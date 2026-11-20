"""Typed settings loaded from ``ECUADOR_DATA_*`` environment variables."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ecuador_data import __version__


class Settings(BaseSettings):
    """Runtime configuration for the data pipeline.

    Every field maps to a documented environment variable with the
    ``ECUADOR_DATA_`` prefix, for example ``ECUADOR_DATA_DATA_DIR``.
    """

    model_config = SettingsConfigDict(
        env_prefix="ECUADOR_DATA_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    data_dir: Path = Path("data")
    http_timeout_s: float = Field(default=30.0, gt=0)
    http_retries: int = Field(default=4, ge=1, le=10)
    user_agent: str = Field(
        default=(
            f"ecuador-data/{__version__} "
            "(+https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop)"
        ),
        min_length=1,
    )
    log_level: str = Field(default="INFO", min_length=1)


def load_settings() -> Settings:
    return Settings()
