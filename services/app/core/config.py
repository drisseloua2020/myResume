from __future__ import annotations
from functools import lru_cache
from pathlib import Path
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MYRESUMES_FRONTEND_ORIGINS = (
    "https://myresumes.net",
    "https://www.myresumes.net",
    "https://myresume-rrcy.onrender.com",
)
DATABASE_SCHEMA_REVISION = "0007_mock_provider_operations"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite+pysqlite:///./app.db"
    jwt_secret: str = "change-me"
    jwt_expires_in: str = "15m"
    port: int = 3000
    cors_origins: str = Field(default="http://localhost:4000,http://127.0.0.1:4000")
    include_legacy_frontend_aliases: bool = True
    smtp_host: str = ""
    smtp_port: int | None = None
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = "admin@myresume.net"
    upload_dir: str = "protected_uploads"
    upload_url_prefix: str = "/uploads"
    max_profile_photo_bytes: int = 5 * 1024 * 1024
    oauth_frontend_url: str = "http://localhost:4000"
    oauth_redirect_base_url: str = ""
    oauth_state_ttl_seconds: int = 600
    oauth_cookie_secure: bool = False
    max_request_bytes: int = 15 * 1024 * 1024
    auth_requests_per_minute: int = 20
    free_resumes_per_day: int = 10
    mock_providers_enabled: bool = False
    jwt_issuer: str = "myresume"
    jwt_audience: str = "myresume-api"
    forwarded_allow_ips: str = "127.0.0.1"
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    microsoft_oauth_client_id: str = ""
    microsoft_oauth_client_secret: str = ""
    microsoft_oauth_tenant: str = "common"
    linkedin_oauth_client_id: str = ""
    linkedin_oauth_client_secret: str = ""
    @property
    def upload_root(self) -> Path:
        path = Path(self.upload_dir)
        return path if path.is_absolute() else Path.cwd() / path
    @property
    def allowed_origins(self) -> list[str]:
        extras = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        seen: list[str] = []
        for origin in extras:
            if origin not in seen:
                seen.append(origin)
        # Existing deployments used these exact aliases for the same frontend.
        if self.include_legacy_frontend_aliases and any(origin in seen for origin in MYRESUMES_FRONTEND_ORIGINS):
            for origin in MYRESUMES_FRONTEND_ORIGINS:
                if origin not in seen:
                    seen.append(origin)
        return seen
    def validate_runtime_settings(self) -> None:
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is required")
        if not self.jwt_secret:
            raise RuntimeError("JWT_SECRET is required")
        if self.app_env == "production":
            if self.mock_providers_enabled:
                raise RuntimeError("Mock providers cannot be enabled in production")
            if self.forwarded_allow_ips.strip() == "*":
                raise RuntimeError("Trust only your reverse proxy addresses, never all forwarded headers")
            if len(self.jwt_secret) < 32 or self.jwt_secret in {"change-me", "test-secret"}:
                raise RuntimeError("Production JWT_SECRET must be a random secret of at least 32 characters")
            if not self.database_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
                raise RuntimeError("Production requires PostgreSQL")
            if not self.allowed_origins or any(not origin.startswith("https://") for origin in self.allowed_origins):
                raise RuntimeError("Production CORS_ORIGINS must contain only explicit HTTPS origins")
            if not self.oauth_cookie_secure or not self.oauth_frontend_url.startswith("https://"):
                raise RuntimeError("Production OAuth requires HTTPS and OAUTH_COOKIE_SECURE=true")
@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
settings = get_settings()
