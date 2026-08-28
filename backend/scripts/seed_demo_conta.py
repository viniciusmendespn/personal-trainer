r"""Seed de uma CONTA DE DEMONSTRAÇÃO completa (demo@coachpilot.com.br).

Diferente de `seed_demo.py` (que seeda uma conta já existente), este script provisiona a
conta demo do zero e a deixa pronta para demonstrar TODAS as funcionalidades da ferramenta:

  0. Cria o usuário no Cognito (email + senha permanente, e-mail já verificado).
  1. Concede 1 ANO de plano Gestão Pro (grátis, via concessão de admin) — alunos ilimitados.
  2. Perfil público do personal (bio, formação, redes, slug /@demo).
  3. Campos customizados, template de anamnese, biblioteca de exercícios.
  4. 5 alunos com perfis completos, anamnese respondida e link de acesso ao app.
  5. Treinos A/B/C por aluno + ~12 semanas de histórico de sessões com progressão real
     (volume, PRs, agregados por grupo muscular, streak, badges, gamificação).
  6. Avaliações físicas com evolução, metas (concluídas/em andamento/propostas), férias.
  7. Agenda (passado/futuro), templates, feed global, postagens (dor/dúvida/correção/PR).
  8. Financeiro: config de cobrança, mensalidades pagas (histórico), pendentes e vencida.
  9. Central de notificações do personal populada.

Reaproveita os módulos reais do backend (app.repositories, app.models, app.services) — os
dados ficam estruturalmente idênticos ao que a API produziria.

Todas as datas são geradas **relativas ao momento da execução** — rodar de novo com `--reset`
"envelhece zero": o histórico, a agenda, o financeiro e os treinos vencidos voltam a ficar
colados na data de hoje. É esse o jeito de atualizar a demo (ver `atualizar_demo.ps1`).

Uso:
    cd backend
    python scripts/seed_demo_conta.py                 # cria conta + seed completo
    python scripts/seed_demo_conta.py --reset          # limpa dados demo anteriores e recria
    python scripts/seed_demo_conta.py --no-cognito     # não mexe no Cognito (conta já existe)

    .\scripts\atualizar_demo.ps1                       # atalho: --reset já embutido

Defaults: profile "pessoal-hotmail", região "us-east-1", tabela "personal-trainer-prod",
User Pool "us-east-1_JzbEnrPkk". Todos configuráveis via flags.
"""
import argparse
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone

# Console do Windows costuma ser cp1252 — força UTF-8 para não quebrar em acentos/setas no resumo.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

# ── CLI args (antes de qualquer import de app.* — Settings() lê env no import) ──────────
parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("--email", default="demo@coachpilot.com.br", help="E-mail da conta demo")
parser.add_argument("--senha", default="Demo@123", help="Senha permanente da conta demo")
parser.add_argument("--nome", default="Studio Demonstração", help="Nome do personal (Cognito + perfil)")
parser.add_argument("--slug", default="demo", help="Slug público (/@slug)")
parser.add_argument("--plano-dias", type=int, default=365, help="Dias de Gestão Pro concedidos")
parser.add_argument("--profile", default="pessoal-hotmail")
parser.add_argument("--region", default="us-east-1")
parser.add_argument("--table", default="personal-trainer-prod")
parser.add_argument("--user-pool-id", default="us-east-1_JzbEnrPkk")
parser.add_argument("--no-cognito", action="store_true", help="Pula criação/ajuste do usuário Cognito")
parser.add_argument("--reset", action="store_true", help="Remove dados demo anteriores antes de recriar")
parser.add_argument("--semanas", type=int, default=12, help="Semanas de histórico de treino")
parser.add_argument("--seed", type=int, default=2026, help="Seed do RNG (reprodutibilidade)")
args = parser.parse_args()

os.environ["AWS_PROFILE"] = args.profile
os.environ["TABLE_NAME"] = args.table
os.environ["COGNITO_REGION"] = args.region
os.environ["STAGE"] = "prod"
# Só afeta o link impresso no resumo (aluno_auth.token_link) — sem isso cairia no domínio do portal.
os.environ.setdefault("ALUNO_FRONTEND_URL", "https://app.coachpilot.com.br")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/ no path

import boto3  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402

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
from app.services import (  # noqa: E402
    alerta_service,
    assinatura_service,
    badge_service,
    ferias_service,
    meta_service,
    notif_service,
    pontos_service,
    postagem_service,
)
from app.services import sessao_service  # noqa: E402
from app import aluno_auth  # noqa: E402
from app.utils import new_id  # noqa: E402

NOW = datetime.now(timezone.utc)
TODAY = NOW.date()
rng = random.Random(args.seed)


# ── Helpers de tempo (para datas controladas no passado) ─────────────────────────────────
def epoch_ms_at(dt: datetime) -> str:
    return f"{int(dt.timestamp() * 1000):013d}"


def iso_at(dt: datetime) -> str:
    return dt.isoformat()


def isoweek_at(dt: datetime) -> str:
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


def ym_offset(d: date, meses_atras: int) -> str:
    y, m = d.year, d.month - meses_atras
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


# ══════════════════════════════════════════════════════════════════════════════════════
# 0) Conta Cognito
# ══════════════════════════════════════════════════════════════════════════════════════
session = boto3.Session(profile_name=args.profile, region_name=args.region)
cognito = session.client("cognito-idp")


def ensure_cognito_user() -> None:
    try:
        cognito.admin_create_user(
            UserPoolId=args.user_pool_id,
            Username=args.email,
            UserAttributes=[
                {"Name": "email", "Value": args.email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": args.nome},
            ],
            MessageAction="SUPPRESS",  # não dispara e-mail de convite
        )
        print(f"  Cognito: usuário {args.email} criado.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "UsernameExistsException":
            print(f"  Cognito: usuário {args.email} já existe — só redefine a senha.")
        else:
            raise
    cognito.admin_set_user_password(
        UserPoolId=args.user_pool_id, Username=args.email,
        Password=args.senha, Permanent=True,
    )
    print(f"  Cognito: senha permanente definida ({args.senha}).")


def resolve_personal_id() -> str:
    resp = cognito.list_users(UserPoolId=args.user_pool_id, Filter=f'email = "{args.email}"')
    users = resp.get("Users", [])
    if not users:
        raise SystemExit(f"Usuário {args.email} não encontrado no Cognito. Rode sem --no-cognito.")
    return users[0]["Username"]  # UsernameAttributes=[email] -> Username == sub


if not args.no_cognito:
    print("Provisionando conta Cognito…")
    ensure_cognito_user()

PERSONAL_ID = resolve_personal_id()
print(f"Personal demo: {args.email} -> personal_id={PERSONAL_ID}")


# ══════════════════════════════════════════════════════════════════════════════════════
# Reset opcional (escopado a esta conta)
# ══════════════════════════════════════════════════════════════════════════════════════
def reset_demo_data() -> None:
    pk = keys.pk_personal(PERSONAL_ID)
    alunos_ptrs = repo.query_pk(pk, sk_prefix="ALUNO#")
    print(f"  Removendo dados de {len(alunos_ptrs)} aluno(s) anteriores…")
    orfaos = 0
    for ptr in alunos_ptrs:
        aluno_id = ptr["aluno_id"]
        items = repo.query_pk(keys.pk_aluno(aluno_id))
        # Itens fora da partição do aluno/personal que ficariam órfãos a cada re-seed
        for i in items:
            if i["SK"] == keys.SK_PROFILE and i.get("acesso_token"):
                repo.delete_item(f"TOKEN#{i['acesso_token']}", "META")  # link do app do aluno
                orfaos += 1
            elif i["SK"].startswith("TREINO#") and i.get("data_fim"):
                repo.delete_item(keys.pk_sched(i["data_fim"]), keys.sk_due(i["treino_id"]))  # aviso de vencimento
                orfaos += 1
        repo.batch_write(deletes=[(keys.pk_aluno(aluno_id), i["SK"]) for i in items])
        if ptr.get("telefone"):
            repo.delete_item(keys.pk_phone(PERSONAL_ID, ptr["telefone"]), "PHONE")
    print(f"  Removidos {orfaos} item(ns) órfão(s) (TOKEN#/SCHED#).")
    pt_items = repo.query_pk(pk)
    pt_delete = [i for i in pt_items if not i["SK"].startswith("WAPI#")]  # preserva config sensível
    repo.batch_write(deletes=[(pk, i["SK"]) for i in pt_delete])
    print(f"  Removidos {len(pt_delete)} item(ns) da partição do personal.")


if args.reset:
    print("--reset: limpando dados demo anteriores…")
    reset_demo_data()


# ══════════════════════════════════════════════════════════════════════════════════════
# 1) Plano — 1 ano de Gestão Pro (grátis, concessão de admin) → alunos ilimitados
# ══════════════════════════════════════════════════════════════════════════════════════
assinatura_service.conceder_admin(PERSONAL_ID, dias=args.plano_dias)
print(f"Plano: Gestão Pro concedido por {args.plano_dias} dias (alunos ilimitados).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 2) Perfil público do personal (+ slug)
# ══════════════════════════════════════════════════════════════════════════════════════
perfil = {
    "personal_id": PERSONAL_ID,
    "nome": args.nome,
    "descricao": "Treinamento personalizado, resultados de verdade.",
    "biografia": (
        "Sou personal trainer há mais de 10 anos, especialista em hipertrofia, emagrecimento e "
        "condicionamento físico. Meu método une periodização inteligente, acompanhamento próximo "
        "e uso de tecnologia para acelerar os resultados de cada aluno — do iniciante ao avançado."
    ),
    "experiencia_profissional": (
        "Ex-preparador físico de atletas amadores de corrida e crossfit. Atendo presencial e online, "
        "com planilhas de treino, avaliações periódicas e ajustes semanais de carga."
    ),
    "formacao": "Bacharel em Educação Física (CREF ativo) · Pós em Fisiologia do Exercício",
    "instagram_url": "https://instagram.com/coachpilot.demo",
    "youtube_url": "https://youtube.com/@coachpilot",
    "site_url": "https://coachpilot.com.br",
    "slug": args.slug,
    "created_at": iso_at(NOW),
    "updated_at": iso_at(NOW),
}
repo.put_item(keys.pk_personal(PERSONAL_ID), keys.SK_PROFILE, perfil)
repo.put_item(keys.pk_slug(args.slug), "META", {"personal_id": PERSONAL_ID})  # reserva/atualiza slug
print(f"Perfil do personal salvo (slug público: /@{args.slug}).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 3) Campos customizados
# ══════════════════════════════════════════════════════════════════════════════════════
custom_cfg = CustomFieldsConfig(
    aluno=[
        CustomFieldDef(key="nivel_experiencia", label="Nível de experiência",
                       type=CustomFieldType.SELECT, options=["Iniciante", "Intermediário", "Avançado"]),
        CustomFieldDef(key="plano", label="Plano contratado",
                       type=CustomFieldType.SELECT, options=["Mensal", "Trimestral", "Anual"]),
        CustomFieldDef(key="indicado_por", label="Indicado por", type=CustomFieldType.TEXT),
    ],
    treino=[
        CustomFieldDef(key="fase_periodizacao", label="Fase de periodização",
                       type=CustomFieldType.SELECT, options=["Adaptação", "Hipertrofia", "Força", "Manutenção"]),
    ],
    exercicio=[
        CustomFieldDef(key="tecnica_especial", label="Técnica especial", type=CustomFieldType.TEXT),
    ],
)
repo.put_item(keys.pk_personal(PERSONAL_ID), keys.SK_CUSTOM_FIELDS, custom_cfg.model_dump())
print("Campos customizados configurados.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 4) Template de anamnese
# ══════════════════════════════════════════════════════════════════════════════════════
anamnese_template = {
    "mensagem_boas_vindas": "Bem-vindo(a)! Preencha sua ficha de saúde para montarmos o melhor treino para você.",
    "solicitar_email": True, "solicitar_nascimento": True, "solicitar_objetivo": True,
    "perguntas": [
        {"key": "problema_saude", "label": "Possui algum problema de saúde ou lesão?", "type": "TEXT", "required": True},
        {"key": "medicamento", "label": "Faz uso de algum medicamento contínuo?", "type": "TEXT", "required": False},
        {"key": "ja_treinou", "label": "Já treinou antes?", "type": "SELECT",
         "options": ["Nunca", "Menos de 1 ano", "1 a 3 anos", "Mais de 3 anos"], "required": True},
        {"key": "frequencia_semanal", "label": "Quantos dias por semana pode treinar?", "type": "SELECT",
         "options": ["2", "3", "4", "5", "6"], "required": True},
        {"key": "fumante", "label": "É fumante?", "type": "BOOL", "required": False},
        {"key": "horas_sono", "label": "Quantas horas dorme por noite?", "type": "NUMBER", "required": False},
    ],
}
repo.put_item(keys.pk_personal(PERSONAL_ID), keys.SK_ANAMNESE_TEMPLATE, anamnese_template)
print("Template de anamnese salvo.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 5) Biblioteca de exercícios (com grupo muscular)
# ══════════════════════════════════════════════════════════════════════════════════════
BIBLIOTECA = [
    ("Supino reto", "Peito", "Cotovelos a 45°, barra até a linha do mamilo."),
    ("Supino inclinado com halteres", "Peito", "Banco a 30°, foco na porção clavicular."),
    ("Crucifixo reto", "Peito", "Amplitude controlada, sem travar o cotovelo."),
    ("Puxada frontal", "Costas", "Pegada pronada, puxar até a linha do queixo."),
    ("Remada curvada", "Costas", "Tronco a 45°, evitar usar o lombar para puxar."),
    ("Remada unilateral", "Costas", "Apoio no banco, cotovelo próximo ao corpo."),
    ("Levantamento terra", "Costas", "Coluna neutra, barra rente às pernas."),
    ("Agachamento livre", "Pernas", "Joelho alinhado com a ponta do pé, quadril para trás."),
    ("Leg press 45°", "Pernas", "Não travar os joelhos no topo do movimento."),
    ("Cadeira extensora", "Pernas", "Movimento controlado, pausa de 1s no topo."),
    ("Mesa flexora", "Pernas", "Evitar elevar o quadril durante a flexão."),
    ("Afundo com halteres", "Pernas", "Passada firme, tronco ereto."),
    ("Stiff", "Posterior", "Joelhos semiflexionados, barra próxima às pernas."),
    ("Desenvolvimento com halteres", "Ombro", "Não hiperestender a lombar."),
    ("Elevação lateral", "Ombro", "Subir até a linha do ombro, sem balançar o tronco."),
    ("Rosca direta", "Bíceps", "Cotovelo fixo ao lado do tronco."),
    ("Rosca alternada", "Bíceps", "Supinar o punho ao subir."),
    ("Tríceps corda", "Tríceps", "Abrir levemente a corda no final do movimento."),
    ("Tríceps testa", "Tríceps", "Cotovelos apontados para cima, fixos."),
    ("Abdominal supra", "Core", "Foco na contração, sem tracionar o pescoço."),
    ("Prancha", "Core", "Corpo alinhado, abdômen contraído."),
    ("Panturrilha em pé", "Panturrilha", "Amplitude total, pausa no topo."),
]
grupo_por_nome: dict[str, str] = {n: g for n, g, _ in BIBLIOTECA}
exlib_by_nome: dict[str, str] = {}
for nome, grupo, rec in BIBLIOTECA:
    exlib_id = new_id()
    ex = ExLib(exlib_id=exlib_id, nome=nome, grupo=grupo,
               video_url=f"https://www.youtube.com/results?search_query={nome.replace(' ', '+')}",
               recomendacoes=rec)
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_exlib(exlib_id), ex.model_dump())
    exlib_by_nome[nome] = exlib_id
print(f"Biblioteca: {len(exlib_by_nome)} exercícios.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 6) Alunos — 5 perfis completos
# ══════════════════════════════════════════════════════════════════════════════════════
ALUNOS_DEF = [
    dict(
        nome="Mariana Souza", telefone="5511987650001", email="mariana.souza@email.com",
        endereco="Rua das Flores, 123 — Vila Madalena, São Paulo/SP", data_nascimento="1994-03-15",
        objetivos=["Hipertrofia", "Emagrecimento"],
        descricao="Professora, treina há 2 anos. Foco em emagrecimento saudável.",
        observacoes="Histórico de dor no joelho direito — evitar agachamento profundo com alta carga. "
                    "Prefere treinar de manhã.",
        custom={"nivel_experiencia": "Intermediário", "plano": "Anual", "indicado_por": "Academia FitLife"},
        anamnese={"problema_saude": "Condromalácia leve no joelho direito", "medicamento": "Nenhum",
                  "ja_treinou": "1 a 3 anos", "frequencia_semanal": "4", "fumante": False, "horas_sono": 7},
        mensalidade=150.0, streak_bonus=2, tendencia="perda",
    ),
    dict(
        nome="Carlos Eduardo Lima", telefone="5511987650002", email="carlos.lima@empresa.com",
        endereco="Av. Paulista, 1000 — Bela Vista, São Paulo/SP", data_nascimento="1989-07-22",
        objetivos=["Ganho de massa muscular", "Força"],
        descricao="Analista de TI, treina há 4 anos. Busca força e hipertrofia.",
        observacoes="Trabalho remoto, muitas horas sentado. Lombalgia leve — priorizar core e mobilidade.",
        custom={"nivel_experiencia": "Avançado", "plano": "Mensal", "indicado_por": "Internet"},
        anamnese={"problema_saude": "Lombalgia leve ocasional", "medicamento": "Nenhum",
                  "ja_treinou": "Mais de 3 anos", "frequencia_semanal": "5", "fumante": False, "horas_sono": 6},
        mensalidade=180.0, streak_bonus=4, tendencia="ganho",
    ),
    dict(
        nome="Fernanda Oliveira", telefone="5511987650003", email="fernanda.oliveira@gmail.com",
        endereco="Rua dos Pinheiros, 456 — Pinheiros, São Paulo/SP", data_nascimento="1998-11-08",
        objetivos=["Condicionamento físico", "Emagrecimento"],
        descricao="Estudante universitária, iniciante. Muito motivada e disciplinada.",
        observacoes="Nunca treinou com personal antes. Prefere treinos à tarde. Sem restrições.",
        custom={"nivel_experiencia": "Iniciante", "plano": "Trimestral", "indicado_por": "Amiga (Mariana Souza)"},
        anamnese={"problema_saude": "Nenhum", "medicamento": "Nenhum",
                  "ja_treinou": "Nunca", "frequencia_semanal": "3", "fumante": False, "horas_sono": 8},
        mensalidade=130.0, streak_bonus=0, tendencia="perda",
    ),
    dict(
        nome="Roberto Almeida", telefone="5511987650004", email="roberto.almeida@email.com",
        endereco="Rua Harmonia, 789 — Vila Madalena, São Paulo/SP", data_nascimento="1980-05-30",
        objetivos=["Saúde e qualidade de vida", "Força"],
        descricao="Empresário, 45 anos. Retomando os treinos após anos parado.",
        observacoes="Hipertensão controlada. Evitar apneia e cargas máximas. Acompanhamento médico em dia.",
        custom={"nivel_experiencia": "Intermediário", "plano": "Anual", "indicado_por": "Esposa"},
        anamnese={"problema_saude": "Hipertensão controlada", "medicamento": "Losartana 50mg",
                  "ja_treinou": "1 a 3 anos", "frequencia_semanal": "3", "fumante": False, "horas_sono": 7},
        mensalidade=200.0, streak_bonus=1, tendencia="ganho",
    ),
    dict(
        nome="Juliana Castro", telefone="5511987650005", email="juliana.castro@email.com",
        endereco="Rua Fradique Coutinho, 321 — Pinheiros, São Paulo/SP", data_nascimento="1992-09-12",
        objetivos=["Tonificação", "Resistência"],
        descricao="Designer, treina há 1 ano. Gosta de treinos dinâmicos.",
        observacoes="Viaja com frequência a trabalho — combinar treinos adaptáveis para hotel/casa.",
        custom={"nivel_experiencia": "Intermediário", "plano": "Mensal", "indicado_por": "Instagram"},
        anamnese={"problema_saude": "Nenhum", "medicamento": "Anticoncepcional",
                  "ja_treinou": "1 a 3 anos", "frequencia_semanal": "4", "fumante": False, "horas_sono": 7},
        mensalidade=150.0, streak_bonus=0, tendencia="perda",
    ),
]

TREINO_DEFS = {
    "A": ("Treino A — Peito/Ombro/Tríceps", "Superior (empurrar)",
          ["Supino reto", "Supino inclinado com halteres", "Desenvolvimento com halteres",
           "Elevação lateral", "Tríceps corda", "Abdominal supra"]),
    "B": ("Treino B — Pernas/Posterior", "Inferior",
          ["Agachamento livre", "Leg press 45°", "Cadeira extensora", "Mesa flexora", "Stiff", "Panturrilha em pé"]),
    "C": ("Treino C — Costas/Bíceps", "Superior (puxar)",
          ["Puxada frontal", "Remada curvada", "Remada unilateral", "Rosca direta", "Rosca alternada", "Prancha"]),
}

# Treinos já vencidos (demonstram o aviso de "treino vencido" no portal e a notificação no sino).
# Chave = (nome do aluno, letra do treino); valor = há quantos dias venceu.
# Mantenha SEMPRE 2 alunos aqui — é o cenário combinado para a demo.
TREINOS_VENCIDOS = {
    ("Carlos Eduardo Lima", "B"): 1,
    ("Juliana Castro", "C"): 6,
}

REP_RANGE = {"compound": (6, 10), "isolation": (10, 14)}
COMPOUND = {"Supino reto", "Agachamento livre", "Leg press 45°", "Stiff", "Puxada frontal",
            "Remada curvada", "Levantamento terra", "Desenvolvimento com halteres"}
BASE_CARGA = {
    "Supino reto": (40, 60), "Supino inclinado com halteres": (14, 20), "Crucifixo reto": (8, 12),
    "Puxada frontal": (35, 55), "Remada curvada": (35, 55), "Remada unilateral": (14, 20),
    "Levantamento terra": (50, 90), "Agachamento livre": (40, 70), "Leg press 45°": (80, 140),
    "Cadeira extensora": (25, 40), "Mesa flexora": (20, 35), "Afundo com halteres": (10, 18),
    "Stiff": (30, 50), "Desenvolvimento com halteres": (10, 16), "Elevação lateral": (6, 10),
    "Rosca direta": (10, 16), "Rosca alternada": (8, 14), "Tríceps corda": (15, 25),
    "Tríceps testa": (12, 22), "Abdominal supra": (0, 0), "Prancha": (0, 0), "Panturrilha em pé": (40, 70),
}

alunos_criados: list[dict] = []
for a in ALUNOS_DEF:
    aluno_id = new_id()
    now = iso_at(NOW)
    token = aluno_auth.issue_token(aluno_id, PERSONAL_ID)  # link permanente do app do aluno
    aluno = Aluno(
        aluno_id=aluno_id, personal_id=PERSONAL_ID, nome=a["nome"], telefone=a["telefone"],
        email=a["email"], endereco=a["endereco"], data_nascimento=a["data_nascimento"],
        objetivos=a["objetivos"], descricao=a["descricao"], observacoes=a["observacoes"],
        status=AlunoStatus.ATIVO, custom=a["custom"], acesso_token=token,
        created_at=now, updated_at=now,
    )
    data = aluno.model_dump()
    repo.put_item_if_absent(keys.pk_phone(PERSONAL_ID, a["telefone"]), "PHONE",
                            {"aluno_id": aluno_id, "nome": a["nome"]})
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_PROFILE, data)
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_aluno_pointer(aluno_id), {
        "aluno_id": aluno_id, "nome": a["nome"], "status": AlunoStatus.ATIVO.value,
        "telefone": a["telefone"], "created_at": now, "updated_at": now, "tem_anamnese": True,
    })
    # Stats de alunos (dashboard + limite do plano) e objetivos
    repo.add_and_set(keys.pk_personal(PERSONAL_ID), keys.SK_STATS_ALUNOS, add={"total": 1, "ativos": 1})
    for obj in a["objetivos"]:
        repo.add_and_set(keys.pk_personal(PERSONAL_ID), keys.SK_STATS_OBJETIVOS,
                         add={keys.normalize_objetivo(obj): 1})
    # Anamnese respondida
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_ANAMNESE_ALUNO, {
        "respostas": a["anamnese"], "preenchido_em": iso_at(NOW - timedelta(weeks=args.semanas)),
        "preenchido_por": "ALUNO",
    })
    alunos_criados.append({
        "aluno_id": aluno_id, "nome": a["nome"], "objetivos": a["objetivos"],
        "token": token, "mensalidade": a["mensalidade"], "streak_bonus": a["streak_bonus"],
        "tendencia": a["tendencia"],
    })
print(f"Alunos: {len(alunos_criados)} criados (perfil + anamnese + link de acesso).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 7) Treinos + exercícios por aluno
# ══════════════════════════════════════════════════════════════════════════════════════
data_inicio_programa = (NOW - timedelta(weeks=args.semanas)).strftime("%Y-%m-%d")

for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    treinos: dict[str, dict] = {}
    for letra, (nome, foco, exs) in TREINO_DEFS.items():
        treino_id = new_id()
        now = iso_at(NOW)
        dias_vencido = TREINOS_VENCIDOS.get((aluno["nome"], letra))
        data_fim = (NOW - timedelta(days=dias_vencido)).strftime("%Y-%m-%d") if dias_vencido else None
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
            grupo = grupo_por_nome.get(ex_nome, "Sem grupo")
            kind = "compound" if ex_nome in COMPOUND else "isolation"
            reps_lo, reps_hi = REP_RANGE[kind]
            n_series = 4 if kind == "compound" else 3
            sp = [SeriePrescrita(series=n_series, reps=f"{reps_lo}-{reps_hi}",
                                 carga=str(carga0) if carga0 else None)]
            exercicio = Exercicio(
                exercicio_id=ex_id, treino_id=treino_id, aluno_id=aluno_id, nome=ex_nome,
                grupo=grupo, ordem=i, series_prescritas=sp,
                video_url=f"https://www.youtube.com/results?search_query={ex_nome.replace(' ', '+')}",
            )
            repo.put_item(keys.pk_aluno(aluno_id), keys.sk_exercicio(treino_id, ex_id), exercicio.model_dump())
            # Catálogo permanente (seletor de evolução)
            sessao_service.upsert_excat(aluno_id, ex_nome, {"grupo": grupo, "tipo_exercicio": "FORCA"})
            exercicios.append({
                "exercicio_id": ex_id, "nome": ex_nome, "grupo": grupo, "carga_inicial": carga0,
                "carga_atual": carga0, "kind": kind, "series_prescritas": [s.model_dump() for s in sp],
            })
        treinos[letra] = {"treino_id": treino_id, "nome": nome, "exercicios": exercicios, "data_fim": data_fim}

        if data_fim:
            repo.put_item(keys.pk_sched(data_fim), keys.sk_due(treino_id), {
                "personal_id": PERSONAL_ID, "aluno_id": aluno_id, "treino_id": treino_id,
                "treino_nome": nome, "aluno_nome": aluno["nome"], "data_fim": data_fim, "tipo": "TREINO_FIM",
            })
            notif_service.criar(PERSONAL_ID, "TREINO_FIM", "Treino vencido",
                                f'O treino "{nome}" de {aluno["nome"]} venceu em {data_fim}.', aluno_id=aluno_id)
    aluno["treinos"] = treinos
print("Treinos e exercícios criados para todos os alunos.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 8) Histórico de sessões (~N semanas) com progressão real + agregados por grupo
# ══════════════════════════════════════════════════════════════════════════════════════
def gerar_series(carga: float | None, reps_lo: int, reps_hi: int, n: int) -> list[SerieExec]:
    out = []
    for i in range(n):
        reps = rng.randint(reps_lo, reps_hi) - (1 if i == n - 1 else 0)
        out.append(SerieExec(carga=(str(carga) if carga else None), reps=max(reps, 1)))
    return out


def registrar_sessao_historica(aluno_id: str, treino: dict, dt: datetime) -> str:
    """Espelha sessao_service.finish()+record() com timestamp controlado: histórico + registros
    (GSI1) + agregados de volume/PR e por grupo muscular."""
    sessao_id = new_id()
    pk = keys.pk_aluno(aluno_id)
    wk = isoweek_at(dt)
    snaps = [{"exercicio_id": e["exercicio_id"], "nome": e["nome"], "grupo": e["grupo"],
              "series_prescritas": e.get("series_prescritas"), "intervalo_s": None}
             for e in treino["exercicios"]]

    canal = rng.choice([CanalOrigem.WHATSAPP, CanalOrigem.PORTAL])
    ator = Ator.ALUNO if canal == CanalOrigem.WHATSAPP else Ator.PERSONAL
    classificacao = Classificacao.AUTO if canal == CanalOrigem.WHATSAPP else Classificacao.MANUAL
    exercicios_exec = []
    total_series = 0
    for ex in treino["exercicios"]:
        kind = ex["kind"]
        reps_lo, reps_hi = REP_RANGE[kind]
        n_series = 4 if kind == "compound" else 3
        series = gerar_series(ex["carga_atual"], reps_lo, reps_hi, n_series)
        total_series += len(series)
        registro = Registro(
            sessao_id=sessao_id, exercicio_id=ex["exercicio_id"], exercicio_nome=ex["nome"], aluno_id=aluno_id,
            series_exec=series, data_hora=iso_at(dt), canal_origem=canal, classificacao=classificacao, ator=ator,
        )
        chave = sessao_service.chave_exercicio(ex["nome"])
        item = registro.model_dump()
        item["GSI1PK"] = keys.gsi1_registro(aluno_id, chave)
        item["GSI1SK"] = keys.gsi1sk_registro(epoch_ms_at(dt))
        repo.put_item(pk, keys.sk_registro(sessao_id, ex["exercicio_id"]), item)
        exercicios_exec.append({
            "exercicio_id": ex["exercicio_id"], "exercicio_nome": ex["nome"],
            "series_exec": [{"carga": s.carga, "reps": s.reps} for s in series],
            "series_prescritas": ex.get("series_prescritas"),
        })

        cargas, volume = [], 0.0
        for s in series:
            if s.carga:
                cg = float(s.carga)
                cargas.append(cg)
                volume += cg * (s.reps or 0)
        if volume > 0:
            grupo_key = sessao_service._normalizar_grupo(ex["grupo"])
            repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={"total_volume": volume}, set_={"ultimo_treino": iso_at(dt)})
            repo.add_and_set(pk, keys.sk_stats_week(wk), add={"volume": volume}, set_={"semana": wk})
            repo.add_and_set(pk, keys.sk_stats_week_grupo(wk, grupo_key),
                             add={"volume": volume}, set_={"semana": wk, "grupo": ex["grupo"]})
            repo.add_and_set(pk, keys.sk_stats_grupo(grupo_key), add={"volume": volume}, set_={"grupo": ex["grupo"]})
        if cargas:
            repo.update_if_greater(pk, keys.sk_stats_pr(chave), "carga", max(cargas),
                                   extra={"exercicio_nome": ex["nome"], "data": iso_at(dt)})

    duracao_s = 50 * 60 + rng.randint(-600, 600)
    volume_total = sum(
        float(s["carga"]) * (s["reps"] or 0)
        for e in exercicios_exec for s in e["series_exec"] if s["carga"]
    )
    hist = {
        "sessao_id": sessao_id, "aluno_id": aluno_id, "personal_id": PERSONAL_ID,
        "treino_id": treino["treino_id"], "treino_nome": treino["nome"], "status": "FINALIZADA",
        "exercicios": snaps, "ex_atual": snaps[-1] if snaps else None, "ordem_atual": len(snaps) - 1,
        "total_ex": len(snaps), "data_hora_inicio": iso_at(dt - timedelta(seconds=duracao_s)),
        "data_hora_fim": iso_at(dt), "duracao_segundos": duracao_s,
        "exercicios_exec": exercicios_exec, "volume_total": round(volume_total, 1),
        "total_series": total_series,
    }
    sk_hist = keys.sk_sessao_hist(epoch_ms_at(dt), sessao_id)
    repo.put_item(pk, sk_hist, hist)
    repo.put_item(pk, keys.sk_sessao_idx(sessao_id), {"sk": sk_hist})
    # Agregados de sessão/tempo/frequência
    dow = dt.weekday()
    repo.add_and_set(pk, keys.SK_STATS_ALUNO, add={
        "total_sessoes": 1, "soma_duracao_segundos": duracao_s,
        "soma_total_series": total_series, "sessoes_com_metrica": 1, f"dow_{dow}": 1,
    }, set_={"ultimo_treino": iso_at(dt)})
    repo.add_and_set(pk, keys.sk_stats_week(wk), add={"sessoes": 1}, set_={"semana": wk})
    hoje_str = dt.date().isoformat()
    repo.add_and_set(keys.pk_personal(PERSONAL_ID), f"STATS#D#{hoje_str}",
                     add={"sessoes": 1}, set_={"data": hoje_str})
    repo.add_to_set(keys.pk_personal(PERSONAL_ID), f"STATS#D#{hoje_str}", "alunos_set", {aluno_id})
    return sessao_id


total_sessoes = 0
last_sessao_id: dict = {}
sessoes_por_aluno: dict[str, int] = {}
semanas_treinadas: dict[str, set] = {}
last_dt_por_aluno: dict[str, datetime] = {}
for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    rotina = [("A", 0), ("B", 2), ("C", 4)]  # seg / qua / sex
    count = 0
    weeks_hit: set = set()
    for semanas_atras in range(args.semanas, -1, -1):
        # Progressão de carga: ~1.5% por semana (sobrecarga progressiva realista)
        fator = 1.0 + (args.semanas - semanas_atras) * 0.015
        for ex in [e for t in aluno["treinos"].values() for e in t["exercicios"]]:
            if ex["carga_inicial"]:
                ex["carga_atual"] = round(ex["carga_inicial"] * fator * rng.uniform(0.99, 1.02), 1)
        for letra, dia_offset in rotina:
            if rng.random() < 0.15:  # ~15% de faltas — adesão realista
                continue
            dt = NOW - timedelta(weeks=semanas_atras)
            dt = dt - timedelta(days=dt.weekday()) + timedelta(
                days=dia_offset, hours=rng.choice([7, 8, 18, 19]), minutes=rng.randint(0, 59)
            )
            if dt > NOW:
                continue
            sid = registrar_sessao_historica(aluno_id, aluno["treinos"][letra], dt)
            total_sessoes += 1
            count += 1
            weeks_hit.add(isoweek_at(dt))
            last_sessao_id[(aluno_id, letra)] = sid
            last_dt_por_aluno[aluno_id] = max(last_dt_por_aluno.get(aluno_id, dt), dt)
    sessoes_por_aluno[aluno_id] = count
    semanas_treinadas[aluno_id] = weeks_hit
print(f"Histórico de sessões: {total_sessoes} sessões (progressão de carga + agregados por grupo).")


# ── Streak (semanas consecutivas até hoje) + atividade recente (dashboard) ───────────────
def calcular_streak(weeks: set) -> tuple[int, int]:
    if not weeks:
        return 0, 0
    y, w, _ = NOW.isocalendar()
    cur = f"{y}-W{w:02d}"

    def prev(wk: str) -> str:
        yy, ww = int(wk.split("-W")[0]), int(wk.split("-W")[1])
        monday = date.fromisocalendar(yy, ww, 1) - timedelta(weeks=1)
        p = monday.isocalendar()
        return f"{p[0]}-W{p[1]:02d}"

    # streak atual: conta para trás a partir da semana atual (ou anterior)
    atual = 0
    probe = cur if cur in weeks else prev(cur)
    while probe in weeks:
        atual += 1
        probe = prev(probe)
    # streak máximo
    ordenadas = sorted(weeks)
    maximo = run = 1
    for i in range(1, len(ordenadas)):
        if prev(ordenadas[i]) == ordenadas[i - 1]:
            run += 1
        else:
            run = 1
        maximo = max(maximo, run)
    return atual, max(maximo, atual)


for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    streak_atual, streak_max = calcular_streak(semanas_treinadas[aluno_id])
    y, w, _ = NOW.isocalendar()
    repo.add_and_set(keys.pk_aluno(aluno_id), keys.SK_STATS_ALUNO, set_={
        "streak_atual": streak_atual, "streak_maximo": streak_max,
        "streak_ultima_semana": f"{y}-W{w:02d}", "usou_app": True,
    })
    aluno["streak_atual"], aluno["streak_maximo"] = streak_atual, streak_max
    # Atividade recente na partição do personal (dashboard: "quem treinou por último", via GSI1)
    ldt = last_dt_por_aluno.get(aluno_id, NOW)
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_atividade(aluno_id), {
        "aluno_id": aluno_id, "status": "FINALIZADA", "treino_nome": None,
        "exercicio_atual": None, "ordem_atual": None, "total_ex": None,
        "atualizado_em": iso_at(ldt),
        "GSI1PK": keys.gsi1_atividade(PERSONAL_ID), "GSI1SK": epoch_ms_at(ldt),
    })
# Contador de alunos que usaram o app (dashboard)
repo.add_and_set(keys.pk_personal(PERSONAL_ID), keys.SK_STATS_ALUNOS, add={"alunos_app": len(alunos_criados)})
print("Streak, badges base e atividade recente calculados.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 9) Gamificação — pontos, ranking e badges
# ══════════════════════════════════════════════════════════════════════════════════════
for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    n = sessoes_por_aluno.get(aluno_id, 0)
    for _ in range(n):
        pontos_service.award(aluno_id, "SESSAO", PERSONAL_ID, descricao="Sessão concluída")
    for _ in range(n // 2):
        pontos_service.award(aluno_id, "SESSAO_COMPLETA_BONUS", PERSONAL_ID, descricao="Treino 100% completo")
    pontos_service.award(aluno_id, "PR", PERSONAL_ID, descricao="Recorde pessoal batido")
    pontos_service.award(aluno_id, "POST", PERSONAL_ID, descricao="Postagem no feed")
    # Badges por marcos de sessões e streak (concede todos os já atingidos)
    for t in sorted(badge_service.SESSAO_THRESHOLDS):
        if n >= t:
            badge_service._tentar_conceder(aluno_id, f"SESS_{t}", badge_service.BADGES[f"SESS_{t}"])
    for t in sorted(badge_service.STREAK_THRESHOLDS):
        if aluno.get("streak_maximo", 0) >= t:
            badge_service._tentar_conceder(aluno_id, f"STREAK_{t}", badge_service.BADGES[f"STREAK_{t}"])
print("Gamificação: pontos, ranking e badges concedidos.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 10) Avaliações físicas com evolução
# ══════════════════════════════════════════════════════════════════════════════════════
MEDIDAS_BASE = {
    "cintura": (70.0, 92.0), "quadril": (88.0, 106.0), "braco_direito": (28.0, 38.0),
    "coxa_direita": (50.0, 64.0), "panturrilha": (34.0, 41.0), "abdomen": (75.0, 96.0),
}
OBSERVACOES_AVAL = [
    "Avaliação inicial. Boa disposição, parâmetros dentro do esperado para o perfil.",
    "Evolução consistente. Composição corporal avançando conforme a meta. Manter protocolo.",
    "Melhor resultado até agora. Ótima aderência ao treino e à dieta.",
    "Revisão de metas: próximo ciclo com foco em manutenção dos ganhos e resistência.",
]
total_avaliacoes = 0
for aluno in alunos_criados:
    aluno_id = aluno["aluno_id"]
    peso0 = round(rng.uniform(58, 95), 1)
    gordura0 = round(rng.uniform(14, 30), 1)
    altura = round(rng.uniform(1.58, 1.86), 2) * 100
    tendencia = -1 if aluno["tendencia"] == "perda" else 1
    medidas0 = {k: round(rng.uniform(lo, hi), 1) for k, (lo, hi) in MEDIDAS_BASE.items()}
    marcos = [args.semanas, int(args.semanas * 0.66), int(args.semanas * 0.33), 1]
    for i, semanas_atras in enumerate(marcos):
        dt = NOW - timedelta(weeks=semanas_atras)
        peso = round(peso0 + tendencia * i * rng.uniform(0.4, 1.1), 1)
        gordura = round(max(8.0, gordura0 + tendencia * i * rng.uniform(0.3, 0.8)), 1)
        medidas = {}
        for k, v0 in medidas0.items():
            # cintura/abdômen acompanham a tendência de gordura; membros crescem no ganho de massa
            if k in ("cintura", "abdomen", "quadril"):
                delta = tendencia * i * rng.uniform(0.3, 0.7)
            else:
                delta = abs(tendencia) * i * rng.uniform(0.2, 0.5) * (1 if tendencia > 0 else -0.3)
            medidas[k] = round(max(20.0, v0 + delta), 1)
        imc = round(peso / (altura / 100) ** 2, 1)
        tendencia_dobra = -1 if tendencia < 0 else 1
        metricas = [
            MetricaCustomizada(nome="IMC", unidade="kg/m²", valor=imc),
            MetricaCustomizada(nome="Dobra tricipital", unidade="mm",
                               valor=round(max(8.0, rng.uniform(12, 26) + tendencia_dobra * i * 0.6), 1)),
            MetricaCustomizada(nome="Dobra abdominal", unidade="mm",
                               valor=round(max(8.0, rng.uniform(15, 32) + tendencia_dobra * i * 0.9), 1)),
            MetricaCustomizada(nome="Massa magra (estim.)", unidade="kg",
                               valor=round(peso * (1 - gordura / 100), 1)),
        ]
        av = Avaliacao(
            avaliacao_id=new_id(), aluno_id=aluno_id, data=dt.strftime("%Y-%m-%d"),
            peso=peso, altura_cm=altura, percentual_gordura=gordura,
            medidas=medidas, metricas=metricas,
            observacoes=OBSERVACOES_AVAL[min(i, len(OBSERVACOES_AVAL) - 1)], created_at=iso_at(dt),
        )
        repo.put_item(keys.pk_aluno(aluno_id), keys.sk_avaliacao(epoch_ms_at(dt), av.avaliacao_id), av.model_dump())
        total_avaliacoes += 1
print(f"Avaliações físicas: {total_avaliacoes} (com medidas, métricas e evolução).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 11) Metas / objetivos
# ══════════════════════════════════════════════════════════════════════════════════════
mariana = next(a for a in alunos_criados if a["nome"] == "Mariana Souza")
carlos = next(a for a in alunos_criados if a["nome"] == "Carlos Eduardo Lima")
fernanda = next(a for a in alunos_criados if a["nome"] == "Fernanda Oliveira")
roberto = next(a for a in alunos_criados if a["nome"] == "Roberto Almeida")
juliana = next(a for a in alunos_criados if a["nome"] == "Juliana Castro")


def _ex_do_aluno(aluno: dict, nome: str):
    for t in aluno["treinos"].values():
        for e in t["exercicios"]:
            if e["nome"] == nome:
                return e
    return None


# Mariana: meta de peso (em andamento) + meta de carga concluída
meta_service.criar(mariana["aluno_id"], PERSONAL_ID, {
    "tipo": "PESO", "titulo": "Chegar a 62 kg", "descricao": "Meta de emagrecimento saudável.",
    "valor_alvo": 62.0, "unidade": "kg", "data_limite": (TODAY + timedelta(days=60)).isoformat(),
})
ex_sup = _ex_do_aluno(mariana, "Supino reto")
m_carga = meta_service.criar(mariana["aluno_id"], PERSONAL_ID, {
    "tipo": "CARGA", "titulo": "Supino reto 50 kg", "descricao": "Progressão de força no supino.",
    "valor_alvo": 50.0, "unidade": "kg", "exercicio_id": ex_sup["exercicio_id"] if ex_sup else None,
    "exercicio_nome": "Supino reto", "chave": "supino reto", "direcao": "MAIOR",
})
repo.update_item_if_exists(keys.pk_aluno(mariana["aluno_id"]),
                           keys.sk_meta(m_carga["ts"], m_carga["meta_id"]),
                           {"status": "CONCLUIDA", "data_conclusao": iso_at(NOW - timedelta(days=10)),
                            "valor_atingido": 52.0})

# Carlos: meta de massa (em andamento)
meta_service.criar(carlos["aluno_id"], PERSONAL_ID, {
    "tipo": "LIVRE", "titulo": "Ganhar 3 kg de massa magra", "descricao": "Foco em superávit calórico limpo.",
    "valor_alvo": 3.0, "unidade": "kg", "data_limite": (TODAY + timedelta(days=90)).isoformat(),
})

# Fernanda: meta proposta pelo aluno (pendente de aprovação — aparece na central do personal)
meta_service.criar(fernanda["aluno_id"], PERSONAL_ID, {
    "tipo": "LIVRE", "titulo": "Treinar 4x na semana", "descricao": "Quero aumentar minha frequência!",
    "valor_alvo": 4.0, "unidade": "treinos/semana",
}, criado_por="ALUNO")

# Roberto: meta de medida (cintura)
meta_service.criar(roberto["aluno_id"], PERSONAL_ID, {
    "tipo": "MEDIDA", "titulo": "Reduzir cintura para 90 cm", "descricao": "Saúde cardiovascular.",
    "valor_alvo": 90.0, "unidade": "cm", "campo_medida": "cintura",
    "data_limite": (TODAY + timedelta(days=120)).isoformat(),
})
print("Metas criadas (concluída, em andamento, proposta pelo aluno, de medida).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 12) Férias / ausências
# ══════════════════════════════════════════════════════════════════════════════════════
ferias_service.criar(juliana["aluno_id"], PERSONAL_ID, {
    "data_inicio": (TODAY + timedelta(days=20)).isoformat(),
    "data_fim": (TODAY + timedelta(days=27)).isoformat(),
    "observacao": "Viagem a trabalho — levar treino adaptável para hotel.",
}, criado_por="ALUNO")
ferias_service.criar(roberto["aluno_id"], PERSONAL_ID, {
    "data_inicio": (TODAY - timedelta(days=40)).isoformat(),
    "data_fim": (TODAY - timedelta(days=33)).isoformat(),
    "observacao": "Férias em família (já retornou).",
}, criado_por="PERSONAL")
print("Férias/ausências registradas.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 13) Agenda (passado concluído, futuro confirmado/agendado, 1 cancelado)
# ══════════════════════════════════════════════════════════════════════════════════════
horarios = [7, 8, 9, 17, 18, 19]
OBSERVACOES_AG = [
    "Sessão presencial — foco em técnica de execução.",
    "Avaliação funcional + treino moderado.",
    "Treino de alta intensidade + revisão de cargas.",
]
total_agendamentos = 0
for i, aluno in enumerate(alunos_criados):
    for offset_dias, status in [
        (-(i + 1), AgendamentoStatus.CONCLUIDO),
        (i % 5 + 1, AgendamentoStatus.CONFIRMADO if i % 2 else AgendamentoStatus.AGENDADO),
    ]:
        dt = (NOW + timedelta(days=offset_dias)).replace(
            hour=horarios[i % len(horarios)], minute=0, second=0, microsecond=0)
        ag = Agendamento(
            agendamento_id=new_id(), personal_id=PERSONAL_ID, aluno_id=aluno["aluno_id"],
            data_hora_inicio=iso_at(dt), duracao_min=60,
            observacao=OBSERVACOES_AG[i % len(OBSERVACOES_AG)], status=status, created_at=iso_at(NOW),
        )
        repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_agenda(ag.data_hora_inicio, ag.agendamento_id), ag.model_dump())
        total_agendamentos += 1
# 1 cancelado (Mariana, daqui 3 dias)
dt = (NOW + timedelta(days=3)).replace(hour=16, minute=0, second=0, microsecond=0)
ag = Agendamento(
    agendamento_id=new_id(), personal_id=PERSONAL_ID, aluno_id=mariana["aluno_id"],
    data_hora_inicio=iso_at(dt), duracao_min=60,
    observacao="Remarcar — aluna avisou que não poderá comparecer.",
    status=AgendamentoStatus.CANCELADO, created_at=iso_at(NOW),
)
repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_agenda(ag.data_hora_inicio, ag.agendamento_id), ag.model_dump())
total_agendamentos += 1
print(f"Agenda: {total_agendamentos} agendamentos (concluídos, futuros e 1 cancelado).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 14) Templates de treino reutilizáveis
# ══════════════════════════════════════════════════════════════════════════════════════
TEMPLATES_DEF = [
    ("Treino A — Superior (padrão)", "Peito/Ombro/Tríceps", TREINO_DEFS["A"][2]),
    ("Full Body — Iniciante", "Corpo inteiro",
     ["Agachamento livre", "Supino reto", "Puxada frontal", "Desenvolvimento com halteres", "Abdominal supra"]),
    ("Push/Pull/Legs — Intermediário", "Divisão ABC", TREINO_DEFS["B"][2]),
]
for nome, foco, exs in TEMPLATES_DEF:
    exercicios_tpl = [
        ExercicioTemplate(nome=ex_nome, ordem=i, grupo=grupo_por_nome.get(ex_nome),
                          series_prescritas=[SeriePrescrita(series=3, reps="8-12")])
        for i, ex_nome in enumerate(exs)
    ]
    tpl = TreinoTemplate(template_id=new_id(), personal_id=PERSONAL_ID, nome=nome, foco=foco,
                         exercicios=exercicios_tpl, created_at=iso_at(NOW))
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_template(tpl.template_id), tpl.model_dump())
print(f"Templates de treino: {len(TEMPLATES_DEF)}.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 15) Feed global do personal
# ══════════════════════════════════════════════════════════════════════════════════════
POSTS_GLOBAIS = [
    ("DICA", -5, "Dica da semana: o descanso é tão importante quanto o treino. Garanta 7–8h de "
     "sono por noite para maximizar a recuperação muscular e os ganhos de força."),
    ("MOTIVACAO", -3, "Parabéns a todos que fecharam a semana com 100% dos treinos! Consistência é o "
     "que separa quem sonha de quem conquista. Bora pra cima! 💪"),
    ("ARTIGO", -2, "Periodização: por que variar volume e intensidade a cada ciclo? Alterar os estímulos "
     "a cada 4–6 semanas previne a adaptação, evita o platô e acelera os resultados a longo prazo."),
    ("AVISO", 0, "Aviso: novos horários disponíveis para avaliação física nesta semana. Quem ainda não "
     "fez a reavaliação do mês, me chama para agendar!"),
]
for tipo, dias_offset, texto in POSTS_GLOBAIS:
    post_id = new_id()
    ts = iso_at(NOW + timedelta(days=dias_offset))
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_feed_global(ts, post_id), {
        "post_id": post_id, "personal_id": PERSONAL_ID, "tipo": tipo, "texto": texto,
        "midias": [], "total_curtidas": rng.randint(2, 9), "data_hora": ts,
    })
print(f"Feed global: {len(POSTS_GLOBAIS)} posts.")


# ══════════════════════════════════════════════════════════════════════════════════════
# 16) Postagens no feed dos exercícios (dor + resposta, correção, dúvidas, PR)
# ══════════════════════════════════════════════════════════════════════════════════════
ex_agach_m = _ex_do_aluno(mariana, "Agachamento livre")
ex_puxada_c = _ex_do_aluno(carlos, "Puxada frontal")
ex_supino_m = _ex_do_aluno(mariana, "Supino reto")
ex_leg_f = _ex_do_aluno(fernanda, "Leg press 45°")
ex_terra_r = _ex_do_aluno(roberto, "Stiff")

# DOR: Mariana no agachamento — com resposta do personal na thread
postagem_service.criar_postagem(
    aluno_id=mariana["aluno_id"], exercicio_id=ex_agach_m["exercicio_id"], exercicio_nome="Agachamento livre",
    tipo="DOR", descricao="Senti uma dor incômoda no joelho direito na última série. Não foi aguda, "
    "mas persistiu por algumas horas.", midias=[], sessao_id=last_sessao_id.get((mariana["aluno_id"], "B")),
    ator="ALUNO", personal_id=PERSONAL_ID,
)
dor_posts = repo.query_pk(keys.pk_aluno(mariana["aluno_id"]), sk_prefix=f"POST#{ex_agach_m['exercicio_id']}#")
if dor_posts:
    alerta_service.adicionar_comentario(
        mariana["aluno_id"], dor_posts[0]["SK"], "PERSONAL",
        "Dor típica de sobrecarga no joelho. Vamos reduzir 10% da carga e reforçar a ativação do "
        "glúteo antes de cada série. Me avise se persistir na próxima sessão.",
    )

# CORRECAO: personal corrige a postura de Mariana
postagem_service.criar_postagem(
    aluno_id=mariana["aluno_id"], exercicio_id=ex_agach_m["exercicio_id"], exercicio_nome="Agachamento livre",
    tipo="CORRECAO", descricao="Percebi que os joelhos entram para dentro na descida. Ative o glúteo e "
    "empurre os joelhos para fora, alinhados com o 2º dedo do pé. Reduza 10% da carga até corrigir.",
    midias=[], sessao_id=None, ator="PERSONAL", personal_id=PERSONAL_ID,
)

# EXECUCAO/PR: Mariana registra recorde no supino
postagem_service.criar_postagem(
    aluno_id=mariana["aluno_id"], exercicio_id=ex_supino_m["exercicio_id"], exercicio_nome="Supino reto",
    tipo="EXECUCAO", descricao="Novo recorde! 4 séries de 8 com 52 kg hoje, sem dor. Evoluindo muito! 🎉",
    midias=[], sessao_id=None, ator="ALUNO", personal_id=PERSONAL_ID,
)

# DUVIDA: Carlos (puxada) e Fernanda (leg press) — abertas
postagem_service.criar_postagem(
    aluno_id=carlos["aluno_id"], exercicio_id=ex_puxada_c["exercicio_id"], exercicio_nome="Puxada frontal",
    tipo="DUVIDA", descricao="Qual pegada ativa mais o dorsal — pronada aberta ou supinada fechada?",
    midias=[], sessao_id=last_sessao_id.get((carlos["aluno_id"], "C")), ator="ALUNO", personal_id=PERSONAL_ID,
)
postagem_service.criar_postagem(
    aluno_id=fernanda["aluno_id"], exercicio_id=ex_leg_f["exercicio_id"], exercicio_nome="Leg press 45°",
    tipo="DUVIDA", descricao="Posso colocar os pés mais altos na plataforma para focar no glúteo?",
    midias=[], sessao_id=last_sessao_id.get((fernanda["aluno_id"], "B")), ator="ALUNO", personal_id=PERSONAL_ID,
)
# CORRECAO: Roberto no stiff
if ex_terra_r:
    postagem_service.criar_postagem(
        aluno_id=roberto["aluno_id"], exercicio_id=ex_terra_r["exercicio_id"], exercicio_nome="Stiff",
        tipo="CORRECAO", descricao="Mantenha a coluna neutra e não arredonde a lombar no final. "
        "Desça só até sentir o alongamento do posterior. Segurança em primeiro lugar!",
        midias=[], sessao_id=None, ator="PERSONAL", personal_id=PERSONAL_ID,
    )
print("Postagens criadas (dor+resposta, correções, dúvidas abertas, PR).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 17) Financeiro — config, mensalidades pagas (histórico), pendentes e vencida
# ══════════════════════════════════════════════════════════════════════════════════════
def _cobranca(aluno_id: str, valor: float, vencimento: date, status: str,
              data_pagamento: str | None = None, forma: str = "MANUAL", mp_taxa: float | None = None) -> None:
    cid = new_id()
    ano_mes = vencimento.strftime("%Y-%m")
    sk = keys.sk_cobranca(ano_mes, cid)
    item = {
        "cobranca_id": cid, "aluno_id": aluno_id, "personal_id": PERSONAL_ID,
        "valor": valor, "recorrencia": "MENSAL", "vencimento": vencimento.isoformat(),
        "status": status, "notas": None, "origem": "AUTO",
        "forma_pagamento": forma if status == "PAGA" else None,
        "data_pagamento": data_pagamento, "mp_payment_id": None,
        "mp_valor_liquido": (round(valor - mp_taxa, 2) if mp_taxa else None),
        "mp_taxa": mp_taxa, "criado_em": iso_at(NOW), "atualizado_em": iso_at(NOW),
    }
    repo.put_item(keys.pk_aluno(aluno_id), sk, item)
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_cobranca_idx(cid),
                  {"cobranca_id": cid, "sk": sk, "personal_id": PERSONAL_ID})


def _cobranca_config(aluno_id: str, valor: float) -> None:
    cfg = {
        "personal_id": PERSONAL_ID, "aluno_id": aluno_id, "valor": valor,
        "recorrencia": "MENSAL", "dia_vencimento": 5, "mes_vencimento": None,
        "ativo": True, "dias_antecedencia": 10,
        "criado_em": iso_at(NOW - timedelta(weeks=args.semanas)), "atualizado_em": iso_at(NOW),
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.SK_COBRANCA_CFG, cfg)
    repo.put_item(keys.pk_personal(PERSONAL_ID), keys.sk_cobranca_aluno(aluno_id), {
        "aluno_id": aluno_id, "ativo": True, "valor": valor, "recorrencia": "MENSAL",
        "atualizado_em": iso_at(NOW),
    })


# Situação do mês corrente por aluno (demonstra pago / pendente / vencido)
situacao_mes = {
    mariana["aluno_id"]: "PAGA", carlos["aluno_id"]: "PENDENTE", fernanda["aluno_id"]: "PENDENTE",
    roberto["aluno_id"]: "PAGA", juliana["aluno_id"]: "VENCIDA",
}
for aluno in alunos_criados:
    aluno_id, valor = aluno["aluno_id"], aluno["mensalidade"]
    _cobranca_config(aluno_id, valor)
    # 4 meses de histórico PAGO
    for meses_atras in range(4, 0, -1):
        venc = date.fromisoformat(f"{ym_offset(TODAY, meses_atras)}-05")
        pago = (venc + timedelta(days=rng.randint(-2, 3)))
        forma = rng.choice(["MANUAL", "PIX_MP"])
        taxa = round(valor * 0.0099 + 0.40, 2) if forma == "PIX_MP" else None
        _cobranca(aluno_id, valor, venc, "PAGA", data_pagamento=pago.isoformat(), forma=forma, mp_taxa=taxa)
    # Mês corrente
    venc_atual = date(TODAY.year, TODAY.month, 5)
    st = situacao_mes[aluno_id]
    if st == "PAGA":
        _cobranca(aluno_id, valor, venc_atual, "PAGA",
                  data_pagamento=venc_atual.isoformat(), forma="PIX_MP",
                  mp_taxa=round(valor * 0.0099 + 0.40, 2))
    elif st == "VENCIDA":
        venc_venc = TODAY - timedelta(days=8)
        _cobranca(aluno_id, valor, venc_venc, "VENCIDA")
    else:
        _cobranca(aluno_id, valor, venc_atual, "PENDENTE")
# Zera o snapshot de agregados financeiros p/ forçar recomputo (lazy backfill) na 1ª leitura
repo.delete_item(keys.pk_personal(PERSONAL_ID), keys.SK_STATS_FIN_OPEN)
print("Financeiro: config + 4 meses pagos + situação do mês (pago/pendente/vencido).")


# ══════════════════════════════════════════════════════════════════════════════════════
# 18) Central de notificações do personal (alguns itens informativos)
# ══════════════════════════════════════════════════════════════════════════════════════
notif_service.criar(PERSONAL_ID, "FEEDBACK", "Feedback do aluno",
                    "Achei o treino desta semana mais desafiador, mas consegui finalizar tudo!",
                    aluno_id=fernanda["aluno_id"])
notif_service.criar(PERSONAL_ID, "AVALIACAO", "Reavaliação sugerida",
                    "Faz mais de 3 semanas desde a última avaliação de Carlos Eduardo Lima.",
                    aluno_id=carlos["aluno_id"])
print("Central de notificações populada.")


# ══════════════════════════════════════════════════════════════════════════════════════
# Resumo
# ══════════════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 66)
print("SEED DA CONTA DEMO CONCLUÍDO")
print("=" * 66)
print(f"Login portal:      https://coachpilot.com.br  ->  {args.email} / {args.senha}")
print(f"Página pública:    https://coachpilot.com.br/@{args.slug}")
print(f"Personal:          {args.nome} ({PERSONAL_ID})")
print(f"Plano:             Gestão Pro por {args.plano_dias} dias (alunos ilimitados)")
print(f"Alunos:            {len(alunos_criados)} (perfis completos + anamnese)")
print(f"Biblioteca:        {len(exlib_by_nome)} exercícios")
print(f"Sessões:           {total_sessoes} (~{args.semanas} semanas, progressão + PRs + grupos)")
print(f"Avaliações:        {total_avaliacoes}")
print(f"Agendamentos:      {total_agendamentos}")
print("Financeiro:        4 meses pagos/aluno + pendentes + 1 vencida")
print(f"Treinos vencidos:  {len(TREINOS_VENCIDOS)} — " +
      ", ".join(f"{n} (treino {l}, há {d}d)" for (n, l), d in TREINOS_VENCIDOS.items()))
print("Extras:            metas, férias, badges, ranking, feed, postagens, notificações")
print("\nLinks do app do aluno (app.coachpilot.com.br):")
for aluno in alunos_criados:
    print(f"  - {aluno['nome']:<24} {aluno_auth.token_link(aluno['token'])}")
print("\nFaça login no portal e explore: Dashboard, Alunos, Agenda, Financeiro, Templates,")
print("Biblioteca, Feed Global e a Central (sino).")
