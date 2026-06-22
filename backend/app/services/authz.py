"""Autorização de acesso a um aluno (ESPEC §2.2). O personal só acessa alunos que
possui — validado pelo ponteiro PT#{personal}/ALUNO#{aluno}. Cache em memória do
container quente com TTL curto (preferir revalidar a servir autorização velha)."""
import time

from fastapi import HTTPException

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import assinatura_service

_cache: dict[tuple[str, str], float] = {}
_TTL = 120  # s


def authorize_aluno(personal_id: str, aluno_id: str) -> None:
    key = (personal_id, aluno_id)
    now = time.time()
    exp = _cache.get(key)
    if exp and exp > now:
        return
    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_aluno_pointer(aluno_id))
    if not ptr:
        raise HTTPException(404, "Aluno não encontrado")
    if aluno_id in assinatura_service.get_alunos_bloqueados(personal_id):
        raise HTTPException(403, {"code": "ALUNO_BLOCKED_BY_PLAN"})
    _cache[key] = now + _TTL


def invalidate(personal_id: str, aluno_id: str) -> None:
    _cache.pop((personal_id, aluno_id), None)
