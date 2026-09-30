from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SentinelX"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql://sentinelx:sentinelx@localhost:5432/sentinelx_db"

    # External APIs
    NEWS_API_KEY: str = ""
    WEATHER_API_KEY: str = ""

    # LLM configuration (Strictly Gemini as per SentinelX specification)
    LLM_API_KEY: str = ""
    LLM_PROVIDER: str = "gemini"

    # CORS configuration for frontend
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
