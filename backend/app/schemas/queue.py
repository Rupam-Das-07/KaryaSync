from datetime import datetime
from typing import Any, Dict, Optional, List
from uuid import UUID

from pydantic import BaseModel

from app.models.queue import SearchStatus

class SearchQueueBase(BaseModel):
  query: str
  filters: Dict[str, Any] = {}

class SearchQueueCreate(SearchQueueBase):
  pass

class SearchQueueResponse(SearchQueueBase):
  id: UUID
  status: SearchStatus
  created_at: datetime
  updated_at: datetime

  class Config:
    from_attributes = True

class DiscoverRequest(BaseModel):
    roles: Optional[List[str]] = None
    skills: List[str]
    preferred_locations: Optional[List[str]] = None
    location: Optional[str] = None
    salary_min: Optional[str] = None
    limit: int = 5
