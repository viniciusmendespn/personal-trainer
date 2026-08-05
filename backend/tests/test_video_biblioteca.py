"""Prioridade do vídeo da biblioteca do personal sobre o vídeo vindo do arquivo/IA (helpers puros,
sem DynamoDB)."""
from app.services.biblioteca_service import eh_busca_youtube, resolver_video, url_busca_youtube

VIDEO_LIB = "https://www.youtube.com/watch?v=DA_BIBLIOTECA"
VIDEO_IA = "https://www.youtube.com/watch?v=DA_IA"
MAPA = {"supino reto com barra": VIDEO_LIB}


def test_eh_busca_youtube():
    assert eh_busca_youtube(url_busca_youtube("Supino Reto")) is True
    assert eh_busca_youtube(VIDEO_LIB) is False
    assert eh_busca_youtube(None) is False


def test_biblioteca_vence_o_video_da_ia():
    assert resolver_video("Supino Reto com Barra", VIDEO_IA, MAPA) == VIDEO_LIB


def test_casa_por_chave_canonica_ignorando_acento_e_caixa():
    """A IA não precisa acertar acento/caixa para herdar o vídeo já cadastrado."""
    assert resolver_video("SUPINO RETO COM BARRA", None, MAPA) == VIDEO_LIB
    assert resolver_video("Tríceps na Polia", None, {"triceps na polia": VIDEO_LIB}) == VIDEO_LIB


def test_exercicio_fora_da_biblioteca_mantem_o_video_da_ia():
    assert resolver_video("Remada Cavalinho", VIDEO_IA, MAPA) == VIDEO_IA


def test_busca_nunca_vira_video():
    """Nem vinda da IA, nem vinda de item antigo da biblioteca com o fallback gravado."""
    assert resolver_video("Remada Cavalinho", url_busca_youtube("Remada Cavalinho"), MAPA) is None
    mapa_so_busca = {"remada cavalinho": url_busca_youtube("Remada Cavalinho")}
    assert resolver_video("Remada Cavalinho", VIDEO_IA, mapa_so_busca) == VIDEO_IA


def test_sem_video_em_lugar_nenhum():
    """`None` é o certo — o app cai na busca do YouTube pelo nome na hora de exibir."""
    assert resolver_video("Remada Cavalinho", None, MAPA) is None
