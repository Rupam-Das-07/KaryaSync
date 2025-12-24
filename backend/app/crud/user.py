from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app import schemas
from app.models import AcademicProfile, CvUpload, JobPreference, User


def create_cv_upload(
  db: Session,
  user_id: str,
  filename: str,
  storage_url: str,
  skills: list[str],
  roles: list[str],
  summary: str
) -> CvUpload:
  cv = CvUpload(
    user_id=user_id,
    filename=filename,
    storage_url=storage_url,
    parsed_skills=skills,
    parsed_roles=roles,
    summary=summary
  )
  db.add(cv)
  db.commit()
  db.refresh(cv)
  return cv


def create_user(db: Session, user_in: schemas.UserCreate) -> User:
  user_data = user_in.model_dump()
  # If id is provided, use it; otherwise let DB generate (though for Supabase we always want to use provided ID)
  if user_in.id:
    user_data["id"] = user_in.id
  
  user = User(**user_data)
  db.add(user)
  db.commit()
  db.refresh(user)
  return user


def upsert_user(db: Session, user_in: schemas.UserCreate) -> User:
  # First try to find by ID if provided (most reliable)
  if user_in.id:
    user = db.get(User, user_in.id)
    if user:
      # Found by ID, update fields
      update_data = user_in.model_dump(exclude_unset=True)
      for key, value in update_data.items():
        if key != "id": # Don't update ID
          setattr(user, key, value)
      db.commit()
      db.refresh(user)
      return user

  # If not found by ID (or ID not provided), try email
  user = get_user_by_email(db, user_in.email)
  if user:
    # Found by email
    # If user_in.id was provided but we didn't find it above, it means the DB has a DIFFERENT ID for this email.
    # We should update the DB ID to match the Supabase ID (user_in.id).
    if user_in.id and user.id != user_in.id:
      # This is a critical fix for the "Onboarding Loop" issue.
      # The DB had a random ID, but we want it to match Supabase.
      # We need to be careful with FKs, but for now assuming simple user update.
      user.id = user_in.id
    
    # Update other fields
    if user_in.full_name:
      user.full_name = user_in.full_name
    if user_in.phone:
      user.phone = user_in.phone
    if user_in.profile_links:
      user.profile_links = user_in.profile_links
    if user_in.preferred_locations:
      user.preferred_locations = user_in.preferred_locations
      
    db.commit()
    db.refresh(user)
    return user
  else:
    # Not found by ID or Email -> Create new
    return create_user(db, user_in)


def get_user(db: Session, user_id: str) -> Optional[User]:
  return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> Optional[User]:
  return db.query(User).filter(User.email == email).one_or_none()


def upsert_academic_profile(
  db: Session, user_id: str, profile_in: schemas.AcademicProfileBase
) -> AcademicProfile:
  profile = (
    db.query(AcademicProfile)
    .filter(AcademicProfile.user_id == user_id)
    .one_or_none()
  )
  if profile is None:
    profile = AcademicProfile(user_id=user_id)
    db.add(profile)

  for field, value in profile_in.model_dump(exclude_unset=True).items():
    setattr(profile, field, value)

  db.commit()
  db.refresh(profile)
  return profile


def upsert_job_preference(
  db: Session, user_id: str, preference_in: schemas.JobPreferenceBase
) -> JobPreference:
  preference = (
    db.query(JobPreference).filter(JobPreference.user_id == user_id).one_or_none()
  )
  if preference is None:
    preference = JobPreference(user_id=user_id)
    db.add(preference)

  for field, value in preference_in.model_dump(exclude_unset=True).items():
    setattr(preference, field, value)

  db.commit()
  db.refresh(preference)
  db.refresh(preference)
  return preference


def get_academic_profile(db: Session, user_id: str) -> Optional[AcademicProfile]:
  return (
    db.query(AcademicProfile)
    .filter(AcademicProfile.user_id == user_id)
    .one_or_none()
  )


def get_job_preference(db: Session, user_id: str) -> Optional[JobPreference]:
  return (
    db.query(JobPreference).filter(JobPreference.user_id == user_id).one_or_none()
  )

