"""Servidor MCP remoto do CoachPilot.

O personal conecta o ChatGPT/Claude/Gemini que ele já paga e conversa direto com os
próprios dados. Automatiza o copia-e-cola que hoje é manual (frontend/public/prompt-treino-aluno.md).

Módulos:
  tokens.py   — access token HS256 + contexto de tenant (ContextVar)
  oauth.py    — authorization server próprio (DCR + PKCE + code + refresh rotativo)
  jsonrpc.py  — transporte MCP Streamable HTTP, stateless
  tools.py    — as tools expostas ao LLM
  asgi.py     — FastAPI + handler Lambda
"""
