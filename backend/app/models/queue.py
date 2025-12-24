from __future__ import annotations

import uuid
from enum import Enum

from sqlalchemy import (
  Column,
  DateTime,
  Enum as SAEnum,
  String,
  text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base

class SearchStatus(str, Enum):
  PENDING = "pending"
  PROCESSING = "processing"
  COMPLETED = "completed"
  FAILED = "failed"

class SearchQueue(Base):
  __tablename__ = "search_queue"

  id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
  )
  user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
  status: Mapped[SearchStatus] = mapped_column(
    SAEnum(SearchStatus, name="search_status_enum"),
    nullable=False,
    default=SearchStatus.PENDING,
  )
  query: Mapped[str] = mapped_column(String(512), nullable=False)
  resolved_locations_source = Column(String, nullable=True)
  filters = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
  
  # New Columns for Super Worker
  task_type = Column(String(50), nullable=False, server_default="SEARCH") # 'SEARCH' or 'ATS'
  payload = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb")) # Extra data like resume_text

  created_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True), nullable=False, server_default=func.now()
  )
  updated_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True),
    nullable=False,
    server_default=func.now(),
    onupdate=func.now(),
  )

