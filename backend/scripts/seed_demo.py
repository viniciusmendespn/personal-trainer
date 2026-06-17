"""Seed de dados simulados (realistas) para demonstrar as funcionalidades do app.

Cria alunos, biblioteca de exercícios, treinos/exercícios, ~10 semanas de histórico de
sessões (com agregados de volume/PR exatamente como a app real produziria), avaliações
físicas, agendamentos, templates de treino e uma central de notificações/pendências
povoada (incluindo um relato de dor e uma mídia pendente vinculável).

Reaproveita os módulos reais do backend (app.repositories, app.models, app.services) —
os dados ficam estruturalmente idênticos ao que a API produziria, não uma simulação solta.

Uso:
    cd backend
    python scripts/seed_demo.py --email viniciusmendespn@gmail.com
    python scripts/seed_demo.py --email viniciusmendespn@gmail.com --reset   # limpa o seed anterior antes

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
from app.models.avaliacao import Avaliacao  # noqa: E402
from app.models.biblioteca import ExLib  # noqa: E402
from app.models.enums import AgendamentoStatus, AlunoStatus, Ator, CanalOrigem, Classificacao  # noqa: E402
from app.models.exercicio import Exercicio, SeriePrescrita  # noqa: E402
from app.models.registro import Registro, SerieExec  # noqa: E402
from app.models.template import ExercicioTemplate, TreinoTemplate  # noqa: E402
from app.models.treino import Treino  # noqa: E402
from app.repositories import dynamo_repo as repo  # noqa: E402
from app.repositories import keys  # noqa: E402
from app.services import alerta_service, correcao_service, notif_service  # noqa: E402
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
    aluno_ids = [a["aluno_id"] for a in alunos_ptrs]
    print(f"  Removendo dados de {len(aluno_ids)} aluno(s) anteriores…")
    for aluno_id in aluno_ids:
        items = repo.query_pk(keys.pk_aluno(aluno_id))
        repo.batch_write(deletes=[(keys.pk_aluno(aluno_id), i["SK"]) for i in items])
        aluno = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE)
        if aluno and aluno.get("telefone"):
            repo.delete_item(keys.pk_phone(PERSONAL_ID, aluno["telefone"]), "PHONE")
    pt_items = repo.query_pk(pk)
    # mantém apenas config sensível (WAPI) caso exista — todo o resto é demo
    pt_to_delete = [i for i in pt_items if not i["SK"].startswith("WAPI#")]
    repo.batch_write(deletes=[(pk, i["SK"]) for i in pt_to_delete])
    print(f"  Removidos {len(pt_to_delete)} item(ns) da partição do personal.")


if args.reset:
    print("--reset: limpando dados simulados anteriores…")
    reset_demo_data()


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


# ── 2) Alunos ─────────────────────────────────────────────────────────────────────────
ALUNOS_DEF = [
    ("Mariana Souza", "5511987654321", "Hipertrofia e perda de gordura", AlunoStatus.ATIVO),
    ("Carlos Eduardo Lima", "5511976543210", "Ganho de massa muscular", AlunoStatus.ATIVO),
    ("Fernanda Oliveira", "5511965432109", "Condicionamento físico geral", AlunoStatus.ATIVO),
    ("Rafael Santos", "5511954321098", "Preparação para corrida de rua", AlunoStatus.ATIVO),
    ("Juliana Costa", "5511943210987", "Tonificação e postura", AlunoStatus.ATIVO),
    ("Bruno Almeida", "5511932109876", "Reabilitação pós-lesão no ombro", AlunoStatus.ATIVO),
    ("Patrícia Mendes", "5511921098765", "Emagrecimento", AlunoStatus.INATIVO),
    ("Thiago Ferreira", "5511910987654", "Performance esportiva (futebol)", AlunoStatus.ATIVO),
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
for nome, telefone, objetivo, status in ALUNOS_DEF:
    aluno_id = new_id()
    now = iso_at(NOW)
    aluno = Aluno(aluno_id=aluno_id, personal_id=PERSONAL_ID, nome=nome, telefone=telefone,
                  objetivo=objetivo, status=status, created_at=now, updated_at=now)
    data = aluno.model_dump()
    repo.put_item_if_absent(keys.pk_phone(PERSONAL_ID, telefone), "PHONE", {"aluno_id": aluno_id, "nome": nome})
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, data)
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_aluno_pointer(aluno_id), {
        "aluno_id": aluno_id, "nome": nome, "status": status.value, "telefone": telefone, "updated_at": now,
    })
    alunos_criados.append({"aluno_id": aluno_id, "nome": nome, "objetivo": objetivo, "status": status})
print(f"Alunos: {len(alunos_criados)} criados.")


# ── 3) Treinos + exercícios por aluno ────────────────────────────────────────────────────
data_inicio_programa = (NOW - timedelta(weeks=10)).strftime("%Y-%m-%d")

for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    treinos: dict[str, dict] = {}
    for letra, (nome, foco, exs) in TREINO_DEFS.items():
        treino_id = new_id()
        now = iso_at(NOW)
        # demonstra um treino vencido (TREINO_FIM) só para o 2º aluno (Carlos), no Treino B
        data_fim = None
        if aluno["nome"] == "Carlos Eduardo Lima" and letra == "B":
            data_fim = (NOW - timedelta(days=1)).strftime("%Y-%m-%d")
        treino = Treino(treino_id=treino_id, aluno_id=aluno_id, nome=nome, foco=foco, ordem=ord(letra) - ord("A"),
                         data_inicio=data_inicio_programa, data_fim=data_fim, created_at=now, updated_at=now)
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
            exercicios.append({"exercicio_id": ex_id, "nome": ex_nome, "carga_atual": carga0, "kind": kind,
                               "series_prescritas": [s.model_dump() for s in sp]})
        treinos[letra] = {"treino_id": treino_id, "nome": nome, "exercicios": exercicios, "data_fim": data_fim}

        if data_fim:
            # mantém o sistema coerente: agenda global de vencimento (lida pelo scheduler) + notificação já gerada
            repo.put_item(keys.PK_SCHED, keys.sk_due(data_fim, treino_id), {
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
        reps = rng.randint(reps_lo, reps_hi) - (1 if i == n - 1 else 0)  # última série com mais fadiga
        out.append(SerieExec(carga=(str(carga) if carga else None), reps=max(reps, 1), rpe=round(rng.uniform(6.5, 9.5), 1)))
    return out


def registrar_sessao_historica(aluno_id: str, treino: dict, dt: datetime) -> float:
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
        # progressão de carga leve a cada sessão (com pequena variação) — só p/ exercícios com carga
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

    duracao_s = 50 * 60 + rng.randint(-600, 600)  # ~50min com variação
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
for aluno in alunos_criados:
    if aluno["status"] != AlunoStatus.ATIVO and aluno["nome"] != "Patrícia Mendes":
        continue
    inativa = aluno["nome"] == "Patrícia Mendes"
    semanas_range = range(10, 4, -1) if inativa else range(10, -1, -1)  # parou há ~4 semanas
    rotina = [("A", 0), ("B", 2), ("C", 4)]  # seg/qua/sex
    for semanas_atras in semanas_range:
        for letra, dia_offset in rotina:
            if rng.random() < 0.18:  # ~18% de faltas — adesão realista, não 100%
                continue
            dt = NOW - timedelta(weeks=semanas_atras)
            dt = dt - timedelta(days=dt.weekday()) + timedelta(days=dia_offset, hours=rng.choice([7, 8, 18, 19]), minutes=rng.randint(0, 59))
            if dt > NOW:
                continue
            vol, sid = registrar_sessao_historica(aluno["aluno_id"], aluno["treinos"][letra], dt)
            total_sessoes += 1
            last_sessao_id[(aluno["aluno_id"], letra)] = sid
print(f"Histórico de sessões: {total_sessoes} sessões registradas (com agregados de volume/PR).")


# ── 5) Avaliações físicas ────────────────────────────────────────────────────────────────
total_avaliacoes = 0
for aluno in alunos_criados:
    peso0 = round(rng.uniform(58, 95), 1)
    gordura0 = round(rng.uniform(14, 30), 1)
    altura = round(rng.uniform(1.55, 1.88), 2) * 100
    tendencia = -1 if "perda" in aluno["objetivo"].lower() or "emagrec" in aluno["objetivo"].lower() else (
        1 if "massa" in aluno["objetivo"].lower() else 0)
    for i, semanas_atras in enumerate([10, 7, 4, 1]):
        dt = NOW - timedelta(weeks=semanas_atras)
        peso = round(peso0 + tendencia * i * rng.uniform(0.4, 1.1), 1)
        gordura = round(max(8.0, gordura0 + tendencia * i * rng.uniform(0.3, 0.8)), 1)
        av = Avaliacao(avaliacao_id=new_id(), aluno_id=aluno["aluno_id"], data=dt.strftime("%Y-%m-%d"),
                       peso=peso, altura_cm=altura, percentual_gordura=gordura, created_at=iso_at(dt))
        repo.put_item(keys.pk_aluno(aluno["aluno_id"]), keys.sk_avaliacao(epoch_ms_at(dt), av.avaliacao_id), av.model_dump())
        total_avaliacoes += 1
print(f"Avaliações físicas: {total_avaliacoes} criadas.")


# ── 6) Agendamentos ──────────────────────────────────────────────────────────────────────
total_agendamentos = 0
horarios = [7, 8, 9, 17, 18, 19]
for i, aluno in enumerate(a for a in alunos_criados if a["status"] == AlunoStatus.ATIVO):
    # 1 no passado (concluído), 1 hoje/próximos dias, 1 cancelado
    for offset_dias, status in [(-2, AgendamentoStatus.CONCLUIDO), (i % 5, AgendamentoStatus.CONFIRMADO if i % 2 else AgendamentoStatus.AGENDADO)]:
        dt = (NOW + timedelta(days=offset_dias)).replace(hour=horarios[i % len(horarios)], minute=0, second=0, microsecond=0)
        ag = Agendamento(agendamento_id=new_id(), personal_id=PERSONAL_ID, aluno_id=aluno["aluno_id"],
                         data_hora_inicio=iso_at(dt), duracao_min=60, observacao="Sessão de treino presencial",
                         status=status, created_at=iso_at(NOW))
        repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_agenda(ag.data_hora_inicio, ag.agendamento_id), ag.model_dump())
        total_agendamentos += 1
# 1 cancelado, de exemplo
aluno_ex = alunos_criados[0]
dt = (NOW + timedelta(days=3)).replace(hour=16, minute=0, second=0, microsecond=0)
ag = Agendamento(agendamento_id=new_id(), personal_id=PERSONAL_ID, aluno_id=aluno_ex["aluno_id"],
                 data_hora_inicio=iso_at(dt), duracao_min=60, observacao="Remarcar — aluno avisou que não pode",
                 status=AgendamentoStatus.CANCELADO, created_at=iso_at(NOW))
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


# ── 8) Relatos, respostas e correções demo ───────────────────────────────────────────────
mariana = next(a for a in alunos_criados if a["nome"] == "Mariana Souza")
carlos = next(a for a in alunos_criados if a["nome"] == "Carlos Eduardo Lima")
ex_agachamento = next(e for e in mariana["treinos"]["B"]["exercicios"] if e["nome"] == "Agachamento livre")
ex_puxada = next(e for e in carlos["treinos"]["C"]["exercicios"] if e["nome"] == "Puxada frontal")

# DOR vinculada à última sessão B de Mariana
mariana_sessao_b = last_sessao_id.get((mariana["aluno_id"], "B"))
alerta_service.registrar_dor(
    PERSONAL_ID, mariana["aluno_id"],
    "Senti uma dor incômoda no joelho direito durante a última série.",
    exercicio_id=ex_agachamento["exercicio_id"], exercicio_nome=ex_agachamento["nome"],
    sessao_id=mariana_sessao_b,
)
# Personal responde à dor (demonstra o loop completo de resposta)
dor_items = repo.query_pk(keys.pk_aluno(mariana["aluno_id"]), sk_prefix=f"DOR#{ex_agachamento['exercicio_id']}#")
if dor_items:
    alerta_service.responder_relato(
        mariana["aluno_id"], dor_items[0]["SK"],
        "Dor típica de sobrecarga no joelho. Vamos reduzir 10% da carga e reforçar a ativação do glúteo antes de cada série.",
        PERSONAL_ID,
    )

# DÚVIDA não respondida de Carlos (puxada frontal — fica aberta para demo)
carlos_sessao_c = last_sessao_id.get((carlos["aluno_id"], "C"))
alerta_service.registrar_duvida(
    PERSONAL_ID, carlos["aluno_id"],
    "Qual a pegada correta para ativar mais o dorsal — pronada ou supinada?",
    exercicio_id=ex_puxada["exercicio_id"], exercicio_nome=ex_puxada["nome"],
    sessao_id=carlos_sessao_c,
)

# CORREÇÃO do personal para Mariana (agachamento) — aparece no feed do exercício e notifica a aluna
correcao_service.criar_correcao(
    PERSONAL_ID, mariana["aluno_id"],
    ex_agachamento["exercicio_id"], ex_agachamento["nome"],
    "Percebi que os joelhos estão entrando para dentro na fase excêntrica. Ative o glúteo e empurre os joelhos para fora, alinhando com o 2º dedo do pé durante toda a amplitude do movimento.",
    midias=[],
)

bruno = next(a for a in alunos_criados if a["nome"] == "Bruno Almeida")
midia_id = new_id()
repo.put_item(keys.pk_aluno(bruno["aluno_id"]), f"MIDIA#NA#{midia_id}", {
    "midia_id": midia_id, "tipo": "video_execucao",
    "s3_key": f"midia/{bruno['aluno_id']}/{midia_id}.mp4",
    "exercicio_id": None, "exercicio_nome": None, "status": "PENDENTE", "data_hora": iso_at(NOW),
})
notif_service.criar(
    PERSONAL_ID, "MIDIA_PENDENTE", "Mídia sem exercício",
    "Mídia recebida sem exercício vinculado",
    aluno_id=bruno["aluno_id"],
    ref_extra={"midia_id": midia_id, "s3_key": f"midia/{bruno['aluno_id']}/{midia_id}.mp4"},
)

fernanda = next(a for a in alunos_criados if a["nome"] == "Fernanda Oliveira")
notif_service.criar(
    PERSONAL_ID, "FEEDBACK", "Feedback do aluno",
    "Achei o treino meio pesado essa semana",
    aluno_id=fernanda["aluno_id"],
)

# ── 8b) Mídias de execução e correção vinculadas a exercícios (demo) ─────────────────────
TIPOS_EXECUCAO = ["foto_exercicio", "video_execucao"]
TIPOS_CORRECAO = ["foto_correcao", "video_correcao"]

def seed_midias_aluno(aluno: dict, treino_letra: str) -> int:
    """Cria mídias de execução (ator ALUNO) + uma correção do personal para os primeiros exercícios."""
    aluno_id = aluno["aluno_id"]
    treino = aluno["treinos"][treino_letra]
    total = 0
    for i, ex in enumerate(treino["exercicios"][:3]):  # apenas os 3 primeiros exercícios
        ex_id = ex["exercicio_id"]
        ex_nome = ex["nome"]
        # execução enviada pelo aluno
        tipo_ex = TIPOS_EXECUCAO[i % 2]
        ext = "mp4" if "video" in tipo_ex else "jpg"
        midia_id = new_id()
        dt_midia = NOW - timedelta(days=rng.randint(1, 14))
        repo.put_item(keys.pk_aluno(aluno_id), f"MIDIA#{ex_id}#{midia_id}", {
            "midia_id": midia_id, "tipo": tipo_ex,
            "s3_key": f"demo/{aluno_id}/{ex_id}/{midia_id}.{ext}",
            "exercicio_id": ex_id, "exercicio_nome": ex_nome,
            "status": "VINCULADA", "data_hora": iso_at(dt_midia), "ator": "ALUNO",
        })
        total += 1
        # correção enviada pelo personal (apenas para o 1º exercício)
        if i == 0:
            tipo_cor = TIPOS_CORRECAO[0]
            corr_id = new_id()
            repo.put_item(keys.pk_aluno(aluno_id), f"MIDIA#{ex_id}#{corr_id}", {
                "midia_id": corr_id, "tipo": tipo_cor,
                "s3_key": f"demo/{aluno_id}/{ex_id}/{corr_id}.jpg",
                "exercicio_id": ex_id, "exercicio_nome": ex_nome,
                "status": "VINCULADA", "data_hora": iso_at(NOW - timedelta(hours=2)), "ator": "PERSONAL",
            })
            total += 1
    return total

total_midias = 0
# Mariana (aluna ativa) — treino A (superior)
total_midias += seed_midias_aluno(alunos_criados[0], "A")
# Carlos — treino C (costas/bíceps)
total_midias += seed_midias_aluno(alunos_criados[1], "C")
# Thiago — treino B (inferior)
total_midias += seed_midias_aluno(alunos_criados[7], "B")
print(f"Mídias demo: {total_midias} registros criados (S3 keys fictícios — upload real via app).")

# notificações extras (já lidas) para dar histórico à Central
thiago = next(a for a in alunos_criados if a["nome"] == "Thiago Ferreira")
nid = notif_service.criar(PERSONAL_ID, "FEEDBACK", "Feedback antigo (exemplo)",
                          f"Histórico antigo de {thiago['nome']} — apenas para exemplo de notificação lida.",
                          aluno_id=thiago["aluno_id"])
# marca como lida diretamente (SK previsível, pois notif_service.criar usa epoch 'agora')
notifs = repo.query_pk_last_n(keys.pk_personal(PERSONAL_ID), keys.NOTIF_PREFIX, 5)
for n in notifs:
    if n.get("notif_id") == nid:
        repo.update_item_if_exists(keys.pk_personal(PERSONAL_ID), n["SK"], {"lida": True})
        break

print("Relatos: DOR Mariana (respondida), DUVIDA Carlos (aberta), CORRECAO Mariana (agachamento).")


# ── Resumo final ──────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SEED CONCLUÍDO")
print("=" * 60)
print(f"Personal:        {args.email} ({PERSONAL_ID})")
print(f"Alunos:          {len(alunos_criados)} (1 inativo: Patrícia Mendes)")
print(f"Biblioteca:      {len(exlib_by_nome)} exercícios")
print(f"Sessões:         {total_sessoes} (histórico de ~10 semanas, com exercicios_exec, duração, PRs e volume semanal)")
print(f"Avaliações:      {total_avaliacoes}")
print(f"Agendamentos:    {total_agendamentos}")
print(f"Templates:       {len(TEMPLATES_DEF)}")
print(f"Mídias demo:     {total_midias} (Mariana/Carlos/Thiago — S3 keys fictícios, URLs quebradas mas itens visíveis)")
print("Pendências:      DOR respondida (Mariana/agachamento), DUVIDA aberta (Carlos/puxada frontal), CORRECAO (Mariana), MIDIA_PENDENTE (Bruno), FEEDBACK (Fernanda)")
print("\nFaça login no portal e explore Dashboard, Alunos, Agenda, Templates, Biblioteca e a Central (sino).")
print("Aba Histórico: disponível no app do aluno e na página de detalhes do aluno (personal).")
print("Reordenacao de treinos: use os botoes ^ / v na pagina de detalhe do aluno para ordenar a sequencia de treinos.")
