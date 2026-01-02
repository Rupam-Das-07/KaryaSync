from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional
import uuid

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.queue import SearchQueue, SearchStatus

def _job_type_from_legacy(value: str | None) -> Optional[schemas.JobType]:
  if not value:
    return None
  mapping = {
    "Internship": schemas.JobType.INTERNSHIP,
    "Full-time": schemas.JobType.FULL_TIME,
    "Full time": schemas.JobType.FULL_TIME,
    "Contract": schemas.JobType.CONTRACT,
  }
  return mapping.get(value, schemas.JobType.FULL_TIME)


def _work_mode_from_legacy(value: str | None) -> Optional[schemas.WorkMode]:
  if not value:
    return None
  mapping = {
    "Onsite": schemas.WorkMode.ONSITE,
    "Hybrid": schemas.WorkMode.HYBRID,
    "Remote": schemas.WorkMode.REMOTE,
    "Remote-first": schemas.WorkMode.REMOTE,
  }
  return mapping.get(value, schemas.WorkMode.HYBRID)


def _source_from_legacy(value: str | None) -> schemas.OpportunitySource:
  if not value:
    return schemas.OpportunitySource.OTHER
  normalized = value.lower()
  if "linkedin" in normalized:
    return schemas.OpportunitySource.LINKEDIN
  if "unstop" in normalized:
    return schemas.OpportunitySource.UNSTOP
  if "official" in normalized or "career" in normalized:
    return schemas.OpportunitySource.OFFICIAL
  return schemas.OpportunitySource.OTHER


def _status_from_legacy(value: str | None) -> schemas.OpportunityStatus:
  if not value:
    return schemas.OpportunityStatus.OPEN
  normalized = value.lower()
  if "closed" in normalized:
    return schemas.OpportunityStatus.CLOSED
  return schemas.OpportunityStatus.OPEN


def _as_datetime(value: date) -> datetime:
  return datetime.combine(value, time.min)

from app import schemas
from app.schemas.queue import SearchQueueResponse # Explicit import if not in __init__
from app.crud import opportunity as opportunity_crud
from app.crud import user as user_crud
from app.db.session import get_db
from app.models import Opportunity, UserOpportunity, ApplicationStage

class LegacyOpportunity(BaseModel):
  id: str
  company: str
  role: str
  job_type: str
  work_mode: str
  location: str
  package: str
  status: str
  source: str
  match_reason: List[str]
  link: str
  last_checked: date
  status_date: date | None = None


DEMO_OPPORTUNITIES: List[LegacyOpportunity] = [
  LegacyOpportunity(
    id="op-1",
    company="Stripe",
    role="SDE Intern – Payments",
    job_type="Internship",
    work_mode="Hybrid",
    location="Bengaluru",
    package="₹1.1L/mo",
    status="open",
    source="Official career",
    match_reason=["TypeScript", "Distributed systems"],
    link="https://stripe.com/careers",
    last_checked=date(2025, 1, 18),
  ),
  LegacyOpportunity(
    id="op-2",
    company="Atlassian",
    role="Product Engineer",
    job_type="Full-time",
    work_mode="Remote-first",
    location="Pune",
    package="₹32L CTC",
    status="applied",
    source="LinkedIn",
    match_reason=["React", "Team collaboration"],
    link="https://linkedin.com/jobs",
    last_checked=date(2025, 1, 16),
  ),
  LegacyOpportunity(
    id="op-3",
    company="Zolve",
    role="Backend Engineer",
    job_type="Full-time",
    work_mode="Onsite",
    location="Bengaluru",
    package="₹28L CTC",
    status="closed",
    source="Career page",
    match_reason=["Python", "Fintech APIs"],
    link="https://zolve.com/careers",
    last_checked=date(2025, 1, 10),
    status_date=date(2025, 1, 14),
  ),
]


class AnalyzeResponse(BaseModel):
  skills: List[str]
  roles: List[str]
  summary: str


app = FastAPI(title="Job Aggregator Prototype API", version="0.1.0")

app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)



# ========================
# CACHE IMPLEMENTATION
# ========================
import time
from threading import Lock

_CACHE = {}
_CACHE_LOCK = Lock()
CACHE_TTL = 300  # 5 minutes

def get_cache(key: str):
    with _CACHE_LOCK:
        if key in _CACHE:
            data, timestamp = _CACHE[key]
            if time.time() - timestamp < CACHE_TTL:
                return data
            else:
                del _CACHE[key]  # Expired
    return None

def set_cache(key: str, data: any):
    with _CACHE_LOCK:
        _CACHE[key] = (data, time.time())

def clear_cache():
    with _CACHE_LOCK:
        _CACHE.clear()

@app.get("/health")
def health() -> dict[str, str]:
  return {"status": "ok"}


@app.get("/opportunities", response_model=schemas.PaginatedOpportunities)
def list_opportunities(
  page: int = 1,
  limit: int = 20,
  source: Optional[str] = None,
  status: Optional[str] = None,
  job_type: Optional[str] = None,
  db: Session = Depends(get_db),
) -> schemas.PaginatedOpportunities:
  # 1. Check Cache
  cache_key = f"opps:p{page}:l{limit}:src{source}:st{status}:jt{job_type}"
  cached = get_cache(cache_key)
  if cached:
      return cached

  # 2. Prepare Filters
  offset = (page - 1) * limit
  
  src_enum = schemas.OpportunitySource(source) if source else None
  status_enum = schemas.OpportunityStatus(status) if status else None
  
  type_enum = None
  if job_type:
      try: type_enum = schemas.JobType(job_type.lower())
      except: pass
  
  total = 0
  data = []

  # 3. Query DB
  if db.bind:
      data, total = opportunity_crud.list_opportunities(
        db=db,
        source=src_enum,
        status=status_enum,
        job_type=type_enum,
        skip=offset,
        limit=limit,
      )
  else:
      # Legacy Fallback (No DB)
      filtered = []
      for legacy in DEMO_OPPORTUNITIES:
          # Basic filtering simulation
          if source and legacy.source != source: continue
          if status and legacy.status != status: continue
          
          # Convert legacy to schema for list consistency
          # (Simplified for fallback)
          op = schemas.Opportunity(
              id=legacy.id,
              company_name=legacy.company,
              role_title=legacy.role,
              job_type=_job_type_from_legacy(legacy.job_type),
              work_mode=_work_mode_from_legacy(legacy.work_mode),
              location=legacy.location,
              apply_link=legacy.link,
              source=_source_from_legacy(legacy.source),
              status=_status_from_legacy(legacy.status),
              created_at=_as_datetime(legacy.last_checked),
              updated_at=_as_datetime(legacy.last_checked)
          )
          
          if type_enum and op.job_type != type_enum: continue
          filtered.append(op)
          
      total = len(filtered)
      start = offset
      end = offset + limit
      data = filtered[start:end]

  # 4. Construct Response
  response = schemas.PaginatedOpportunities(
      data=data,
      page=page,
      limit=limit,
      total=total
  )

  # 5. Set Cache
  set_cache(cache_key, response)
  return response


@app.post("/opportunities", response_model=schemas.Opportunity)
def create_opportunity(
  opportunity_in: schemas.OpportunityBase,
  db: Session = Depends(get_db),
):
  if not db.bind:
    raise HTTPException(
      status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
      detail="Database not configured for write operations.",
    )
  
  # Invalidate Cache on New Insert
  clear_cache()
  
  return opportunity_crud.create_opportunity(db, opportunity_in)


from fastapi.staticfiles import StaticFiles
import shutil
import os

# Mount static directory for serving resumes
# Ensure directory exists
os.makedirs("app/static/resumes", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.post("/analyze-cv", response_model=AnalyzeResponse)
async def analyze_cv(
  file: UploadFile = File(...),
  user_id: Optional[str] = None,
  db: Session = Depends(get_db)
) -> AnalyzeResponse:
  import io
  from pypdf import PdfReader
  
  # Read content
  content = await file.read()
  
  # Save file locally
  filename = f"{uuid.uuid4()}_{file.filename}"
  file_path = f"app/static/resumes/{filename}"
  
  with open(file_path, "wb") as f:
      f.write(content)
      
  # Generate Access URL (assuming localhost for prototype)
  # In prod, this would be S3 or similar.
  storage_url = f"http://localhost:8000/static/resumes/{filename}"

  text = ""
  try:
    # Attempt to read as PDF
    reader = PdfReader(io.BytesIO(content))
    for page in reader.pages:
      text += page.extract_text() + "\n"
  except Exception:
    pass

  # Basic keyword extraction
  text_lower = text.lower()
  found_skills = []
  all_skills = [
    "python", "react", "next.js", "typescript", "javascript", "sql", "postgresql",
    "docker", "aws", "fastapi", "django", "flask", "node.js", "java", "c++",
    "machine learning", "data science", "html", "css", "tailwind"
  ]

  for skill in all_skills:
    if skill in text_lower:
      found_skills.append(skill.title())

  # Infer roles based on skills
  suggested_roles = []
  if "python" in text_lower or "django" in text_lower or "fastapi" in text_lower:
    suggested_roles.append("Backend Engineer")
  if "react" in text_lower or "next.js" in text_lower or "typescript" in text_lower:
    suggested_roles.append("Frontend Engineer")
  if "data science" in text_lower or "machine learning" in text_lower:
    suggested_roles.append("Data Scientist")
  
  if not suggested_roles:
    suggested_roles = ["Software Engineer"]

  # Persist if user_id is provided
  print(f"DEBUG: analyze_cv received user_id={user_id}")
  if user_id:
    try:
      user_crud.create_cv_upload(
        db=db,
        user_id=user_id,
        filename=file.filename or "uploaded_cv.pdf",
        storage_url=storage_url, 
        skills=found_skills,
        roles=list(set(suggested_roles)),
        summary=f"Analyzed {len(found_skills)} skills"
      )
    except Exception as e:
      print(f"Failed to persist CV upload: {e}")
      # Don't silence it! Let the frontend know so we can debug.
      raise HTTPException(status_code=500, detail=f"Database Persistence Failed: {str(e)}")

  return AnalyzeResponse(
    skills=found_skills if found_skills else ["General"],
    roles=list(set(suggested_roles)),
    summary=f"Analyzed {file.filename}. Found {len(found_skills)} skills.",
  )


@app.post("/users", response_model=schemas.User)
def create_user(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
  # Use upsert logic
  return user_crud.upsert_user(db, user_in)


@app.post("/users/{user_id}/academic-profile", response_model=schemas.AcademicProfile)
def upsert_academic_profile(
  user_id: str,
  profile_in: schemas.AcademicProfileBase,
  db: Session = Depends(get_db)
):
  # Ensure user exists first? Or assume valid ID from auth.
  # Ideally check:
  user = user_crud.get_user(db, user_id)
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  return user_crud.upsert_academic_profile(db, user_id, profile_in)


@app.post("/users/{user_id}/job-preferences", response_model=schemas.JobPreference)
def upsert_job_preference(
  user_id: str,
  preference_in: schemas.JobPreferenceBase,
  db: Session = Depends(get_db)
):
  user = user_crud.get_user(db, user_id)
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  return user_crud.upsert_job_preference(db, user_id, preference_in)


@app.get("/users/{user_id}/academic-profile", response_model=Optional[schemas.AcademicProfile])
def read_academic_profile(user_id: str, db: Session = Depends(get_db)):
  profile = user_crud.get_academic_profile(db, user_id)
  if not profile:
    # Return empty or 404? Frontend expects JSON. 
    # If we return 404, frontend might throw error. 
    # Better to return null or 404 and handle in frontend.
    # Given frontend code: if (academicRes.ok) setAcademic(...)
    # If 404, ok is false. So setAcademic is skipped.
    # This is fine, but we want to confirm if it exists.
    raise HTTPException(status_code=404, detail="Academic profile not found")
  return profile


@app.get("/users/{user_id}/job-preferences", response_model=Optional[schemas.JobPreference])
def read_job_preference(user_id: str, db: Session = Depends(get_db)):
  preference = user_crud.get_job_preference(db, user_id)
  if not preference:
    raise HTTPException(status_code=404, detail="Job preference not found")
  return preference


@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: str, db: Session = Depends(get_db)):
  user = user_crud.get_user(db, user_id)
  if not user:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
  return user


@app.post("/opportunities/discover", response_model=schemas.SearchQueueResponse)
def discover_opportunities(
  payload: schemas.DiscoverRequest,
  user_id: Optional[str] = None, # Optional for now, or extract from auth if available
  db: Session = Depends(get_db)
):
  import logging
  from app.models.queue import SearchQueue
  
  # Setup logger
  logger = logging.getLogger("app.discover")
  logger.setLevel(logging.INFO)
  if not logger.handlers:
      ch = logging.StreamHandler()
      formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
      ch.setFormatter(formatter)
      logger.addHandler(ch)

  # 1. Log Request
  print("🚀 Deep Scan requested")

  # Helper to normalize locations
  def normalize_locations(loc_list: List[str]) -> List[str]:
      out = []
      for l in loc_list or []:
          if not l: continue
          s = l.strip()
          if not s: continue
          s = s.title()
          if s not in out:
              out.append(s)
      return out

  # 1. Resolve Locations
  locations = []
  resolved_locations_source = "default"

  # a) Request
  req_locs = []
  if payload.preferred_locations:
      req_locs.extend(payload.preferred_locations)
  if payload.location:
      req_locs.append(payload.location)
  
  req_locs = normalize_locations(req_locs)
  
  if req_locs:
      locations = req_locs
      resolved_locations_source = "request"
  else:
      pass

  if not locations:
      # c) Default
      locations = ["Unknown"] # Or a safe default like "Remote" or "Bangalore"
      resolved_locations_source = "default"
      # logger.warning("discover: resolved locations empty - using default fallback")

  # 2. Build Query
  # Prioritize Roles (Designations) if provided
  if payload.roles and len(payload.roles) > 0:
      base_query = " OR ".join(payload.roles)
      query_parts = [base_query]
  else:
      # Fallback to skills
      query_parts = payload.skills[:3]
      
  if locations and locations[0] != "Unknown":
      query_parts.append(locations[0])
  
  task_query = " ".join(query_parts)
  
  # 3. Validation
  if not task_query.strip():
      raise HTTPException(status_code=400, detail="Query cannot be empty. Please provide skills or location.")

  # logger.info("enqueueing search task", {"query": task_query, "loc_source": resolved_locations_source})

  # 4. Create Queue Item
  queue_item = SearchQueue(
      query=task_query,
      resolved_locations_source=resolved_locations_source,
      filters={
          "location": payload.location, # Keep original raw input
          "resolved_locations": locations, # Store resolved list
          "salary_min": payload.salary_min,
          "limit": payload.limit,
          "skills": payload.skills
      }
  )
  db.add(queue_item)
  db.commit()
  db.refresh(queue_item)
  
  print("📦 Queue item created")
  
  # 5. Trigger GitHub Action (Instant Deep Scan)
  print("⚡ Triggering GitHub Actions workflow")
  try:
      import requests
      import os
      
      git_token = os.environ.get("GITHUB_ACTIONS_TOKEN")
      git_owner = os.environ.get("GITHUB_REPO_OWNER")
      git_repo = os.environ.get("GITHUB_REPO_NAME")
      git_workflow = os.environ.get("GITHUB_WORKFLOW_FILE", "job_agent.yml")
      
      # UNCONDITIONAL TRIGGER ATTEMPT
      url = f"https://api.github.com/repos/{git_owner}/{git_repo}/actions/workflows/{git_workflow}/dispatches"
      headers = {
          "Authorization": f"Bearer {git_token}",
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
      }
      payload_data = {"ref": "main"}
      
      resp = requests.post(url, json=payload_data, headers=headers, timeout=5)
      
      if resp.status_code in [200, 204]:
          print("✅ GitHub Actions dispatch sent")
      else:
          print(f"❌ GitHub trigger failed: {resp.status_code} - {resp.text}")

  except Exception as e:
      print(f"❌ GitHub trigger failed: {str(e)}")
  
  return queue_item


@app.post(
  "/users/{user_id}/applications",
  response_model=schemas.UserOpportunity,
  status_code=status.HTTP_201_CREATED,
)
def create_user_application(
  user_id: str,
  payload: schemas.UserOpportunityBase,
  db: Session = Depends(get_db),
):
  user = user_crud.get_user(db, user_id)
  if not user:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
  record = opportunity_crud.create_user_opportunity(db, user_id, payload)
  return record
@app.post("/users/{user_id}/saved_jobs/{job_id}", response_model=schemas.UserOpportunity)
def toggle_saved_job(
    user_id: str,
    job_id: str,
    db: Session = Depends(get_db)
):
    # Check if opportunity exists
    job = db.query(Opportunity).filter(Opportunity.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Check if UserOpportunity exists
    user_op = db.query(UserOpportunity).filter(
        UserOpportunity.user_id == user_id,
        UserOpportunity.opportunity_id == job_id
    ).first()
    
    if user_op:
        # If it's already saved, unsave it (delete)
        if user_op.stage == ApplicationStage.SAVED:
            db.delete(user_op)
            db.commit()
            return user_op # Return deleted obj (or we could return null/status)
        else:
            # If it's in another stage (e.g. Applied), valid question: should we "unsave"?
            # For now, let's assume we can't "unsave" an applied job via bookmark.
            # Or we could just toggle it back to SAVED? No, that loses history.
            # Let's say: if matched/suggested, move to SAVED.
            if user_op.stage == ApplicationStage.SUGGESTED:
                user_op.stage = ApplicationStage.SAVED
                db.commit()
                db.refresh(user_op)
                return user_op
            else:
                 # Already Applied/Interview etc. 
                 # Maybe allow "un-bookmarking" if we treat stages differently?
                 # But UserOpportunity IS the relationship. 
                 # Let's simple toggle: If exists and NOT saved, do nothing (or error).
                 # If exists and SAVED, delete.
                 raise HTTPException(status_code=400, detail="Job is already in progress (Applied/Interview)")
    else:
        # Create new Saved Job
        new_op = UserOpportunity(
            user_id=user_id,
            opportunity_id=job_id,
            stage=ApplicationStage.SAVED
        )
        db.add(new_op)
        db.commit()
        db.refresh(new_op)
        return new_op

@app.get("/users/{user_id}/saved_jobs", response_model=List[schemas.UserOpportunity])
def get_saved_jobs(
    user_id: str,
    db: Session = Depends(get_db)
):
    saved_jobs = db.query(UserOpportunity).join(Opportunity).filter(
        UserOpportunity.user_id == user_id,
        UserOpportunity.stage == ApplicationStage.SAVED
    ).all()
    return saved_jobs

class ATSCheckRequest(BaseModel):
  user_id: str
  job_description: str

class ATSCheckResponse(BaseModel):
  score: int
  matched_skills: List[str]
  missing_skills: List[str]
  recommendations: List[str]

@app.post("/ats-check", response_model=ATSCheckResponse)
def ats_check(
  payload: ATSCheckRequest,
  db: Session = Depends(get_db)
):
  # 1. Get User's Skills from DB (CV Uploads or Job Preferences)
  # For now, let's try to fetch from the latest CV upload
  # Since we don't have a direct "get latest CV" CRUD method exposed here easily,
  # we will fallback to Job Preferences or a mock if not found.
  
  # Mocking user skills for now if we can't easily query complex relationships in this single file
  # In a real app, we'd do: user = user_crud.get_user(db, payload.user_id) -> user.cv_uploads...
  
  # Let's try to get job preferences as a proxy for skills
  pref = user_crud.get_job_preference(db, payload.user_id)
  user_skills = []
  if pref and pref.priority_skills:
    user_skills = [s.lower() for s in pref.priority_skills]
  
  # If no prefs, default to some common ones for demo purposes if user exists
  if not user_skills:
     user_skills = ["python", "react", "communication"]

  # 2. Parse Job Description
  jd_text = payload.job_description.lower()
  
  # Simple keyword extraction from JD (naive approach)
  # In a real app, use NLP (spacy/nltk)
  common_tech_keywords = [
    "python", "java", "c++", "javascript", "typescript", "react", "angular", "vue",
    "node.js", "django", "flask", "fastapi", "sql", "postgresql", "mongodb", "aws",
    "docker", "kubernetes", "git", "ci/cd", "communication", "teamwork", "leadership",
    "problem solving", "agile", "scrum"
  ]
  
  jd_keywords = [kw for kw in common_tech_keywords if kw in jd_text]
  
  # 3. Compare
  matched = [skill for skill in jd_keywords if skill in user_skills]
  missing = [skill for skill in jd_keywords if skill not in user_skills]
  
  # 4. Score
  if not jd_keywords:
    score = 50 # Neutral if no keywords found
  else:
    score = int((len(matched) / len(jd_keywords)) * 100)
  
  # 5. Recommendations
  recommendations = []
  if score < 50:
    recommendations.append("Your CV is missing many key skills mentioned in the JD.")
  if missing:
    recommendations.append(f"Consider adding projects that use: {', '.join(missing[:3])}.")
  if not missing:
    recommendations.append("Great match! Your profile aligns well with this job.")
    
  return ATSCheckResponse(
    score=score,
    matched_skills=[m.title() for m in matched],
    missing_skills=[m.title() for m in missing],
    recommendations=recommendations
  )


from app.services.ats_logic import ATSAnalyzer

class ATSAnalyzeResponse(BaseModel):
  score: float
  recommendations: List[str]
  missing_keywords: List[str] = []

@app.post("/analyze-ats", response_model=ATSAnalyzeResponse)
async def analyze_ats_upload(
  file: UploadFile = File(...),
  job_description: str = Form(...),
):
  analyzer = ATSAnalyzer()
  content = await file.read()
  
  result = analyzer.analyze(content, job_description)
  
  return ATSAnalyzeResponse(
    score=result.get("score", 0),
    recommendations=result.get("recommendations", []),
    missing_keywords=result.get("missing_keywords", [])
  )

