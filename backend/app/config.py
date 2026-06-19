from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    table_name: str = "personal-trainer-prod"
    cognito_user_pool_id: str = ""
    cognito_region: str = "us-east-1"
    stage: str = "dev"
    wapi_base_url: str = "https://api.w-api.app"
    webhook_secret: str = ""
    webhook_base_url: str = ""            # base pública da API (p/ auto-configurar o webhook na W-API)
    frontend_url: str = ""                # URL do frontend (p/ magic-link do app do aluno)
    media_bucket_name: str = ""
    openai_api_key: str = ""              # key SEPARADA deste app (custo isolado)
    openai_model: str = "gpt-5.4-nano"

    # Provider do agente — "openai" (padrão) ou "fusion" (gateway interno, formato Azure
    # OpenAI). Trocar é só mudar LLM_PROVIDER; reversível sem alterar código (llm_agent.py).
    llm_provider: str = "openai"
    fusion_api_key: str = ""
    fusion_base_url: str = "https://fusion-llm.brq.com"
    fusion_api_version: str = "2025-03-01-preview"
    admin_secret: str = ""                 # protege POST /v1/wapi/config (só scripts admin)

    class Config:
        env_file = (".env", ".env.local")
        extra = "ignore"


settings = Settings()
