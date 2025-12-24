from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models import (
  ApplicationStage,
  JobType,
  OpportunitySource,
  OpportunityStatus,
  WorkMode,
)


class BaseSchema(BaseModel):
  class Config:
    from_attributes = True


# User & profile
class UserBase(BaseSchema):
  email: EmailStr
  full_name: Optional[str] = None
  phone: Optional[str] = None
  preferred_locations: List[str] = Field(default_factory=list)
  profile_links: dict[str, str] = Field(default_factory=dict)


class UserCreate(UserBase):
  id: Optional[UUID] = None


class User(UserBase):
  id: UUID
  created_at: datetime
  updated_at: datetime


class AcademicProfileBase(BaseSchema):
  degree: Optional[str] = None
  major: Optional[str] = None
  university: Optional[str] = None
  location: Optional[str] = None
  grad_year: Optional[int] = None
  gpa: Optional[str] = None
  highlights: Optional[str] = None


class AcademicProfile(AcademicProfileBase):
  id: int
  user_id: UUID
  created_at: datetime
  updated_at: datetime


class JobPreferenceBase(BaseSchema):
  desired_roles: List[str] = Field(default_factory=list)
  job_type: Optional[JobType] = None
  work_mode: Optional[WorkMode] = None
  industries: List[str] = Field(default_factory=list)
  salary_min: Optional[float] = None
  salary_max: Optional[float] = None
  priority_skills: List[str] = Field(default_factory=list)
  experience_years: int = 0


class JobPreference(JobPreferenceBase):
  id: int
  user_id: UUID
  created_at: datetime
  updated_at: datetime


# CV uploads
class CvUploadBase(BaseSchema):
  storage_url: str
  filename: str
  parsed_skills: List[str] = Field(default_factory=list)
  parsed_roles: List[str] = Field(default_factory=list)
  summary: Optional[str] = None


class CvUpload(CvUploadBase):
  id: int
  user_id: UUID
  uploaded_at: datetime


# Opportunities
class OpportunityBase(BaseSchema):
  company_name: str
  role_title: str
  job_type: Optional[JobType] = None
  work_mode: Optional[WorkMode] = None
  location: Optional[str] = None
  salary_min: Optional[float] = None
  salary_max: Optional[float] = None
  currency: Optional[str] = "INR"
  apply_link: str
  source: OpportunitySource = OpportunitySource.OFFICIAL
  status: OpportunityStatus = OpportunityStatus.OPEN
  status_note: Optional[str] = None
  source_metadata: dict = Field(default_factory=dict)


class Opportunity(OpportunityBase):
  id: UUID
  last_checked_at: Optional[datetime] = None
  created_at: datetime
  updated_at: datetime


# User opportunities + status
class UserOpportunityBase(BaseSchema):
  opportunity_id: UUID
  match_reason: Optional[str] = None
  stage: ApplicationStage = ApplicationStage.SUGGESTED
  notes: Optional[str] = None


class UserOpportunity(UserOpportunityBase):
  id: int
  user_id: UUID
  created_at: datetime
  updated_at: datetime
  opportunity: Opportunity | None = None


class StatusHistory(BaseSchema):
  id: int
  user_opportunity_id: int
  status: ApplicationStage
  comment: Optional[str] = None
  created_at: datetime

from .queue import SearchQueueCreate, SearchQueueResponse, DiscoverRequest

