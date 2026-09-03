"""Fuso horário por usuário — os baldes caem no dia/semana LOCAL de quem é dono deles.

O que está sendo travado aqui (docs/TIMEZONE.md):
  • instante é UTC no banco; "de que dia isso é?" depende do fuso de quem pergunta;
  • `STATS#D#` mora na partição do personal → dia do PERSONAL;
  • streak, `STATS#W#` e `dow_` moram na do aluno → dia/semana do ALUNO;
  • `historico_mes` agrupa na LEITURA, então trocar o fuso reescreve o passado inteiro;
  • data civil (vencimento, prazo) compara com hoje no fuso do dono, não com o dia UTC.
"""
import pytest

from app.repositories import keys
from app.services import locale_service, pendencia_service, sessao_service

PERSONAL = "p-1"
ALUNO = "a-1"
TREINO = "t-1"

SP = "America/Sao_Paulo"     # UTC-3, sem horário de verão
TOKYO = "Asia/Tokyo"         # UTC+9
NY = "America/New_York"      # UTC-5/-4, COM horário de verão


@pytest.fixture
def sessao(repo_fake, monkeypatch):
    from app.services import notif_service
    monkeypatch.setattr(notif_service, "_disparar_push_personal", lambda *a, **k: None)
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_treino(TREINO),
                       {"treino_id": TREINO, "nome": "Treino A"})
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO), {"nome": "Aluno"})
    return repo_fake


def _perfis(fake, tz_personal=None, tz_aluno=None):
    fake.put_item(keys.pk_personal(PERSONAL), keys.SK_PROFILE,
                  {"nome": "Personal", **({"timezone": tz_personal} if tz_personal else {})})
    fake.put_item(keys.pk_aluno(ALUNO), keys.SK_PROFILE,
                  {"nome": "Aluno", "personal_id": PERSONAL,
                   **({"timezone": tz_aluno} if tz_aluno else {})})


# ── Conversão de instante para calendário ────────────────────────────────────

def test_instante_vira_dias_diferentes_em_fusos_diferentes():
    """23h30 em São Paulo é 11h30 do dia SEGUINTE em Tóquio. O mesmo instante, dois dias."""
    inicio = "2026-09-08T02:30:00Z"          # 23h30 do dia 7 em SP
    assert locale_service.dia(inicio, SP) == "2026-09-07"
    assert locale_service.dia(inicio, TOKYO) == "2026-09-08"
    assert locale_service.dia(inicio, "UTC") == "2026-09-08"


def test_treino_das_21h_no_brasil_nao_vaza_para_o_dia_seguinte():
    """O caso que gerou a série inteira: 21h no BRT já é o dia seguinte em UTC."""
    assert locale_service.dia("2026-09-08T00:30:00Z", SP) == "2026-09-07"


def test_semana_iso_local_difere_da_utc_na_virada_de_domingo():
    """Segunda 07h em Tóquio ainda é domingo em UTC — a semana ISO não pode ser a anterior."""
    segunda_tokyo = "2026-09-06T22:00:00Z"   # segunda, 07h em Tóquio; domingo em UTC
    assert locale_service.semana_iso(segunda_tokyo, TOKYO) == "2026-W37"
    assert locale_service.semana_iso(segunda_tokyo, "UTC") == "2026-W36"


def test_dow_local_segue_o_dia_do_aluno():
    """Segunda 21h no BRT: `weekday()` em UTC diria terça (1), no fuso do aluno diz segunda (0)."""
    segunda_21h = "2026-09-08T00:00:00Z"
    assert locale_service.dow(segunda_21h, SP) == 0
    assert locale_service.dow(segunda_21h, "UTC") == 1


def test_fuso_invalido_ou_ausente_degrada_para_o_padrao():
    """Perfil corrompido não pode derrubar o dashboard — cai no padrão em vez de estourar."""
    assert locale_service.dia("2026-09-08T00:30:00Z", "Marte/Olympus") == "2026-09-07"
    assert locale_service.dia("2026-09-08T00:30:00Z", None) == "2026-09-07"
    assert locale_service.dia("2026-09-08T00:30:00Z", "-3") == "2026-09-07"


def test_so_nome_iana_e_aceito():
    assert locale_service.tz_valido(SP)
    assert locale_service.tz_valido(NY)
    assert not locale_service.tz_valido("-3")      # offset é a forma errada: quebra no DST
    assert not locale_service.tz_valido("BRT")
    assert not locale_service.tz_valido("")
    assert not locale_service.tz_valido(None)


# ── Cascata de resolução ─────────────────────────────────────────────────────

def test_aluno_sem_fuso_herda_o_do_personal(sessao):
    _perfis(sessao, tz_personal=TOKYO)
    assert locale_service.tz_do_aluno(ALUNO, PERSONAL) == TOKYO


def test_fuso_do_aluno_vence_o_do_personal(sessao):
    """Treino remoto é o caso de uso: o aluno mora onde mora."""
    _perfis(sessao, tz_personal=SP, tz_aluno=TOKYO)
    assert locale_service.tz_do_aluno(ALUNO, PERSONAL) == TOKYO
    assert locale_service.tz_do_personal(PERSONAL) == SP


def test_sem_nada_configurado_cai_no_padrao(sessao):
    _perfis(sessao)
    assert locale_service.tz_do_aluno(ALUNO, PERSONAL) == locale_service.TZ_PADRAO


# ── Escrita: cada balde no fuso do dono da partição ──────────────────────────

def _sessao_finalizada(fake, monkeypatch, inicio_iso, fim_iso):
    """Roda um treino inteiro com instantes controlados."""
    fake.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio(TREINO, "e-1"),
                  {"exercicio_id": "e-1", "nome": "Supino", "ordem": 0, "grupos": ["Peito"]})
    monkeypatch.setattr(sessao_service, "now_iso", lambda: inicio_iso)
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)
    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])
    monkeypatch.setattr(sessao_service, "now_iso", lambda: fim_iso)
    sessao_service.finish(ALUNO)


def test_stats_diario_usa_o_dia_do_personal(sessao, monkeypatch):
    """`STATS#D#` mora na partição do personal e alimenta o gráfico dele.

    Aluno em Tóquio, personal em São Paulo, treino terminado às 02h UTC: para o personal
    ainda é dia 7; para o aluno já é dia 8. O balde é do personal."""
    _perfis(sessao, tz_personal=SP, tz_aluno=TOKYO)
    _sessao_finalizada(sessao, monkeypatch, "2026-09-08T01:00:00Z", "2026-09-08T02:00:00Z")

    dias = [sk for (pk, sk) in sessao.itens
            if pk == keys.pk_personal(PERSONAL) and sk.startswith("STATS#D#")]
    assert dias == ["STATS#D#2026-09-07"]


def test_dow_e_semana_usam_o_fuso_do_aluno(sessao, monkeypatch):
    """Os agregados da partição do aluno seguem o calendário dele, não o do personal."""
    _perfis(sessao, tz_personal=SP, tz_aluno=TOKYO)
    # Terça 10h em Tóquio = segunda 01h UTC = domingo 22h em SP. Três dias da semana distintos.
    _sessao_finalizada(sessao, monkeypatch, "2026-09-08T01:00:00Z", "2026-09-08T02:00:00Z")

    stats = sessao.itens[(keys.pk_aluno(ALUNO), keys.SK_STATS_ALUNO)]
    assert stats.get("dow_1") == 1          # terça no fuso do aluno
    assert "dow_0" not in stats             # segunda seria o valor em UTC
    assert stats.get("streak_ultima_semana") == "2026-W37"


def test_sessao_congela_os_dois_fusos_ao_iniciar(sessao, monkeypatch):
    """`finish` é o caminho mais quente do app — os fusos vêm do item, sem leitura extra."""
    _perfis(sessao, tz_personal=SP, tz_aluno=TOKYO)
    sessao.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio(TREINO, "e-1"),
                    {"exercicio_id": "e-1", "nome": "Supino", "ordem": 0})
    item = sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)
    assert item["tz_aluno"] == TOKYO
    assert item["tz_personal"] == SP


def test_sessao_antiga_sem_fuso_gravado_continua_funcionando(sessao):
    """Dado anterior à mudança não tem `tz_aluno` — resolve pelo perfil, sem migração."""
    _perfis(sessao, tz_personal=SP, tz_aluno=TOKYO)
    antiga = {"aluno_id": ALUNO, "personal_id": PERSONAL}          # sem tz_aluno
    assert sessao_service._tz_da_sessao(antiga) == TOKYO
    assert sessao_service._tz_do_personal_da_sessao(antiga) == SP


# ── Leitura: o calendário do aluno corrige o passado sem migração ────────────

def test_historico_mes_agrupa_no_dia_do_aluno(sessao, monkeypatch):
    """Sessão às 23h de 7/9 em SP fica no dia 7, não no 8 (que é o dia UTC dela)."""
    _perfis(sessao, tz_personal=SP, tz_aluno=SP)
    _sessao_finalizada(sessao, monkeypatch, "2026-09-08T02:00:00Z", "2026-09-08T02:30:00Z")

    resumo = sessao_service.historico_mes(ALUNO, 2026, 9, incluir_fotos=False)
    assert list(resumo["dias"]) == ["2026-09-07"]


def test_historico_mes_pega_a_virada_do_mes_no_fuso_local(sessao, monkeypatch):
    """A janela alargada existe para isto: 21h de 30/9 em SP é 1/10 em UTC. Sem a folga a
    sessão sumiria do mês de setembro."""
    _perfis(sessao, tz_personal=SP, tz_aluno=SP)
    _sessao_finalizada(sessao, monkeypatch, "2026-10-01T00:30:00Z", "2026-10-01T01:00:00Z")

    setembro = sessao_service.historico_mes(ALUNO, 2026, 9, incluir_fotos=False)
    outubro = sessao_service.historico_mes(ALUNO, 2026, 10, incluir_fotos=False)
    assert list(setembro["dias"]) == ["2026-09-30"]
    assert outubro["dias"] == {}


def test_trocar_o_fuso_do_aluno_reescreve_o_calendario_inteiro(sessao, monkeypatch):
    """A razão de agrupar na leitura em vez de gravar o dia: fuso configurado errado é
    consertável, e o histórico todo se corrige junto."""
    _perfis(sessao, tz_personal=SP, tz_aluno=SP)
    _sessao_finalizada(sessao, monkeypatch, "2026-09-08T02:00:00Z", "2026-09-08T02:30:00Z")
    assert list(sessao_service.historico_mes(ALUNO, 2026, 9)["dias"]) == ["2026-09-07"]

    sessao.update_item(keys.pk_aluno(ALUNO), keys.SK_PROFILE, {"timezone": TOKYO})
    assert list(sessao_service.historico_mes(ALUNO, 2026, 9)["dias"]) == ["2026-09-08"]


# ── Data civil ───────────────────────────────────────────────────────────────

def test_hoje_das_pendencias_sai_do_fuso_do_personal(sessao, monkeypatch):
    _perfis(sessao, tz_personal=TOKYO)
    monkeypatch.setattr(locale_service, "hoje", lambda tz: f"hoje-em-{tz}")
    assert pendencia_service.hoje_iso(PERSONAL) == f"hoje-em-{TOKYO}"


def test_horario_de_verao_e_tratado_pelo_nome_iana():
    """Só o nome IANA sabe que Nova York é -5 em janeiro e -4 em julho. Com offset fixo
    gravado, metade do ano sairia errada — é por isso que a validação recusa '-3'."""
    assert locale_service.hora("2026-01-15T17:00:00Z", NY) == "12:00"   # EST, -5
    assert locale_service.hora("2026-07-15T17:00:00Z", NY) == "13:00"   # EDT, -4


# ── Cupom: data civil e instante são comparados de formas diferentes ─────────

def test_cupom_com_data_civil_nao_estoura():
    """Regressão: data civil virava datetime naive e caía em `naive < aware`, que levanta
    TypeError (não ValueError) — o except não pegava e o resgate dava 500."""
    from app.services import cupom_service
    assert cupom_service._expirado("2020-01-01") is True
    assert cupom_service._expirado("2099-12-31") is False


def test_cupom_com_instante_compara_com_agora():
    from app.services import cupom_service
    assert cupom_service._expirado("2020-01-01T00:00:00+00:00") is True
    assert cupom_service._expirado("2099-12-31T23:59:00+00:00") is False
    # Instante sem offset é assumido UTC em vez de estourar.
    assert cupom_service._expirado("2020-01-01T00:00:00") is True


def test_cupom_sem_expiracao_ou_corrompido():
    from app.services import cupom_service
    assert cupom_service._expirado(None) is False
    assert cupom_service._expirado("") is False
    # Config quebrada trava o cupom em vez de liberá-lo para sempre.
    assert cupom_service._expirado("2026-13-45T99:99:99") is True
