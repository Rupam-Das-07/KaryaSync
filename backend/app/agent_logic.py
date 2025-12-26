import os
import sys
import re
import io
import pandas as pd
import requests
import json
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from jobspy import scrape_jobs
from sqlalchemy.orm import Session
from sqlalchemy import text
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pypdf import PdfReader

# Import your existing models
from app.models import Opportunity, OpportunitySource, JobType, WorkMode, OpportunityStatus, JobPreference
from app.models.queue import SearchQueue, SearchStatus

# --- 1. UTILITIES (Copied from your script) ---

TECH_KEYWORDS = {
    "python", "java", "c++", "c#", "javascript", "typescript", "ruby", "php", "swift", "kotlin", "go", "rust",
    "html", "css", "react", "angular", "vue", "nextjs", "node.js", "django", "flask", "fastapi", "spring", "asp.net",
    "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "cassandra", "dynamodb",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible", "jenkins", "gitlab ci", "github actions",
    "git", "linux", "unix", "bash", "shell scripting",
    "machine learning", "deep learning", "nlp", "computer vision", "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
    "data science", "data analysis", "big data", "hadoop", "spark", "kafka", "airflow",
    "agile", "scrum", "kanban", "jira", "confluence",
    "rest api", "graphql", "grpc", "microservices", "serverless",
    "object oriented programming", "functional programming", "data structures", "algorithms",
    "communication", "leadership", "problem solving", "teamwork", "critical thinking"
}

def is_entry_level(title, description, experience_years=0):
    if experience_years > 0: return True
    title_lower = title.lower()
    senior_titles = ["senior", "lead", "principal", "manager", "architect", "head", "vp", "director"]
    if any(t in title_lower for t in senior_titles): return False
    match = re.search(r"(minimum|required|requires|experience)\s*(?:of|:)?\s*[2-9]\s*(?:\+|plus)?\s*(?:years|yrs)", description.lower())
    if match: return False
    return True

def detect_job_type(title, description):
    t_lower, d_lower = title.lower(), description.lower()
    if any(k in t_lower for k in ['intern', 'internship']) or 'internship' in d_lower: return JobType.INTERNSHIP
    if any(k in t_lower for k in ['contract', 'freelance']): return JobType.CONTRACT
    return JobType.FULL_TIME

def extract_salary(description):
    # (Kept simple for brevity, paste your full regex logic here if needed)
    return None, None

def _process_jobspy_row(row, db, location, experience_years):
    job_url = row.get('job_url')
    if not job_url or pd.isna(job_url): return False
    
    description = str(row.get('description', ''))
    role_title = str(row.get('title', 'Unknown Role'))
    
    if not description: return False
    if not is_entry_level(role_title, description, experience_years): return False
    
    # Check duplicate
    if db.query(Opportunity).filter(Opportunity.apply_link == job_url).first():
        return False

    job_type = detect_job_type(role_title, description)
    work_mode = WorkMode.REMOTE if "remote" in location.lower() else WorkMode.ONSITE

    op = Opportunity(
        company_name=str(row.get('company', 'Unknown')),
        role_title=role_title,
        apply_link=job_url,
        location=str(row.get('location', location)),
        source=OpportunitySource.OTHER,
        status=OpportunityStatus.OPEN,
        job_type=job_type,
        work_mode=work_mode,
        source_metadata={"origin": "JobSpy", "site": str(row.get('site'))}
    )
    db.add(op)
    return True

# --- 2. MAIN LOGIC (The Worker Function) ---

def run_jobspy_scan(task_id: int, db: Session):
    """
    This function is called by the API. 
    It runs ONLY when requested.
    """
    print(f"🕵️‍♀️ Cloud Agent waking up for Task {task_id}...")
    
    # 1. Fetch the task from DB
    task = db.query(SearchQueue).filter(SearchQueue.id == task_id).first()
    if not task:
        print("❌ Task not found!")
        return

    # 2. Setup Task Data
    task.status = SearchStatus.PROCESSING
    db.commit()
    
    filters = task.filters or {}
    query = task.query
    location = filters.get("location", "India")
    if filters.get("is_remote"): location = "Remote"
    
    print(f"🚀 Scanning for: {query} in {location}")

    try:
        # 3. Run JobSpy (The heavy lifting)
        job_type_param = "internship" if filters.get("is_internship") else "fulltime"
        
        # NOTE: Reduced results_wanted to 10 for stability on Free Tier
        jobs = scrape_jobs(
            site_name=["indeed", "linkedin", "glassdoor"], 
            search_term=query,
            location=location,
            results_wanted=10, 
            job_type=job_type_param,
            country_indeed='India'
        )
        
        saved_count = 0
        if not jobs.empty:
            for index, row in jobs.iterrows():
                if _process_jobspy_row(row, db, location, 0):
                    saved_count += 1
            db.commit()

        print(f"✅ Scan Complete. Saved {saved_count} jobs.")
        task.status = SearchStatus.COMPLETED
        db.commit()

    except Exception as e:
        print(f"❌ Scan Failed: {e}")
        task.status = SearchStatus.FAILED
        db.commit()