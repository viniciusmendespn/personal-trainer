from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    table_name: str = "personal-trainer-prod"
    cognito_user_pool_id: str = ""
    cognito_region: str = "us-east-1"
    stage: str = "dev"
    wapi_base_url: str = "https://api.w-api.app"
    webhook_secret: str = ""
    webhook_base_url: str = ""            # base pública da API (p/ auto-configurar o webhook na W-API)
    media_bucket_name: str = ""
    openai_api_key: str = ""              # key SEPARADA deste app (custo isolado)
    openai_model: str = "gpt-5.4-nano"

    class Config:
        env_file = (".env", ".env.local")
        extra = "ignore"


settings = Settings()
