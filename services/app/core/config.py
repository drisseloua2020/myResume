from __future__ import annotations
from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite+pysqlite:///./app.db"
    jwt_secret: str = "change-me"
    jwt_expires_in: str = "15m"
    port: int = 3000
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"
    gemini_temperature: float = 0.4
    cors_origins: str = Field(default="http://localhost:4000,http://127.0.0.1:4000")
    smtp_host: str = ""
    smtp_port: int | None = None
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = "myresume_team@myresume.ai"
    @property
    def allowed_origins(self) -> list[str]:
        defaults = ["http://localhost:4000", "http://127.0.0.1:4000"]
        extras = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        seen: list[str] = []
        for origin in defaults + extras:
            if origin not in seen:
                seen.append(origin)
        return seen
    def validate_runtime_settings(self) -> None:
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is required")
        if not self.jwt_secret:
            raise RuntimeError("JWT_SECRET is required")
@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
settings = get_settings()
