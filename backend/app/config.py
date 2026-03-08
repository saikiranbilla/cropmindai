from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    anthropic_api_key: str
    supabase_url: str
    supabase_service_key: str
    frontend_url: str = "http://localhost:5173"


# Single instance imported everywhere
settings = Settings()
