"""Volume por grupo muscular com exercício multi-grupo e com agregado legado composto.

O agregado é escrito na hora do registro (`STATS#G#{grupo}` / `STATS#WG#{semana}#{grupo}`), o
que trazia duas consequências: exercício de peito+tríceps só sabia somar num bucket, e a base
já tem agregados gravados sob a chave composta "peito, triceps" — uma barra própria no gráfico,
separada de "peito". Aqui o contrato é: escrita credita cada grupo, leitura quebra o composto
legado, e as duas séries do gráfico (`volume_por_grupo` e `semanas[].grupos`) batem entre si.
"""
import pytest

from app.repositories import keys
from app.services import sessao_service

PERSONAL = "p-1"
ALUNO = "a-1"
TREINO = "t-1"


def _stats_grupo(fake) -> dict[str, float]:
    """Agregado all-time por grupo, indexado pela chave do SK."""
    prefixo = keys.sk_stats_grupo("")
    return {sk[len(prefixo):]: i.get("volume")
            for (pk, sk), i in fake.itens.items()
            if pk == keys.pk_aluno(ALUNO) and sk.startswith(prefixo)}


@pytest.fixture
def sessao(repo_fake, monkeypatch):
    from app.services import notif_service
    monkeypatch.setattr(notif_service, "_disparar_push_personal", lambda *a, **k: None)
    repo_fake.put_item(keys.pk_aluno(ALUNO), keys.sk_treino(TREINO),
                       {"treino_id": TREINO, "nome": "Treino A"})
    repo_fake.put_item(keys.pk_personal(PERSONAL), keys.sk_aluno_pointer(ALUNO), {"nome": "Aluno"})
    return repo_fake


def _exercicio(fake, ex_id: str, nome: str, ordem: int = 0, **grupo_campos) -> None:
    fake.put_item(keys.pk_aluno(ALUNO), keys.sk_exercicio(TREINO, ex_id),
                  {"exercicio_id": ex_id, "nome": nome, "ordem": ordem, **grupo_campos})


# ── Escrita: um agregado por grupo ───────────────────────────────────────────

def test_exercicio_multi_grupo_credita_cada_grupo(sessao):
    _exercicio(sessao, "e-1", "Supino reto", grupos=["Peito", "Tríceps"])
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])   # 500 kg

    # O volume vai INTEIRO para cada grupo: é o que "volume por grupo muscular" significa.
    assert _stats_grupo(sessao) == {"peito": 500, "triceps": 500}


def test_exercicio_de_um_grupo_so_segue_igual(sessao):
    _exercicio(sessao, "e-1", "Rosca direta", grupos=["Bíceps"])
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 20}])

    assert _stats_grupo(sessao) == {"biceps": 200}


def test_exercicio_sem_grupo_cai_em_sem_grupo(sessao):
    _exercicio(sessao, "e-1", "Exercício solto")
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 30}])

    assert _stats_grupo(sessao) == {"sem grupo": 300}


def test_exercicio_legado_com_grupo_composto_ja_e_creditado_separado(sessao):
    """Exercício antigo, nunca reeditado: a quebra do `grupo` acontece na hora de creditar."""
    _exercicio(sessao, "e-1", "Supino reto", grupo="Peito, Tríceps")
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])

    assert _stats_grupo(sessao) == {"peito": 500, "triceps": 500}


def test_edicao_de_series_ajusta_todos_os_grupos_pelo_delta(sessao):
    """`set_series` substitui — o delta tem que descer em cada grupo, senão o gráfico infla."""
    _exercicio(sessao, "e-1", "Supino reto", grupos=["Peito", "Tríceps"])
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)

    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])   # 500
    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 30}])   # 300

    assert _stats_grupo(sessao) == {"peito": 300, "triceps": 300}


def test_grupos_do_snapshot_sobrevivem_a_troca_do_programa(sessao):
    """A sessão carrega o próprio snapshot: apagar o EX# no meio do treino não perde o grupo."""
    _exercicio(sessao, "e-1", "Supino reto", grupos=["Peito", "Tríceps"])
    sessao_service.start_session(PERSONAL, ALUNO, TREINO, iniciado_pelo_aluno=True)
    sessao.delete_item(keys.pk_aluno(ALUNO), keys.sk_exercicio(TREINO, "e-1"))

    sessao_service.set_series(ALUNO, "e-1", [{"reps": 10, "carga": 50}])

    assert _stats_grupo(sessao) == {"peito": 500, "triceps": 500}


# ── Leitura: o composto legado some do gráfico ───────────────────────────────

def _semear_agregado_legado(fake, grupo: str, volume: float, semana: str) -> None:
    """Simula o que a base já tem: agregados gravados antes do campo múltiplo existir."""
    chave = grupo.lower()
    fake.add_and_set(keys.pk_aluno(ALUNO), keys.sk_stats_grupo(chave),
                     add={"volume": volume}, set_={"grupo": grupo})
    fake.add_and_set(keys.pk_aluno(ALUNO), keys.sk_stats_week_grupo(semana, chave),
                     add={"volume": volume}, set_={"semana": semana, "grupo": grupo})
    fake.add_and_set(keys.pk_aluno(ALUNO), keys.sk_stats_week(semana),
                     add={"volume": volume}, set_={"semana": semana})


def test_resumo_quebra_o_agregado_composto_legado(sessao):
    semana = sessao_service._isoweek()
    _semear_agregado_legado(sessao, "peito, triceps", 500, semana)

    resumo = sessao_service.resumo_aluno(ALUNO)

    por_grupo = {g["grupo"]: g["volume"] for g in resumo["volume_por_grupo"]}
    assert por_grupo == {"Peito": 500, "Triceps": 500}
    # "Peito, triceps" não existe mais como barra própria.
    assert not any("," in g for g in por_grupo)


def test_resumo_soma_legado_composto_e_agregado_novo_no_mesmo_grupo(sessao):
    """O caso real: histórico antigo sob "peito, triceps" + registros novos sob "peito"."""
    semana = sessao_service._isoweek()
    _semear_agregado_legado(sessao, "peito, triceps", 500, semana)
    _semear_agregado_legado(sessao, "peito", 200, semana)

    resumo = sessao_service.resumo_aluno(ALUNO)

    por_grupo = {g["grupo"]: g["volume"] for g in resumo["volume_por_grupo"]}
    assert por_grupo == {"Peito": 700, "Triceps": 500}


def test_semanas_e_volume_por_grupo_usam_os_mesmos_rotulos(sessao):
    """O gráfico empilhado lê os nomes de `volume_por_grupo` e os valores de `semanas[].grupos`:
    rótulo divergente entre os dois vira barra vazia."""
    semana = sessao_service._isoweek()
    _semear_agregado_legado(sessao, "peito, triceps", 500, semana)

    resumo = sessao_service.resumo_aluno(ALUNO)

    nomes = {g["grupo"] for g in resumo["volume_por_grupo"]}
    da_semana = next(w for w in resumo["semanas"] if w["semana"] == semana)
    assert set(da_semana["grupos"]) == nomes
    assert da_semana["grupos"] == {"Peito": 500, "Triceps": 500}
