from typing import Any, List, Union
from pydantic import field_validator
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

    # Scheduled Refresh (Phase 5)
    ENABLE_SCHEDULER: bool = False
    RISK_REFRESH_INTERVAL_MINUTES: int = 60

    # CORS configuration for frontend
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return v

    @field_validator("RISK_REFRESH_INTERVAL_MINUTES")
    @classmethod
    def validate_refresh_interval(cls, v: int) -> int:
        if v < 1:
            raise ValueError("RISK_REFRESH_INTERVAL_MINUTES must be >= 1 minute")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
