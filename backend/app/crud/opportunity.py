from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.models import (
  Opportunity,
  OpportunitySource,
  OpportunityStatus,
  UserOpportunity,
)


def create_opportunity(
  db: Session, opportunity_in: schemas.OpportunityBase
) -> Opportunity:
  opportunity = Opportunity(**opportunity_in.model_dump())
  db.add(opportunity)
  db.commit()
  db.refresh(opportunity)
  return opportunity


def list_opportunities(
  db: Session,
  *,
  source: Optional[OpportunitySource] = None,
  status: Optional[OpportunityStatus] = None,
  job_type: Optional[schemas.JobType] = None,
  skip: int = 0,
  limit: int = 20,
) -> tuple[List[Opportunity], int]:
  stmt = select(Opportunity)
  if source:
    stmt = stmt.filter(Opportunity.source == source)
  if status:
    stmt = stmt.filter(Opportunity.status == status)
  if job_type:
    stmt = stmt.filter(Opportunity.job_type == job_type)
  
  # Total count query
  # Note: A separate count query is often cleaner or func.count()
  # For simplicity with the existing select structure:
  from sqlalchemy import func
  count_stmt = select(func.count()).select_from( stmt.subquery() )
  total = db.scalar(count_stmt) or 0

  # Pagination
  stmt = stmt.order_by(Opportunity.created_at.desc())
  stmt = stmt.offset(skip).limit(limit)
  
  return list(db.scalars(stmt)), total


def create_user_opportunity(
  db: Session, user_id: str, payload: schemas.UserOpportunityBase
) -> UserOpportunity:
  record = UserOpportunity(user_id=user_id, **payload.model_dump())
  db.add(record)
  db.commit()
  db.refresh(record)
  return record


def update_user_opportunity_stage(
  db: Session, record_id: int, stage: schemas.ApplicationStage, note: str | None = None
) -> Optional[UserOpportunity]:
  record = db.get(UserOpportunity, record_id)
  if not record:
    return None
  record.stage = stage
  if note:
    record.notes = note
  db.commit()
  db.refresh(record)
  return record

