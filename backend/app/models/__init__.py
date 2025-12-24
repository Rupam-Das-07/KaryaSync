from __future__ import annotations

import uuid
from enum import Enum

from sqlalchemy import (
  Column,
  DateTime,
  Enum as SAEnum,
  ForeignKey,
  Integer,
  Numeric,
  String,
  Text,
  text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class JobType(str, Enum):
  INTERNSHIP = "internship"
  FULL_TIME = "full_time"
  CONTRACT = "contract"


class WorkMode(str, Enum):
  ONSITE = "onsite"
  HYBRID = "hybrid"
  REMOTE = "remote"


class OpportunitySource(str, Enum):
  LINKEDIN = "linkedin"
  UNSTOP = "unstop"
  OFFICIAL = "official"
  REFERRAL = "referral"
  OTHER = "other"


class OpportunityStatus(str, Enum):
  OPEN = "open"
  CLOSED = "closed"
  HOLD = "hold"


class ApplicationStage(str, Enum):
  SUGGESTED = "suggested"
  SAVED = "saved"
  APPLIED = "applied"
  INTERVIEW = "interview"
  OFFER = "offer"
  REJECTED = "rejected"


class User(Base):
  __tablename__ = "users"

  id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
  )
  email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
  full_name: Mapped[str | None] = mapped_column(String(255))
  phone: Mapped[str | None] = mapped_column(String(32))
  preferred_locations = Column(
    JSONB, nullable=False, server_default=text("'[]'::jsonb")
  )
  profile_links = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
  created_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True), nullable=False, server_default=func.now()
  )
  updated_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True),
    nullable=False,
    server_default=func.now(),
    onupdate=func.now(),
  )

  academic_profile: Mapped["AcademicProfile"] = relationship(
    back_populates="user", uselist=False
  )
  job_preference: Mapped["JobPreference"] = relationship(
    back_populates="user", uselist=False
  )
  cv_uploads: Mapped[list["CvUpload"]] = relationship(back_populates="user")
  applications: Mapped[list["UserOpportunity"]] = relationship(
    back_populates="user", cascade="all, delete-orphan"
  )





class AcademicProfile(Base):
  __tablename__ = "academic_profiles"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  university = Column(String, nullable=True)
  degree = Column(String, nullable=True)
  major = Column(String, nullable=True)
  location = Column(String, nullable=True)
  grad_year = Column(Integer, nullable=True)
  gpa = Column(String, nullable=True)
  highlights = Column(String, nullable=True)

  created_at = Column(DateTime, default=func.now())
  updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

  user = relationship("User", back_populates="academic_profile")


class CvUpload(Base):
  __tablename__ = "cv_uploads"

  id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
  user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
  )
  storage_url: Mapped[str] = mapped_column(String(512), nullable=False)
  filename: Mapped[str] = mapped_column(String(255), nullable=False)
  uploaded_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )
  parsed_skills = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
  parsed_roles = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
  summary: Mapped[str | None] = mapped_column(Text)

  user: Mapped[User] = relationship(back_populates="cv_uploads")


class JobPreference(Base):
  __tablename__ = "job_preferences"

  id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
  user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
  )
  desired_roles = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
  job_type: Mapped[JobType | None] = mapped_column(
    SAEnum(JobType, name="job_type_enum"), nullable=True
  )
  work_mode: Mapped[WorkMode | None] = mapped_column(
    SAEnum(WorkMode, name="work_mode_enum"), nullable=True
  )
  industries = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
  salary_min: Mapped[float | None] = mapped_column(Numeric(10, 2))
  salary_max: Mapped[float | None] = mapped_column(Numeric(10, 2))
  priority_skills = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
  experience_years: Mapped[int] = mapped_column(Integer, default=0)
  created_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )
  updated_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
  )

  user: Mapped[User] = relationship(back_populates="job_preference")


class Opportunity(Base):
  __tablename__ = "job_listings"

  id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
  )
  company_name: Mapped[str] = mapped_column(String(255), nullable=False)
  role_title: Mapped[str] = mapped_column(String(255), nullable=False)
  job_type: Mapped[JobType | None] = mapped_column(
    SAEnum(JobType, name="job_type_enum"), nullable=True
  )
  work_mode: Mapped[WorkMode | None] = mapped_column(
    SAEnum(WorkMode, name="work_mode_enum"), nullable=True
  )
  location: Mapped[str | None] = mapped_column(String(255))
  salary_min: Mapped[float | None] = mapped_column(Numeric(10, 2))
  salary_max: Mapped[float | None] = mapped_column(Numeric(10, 2))
  currency: Mapped[str | None] = mapped_column(String(8), default="INR")
  apply_link: Mapped[str] = mapped_column(String(512), nullable=False)
  source: Mapped[OpportunitySource] = mapped_column(
    SAEnum(OpportunitySource, name="opportunity_source_enum"),
    nullable=False,
    default=OpportunitySource.OFFICIAL,
  )
  status: Mapped[OpportunityStatus] = mapped_column(
    SAEnum(OpportunityStatus, name="opportunity_status_enum"),
    nullable=False,
    default=OpportunityStatus.OPEN,
  )
  status_note: Mapped[str | None] = mapped_column(Text)
  last_checked_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
  source_metadata = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
  created_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )
  updated_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
  )

  applications: Mapped[list["UserOpportunity"]] = relationship(
    back_populates="opportunity", cascade="all, delete-orphan"
  )


class UserOpportunity(Base):
  __tablename__ = "user_opportunities"

  id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
  user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
  )
  opportunity_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("job_listings.id", ondelete="CASCADE"),
    nullable=False,
  )
  match_reason: Mapped[str | None] = mapped_column(Text)
  stage: Mapped[ApplicationStage] = mapped_column(
    SAEnum(ApplicationStage, name="application_stage_enum"),
    nullable=False,
    default=ApplicationStage.SUGGESTED,
  )
  notes: Mapped[str | None] = mapped_column(Text)
  created_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )
  updated_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
  )

  user: Mapped[User] = relationship(back_populates="applications")
  opportunity: Mapped[Opportunity] = relationship(back_populates="applications")
  history: Mapped[list["StatusHistory"]] = relationship(
    back_populates="user_opportunity", cascade="all, delete-orphan"
  )


class StatusHistory(Base):
  __tablename__ = "status_history"

  id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
  user_opportunity_id: Mapped[int] = mapped_column(
    Integer, ForeignKey("user_opportunities.id", ondelete="CASCADE"), nullable=False
  )
  status: Mapped[ApplicationStage] = mapped_column(
    SAEnum(ApplicationStage, name="application_stage_enum"), nullable=False
  )
  comment: Mapped[str | None] = mapped_column(Text)
  created_at: Mapped[DateTime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )

  user_opportunity: Mapped[UserOpportunity] = relationship(back_populates="history")


from app.models.queue import SearchQueue, SearchStatus


