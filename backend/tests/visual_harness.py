"""Harness SOMENTE local: iframe MCP Apps + OAuth de teste + backend em memória.

Não é importado pela aplicação. Nunca usa AWS, contas ou dados de produção.
"""
import json
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from fake_repo import FakeRepo
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.config import settings
settings.mcp_compat_mode = False
from app.repositories import dynamo_repo as repo, keys
from app.services import authz, programa_commit_service as commits
from app.mcp import tools, tokens, ui_resources
from app.mcp.asgi import app

settings.mcp_token_secret = "harness-local-only"
settings.mcp_server_url = "http://127.0.0.1:8766"
settings.mcp_ui_enabled = settings.mcp_propostas_enabled = settings.mcp_aplicacao_enabled = True
fake = FakeRepo()
for name in dir(fake):
    if not name.startswith('_') and callable(getattr(fake, name)) and hasattr(repo, name):
        setattr(repo, name, getattr(fake, name))
authz.assinatura_service.get_alunos_bloqueados = lambda _: set()
client = TestClient(app)
from app.mcp import compat_visual_jsonrpc
compat_app = FastAPI()
compat_app.include_router(compat_visual_jsonrpc.router)
compat_client = TestClient(compat_app)
PID, AID = "harness-personal", "harness-mariana"


def reset():
    fake.itens.clear()
    authz._cache.clear()
    for read in (False, True):
        fake.put_item(keys.pk_personal(PID), keys.sk_mcp_conn('read' if read else 'write'), {
            "conn_id": 'read' if read else 'write', "client_name": "Harness",
            "scopes": [tokens.SCOPE_READ] if read else [tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE]})
    fake.put_item(keys.pk_personal(PID), keys.sk_aluno_pointer(AID), {"aluno_id": AID,
        "nome": "Mariana", "objetivos": ["Hipertrofia"], "vigencias": [], "status": "ATIVO"})
    fake.put_item(keys.pk_aluno(AID), keys.SK_PROFILE, {"nome": "Mariana", "objetivos": ["Hipertrofia"]})
    fake.put_item(keys.pk_aluno(AID), keys.SK_ANAMNESE_ALUNO,
        {"preenchido_em": "2026-09-29", "respostas": {"restricoes": "Dor no ombro relatada pelo aluno",
            "fumante": False, "objetivo_extra": ["Postura", "Condicionamento"]}})
    fake.put_item(keys.pk_personal(PID), keys.SK_ANAMNESE_TEMPLATE, {"perguntas": []}) if hasattr(keys, 'SK_ANAMNESE_TEMPLATE') else None


def rpc(payload, read=False, compat=False):
    scopes = [tokens.SCOPE_READ] if read else [tokens.SCOPE_READ, tokens.SCOPE_TREINOS_WRITE]
    token, _ = tokens.emitir_access_token(PID, 'read' if read else 'write', scopes, "Harness")
    return (compat_client if compat else client).post('/mcp', json=payload, headers={"Authorization": f"Bearer {token}"}).json()


PAGE = '''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>CoachPilot — harness local</title></head><body style="margin:0">
<button id="proposal">Revisar proposta de teste</button><iframe title="CoachPilot" style="width:100%;height:calc(100vh - 44px);border:0" src="/_test/ui"></iframe>
<script>
const frame = document.querySelector('iframe'); const query = new URLSearchParams(location.search);
frame.src = '/_test/ui?' + query; window.messages = []; window.contexts = [];
window.addEventListener('message', async event => {
 if (event.source !== frame.contentWindow || !event.data || event.data.jsonrpc !== '2.0') return;
 const msg = event.data; if (!('id' in msg)) return;
 let result = {};
 if (msg.method === 'ui/initialize') result = {protocolVersion: msg.params.protocolVersion, hostInfo: {name: 'local-test', version: '1'},
 hostCapabilities: {serverTools: {}, updateModelContext: {}, message: {}, openLinks: {}},
 hostContext: {theme: query.get('theme') || 'light', displayMode: query.get('mode') || 'inline', availableDisplayModes: query.get('nofs') ? ['inline'] : ['inline', 'fullscreen']}};
 else if (msg.method === 'tools/call') {
  const resp = await fetch('/mcp?' + query, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(msg)});
  const envelope = await resp.json(); frame.contentWindow.postMessage(envelope, location.origin); return;
 } else if (msg.method === 'ui/message') window.messages.push(msg.params);
 else if (msg.method === 'ui/update-model-context') window.contexts.push(msg.params);
 else if (msg.method === 'ui/request-display-mode') { result = {mode:msg.params.mode}; frame.contentWindow.postMessage({jsonrpc:'2.0', method:'ui/notifications/host-context-changed', params:{displayMode:msg.params.mode}},location.origin); }
 frame.contentWindow.postMessage({jsonrpc:'2.0', id:msg.id, result},location.origin);
});
document.getElementById('proposal').onclick = async () => {
 const r = await (await fetch('/_test/proposal?' + query, {method:'POST'})).json();
 frame.contentWindow.postMessage({jsonrpc:'2.0', method:'ui/notifications/tool-result', params:r.result},location.origin);
};
</script></body></html>'''


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass
    def send(self, data, kind='application/json'):
        raw = data.encode() if isinstance(data, str) else json.dumps(data, ensure_ascii=False, default=list).encode()
        self.send_response(200)
        self.send_header('Content-Type', kind + '; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        if self.path.startswith('/_test/ui'):
            r = rpc({"jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": {"uri": ui_resources.URI}})
            self.send(r['result']['contents'][0]['text'], 'text/html')
        elif self.path.startswith('/_test/status'):
            self.send({"revisao": commits.revisao(AID), "treinos": fake.clean_all(fake.query_pk(keys.pk_aluno(AID), 'TREINO#'))})
        else:
            self.send(PAGE, 'text/html')
    def do_POST(self):
        if self.path.startswith('/_test/reset'):
            reset(); self.send({"ok": True}); return
        if self.path.startswith('/_test/evolution'):
            for i, (value, unit) in enumerate([(20, 'kg'), (40, 'lb'), (10, None)]):
                fake.put_item(keys.pk_aluno(AID), f'REG#teste#{i}', {
                    "data_hora": datetime.now(timezone.utc).isoformat(),
                    "series_exec": [{"carga": value, "reps": 10}], "unidade_carga": unit,
                    "GSI1PK": keys.gsi1_registro(AID, 'supino'), "GSI1SK": str(i)})
            self.send({"ok": True}); return
        if self.path.startswith('/_test/legacy-program'):
            fake.put_item(keys.pk_aluno(AID), keys.sk_treino('legacy'),
                {"treino_id": "legacy", "nome": "Treino anterior", "ativo": True, "ordem": 0})
            fake.put_item(keys.pk_aluno(AID), keys.sk_exercicio('legacy', 'exercise'),
                {"exercicio_id": "exercise", "treino_id": "legacy", "nome": "Supino", "ordem": 0,
                 "series_prescritas": [{"series": 3, "reps": "10", "carga": "20"}]})
            self.send({"ok": True}); return
        if self.path.startswith('/_test/proposal'):
            saved = rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
                "name": "salvar_proposta_programa", "arguments": {"aluno_id": AID,
                    "revisao_base": commits.revisao(AID), "resumo_da_mudanca": "Primeiro programa de força",
                    "programa": {"version": "1", "treinos": [{"nome": "Treino A", "exercicios": [{
                        "nome": "Supino", "series_prescritas": [{"series": 3, "reps": "10", "carga": "20"}]}]}]}}}})
            self.send(rpc({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {
                "name": "mostrar_proposta_programa", "arguments": {"aluno_id": AID,
                    "proposta_id": saved['result']['structuredContent']['proposta_id']}}}, read='read=1' in self.path)); return
        if self.path.startswith('/mcp'):
            payload = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            self.send(rpc(payload, read='read=1' in self.path, compat='compat=1' in self.path)); return
        self.send({"error": "rota desconhecida"})


if __name__ == '__main__':
    reset()
    ThreadingHTTPServer(('127.0.0.1', 8766), Handler).serve_forever()
