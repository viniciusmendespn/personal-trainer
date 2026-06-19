"""Seed de dados simulados (realistas) para demonstrar as funcionalidades do app.

Cria 3 alunos com todos os campos preenchidos, biblioteca de exercícios, treinos/exercícios,
~10 semanas de histórico de sessões (com agregados de volume/PR exatamente como a app real
produziria), avaliações físicas completas (medidas de circunferência + métricas customizadas),
agendamentos, templates de treino, feed global do personal, gamificação (pontos + ranking) e
uma central de notificações/pendências (relato de dor, dúvida e correção).

Reaproveita os módulos reais do backend (app.repositories, app.models, app.services) —
os dados ficam estruturalmente idênticos ao que a API produziria, não uma simulação solta.

Uso:
    cd backend
    python scripts/seed_demo.py --email viniciusmendespn@gmail.com
    python scripts/seed_demo.py --email viniciusmendespn@gmail.com --reset   # limpa seed anterior

Por padrão usa profile "pessoal-hotmail", região "us-east-1", tabela "personal-trainer-prod"
e o User Pool "us-east-1_JzbEnrPkk" — todos configuráveis via flags.
"""
import argparse
import os
import random
import sys
from datetime import datetime, timedelta, timezone

# ── CLI args (antes de qualquer import de app.* — Settings() lê env no import) ──────────
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--email", required=True, help="E-mail do personal (Cognito) a seedar")
parser.add_argument("--profile", default="pessoal-hotmail")
parser.add_argument("--region", default="us-east-1")
parser.add_argument("--table", default="personal-trainer-prod")
parser.add_argument("--user-pool-id", default="us-east-1_JzbEnrPkk")
parser.add_argument("--reset", action="store_true", help="Remove dados simulados anteriores deste personal antes de recriar")
parser.add_argument("--seed", type=int, default=42, help="Seed do RNG (reprodutibilidade)")
args = parser.parse_args()

os.environ["AWS_PROFILE"] = args.profile
os.environ["TABLE_NAME"] = args.table
os.environ["COGNITO_REGION"] = args.region
os.environ["STAGE"] = "prod"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/ no path

import boto3  # noqa: E402

from app.models.agendamento import Agendamento  # noqa: E402
from app.models.aluno import Aluno  # noqa: E402
from app.models.avaliacao import Avaliacao, MetricaCustomizada  # noqa: E402
from app.models.biblioteca import ExLib  # noqa: E402
from app.models.common import CustomFieldDef, CustomFieldsConfig  # noqa: E402
from app.models.enums import (  # noqa: E402
    AgendamentoStatus,
    AlunoStatus,
    Ator,
    CanalOrigem,
    Classificacao,
    CustomFieldType,
)
from app.models.exercicio import Exercicio, SeriePrescrita  # noqa: E402
from app.models.registro import Registro, SerieExec  # noqa: E402
from app.models.template import ExercicioTemplate, TreinoTemplate  # noqa: E402
from app.models.treino import Treino  # noqa: E402
from app.repositories import dynamo_repo as repo  # noqa: E402
from app.repositories import keys  # noqa: E402
from app.services import alerta_service, feed_global_service, notif_service, pontos_service, postagem_service  # noqa: E402
from app.utils import new_id  # noqa: E402

NOW = datetime.now(timezone.utc)
rng = random.Random(args.seed)


# ── Helpers de tempo (equivalentes a app.utils, mas para uma data controlada) ───────────
def epoch_ms_at(dt: datetime) -> str:
    return f"{int(dt.timestamp() * 1000):013d}"


def iso_at(dt: datetime) -> str:
    return dt.isoformat()


def isoweek_at(dt: datetime) -> str:
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


# ── Resolver personal_id pelo e-mail no Cognito ──────────────────────────────────────────
def resolve_personal_id(email: str) -> str:
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    cognito = session.client("cognito-idp")
    resp = cognito.list_users(UserPoolId=args.user_pool_id, Filter=f'email = "{email}"')
    users = resp.get("Users", [])
    if not users:
        raise SystemExit(f"Nenhum usuário Cognito encontrado com e-mail {email}")
    return users[0]["Username"]  # UsernameAttributes=[email] -> Username == sub


PERSONAL_ID = resolve_personal_id(args.email)
print(f"Personal alvo: {args.email} -> personal_id={PERSONAL_ID}")


# ── Reset opcional (escopado a este personal_id) ─────────────────────────────────────────
def reset_demo_data() -> None:
    pk = keys.pk_personal(PERSONAL_ID)
    alunos_ptrs = repo.query_pk(pk, sk_prefix="ALUNO#")
    print(f"  Removendo dados de {len(alunos_ptrs)} aluno(s) anteriores…")
    # Fix: lê telefone do pointer (já disponível) antes de deletar a partição do aluno
    for aluno_ptr in alunos_ptrs:
        aluno_id = aluno_ptr["aluno_id"]
        items = repo.query_pk(keys.pk_aluno(aluno_id))
        repo.batch_write(deletes=[(keys.pk_aluno(aluno_id), i["SK"]) for i in items])
        if aluno_ptr.get("telefone"):
            repo.delete_item(keys.pk_phone(PERSONAL_ID, aluno_ptr["telefone"]), "PHONE")
    pt_items = repo.query_pk(pk)
    # mantém apenas config sensível (WAPI) caso exista — todo o resto é demo
    pt_to_delete = [i for i in pt_items if not i["SK"].startswith("WAPI#")]
    repo.batch_write(deletes=[(pk, i["SK"]) for i in pt_to_delete])
    print(f"  Removidos {len(pt_to_delete)} item(ns) da partição do personal.")


if args.reset:
    print("--reset: limpando dados simulados anteriores…")
    reset_demo_data()


# ── 0) Campos customizados do personal ──────────────────────────────────────────────────
custom_cfg = CustomFieldsConfig(
    aluno=[
        CustomFieldDef(key="nivel_experiencia", label="Nível de experiência",
                       type=CustomFieldType.SELECT,
                       options=["Iniciante", "Intermediário", "Avançado"]),
        CustomFieldDef(key="plano", label="Plano",
                       type=CustomFieldType.SELECT,
                       options=["Basic", "Standard", "Premium"]),
        CustomFieldDef(key="indicado_por", label="Indicado por",
                       type=CustomFieldType.TEXT),
    ],
    treino=[
        CustomFieldDef(key="fase_periodizacao", label="Fase de periodização",
                       type=CustomFieldType.SELECT,
                       options=["Adaptação", "Hipertrofia", "Força", "Manutenção"]),
    ],
    exercicio=[
        CustomFieldDef(key="tecnica_especial", label="Técnica especial",
                       type=CustomFieldType.TEXT),
    ],
)
repo.put_item(keys.pk_personal(PERSONAL_ID), keys.SK_CUSTOM_FIELDS, custom_cfg.model_dump())
print("Campos customizados configurados (aluno, treino, exercício).")


# ── 1) Biblioteca de exercícios ──────────────────────────────────────────────────────────
BIBLIOTECA = [
    ("Supino reto", "Peito", "Cotovelos a 45°, barra até a linha do mamilo."),
    ("Supino inclinado com halteres", "Peito", "Banco a 30°, foco na porção clavicular."),
    ("Crucifixo reto", "Peito", "Amplitude controlada, sem travar o cotovelo."),
    ("Puxada frontal", "Costas", "Pegada pronada, puxar até a linha do queixo."),
    ("Remada curvada", "Costas", "Tronco a 45°, evitar usar o lombar para puxar."),
    ("Remada unilateral", "Costas", "Apoio no banco, cotovelo próximo ao corpo."),
    ("Agachamento livre", "Pernas", "Joelho alinhado com a ponta do pé, quadril para trás."),
    ("Leg press 45°", "Pernas", "Não travar os joelhos no topo do movimento."),
    ("Cadeira extensora", "Pernas", "Movimento controlado, pausa de 1s no topo."),
    ("Mesa flexora", "Pernas", "Evitar elevar o quadril durante a flexão."),
    ("Stiff", "Posterior", "Joelhos semiflexionados, barra próxima às pernas."),
    ("Desenvolvimento com halteres", "Ombro", "Não hiperestender a lombar."),
    ("Elevação lateral", "Ombro", "Subir até a linha do ombro, sem balançar o tronco."),
    ("Rosca direta", "Bíceps", "Cotovelo fixo ao lado do tronco."),
    ("Tríceps corda", "Tríceps", "Abrir levemente a corda no final do movimento."),
    ("Abdominal supra", "Core", "Foco na contração, sem tracionar o pescoço."),
    ("Panturrilha em pé", "Panturrilha", "Amplitude total, pausa no topo."),
]
exlib_by_nome: dict[str, str] = {}
for nome, grupo, rec in BIBLIOTECA:
    exlib_id = new_id()
    ex = ExLib(exlib_id=exlib_id, nome=nome, grupo=grupo,
               video_url=f"https://www.youtube.com/results?search_query={nome.replace(' ', '+')}",
               recomendacoes=rec)
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_exlib(exlib_id), ex.model_dump())
    exlib_by_nome[nome] = exlib_id
print(f"Biblioteca: {len(exlib_by_nome)} exercícios criados.")


# ── 2) Alunos — 3 alunos com todos os campos preenchidos ────────────────────────────────
ALUNOS_DEF = [
    dict(
        nome="Mariana Souza",
        telefone="5511987654321",
        email="mariana.souza@email.com",
        endereco="Rua das Flores, 123 — Vila Madalena, São Paulo/SP",
        data_nascimento="1994-03-15",
        objetivo="Hipertrofia e redução do percentual de gordura",
        descricao="Professora, 30 anos, treina há 2 anos. Foco em emagrecimento saudável.",
        observacoes=(
            "Histórico de dor no joelho direito — evitar agachamentos profundos com alta carga. "
            "Prefere treinos pela manhã. Alérgica a látex (usar faixas de tecido)."
        ),
        status=AlunoStatus.ATIVO,
        custom={"nivel_experiencia": "Intermediário", "plano": "Premium", "indicado_por": "Academia FitLife"},
    ),
    dict(
        nome="Carlos Eduardo Lima",
        telefone="5511976543210",
        email="carlos.lima@empresa.com",
        endereco="Av. Paulista, 1000 — Bela Vista, São Paulo/SP",
        data_nascimento="1989-07-22",
        objetivo="Ganho de massa muscular e melhora do desempenho atlético",
        descricao="Analista de TI, 36 anos, treina há 4 anos. Busca força e hipertrofia.",
        observacoes=(
            "Sedentário por longas horas (trabalho remoto). Histórico de lombalgia leve — "
            "priorizar mobilidade e core. Treina tarde/noite."
        ),
        status=AlunoStatus.ATIVO,
        custom={"nivel_experiencia": "Avançado", "plano": "Standard", "indicado_por": "Internet"},
    ),
    dict(
        nome="Fernanda Oliveira",
        telefone="5511965432109",
        email="fernanda.oliveira@gmail.com",
        endereco="Rua dos Pinheiros, 456 — Pinheiros, São Paulo/SP",
        data_nascimento="1998-11-08",
        objetivo="Condicionamento físico geral e perda de peso",
        descricao="Estudante universitária, 27 anos, iniciante. Muito motivada e disciplinada.",
        observacoes=(
            "Nunca treinou com personal antes. Prefere treinos à tarde, das 15h–17h. "
            "Sem restrições físicas conhecidas."
        ),
        status=AlunoStatus.ATIVO,
        custom={"nivel_experiencia": "Iniciante", "plano": "Basic", "indicado_por": "Amiga (Mariana Souza)"},
    ),
]

TREINO_DEFS = {
    "A": ("Treino A — Superior", "Peito/Ombro/Tríceps",
          ["Supino reto", "Supino inclinado com halteres", "Desenvolvimento com halteres",
           "Elevação lateral", "Tríceps corda", "Abdominal supra"]),
    "B": ("Treino B — Inferior", "Pernas/Posterior",
          ["Agachamento livre", "Leg press 45°", "Cadeira extensora", "Mesa flexora", "Stiff", "Panturrilha em pé"]),
    "C": ("Treino C — Costas/Bíceps", "Costas/Bíceps",
          ["Puxada frontal", "Remada curvada", "Remada unilateral", "Rosca direta", "Abdominal supra"]),
}

REP_RANGE = {"compound": (6, 10), "isolation": (10, 14)}
COMPOUND = {"Supino reto", "Agachamento livre", "Leg press 45°", "Stiff", "Puxada frontal", "Remada curvada"}
BASE_CARGA = {
    "Supino reto": (40, 60), "Supino inclinado com halteres": (14, 20), "Crucifixo reto": (8, 12),
    "Puxada frontal": (35, 55), "Remada curvada": (35, 55), "Remada unilateral": (14, 20),
    "Agachamento livre": (40, 70), "Leg press 45°": (80, 140), "Cadeira extensora": (25, 40),
    "Mesa flexora": (20, 35), "Stiff": (30, 50), "Desenvolvimento com halteres": (10, 16),
    "Elevação lateral": (6, 10), "Rosca direta": (10, 16), "Tríceps corda": (15, 25),
    "Abdominal supra": (0, 0), "Panturrilha em pé": (40, 70),
}

alunos_criados: list[dict] = []
for a in ALUNOS_DEF:
    aluno_id = new_id()
    now = iso_at(NOW)
    aluno = Aluno(
        aluno_id=aluno_id, personal_id=PERSONAL_ID,
        nome=a["nome"], telefone=a["telefone"],
        email=a["email"], endereco=a["endereco"],
        data_nascimento=a["data_nascimento"], objetivo=a["objetivo"],
        descricao=a["descricao"], observacoes=a["observacoes"],
        status=a["status"], custom=a["custom"],
        created_at=now, updated_at=now,
    )
    data = aluno.model_dump()
    repo.put_item_if_absent(keys.pk_phone(PERSONAL_ID, a["telefone"]), "PHONE",
                            {"aluno_id": aluno_id, "nome": a["nome"]})
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, data)
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_aluno_pointer(aluno_id), {
        "aluno_id": aluno_id, "nome": a["nome"], "status": a["status"].value,
        "telefone": a["telefone"], "updated_at": now,
    })
    alunos_criados.append({
        "aluno_id": aluno_id, "nome": a["nome"], "objetivo": a["objetivo"],
        "status": a["status"],
    })
print(f"Alunos: {len(alunos_criados)} criados.")


# ── 3) Treinos + exercícios por aluno ────────────────────────────────────────────────────
data_inicio_programa = (NOW - timedelta(weeks=10)).strftime("%Y-%m-%d")

for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    treinos: dict[str, dict] = {}
    for letra, (nome, foco, exs) in TREINO_DEFS.items():
        treino_id = new_id()
        now = iso_at(NOW)
        # demonstra um treino vencido (TREINO_FIM) só para Carlos, no Treino B
        data_fim = None
        if aluno["nome"] == "Carlos Eduardo Lima" and letra == "B":
            data_fim = (NOW - timedelta(days=1)).strftime("%Y-%m-%d")
        treino = Treino(
            treino_id=treino_id, aluno_id=aluno_id, nome=nome, foco=foco,
            ordem=ord(letra) - ord("A"), data_inicio=data_inicio_programa,
            data_fim=data_fim, created_at=now, updated_at=now,
        )
        repo.put_item(keys.pk_aluno(aluno_id), keys.sk_treino(treino_id), treino.model_dump())
        exercicios = []
        for i, ex_nome in enumerate(exs):
            base_lo, base_hi = BASE_CARGA.get(ex_nome, (10, 20))
            carga0 = round(rng.uniform(base_lo, base_hi), 1) if base_hi else None
            ex_id = new_id()
            kind = "compound" if ex_nome in COMPOUND else "isolation"
            reps_lo, reps_hi = REP_RANGE[kind]
            n_series = 4 if kind == "compound" else 3
            sp = [SeriePrescrita(series=n_series, reps=f"{reps_lo}-{reps_hi}",
                                 carga=str(carga0) if carga0 else None)]
            exercicio = Exercicio(
                exercicio_id=ex_id, treino_id=treino_id, aluno_id=aluno_id, nome=ex_nome, ordem=i,
                series_prescritas=sp,
                video_url=f"https://www.youtube.com/results?search_query={ex_nome.replace(' ', '+')}",
            )
            repo.put_item(keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, ex_id), exercicio.model_dump())
            exercicios.append({
                "exercicio_id": ex_id, "nome": ex_nome, "carga_atual": carga0, "kind": kind,
                "series_prescritas": [s.model_dump() for s in sp],
            })
        treinos[letra] = {"treino_id": treino_id, "nome": nome, "exercicios": exercicios, "data_fim": data_fim}

        if data_fim:
            repo.put_item(keys.pk_sched(data_fim), keys.sk_due(treino_id), {
                "personal_id": PERSONAL_ID, "aluno_id": aluno_id, "treino_id": treino_id,
                "treino_nome": nome, "aluno_nome": aluno["nome"], "data_fim": data_fim, "tipo": "TREINO_FIM",
            })
            notif_service.criar(PERSONAL_ID, "TREINO_FIM", "Treino vencido",
                                f"O treino \"{nome}\" de {aluno['nome']} venceu em {data_fim}.", aluno_id=aluno_id)
    aluno["treinos"] = treinos
print("Treinos e exercícios criados para todos os alunos.")


# ── 4) Histórico de sessões (~10 semanas) com agregados reais ───────────────────────────
def gerar_series(carga: float | None, reps_lo: int, reps_hi: int, n: int) -> list[SerieExec]:
    out = []
    for i in range(n):
        reps = rng.randint(reps_lo, reps_hi) - (1 if i == n - 1 else 0)
        out.append(SerieExec(carga=(str(carga) if carga else None), reps=max(reps, 1), rpe=round(rng.uniform(6.5, 9.5), 1)))
    return out


def registrar_sessao_historica(aluno_id: str, treino: dict, dt: datetime) -> tuple[float, str]:
    """Mirrors sessao_service.finish()+record(): grava histórico + registros + agregados,
    mas com timestamp controlado (dt) em vez de 'agora'."""
    sessao_id = new_id()
    pk = keys.pk_aluno(aluno_id)
    snaps = [{"exercicio_id": e["exercicio_id"], "nome": e["nome"],
              "series_prescritas": e.get("series_prescritas"), "intervalo_s": None} for e in treino["exercicios"]]

    total_volume_sessao = 0.0
    exercicios_exec = []
    canal = rng.choice([CanalOrigem.WHATSAPP, CanalOrigem.PORTAL])
    ator = Ator.ALUNO if canal == CanalOrigem.WHATSAPP else Ator.PERSONAL
    classificacao = Classificacao.AUTO if canal == CanalOrigem.WHATSAPP else Classificacao.MANUAL
    for ex in treino["exercicios"]:
        kind = ex["kind"]
        reps_lo, reps_hi = REP_RANGE[kind]
        n_series = 4 if kind == "compound" else 3
        if ex["carga_atual"]:
            ex["carga_atual"] = round(ex["carga_atual"] * rng.uniform(1.0, 1.04), 1)
        series = gerar_series(ex["carga_atual"], reps_lo, reps_hi, n_series)
        registro = Registro(
            sessao_id=sessao_id, exercicio_id=ex["exercicio_id"], exercicio_nome=ex["nome"], aluno_id=aluno_id,
            series_exec=series, data_hora=iso_at(dt), canal_origem=canal, classificacao=classificacao, ator=ator,
        )
        item = registro.model_dump()
        item["GSI1PK"] = keys.gsi1_registro(aluno_id, ex["exercicio_id"])
        item["GSI1SK"] = keys.gsi1sk_registro(epoch_ms_at(dt))
        repo.put_item(pk, keys.sk_registro(sessao_id, ex["exercicio_id"]), item)
        exercicios_exec.append({
            "exercicio_id": ex["exercicio_id"], "exercicio_nome": ex["nome"],
            "series_exec": [{"carga": s.carga, "reps": s.reps, "rpe": s.rpe} for s in series],
            "series_prescritas": ex.get("series_prescritas"),
        })

        cargas, volume = [], 0.0
        for s in series:
            if s.carga:
                cg = float(s.carga)
                cargas.append(cg)
                volume += cg * (s.reps or 0)
        if volume > 0:
            total_volume_sessao += volume
            repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_volume": volume}, set_={"ultimo_treino": iso_at(dt)})
            repo.add_and_set(pk, keys.sk_stats_week(isoweek_at(dt)), add={"volume": volume}, set_={"semana": isoweek_at(dt)})
        if cargas:
            repo.update_if_greater(pk, keys.sk_stats_pr(ex["exercicio_id"]), "carga", max(cargas),
                                   extra={"exercicio_nome": ex["nome"], "data": iso_at(dt)})

    duracao_s = 50 * 60 + rng.randint(-600, 600)
    hist = {
        "sessao_id": sessao_id, "aluno_id": aluno_id, "personal_id": PERSONAL_ID,
        "treino_id": treino["treino_id"], "treino_nome": treino["nome"], "status": "FINALIZADA",
        "exercicios": snaps, "ex_atual": snaps[-1] if snaps else None, "ordem_atual": len(snaps) - 1,
        "total_ex": len(snaps), "data_hora_inicio": iso_at(dt - timedelta(seconds=duracao_s)),
        "data_hora_fim": iso_at(dt), "duracao_segundos": duracao_s,
        "exercicios_exec": exercicios_exec,
    }
    sk_hist = keys.sk_sessao_hist(epoch_ms_at(dt), sessao_id)
    repo.put_item(pk, sk_hist, hist)
    repo.put_item(pk, keys.sk_sessao_idx(sessao_id), {"sk": sk_hist})
    repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_sessoes": 1}, set_={"ultimo_treino": iso_at(dt)})
    repo.add_and_set(pk, keys.sk_stats_week(isoweek_at(dt)), add={"sessoes": 1}, set_={"semana": isoweek_at(dt)})
    hoje_str = dt.date().isoformat()
    repo.add_and_set(keys.pk_personal(PERSONAL_ID), f"STATS#D#{hoje_str}",
                     add={"sessoes": 1}, set_={"data": hoje_str})
    return total_volume_sessao, sessao_id


last_sessao_id: dict = {}
total_sessoes = 0
sessoes_por_aluno: dict[str, int] = {}
for aluno in alunos_criados:
    rotina = [("A", 0), ("B", 2), ("C", 4)]  # seg/qua/sex
    count = 0
    for semanas_atras in range(10, -1, -1):
        for letra, dia_offset in rotina:
            if rng.random() < 0.18:  # ~18% de faltas — adesão realista
                continue
            dt = NOW - timedelta(weeks=semanas_atras)
            dt = dt - timedelta(days=dt.weekday()) + timedelta(
                days=dia_offset, hours=rng.choice([7, 8, 18, 19]), minutes=rng.randint(0, 59)
            )
            if dt > NOW:
                continue
            vol, sid = registrar_sessao_historica(aluno["aluno_id"], aluno["treinos"][letra], dt)
            total_sessoes += 1
            count += 1
            last_sessao_id[(aluno["aluno_id"], letra)] = sid
    sessoes_por_aluno[aluno["aluno_id"]] = count
print(f"Histórico de sessões: {total_sessoes} sessões registradas (com agregados de volume/PR).")


# ── 5) Avaliações físicas — todos os campos preenchidos ─────────────────────────────────
MEDIDAS_BASE = {
    "cintura":       (70.0, 92.0),
    "quadril":       (88.0, 106.0),
    "braco_direito": (28.0, 36.0),
    "coxa_direita":  (50.0, 62.0),
    "panturrilha":   (34.0, 40.0),
    "abdomen":       (75.0, 96.0),
}
OBSERVACOES_AVAL = [
    "Início do programa. Boa disposição, parâmetros dentro do esperado para o perfil.",
    "Evolução consistente. Redução visível nas circunferências. Manter protocolo.",
    "Melhor resultado até agora. Composição corporal avançando conforme meta.",
    "Revisão de metas: próximo ciclo com foco em resistência e manutenção dos ganhos.",
]

total_avaliacoes = 0
for aluno in alunos_criados:
    peso0 = round(rng.uniform(58, 95), 1)
    gordura0 = round(rng.uniform(14, 30), 1)
    altura = round(rng.uniform(1.55, 1.88), 2) * 100
    obj = aluno["objetivo"].lower()
    tendencia = -1 if ("perda" in obj or "emagr" in obj or "redução" in obj) else (
        1 if "massa" in obj else 0
    )
    medidas0 = {k: round(rng.uniform(lo, hi), 1) for k, (lo, hi) in MEDIDAS_BASE.items()}

    for i, semanas_atras in enumerate([10, 7, 4, 1]):
        dt = NOW - timedelta(weeks=semanas_atras)
        peso = round(peso0 + tendencia * i * rng.uniform(0.4, 1.1), 1)
        gordura = round(max(8.0, gordura0 + tendencia * i * rng.uniform(0.3, 0.8)), 1)

        medidas = {}
        for k, v0 in medidas0.items():
            delta = tendencia * i * rng.uniform(0.2, 0.6)
            medidas[k] = round(max(20.0, v0 + delta), 1)

        imc = round(peso / (altura / 100) ** 2, 1)
        # dobras reduzem com tendência negativa (perda de gordura) ou aumentam com ganho de massa
        tendencia_dobra = -abs(tendencia) if tendencia < 0 else tendencia
        metricas = [
            MetricaCustomizada(nome="IMC", unidade="kg/m²", valor=imc),
            MetricaCustomizada(
                nome="Dobra tricipital", unidade="mm",
                valor=round(max(8.0, rng.uniform(12, 28) + tendencia_dobra * i * 0.5), 1),
            ),
            MetricaCustomizada(
                nome="Dobra abdominal", unidade="mm",
                valor=round(max(8.0, rng.uniform(15, 35) + tendencia_dobra * i * 0.8), 1),
            ),
        ]

        av = Avaliacao(
            avaliacao_id=new_id(), aluno_id=aluno["aluno_id"],
            data=dt.strftime("%Y-%m-%d"),
            peso=peso, altura_cm=altura, percentual_gordura=gordura,
            medidas=medidas, metricas=metricas,
            observacoes=OBSERVACOES_AVAL[i],
            created_at=iso_at(dt),
        )
        repo.put_item(
            keys.pk_aluno(aluno["aluno_id"]),
            keys.sk_avaliacao(epoch_ms_at(dt), av.avaliacao_id),
            av.model_dump(),
        )
        total_avaliacoes += 1
print(f"Avaliações físicas: {total_avaliacoes} criadas (com medidas, métricas e observações).")


# ── 6) Agendamentos ──────────────────────────────────────────────────────────────────────
total_agendamentos = 0
horarios = [7, 8, 9, 17, 18, 19]
OBSERVACOES_AG = [
    "Sessão de treino presencial — foco em técnica de execução.",
    "Avaliação funcional + treino moderado.",
    "Treino de alta intensidade + revisão de cargas.",
]
for i, aluno in enumerate(alunos_criados):
    for offset_dias, status in [
        (-2, AgendamentoStatus.CONCLUIDO),
        (i % 5, AgendamentoStatus.CONFIRMADO if i % 2 else AgendamentoStatus.AGENDADO),
    ]:
        dt = (NOW + timedelta(days=offset_dias)).replace(
            hour=horarios[i % len(horarios)], minute=0, second=0, microsecond=0
        )
        ag = Agendamento(
            agendamento_id=new_id(), personal_id=PERSONAL_ID, aluno_id=aluno["aluno_id"],
            data_hora_inicio=iso_at(dt), duracao_min=60,
            observacao=OBSERVACOES_AG[i % len(OBSERVACOES_AG)],
            status=status, created_at=iso_at(NOW),
        )
        repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_agenda(ag.data_hora_inicio, ag.agendamento_id), ag.model_dump())
        total_agendamentos += 1

# 1 cancelado de exemplo (Mariana, daqui 3 dias)
aluno_ex = alunos_criados[0]
dt = (NOW + timedelta(days=3)).replace(hour=16, minute=0, second=0, microsecond=0)
ag = Agendamento(
    agendamento_id=new_id(), personal_id=PERSONAL_ID, aluno_id=aluno_ex["aluno_id"],
    data_hora_inicio=iso_at(dt), duracao_min=60,
    observacao="Remarcar — aluno avisou que não pode comparecer.",
    status=AgendamentoStatus.CANCELADO, created_at=iso_at(NOW),
)
repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_agenda(ag.data_hora_inicio, ag.agendamento_id), ag.model_dump())
total_agendamentos += 1
print(f"Agendamentos: {total_agendamentos} criados.")


# ── 7) Templates de treino reutilizáveis ─────────────────────────────────────────────────
TEMPLATES_DEF = [
    ("Treino A — Superior (padrão)", "Peito/Ombro/Tríceps", TREINO_DEFS["A"][2]),
    ("Full Body — Iniciante", "Corpo inteiro", ["Agachamento livre", "Supino reto", "Puxada frontal", "Abdominal supra"]),
]
for nome, foco, exs in TEMPLATES_DEF:
    exercicios_tpl = [
        ExercicioTemplate(nome=ex_nome, ordem=i,
                          series_prescritas=[SeriePrescrita(series=3, reps="8-12")])
        for i, ex_nome in enumerate(exs)
    ]
    tpl = TreinoTemplate(template_id=new_id(), personal_id=PERSONAL_ID, nome=nome, foco=foco,
                         exercicios=exercicios_tpl, created_at=iso_at(NOW))
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_template(tpl.template_id), tpl.model_dump())
print(f"Templates de treino: {len(TEMPLATES_DEF)} criados.")


# ── 8) Feed global do personal ──────────────────────────────────────────────────────────
POSTS_GLOBAIS = [
    ("DICA", -3,
     "Dica da semana: o descanso é tão importante quanto o treino. "
     "Garanta 7–8h de sono por noite para maximizar a recuperação muscular e os ganhos de força."),
    ("MOTIVACAO", -2,
     "Parabéns a todos que completaram a semana inteira de treinos! "
     "Consistência é o que separa quem sonha de quem conquista. Continuem assim!"),
    ("ARTIGO", -1,
     "Periodização: por que variar o volume e a intensidade a cada ciclo? "
     "A ciência mostra que alterar os estímulos a cada 4–6 semanas previne a adaptação, "
     "evita o platô e acelera os resultados a longo prazo."),
    ("AVISO", 0,
     "Aviso: a academia estará fechada no feriado de 20/06. "
     "Para quem quiser manter a rotina em casa, enviarei um treino alternativo com peso corporal até amanhã."),
]
for tipo, dias_offset, texto in POSTS_GLOBAIS:
    post_id = new_id()
    ts = iso_at(NOW + timedelta(days=dias_offset))
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_feed_global(ts, post_id), {
        "post_id": post_id, "personal_id": PERSONAL_ID,
        "tipo": tipo, "texto": texto, "midias": [], "total_curtidas": 0, "data_hora": ts,
    })
print(f"Feed global: {len(POSTS_GLOBAIS)} posts criados (DICA, MOTIVACAO, ARTIGO, AVISO).")


# ── 9) Postagens demo no feed dos exercícios ────────────────────────────────────────────
mariana = next(a for a in alunos_criados if a["nome"] == "Mariana Souza")
carlos = next(a for a in alunos_criados if a["nome"] == "Carlos Eduardo Lima")
fernanda = next(a for a in alunos_criados if a["nome"] == "Fernanda Oliveira")

ex_agachamento = next(e for e in mariana["treinos"]["B"]["exercicios"] if e["nome"] == "Agachamento livre")
ex_puxada = next(e for e in carlos["treinos"]["C"]["exercicios"] if e["nome"] == "Puxada frontal")
ex_supino = next(e for e in mariana["treinos"]["A"]["exercicios"] if e["nome"] == "Supino reto")
ex_leg = next(e for e in fernanda["treinos"]["B"]["exercicios"] if e["nome"] == "Leg press 45°")

mariana_sessao_b = last_sessao_id.get((mariana["aluno_id"], "B"))
carlos_sessao_c = last_sessao_id.get((carlos["aluno_id"], "C"))
fernanda_sessao_b = last_sessao_id.get((fernanda["aluno_id"], "B"))

# DOR: Mariana no agachamento — aguarda resposta
postagem_service.criar_postagem(
    aluno_id=mariana["aluno_id"], exercicio_id=ex_agachamento["exercicio_id"],
    exercicio_nome=ex_agachamento["nome"], tipo="DOR",
    descricao="Senti uma dor incômoda no joelho direito durante a última série. Não foi aguda, mas persistiu por algumas horas.",
    midias=[], sessao_id=mariana_sessao_b, ator="ALUNO", personal_id=PERSONAL_ID,
)
# Personal responde na thread da dor de Mariana
dor_posts = repo.query_pk(keys.pk_aluno(mariana["aluno_id"]), sk_prefix=f"POST#{ex_agachamento['exercicio_id']}#")
if dor_posts:
    alerta_service.adicionar_comentario(
        mariana["aluno_id"], dor_posts[0]["SK"], "PERSONAL",
        "Dor típica de sobrecarga no joelho. Vamos reduzir 10% da carga e reforçar a ativação do glúteo antes de cada série. Avise se persistir.",
    )

# DUVIDA: Carlos sobre pegada na puxada — aberta
postagem_service.criar_postagem(
    aluno_id=carlos["aluno_id"], exercicio_id=ex_puxada["exercicio_id"],
    exercicio_nome=ex_puxada["nome"], tipo="DUVIDA",
    descricao="Qual a pegada correta para ativar mais o dorsal — pronada aberta ou supinada fechada?",
    midias=[], sessao_id=carlos_sessao_c, ator="ALUNO", personal_id=PERSONAL_ID,
)

# CORRECAO: Personal corrige postura do agachamento de Mariana
postagem_service.criar_postagem(
    aluno_id=mariana["aluno_id"], exercicio_id=ex_agachamento["exercicio_id"],
    exercicio_nome=ex_agachamento["nome"], tipo="CORRECAO",
    descricao=(
        "Percebi que os joelhos estão entrando para dentro na fase excêntrica. "
        "Ative o glúteo e empurre os joelhos para fora, alinhando com o 2º dedo do pé "
        "durante toda a amplitude do movimento. Reduza a carga em 10% até corrigir."
    ),
    midias=[], sessao_id=None, ator="PERSONAL", personal_id=PERSONAL_ID,
)

# EXECUCAO: Mariana registra PR no supino
postagem_service.criar_postagem(
    aluno_id=mariana["aluno_id"], exercicio_id=ex_supino["exercicio_id"],
    exercicio_nome=ex_supino["nome"], tipo="EXECUCAO",
    descricao="Novo recorde! Consegui fazer 4 séries de 8 reps com 52kg hoje sem dor. Evoluindo muito!",
    midias=[], sessao_id=None, ator="ALUNO", personal_id=PERSONAL_ID,
)

# DUVIDA: Fernanda sobre o leg press — aberta
postagem_service.criar_postagem(
    aluno_id=fernanda["aluno_id"], exercicio_id=ex_leg["exercicio_id"],
    exercicio_nome=ex_leg["nome"], tipo="DUVIDA",
    descricao="Posso fazer o leg press com os pés mais altos na plataforma para focar mais no glúteo?",
    midias=[], sessao_id=fernanda_sessao_b, ator="ALUNO", personal_id=PERSONAL_ID,
)

notif_service.criar(
    PERSONAL_ID, "FEEDBACK", "Feedback do aluno",
    "Achei o treino desta semana mais desafiador, mas consegui finalizar tudo!",
    aluno_id=fernanda["aluno_id"],
)
print("Postagens demo criadas: DOR+resposta (Mariana), CORRECAO (Mariana), DUVIDA aberta (Carlos), EXECUCAO PR (Mariana), DUVIDA (Fernanda).")


# ── 10) Gamificação — Pontos e Ranking ──────────────────────────────────────────────────
for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    n_sessoes = sessoes_por_aluno.get(aluno_id, 0)
    # Pontos por sessões realizadas
    for _ in range(n_sessoes):
        pontos_service.award(aluno_id, "SESSAO", PERSONAL_ID, descricao="Sessão concluída (seed)")
    # Bônus de sessão completa (metade das sessões com 100% de exercícios)
    for _ in range(n_sessoes // 2):
        pontos_service.award(aluno_id, "SESSAO_COMPLETA_BONUS", PERSONAL_ID, descricao="Treino 100% completo (seed)")
    # Pontos por postagens
    pontos_service.award(aluno_id, "POST", PERSONAL_ID, descricao="Postagem no feed (seed)")
    # Pontos por PR
    pontos_service.award(aluno_id, "PR", PERSONAL_ID, descricao="Recorde pessoal batido (seed)")
print("Gamificação: pontos e ranking inicializados para todos os alunos.")


# ── Resumo final ──────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SEED CONCLUÍDO")
print("=" * 60)
print(f"Personal:          {args.email} ({PERSONAL_ID})")
print(f"Alunos:            {len(alunos_criados)} (todos ativos, perfis completos)")
print(f"Biblioteca:        {len(exlib_by_nome)} exercícios")
print(f"Sessões:           {total_sessoes} (~10 semanas, com volume, PRs e exercicios_exec)")
print(f"Avaliações:        {total_avaliacoes} (com medidas, métricas customizadas e observações)")
print(f"Agendamentos:      {total_agendamentos}")
print(f"Templates:         {len(TEMPLATES_DEF)}")
print(f"Posts globais:     {len(POSTS_GLOBAIS)} (DICA, MOTIVACAO, ARTIGO, AVISO)")
print("Posts de alunos:   DOR+resposta (Mariana), CORRECAO (Mariana), DUVIDA (Carlos), EXECUCAO (Mariana), DUVIDA (Fernanda)")
print("Gamificação:       pontos e ranking criados para os 3 alunos")
print("Campos custom:     3 campos de aluno, 1 de treino, 1 de exercício")
print("\nFaça login no portal e explore: Dashboard, Alunos, Agenda, Templates, Biblioteca, Feed Global e Central (sino).")
