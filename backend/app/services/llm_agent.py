"""Orquestrador do agente (OpenAI) — roda no backend, dispara as ferramentas do
agent_service e devolve a resposta curta para o WhatsApp.

Padrão de chamada igual ao gerenciador-financeiro (chat/completions via httpx), com a
diferença de que o loop de tool-calling roda aqui. Persona e estilo: FUNCIONAL §7–§12.
"""
import json
import logging

import httpx

from app.config import settings
from app.models.enums import Ator, CanalOrigem
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import agent_service, sessao_service

logger = logging.getLogger(__name__)

_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
_MAX_STEPS = 5


def _active_key() -> str:
    return settings.fusion_api_key if settings.llm_provider == "fusion" else settings.openai_api_key


def _endpoint_and_headers() -> tuple[str, dict]:
    """Provider do agente — trocar via LLM_PROVIDER (config.py), sem mudar nada aqui além
    desta função. 'fusion' = gateway interno, formato Azure OpenAI (deployment na URL)."""
    if settings.llm_provider == "fusion":
        url = (f"{settings.fusion_base_url}/openai/deployments/{settings.openai_model}"
               f"/chat/completions?api-version={settings.fusion_api_version}")
        headers = {"Authorization": f"Bearer {settings.fusion_api_key}",
                  "Content-Type": "application/json", "Accept": "application/json"}
        return url, headers
    headers = {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}
    return _OPENAI_URL, headers

_SYSTEM = """Você é o assistente de treino de um personal trainer, conversando com o ALUNO no WhatsApp.

ESTILO (obrigatório):
- Curto e direto: 1 a 3 linhas. Nunca listas enormes nem parágrafos.
- No máximo UMA pergunta por vez.

FLUXO — início de treino (sem sessão ativa):
1. O contexto já traz `ultimo` (último treino feito + data) e `proximo` (próximo na rotação).
   Sugira o `proximo` e mencione o último: "Último foi [X] em [data]. Próximo seria [Y]. Quer começar?"
2. Permita que o aluno escolha outro treino. Se não tiver certeza, chame listar_treinos.
3. Quando o aluno confirmar o treino: chame detalhar_treino e apresente um resumo COMPACTO:
   - Nome do treino e foco (1 linha)
   - Cada exercício em 1 linha: "1. Supino reto — 4×10, 30 kg, 90s [Supino reto](https://...)"
   - Se o exercício tiver `video`, inclua o link em formato Markdown ao final da linha: [nome do exercício](url).
4. Pergunte se está pronto ou tem alguma dúvida antes de começar.
5. Só então chame iniciar_sessao.

FLUXO — durante a sessão:
- Ao anunciar cada exercício (início ou após avancar): nome, séries×reps, carga prescrita.
  Se tiver `video` no exercício atual do contexto, inclua o link em formato Markdown: [nome do exercício](url).
- Peça a carga e reps executadas. Registre com a ferramenta `registrar`.
- Após confirmar o registro, pergunte: "Ficou com alguma dúvida ou sentiu alguma dor?"
- Se reportar dor: use registrar_dor, diga que o personal foi avisado. Não oriente progressão.
- Use `avancar` para ir ao próximo exercício. Ao finalizar, use `finalizar`.

REGRAS gerais:
- Se a ferramenta retornar `pr`, comemore em 1 linha (ex.: "🏆 Novo recorde!").
- Use os IDs do contexto; nunca invente IDs, cargas ou histórico.
- Se não estiver claro de qual exercício o aluno fala, pergunte ANTES de registrar.
- Se o aluno iniciou o treino errado, use cancelar_sessao e depois iniciar_sessao com o correto.
- "Vigente" = ativo e dentro de data_inicio/data_fim (se informados)."""

_TOOLS = [
    {"type": "function", "function": {
        "name": "registrar",
        "description": "Registra as séries executadas no exercício atual (ou no exercicio_id informado).",
        "parameters": {"type": "object", "properties": {
            "series": {"type": "array", "items": {"type": "object", "properties": {
                "carga": {"type": "string"}, "reps": {"type": "integer"},
                "rpe": {"type": "number"}}}},
            "exercicio_id": {"type": "string"}},
            "required": ["series"]}}},
    {"type": "function", "function": {
        "name": "consultar_historico",
        "description": "Último registro de um exercício (carga/reps anteriores).",
        "parameters": {"type": "object", "properties": {
            "exercicio_id": {"type": "string"}}, "required": ["exercicio_id"]}}},
    {"type": "function", "function": {
        "name": "avancar", "description": "Avança para o próximo exercício da sessão.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "finalizar", "description": "Finaliza a sessão de treino atual.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "iniciar_sessao", "description": "Inicia uma sessão de um treino pelo treino_id.",
        "parameters": {"type": "object", "properties": {
            "treino_id": {"type": "string"}}, "required": ["treino_id"]}}},
    {"type": "function", "function": {
        "name": "registrar_dor",
        "description": "Registra dor/desconforto do aluno e avisa o personal. Não orientar progressão.",
        "parameters": {"type": "object", "properties": {
            "descricao": {"type": "string"}}, "required": ["descricao"]}}},
    {"type": "function", "function": {
        "name": "buscar_exercicio",
        "description": "Acha um exercício do aluno por nome — use p/ obter o id, o vídeo de referência "
                       "(campo video) ou registrar/consultar um exercício que não é o atual.",
        "parameters": {"type": "object", "properties": {
            "nome": {"type": "string"}}, "required": ["nome"]}}},
    {"type": "function", "function": {
        "name": "treino_de_hoje",
        "description": "Retorna o(s) treino(s) agendado(s) para hoje (use quando o aluno perguntar "
                       "qual o treino do dia).",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "enviar_link_portal",
        "description": "Gera o link do app do aluno (campo link) quando ele pedir para acessar/ver "
                       "no aplicativo. Responda com o link.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "listar_treinos",
        "description": "Lista todos os treinos do aluno com indicação de quais são vigentes "
                       "(vigente=true: ativo e dentro do período). Use quando o aluno perguntar "
                       "quais treinos tem disponíveis ou qual treino fazer.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "detalhar_treino",
        "description": "Retorna os exercícios de um treino com prescrição completa (séries, reps, "
                       "carga, intervalo, vídeo, observações). Use quando o aluno quiser saber o "
                       "que tem no Treino X antes de iniciar ou pedir detalhes de um treino.",
        "parameters": {"type": "object", "properties": {
            "treino_id": {"type": "string"}}, "required": ["treino_id"]}}},
    {"type": "function", "function": {
        "name": "cancelar_sessao",
        "description": "Cancela/desfaz a sessão ativa sem gravar histórico (como se nunca tivesse "
                       "começado). Use quando o aluno iniciou o treino errado e quer recomeçar.",
        "parameters": {"type": "object", "properties": {}}}},
]


def _context(aluno_id: str) -> str:
    s = repo.clean(sessao_service.get_active(aluno_id, consistent=True))
    if not s:
        from datetime import date
        hoje_str = date.today().isoformat()
        treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
        lst = [{"id": t["treino_id"], "nome": t.get("nome"), "foco": t.get("foco"),
                "vigente": agent_service._treino_vigente(t, hoje_str)}
               for t in treinos if t.get("ativo", True)]
        rot = sessao_service.ultimo_e_proximo(aluno_id)
        return json.dumps({"sessao_ativa": False, "treinos": lst,
                           "ultimo": rot.get("ultimo"), "proximo": rot.get("proximo")},
                          ensure_ascii=False)
    ex = s.get("ex_atual") or {}
    return json.dumps({
        "sessao_ativa": True,
        "treino": s.get("treino_nome"),
        "exercicio_atual": {"id": ex.get("exercicio_id"), "nome": ex.get("nome"),
                            "series": ex.get("series"), "reps": ex.get("reps_prescritas"),
                            "carga": ex.get("carga_prescrita")},
        "exercicios": [{"id": e["exercicio_id"], "nome": e.get("nome")} for e in s.get("exercicios", [])],
    }, ensure_ascii=False)


def _exec(name: str, args: dict, personal_id: str, aluno_id: str,
         canal: CanalOrigem, ator: Ator) -> dict:
    if name == "registrar":
        return agent_service.registrar(aluno_id, args.get("series", []), args.get("exercicio_id"),
                                       canal=canal, ator=ator)
    if name == "consultar_historico":
        return agent_service.consultar_historico(aluno_id, args.get("exercicio_id"))
    if name == "avancar":
        return agent_service.avancar(aluno_id)
    if name == "finalizar":
        return agent_service.finalizar(aluno_id)
    if name == "iniciar_sessao":
        return agent_service.iniciar_sessao(personal_id, aluno_id, args.get("treino_id"))
    if name == "registrar_dor":
        return agent_service.registrar_dor(personal_id, aluno_id, args.get("descricao", ""),
                                           canal=canal, ator=ator)
    if name == "buscar_exercicio":
        return agent_service.buscar_exercicio(aluno_id, args.get("nome", ""))
    if name == "treino_de_hoje":
        return agent_service.treino_de_hoje(aluno_id)
    if name == "enviar_link_portal":
        return agent_service.enviar_link_portal(aluno_id, personal_id)
    if name == "listar_treinos":
        return agent_service.listar_treinos(aluno_id)
    if name == "detalhar_treino":
        return agent_service.detalhar_treino(aluno_id, args.get("treino_id", ""))
    if name == "cancelar_sessao":
        return agent_service.cancelar_sessao(aluno_id)
    return {"erro": "ferramenta desconhecida"}


def run(personal_id: str, aluno_id: str, nome: str | None, text: str,
        history: list[dict] | None = None,
        canal: CanalOrigem = CanalOrigem.WHATSAPP, ator: Ator = Ator.ALUNO) -> str:
    """Processa uma mensagem do aluno (ou do personal "atuando como" o aluno) e devolve a
    resposta curta (str vazia = não responder). `history` = turnos anteriores
    [{role, content}] para a desambiguação multi-turno (FUNCIONAL §9). `canal`/`ator`
    identificam a origem real da mensagem (RN010) — propagados às ferramentas que gravam
    registros/dor; default = comportamento atual do WhatsApp."""
    if not _active_key():
        logger.warning("[agent] chave da LLM ausente (provider=%s) — sem resposta", settings.llm_provider)
        return ""
    url, headers = _endpoint_and_headers()
    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "system", "content": f"Aluno: {nome or 'aluno'}. Contexto: {_context(aluno_id)}"},
        *(history or []),
        {"role": "user", "content": text or ""},
    ]
    for _ in range(_MAX_STEPS):
        payload = {"model": settings.openai_model, "messages": messages,
                   "tools": _TOOLS, "tool_choice": "auto"}
        try:
            with httpx.Client(timeout=25.0) as c:
                r = c.post(url, json=payload, headers=headers)
        except httpx.HTTPError as e:
            logger.error("[agent] openai erro de rede: %s", e)
            return "Tive um problema agora. Pode repetir?"
        if not r.is_success:
            logger.error("[agent] openai %d: %s", r.status_code, r.text[:300])
            return "Tive um problema agora. Pode repetir?"
        msg = r.json()["choices"][0]["message"]
        tool_calls = msg.get("tool_calls")
        if not tool_calls:
            return (msg.get("content") or "").strip()
        messages.append(msg)
        for tc in tool_calls:
            try:
                args = json.loads(tc["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            try:
                result = _exec(tc["function"]["name"], args, personal_id, aluno_id, canal, ator)
            except Exception as e:  # ferramenta falhou (ex.: sem sessão) — devolve ao modelo
                result = {"erro": str(e)}
            messages.append({"role": "tool", "tool_call_id": tc["id"],
                             "content": json.dumps(result, ensure_ascii=False)})
    return "Ok."
