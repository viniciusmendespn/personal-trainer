"""Férias / ausências do aluno — CRUD na partição AL#{aluno_id}.

Registro permanente (sem TTL): o aluno (ou o personal) informa períodos de ausência com
antecedência para o personal se programar na vigência dos treinos. Aparecem no calendário
do histórico (via `sessao_service.historico_mes`) e geram um alerta informativo no portal
quando um treino vigora dentro do período."""
import logging
from calendar import monthrange

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import notif_service
from app.utils import epoch_ms, new_id, now_iso

logger = logging.getLogger(__name__)


def _aluno_nome(personal_id: str, aluno_id: str) -> str | None:
    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id))
    return (ptr or {}).get("nome")


def _br(data_iso: str) -> str:
    """YYYY-MM-DD → DD/MM (para mensagens)."""
    p = (data_iso or "").split("-")
    return f"{p[2]}/{p[1]}" if len(p) == 3 else data_iso


def criar(aluno_id: str, personal_id: str, dados: dict, criado_por: str = "PERSONAL") -> dict:
    ferias_id = new_id()
    ts = epoch_ms()
    item = {
        "ferias_id": ferias_id, "aluno_id": aluno_id, "personal_id": personal_id,
        "criado_por": criado_por, "created_at": now_iso(), "ts": str(ts),
        **dados,
    }
    repo.put_item(keys.pk_aluno(aluno_id), keys.sk_ferias(str(ts), ferias_id), item)
    if criado_por == "ALUNO":
        nome = _aluno_nome(personal_id, aluno_id) or "O aluno"
        notif_service.criar(
            personal_id, "FERIAS_ALUNO", "Aluno registrou férias",
            f"{nome} ficará ausente de {_br(dados.get('data_inicio', ''))} "
            f"a {_br(dados.get('data_fim', ''))}.",
            aluno_id=aluno_id,
        )
    return item


def listar(aluno_id: str) -> list[dict]:
    items = repo.clean_all(repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.FERIAS_PREFIX))
    items.sort(key=lambda x: x.get("data_inicio", ""))
    return items


def atualizar(aluno_id: str, ts: str, ferias_id: str, campos: dict) -> dict | None:
    campos = {k: v for k, v in campos.items() if v is not None}
    if not campos:
        return None
    return repo.clean(repo.update_item_if_exists(keys.pk_aluno(aluno_id), keys.sk_ferias(ts, ferias_id), campos))


def excluir(aluno_id: str, ts: str, ferias_id: str) -> bool:
    return repo.delete_item_if_exists(keys.pk_aluno(aluno_id), keys.sk_ferias(ts, ferias_id))


def periodos_no_mes(aluno_id: str, ano: int, mes: int) -> list[str]:
    """Conjunto de dias ISO (YYYY-MM-DD) do mês cobertos por algum período de férias.
    Cobre também períodos que começam em mês anterior e entram neste. Cardinalidade baixa
    (poucos períodos/ano) → listagem simples + interseção em memória."""
    try:
        ini_mes = f"{ano:04d}-{mes:02d}-01"
        fim_mes = f"{ano:04d}-{mes:02d}-{monthrange(ano, mes)[1]:02d}"
        dias: set[str] = set()
        for f in listar(aluno_id):
            fi, ff = f.get("data_inicio"), f.get("data_fim")
            if not fi or not ff:
                continue
            lo = max(fi, ini_mes)
            hi = min(ff, fim_mes)
            if lo > hi:
                continue
            d = int(lo[8:10])
            while d <= int(hi[8:10]):
                dias.add(f"{ano:04d}-{mes:02d}-{d:02d}")
                d += 1
        return sorted(dias)
    except Exception:
        logger.exception("[ferias] periodos_no_mes falhou: aluno=%s %s-%s", aluno_id, ano, mes)
        return []
