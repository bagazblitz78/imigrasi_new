"""Application configuration.

All environment-specific values are injected at runtime so the same immutable
Docker image can be deployed to development, staging and production.

In production the application fails fast if critical secrets are missing or
obviously insecure (requirement 86/108).
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Secrets that must never be used in production.
_INSECURE_SECRETS = {
    "",
    "change_me",
    "changeme",
    "secret",
    "change_me_in_production_use_openssl_rand_hex_32",
    "ganti_ini_dengan_random_64_hex",
    "ganti_ini",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_NAME: str = "Sistem Imigrasi API"
    APP_VERSION: str = "dev"
    API_BASE_URL: str = ""

    # ── JWT / session ────────────────────────────────────────────────────────
    JWT_SECRET: str = ""
    # Backward compatibility with the legacy deployment that used SECRET_KEY.
    SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "imigrasi-api"
    JWT_AUDIENCE: str = "imigrasi-web"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 1

    # ── Database ─────────────────────────────────────────────────────────────
    DB_HOST: str = "mariadb"
    DB_PORT: int = 3306
    DB_NAME: str = "imigrasi_db"
    DB_USER: str = "imigrasi_user"
    DB_PASSWORD: str = "change_me"
    DB_SSL: bool = False

    # ── Cookie / CSRF ────────────────────────────────────────────────────────
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: Optional[str] = None
    CSRF_HEADER: str = "X-CSRF-Token"
    REFRESH_COOKIE_NAME: str = "imigrasi_refresh"
    CSRF_COOKIE_NAME: str = "imigrasi_csrf"

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:8080"]

    # ── Login rate limiting ──────────────────────────────────────────────────
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_WINDOW_SECONDS: int = 900
    LOGIN_LOCKOUT_SECONDS: int = 900

    # ── Upload / MRZ ─────────────────────────────────────────────────────────
    UPLOAD_MAX_SIZE: int = 8 * 1024 * 1024
    MRZ_PROCESSING_TIMEOUT: int = 30

    # ── Observability / SSE ──────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "plain"  # plain | json
    SSE_ENABLED: bool = True

    # ── Derived ──────────────────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def secret_key(self) -> str:
        return self.JWT_SECRET or self.SECRET_KEY

    @property
    def database_url(self) -> str:
        from urllib.parse import quote_plus

        pwd = quote_plus(self.DB_PASSWORD)
        return (
            f"mysql+aiomysql://{self.DB_USER}:{pwd}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def sync_database_url(self) -> str:
        """Used by Alembic (sync driver) and tooling."""
        from urllib.parse import quote_plus

        pwd = quote_plus(self.DB_PASSWORD)
        return (
            f"mysql+pymysql://{self.DB_USER}:{pwd}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    # ── Validators ───────────────────────────────────────────────────────────
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _parse_origins(cls, value):
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    pass
            return [item.strip() for item in text.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _validate_production(self) -> "Settings":
        if not self.is_production:
            if not self.secret_key:
                # Deterministic-but-explicit dev fallback, clearly not for prod.
                self.JWT_SECRET = "dev-only-insecure-secret"
            return self

        errors: list[str] = []
        secret = self.secret_key.strip()
        if secret.lower() in _INSECURE_SECRETS or len(secret) < 32:
            errors.append(
                "JWT_SECRET wajib diisi dengan nilai acak minimal 32 karakter di production"
            )
        if self.DB_PASSWORD.strip().lower() in _INSECURE_SECRETS:
            errors.append("DB_PASSWORD wajib diisi dengan password kuat di production")
        if not self.ALLOWED_ORIGINS:
            errors.append("ALLOWED_ORIGINS wajib diisi di production")
        if "*" in self.ALLOWED_ORIGINS:
            errors.append("ALLOWED_ORIGINS tidak boleh '*' jika credentials diaktifkan")
        if not self.COOKIE_SECURE:
            errors.append("COOKIE_SECURE harus true di production (wajib HTTPS)")
        if self.APP_VERSION == "dev":
            errors.append("APP_VERSION tidak boleh 'dev' di production")
        if errors:
            raise ValueError(
                "Konfigurasi production tidak valid:\n- " + "\n- ".join(errors)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
