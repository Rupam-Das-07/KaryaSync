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
) -> List[Opportunity]:
  stmt = select(Opportunity)
  if source:
    stmt = stmt.filter(Opportunity.source == source)
  if status:
    stmt = stmt.filter(Opportunity.status == status)
  stmt = stmt.order_by(Opportunity.created_at.desc())
  return list(db.scalars(stmt))


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

