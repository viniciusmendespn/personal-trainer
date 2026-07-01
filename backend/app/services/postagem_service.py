"""Postagens unificadas de exercício — texto + mídias em um item POST# (ESPEC §feed)."""
from app.models.enums import CanalOrigem
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import anotif_service, notif_service
from app.services.sessao_service import chave_exercicio
from app.utils import epoch_ms, new_id, now_iso


def criar_postagem(
    aluno_id: str,
    exercicio_id: str,
    exercicio_nome: str | None,
    tipo: str,
    descricao: str | None,
    midias: list[dict],
    sessao_id: str | None,
    ator: str,
    personal_id: str | None = None,
) -> dict:
    """Cria um item POST# com texto e/ou mídias já enviados via presigned URL.

    midias = [{"s3_key": str, "tipo": str}] — URLs geradas no read, não armazenadas.
    """
    ts = epoch_ms()
    post_id = new_id()
    sk = keys.sk_post(exercicio_id, ts, post_id)
    item = {
        "post_id": post_id,
        "tipo": tipo,
        "ator": ator,
        "exercicio_id": exercicio_id,
        "exercicio_nome": exercicio_nome,
        "chave": chave_exercicio(exercicio_nome or ""),
        "descricao": descricao,
        "texto": descricao,       # alias usado pelo CorrecaoItem no frontend
        "midias": midias,
        "comentarios": [],
        "canal_origem": CanalOrigem.PORTAL.value,
        "data_hora": now_iso(),
        "respondido": False,
        **({"sessao_id": sessao_id} if sessao_id else {}),
    }
    repo.put_item(keys.pk_aluno(aluno_id), sk, item)

    ex_nome = exercicio_nome or "um exercício"
    if ator == "ALUNO":
        # Aluno posta → notifica o personal
        if tipo == "DOR" and personal_id:
            notif_service.criar(
                personal_id, "DOR", "Relato de dor",
                f"O aluno relatou dor em {ex_nome}: {descricao}",
                aluno_id=aluno_id,
                ref_extra={"relato_sk": sk, "relato_tipo": "dor", "exercicio_id": exercicio_id,
                          "tem_midia": bool(midias)},
            )
        elif tipo == "DUVIDA" and personal_id:
            notif_service.criar(
                personal_id, "DUVIDA", "Dúvida do aluno",
                f"O aluno teve uma dúvida em {ex_nome}: {descricao}",
                aluno_id=aluno_id,
                ref_extra={"relato_sk": sk, "relato_tipo": "duvida", "exercicio_id": exercicio_id,
                          "tem_midia": bool(midias)},
            )
        elif tipo == "EXECUCAO" and personal_id:
            notif_service.criar(
                personal_id, "EXECUCAO", "Execução registrada",
                f"O aluno registrou a execução de {ex_nome}" + (" com mídia anexada." if midias else "."),
                aluno_id=aluno_id,
                ref_extra={"exercicio_id": exercicio_id, "exercicio_nome": exercicio_nome,
                          "tem_midia": bool(midias)},
            )
        elif tipo == "OUTRO" and personal_id:
            notif_service.criar(
                personal_id, "OUTRO", "Observação do aluno",
                f"O aluno postou uma observação em {ex_nome}.",
                aluno_id=aluno_id,
                ref_extra={"relato_sk": sk, "relato_tipo": "outro", "exercicio_id": exercicio_id,
                          "tem_midia": bool(midias)},
            )
    else:
        # Personal posta → notifica o aluno
        if tipo == "CORRECAO":
            anotif_service.criar(
                aluno_id, "CORRECAO_EXERCICIO", "Correção do personal",
                f"Seu personal postou uma correção em {ex_nome}.",
                ref_extra={"ref_id": post_id, "exercicio_id": exercicio_id},
            )
        elif tipo == "EXECUCAO":
            anotif_service.criar(
                aluno_id, "MIDIA_PERSONAL", "Demonstração do personal",
                f"Seu personal postou uma demonstração em {ex_nome}.",
                ref_extra={"ref_id": post_id, "exercicio_id": exercicio_id},
            )
        elif tipo == "OUTRO":
            anotif_service.criar(
                aluno_id, "MIDIA_PERSONAL", "Observação do personal",
                f"Seu personal postou uma observação em {ex_nome}.",
                ref_extra={"ref_id": post_id, "exercicio_id": exercicio_id},
            )
    return item
