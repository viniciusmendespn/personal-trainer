"""Orquestrador do agente (OpenAI) — roda no backend, dispara as ferramentas do
agent_service e devolve a resposta curta para o WhatsApp.

Padrão de chamada igual ao gerenciador-financeiro (chat/completions via httpx), com a
diferença de que o loop de tool-calling roda aqui. Persona e estilo: FUNCIONAL §7–§12.
"""
import json
import logging

import httpx

from app.config import settings
from app.repositories import dynamo_repo as repo
from app.repositories import keys
from app.services import agent_service, sessao_service

logger = logging.getLogger(__name__)

_URL = "https://api.openai.com/v1/chat/completions"
_MAX_STEPS = 5

_SYSTEM = """Você é o assistente de treino de um personal trainer, conversando com o ALUNO no WhatsApp.
Estilo (obrigatório):
- Curto e direto: 1 a 3 linhas. Nada de textos longos ou listas grandes.
- No máximo UMA pergunta por vez.
- Não envie o treino inteiro de uma vez, a menos que peçam.

Contexto e registros:
- Carga/repetições sempre pertencem a um exercício. Se há exercício atual na sessão, use-o.
- Se não estiver claro de qual exercício o aluno fala, pergunte ANTES de registrar.
- Confirme registros de forma objetiva (ex.: "Registrado no Supino reto.").
- Se a ferramenta retornar `pr` (novo recorde de carga), comemore em 1 linha (ex.: "🏆 Novo recorde!").
- Use os IDs de exercício/treino fornecidos no contexto; nunca invente IDs, cargas ou histórico.
- Dor/desconforto: acolha, registre e diga que o personal foi avisado; não oriente progressão.
- Use as ferramentas para ler/gravar. Se faltar dado, pergunte ao aluno."""

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
]


def _context(aluno_id: str) -> str:
    s = sessao_service.get_active(aluno_id, consistent=True)
    if not s:
        treinos = repo.query_pk(keys.pk_aluno(aluno_id), sk_prefix=keys.SK_TREINO_PREFIX)
        lst = [{"id": t["treino_id"], "nome": t.get("nome")} for t in treinos]
        return json.dumps({"sessao_ativa": False, "treinos": lst}, ensure_ascii=False)
    ex = s.get("ex_atual") or {}
    return json.dumps({
        "sessao_ativa": True,
        "treino": s.get("treino_nome"),
        "exercicio_atual": {"id": ex.get("exercicio_id"), "nome": ex.get("nome"),
                            "series": ex.get("series"), "reps": ex.get("reps_prescritas"),
                            "carga": ex.get("carga_prescrita")},
        "exercicios": [{"id": e["exercicio_id"], "nome": e.get("nome")} for e in s.get("exercicios", [])],
    }, ensure_ascii=False)


def _exec(name: str, args: dict, personal_id: str, aluno_id: str) -> dict:
    if name == "registrar":
        return agent_service.registrar(aluno_id, args.get("series", []), args.get("exercicio_id"))
    if name == "consultar_historico":
        return agent_service.consultar_historico(aluno_id, args.get("exercicio_id"))
    if name == "avancar":
        return agent_service.avancar(aluno_id)
    if name == "finalizar":
        return agent_service.finalizar(aluno_id)
    if name == "iniciar_sessao":
        return agent_service.iniciar_sessao(personal_id, aluno_id, args.get("treino_id"))
    if name == "registrar_dor":
        return agent_service.registrar_dor(personal_id, aluno_id, args.get("descricao", ""))
    return {"erro": "ferramenta desconhecida"}


def run(personal_id: str, aluno_id: str, nome: str | None, text: str) -> str:
    """Processa uma mensagem do aluno e devolve a resposta curta (str vazia = não responder)."""
    if not settings.openai_api_key:
        logger.warning("[agent] OPENAI_API_KEY ausente — sem resposta")
        return ""
    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "system", "content": f"Aluno: {nome or 'aluno'}. Contexto: {_context(aluno_id)}"},
        {"role": "user", "content": text or ""},
    ]
    headers = {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}
    for _ in range(_MAX_STEPS):
        payload = {"model": settings.openai_model, "messages": messages,
                   "tools": _TOOLS, "tool_choice": "auto"}
        try:
            with httpx.Client(timeout=25.0) as c:
                r = c.post(_URL, json=payload, headers=headers)
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
                result = _exec(tc["function"]["name"], args, personal_id, aluno_id)
            except Exception as e:  # ferramenta falhou (ex.: sem sessão) — devolve ao modelo
                result = {"erro": str(e)}
            messages.append({"role": "tool", "tool_call_id": tc["id"],
                             "content": json.dumps(result, ensure_ascii=False)})
    return "Ok."
