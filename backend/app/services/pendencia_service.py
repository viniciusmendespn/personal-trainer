"""Pendências do aluno — situações que exigem ação do personal (aluno sem treino vigente,
parado há dias, mensalidade em atraso).

São **derivadas**, nunca persistidas: não há status aberta/resolvida nem histórico — a pendência
some sozinha quando a causa é resolvida. Isso mantém a verdade sempre coerente com os dados e
dispensa job de reconciliação.

Dois caminhos de leitura, mesmas regras:
  • listagem de alunos → insumos denormalizados no ponteiro PT#{personal}/ALUNO#{aluno}
    (`vigencias`, `ultimo_treino_em`) e PT#{personal}/COBRANCA_ALUNO#{aluno} (`vencidas`),
    lidos em 2 queries na mesma partição, O(1) no número de alunos;
  • aba do aluno → recálculo exato na partição do próprio aluno (fan-out de 1).

Datas no fuso do personal, via `hoje_iso(personal_id)` — ver `docs/TIMEZONE.md` §1.2: prazo e
vencimento são data civil, não instante, e comparar com o dia UTC os adiantava em 3h no BRT.
"""
from datetime import date

from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import locale_service
from app.utils import treino_vigente, treinos_validos

DIAS_SEM_TREINAR = 10       # a partir de quantos dias sem sessão finalizada vira pendência
# Aluno recém-cadastrado não pode estar "sem treinar há N dias". Acoplado ao limiar de propósito:
# desacoplar faria quem nunca treinou alarmar antes de quem treinou uma vez e parou.
GRACA_ALUNO_NOVO_DIAS = DIAS_SEM_TREINAR

SEM_TREINO_VIGENTE = "SEM_TREINO_VIGENTE"
SEM_TREINAR = "SEM_TREINAR"
PAGAMENTO_ATRASADO = "PAGAMENTO_ATRASADO"

# tipo → (severidade, título, aba do cadastro que resolve)
_META: dict[str, tuple[str, str, str]] = {
    SEM_TREINO_VIGENTE: ("alta", "Sem treino vigente", "treinos"),
    SEM_TREINAR: ("media", "Sem treinar", "historico"),
    PAGAMENTO_ATRASADO: ("alta", "Pagamento em atraso", "financeiro"),
}


def hoje_iso(personal_id: str | None = None) -> str:
    """Hoje no calendário do PERSONAL — é a worklist dele, e as datas que ela compara
    (vencimento de cobrança) são datas civis dele.

    Fuso do personal, e não de cada aluno, também por custo: a listagem avalia N alunos numa
    passada só; resolver o fuso de cada um seria N leituras de perfil — o fan-out que a
    arquitetura evita. `date.today()` aqui era o dia UTC, que no BRT vira 3h cedo."""
    return locale_service.hoje(locale_service.tz_do_personal(personal_id))


def _pendencia(tipo: str, detalhe: str | None = None) -> dict:
    severidade, titulo, tab = _META[tipo]
    return {"tipo": tipo, "severidade": severidade, "titulo": titulo,
            "detalhe": detalhe, "tab": tab}


def dias_desde(iso: str | None, hoje: str) -> int | None:
    """Dias inteiros entre um ISO (data ou datetime) e `hoje`. None se ausente/inválido."""
    if not iso:
        return None
    try:
        d = date.fromisoformat(str(iso)[:10])
    except ValueError:
        return None
    return (date.fromisoformat(hoje) - d).days


def janela_vigente(v: dict, hoje: str) -> bool:
    """Espelha `utils.treino_vigente` sobre a janela denormalizada {i: início, f: fim}.
    Só janelas de treinos ativos são gravadas no ponteiro — `ativo` já está filtrado."""
    if v.get("i") and hoje < v["i"]:
        return False
    if v.get("f") and hoje > v["f"]:
        return False
    return True


def tem_vigente(vigencias: list[dict] | None, hoje: str) -> bool | None:
    """True/False se dá pra decidir; None quando o ponteiro ainda não tem o atributo
    (aluno legado, antes do backfill) — nesse caso a regra não dispara, para não alarmar falso."""
    if vigencias is None:
        return None
    return any(janela_vigente(v, hoje) for v in vigencias)


def avaliar(
    *,
    status: str | None,
    bloqueado: bool,
    created_at: str | None,
    vigencias: list[dict] | None,
    ultimo_treino_em: str | None,
    vencidas: int,
    hoje: str,
) -> list[dict]:
    """Pendências de um aluno a partir dos insumos já resolvidos pelo chamador.
    Função pura — é o único lugar onde as regras vivem."""
    if bloqueado or status == "INATIVO":
        return []   # aluno fora de operação não gera cobrança de atenção

    out: list[dict] = []

    if tem_vigente(vigencias, hoje) is False:
        out.append(_pendencia(SEM_TREINO_VIGENTE, "Nenhum treino ativo dentro do período de hoje."))

    dias = dias_desde(ultimo_treino_em, hoje)
    dias_cadastro = dias_desde(created_at, hoje)
    # Aluno novo ainda não teve tempo de acumular ausência — evita alarme no dia do cadastro.
    novo = dias_cadastro is not None and dias_cadastro < GRACA_ALUNO_NOVO_DIAS
    if not novo:
        if dias is None:
            out.append(_pendencia(SEM_TREINAR, "Nunca registrou um treino."))
        elif dias >= DIAS_SEM_TREINAR:
            out.append(_pendencia(SEM_TREINAR, f"Último treino há {dias} dias."))

    if vencidas > 0:
        plural = "s" if vencidas > 1 else ""
        out.append(_pendencia(PAGAMENTO_ATRASADO, f"{vencidas} cobrança{plural} vencida{plural}."))

    return out


def resumo(pendencias: list[dict]) -> list[dict]:
    """Versão enxuta para o card da listagem — sem `detalhe`/`tab`, que só a aba usa."""
    return [{"tipo": p["tipo"], "severidade": p["severidade"], "titulo": p["titulo"]}
            for p in pendencias]


# ── Cálculo exato (aba do aluno) ─────────────────────────────────────────────

def _fmt_data(iso: str) -> str:
    return f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}"


def detalhar(
    *,
    status: str | None,
    bloqueado: bool,
    created_at: str | None,
    treinos: list[dict],
    ultimo_treino: str | None,
    cobrancas_vencidas: list[dict],
    hoje: str,
) -> list[dict]:
    """Mesmas regras, com os dados exatos da partição do aluno e detalhe rico para a aba.
    Não depende de nenhum campo denormalizado — é a versão autoritativa."""
    vigencias = [{k: v for k, v in (("i", t.get("data_inicio")), ("f", t.get("data_fim"))) if v}
                 for t in treinos if t.get("ativo", True)]
    pend = avaliar(status=status, bloqueado=bloqueado, created_at=created_at,
                   vigencias=vigencias, ultimo_treino_em=ultimo_treino,
                   vencidas=len(cobrancas_vencidas), hoje=hoje)

    por_tipo = {p["tipo"]: p for p in pend}

    if SEM_TREINO_VIGENTE in por_tipo:
        expirados = [t for t in treinos if not treino_vigente(t, hoje)]
        if not treinos:
            detalhe = "Este aluno ainda não tem nenhum treino cadastrado."
        elif expirados:
            nomes = ", ".join(t.get("nome", "treino") for t in expirados[:3])
            detalhe = f"{len(expirados)} treino(s) fora de vigência: {nomes}."
        else:
            detalhe = "Nenhum treino ativo dentro do período de hoje."
        por_tipo[SEM_TREINO_VIGENTE]["detalhe"] = detalhe

    if SEM_TREINAR in por_tipo and ultimo_treino:
        dias = dias_desde(ultimo_treino, hoje)
        por_tipo[SEM_TREINAR]["detalhe"] = (
            f"Último treino em {_fmt_data(str(ultimo_treino)[:10])} — há {dias} dias."
        )

    if PAGAMENTO_ATRASADO in por_tipo:
        total = sum(float(c.get("valor", 0) or 0) for c in cobrancas_vencidas)
        venc = sorted(str(c.get("vencimento", "")) for c in cobrancas_vencidas if c.get("vencimento"))
        n = len(cobrancas_vencidas)
        plural = "s" if n > 1 else ""
        detalhe = f"{n} cobrança{plural} vencida{plural}, total de R$ {total:.2f}"
        if venc:
            detalhe += f" — a mais antiga venceu em {_fmt_data(venc[0])}"
        por_tipo[PAGAMENTO_ATRASADO]["detalhe"] = detalhe + "."

    return pend


def do_aluno(personal_id: str, aluno_id: str, aluno: dict, bloqueado: bool) -> list[dict]:
    """Pendências exatas de um aluno (aba do cadastro). 3 leituras na partição do aluno —
    fan-out de 1, o aluno já está aberto na tela.

    Aproveita para corrigir o contador denormalizado `vencidas` quando ele divergir do real:
    a listagem se autoconserta toda vez que o personal abre o aluno, sem job de reconciliação."""
    hoje = hoje_iso(personal_id)
    treinos = treinos_validos(repo.query_pk(keys.pk_aluno(aluno_id),
                                            sk_prefix=keys.SK_TREINO_PREFIX))
    stats = repo.get_item(keys.pk_aluno(aluno_id), keys.SK_STATS_ALUNO) or {}
    vencidas = [c for c in repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.COBRANCA_PREFIX)
                if c.get("status") == "VENCIDA" and c.get("personal_id") == personal_id]

    ptr = repo.get_item(keys.pk_personal(personal_id), keys.sk_cobranca_aluno(aluno_id)) or {}
    if int(ptr.get("vencidas", 0) or 0) != len(vencidas) and (ptr or vencidas):
        repo.update_item(keys.pk_personal(personal_id), keys.sk_cobranca_aluno(aluno_id),
                         {"aluno_id": aluno_id, "vencidas": len(vencidas)})

    return detalhar(
        status=aluno.get("status"), bloqueado=bloqueado, created_at=aluno.get("created_at"),
        treinos=treinos, ultimo_treino=stats.get("ultimo_treino"),
        cobrancas_vencidas=vencidas, hoje=hoje,
    )
