from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
  """Central place to access environment-driven configuration."""

  def __init__(self) -> None:
    self.database_url = self._normalize_db_url(self._require("DATABASE_URL"))
    self.supabase_url = self._require("SUPABASE_URL")
    self.supabase_anon_key = self._require("SUPABASE_ANON_KEY")
    self.supabase_service_role_key = self._require("SUPABASE_SERVICE_ROLE_KEY")
    self.supabase_storage_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "cv-uploads")

  @staticmethod
  def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
      raise RuntimeError(f"Environment variable '{key}' is required but missing.")
    return value

  @staticmethod
  def _normalize_db_url(url: str) -> str:
    """Ensure SQLAlchemy uses the psycopg driver when only a generic URL is provided."""
    if url.startswith("postgresql://"):
      return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@lru_cache
def get_settings() -> Settings:
  return Settings()


settings = get_settings()

