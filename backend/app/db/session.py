from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from sqlalchemy.pool import NullPool

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    poolclass=NullPool,
    connect_args={"sslmode": "require"}  # Enforce SSL for Supabase
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()

