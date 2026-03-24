from __future__ import annotations

import logging
import os
import time
import requests
from threading import Lock
from typing import List, Optional

from sqlalchemy.orm import Session

from app import models, schemas
from app.crud import opportunity as opportunity_crud

logger = logging.getLogger(__name__)

# =============================================================================
# ADZUNA API CONFIGURATION
# =============================================================================

ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")
ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs/in/search/1"

# =============================================================================
# RATE LIMITER
# =============================================================================

_RATE_LIMIT_STORE = {}   # key → last_call_timestamp
_RATE_LOCK = Lock()
API_COOLDOWN = 90        # seconds between API calls for the same key

def _check_rate_limit(identifier: str) -> bool:
    """Returns True if the API call is allowed, False if rate-limited.
    
    Key should be a combination of (user_id or IP) + query.
    """
    key = identifier.strip().lower()
    now = time.time()
    with _RATE_LOCK:
        last = _RATE_LIMIT_STORE.get(key, 0)
        if now - last < API_COOLDOWN:
            remaining = int(API_COOLDOWN - (now - last))
            logger.info(f"⏱️ Rate limited: '{key}' — retry in {remaining}s")
            return False
        _RATE_LIMIT_STORE[key] = now
        return True

# =============================================================================
# NLP PROCESSOR (Preserved)
# =============================================================================

class NLPProcessor:
    """
    A lightweight rule-based NLP processor to clean and structure job data.
    """
    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""
        return text.strip().replace("\n", " ").replace("  ", " ")

    @staticmethod
    def extract_location(snippet: str, default: str) -> str:
        cities = ["Bangalore", "Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Pune", "Chennai", "Gurgaon", "Noida", "Remote"]
        for city in cities:
            if city.lower() in snippet.lower():
                return city
        return default

    @staticmethod
    def extract_salary(snippet: str) -> str:
        import re
        match = re.search(r'(\d+(\.\d+)?\s?-\s?\d+(\.\d+)?\s?LPA)|(\d+\s?LPA)', snippet, re.IGNORECASE)
        if match:
            return match.group(0)
        return "Not Disclosed"

    @staticmethod
    def extract_job_type(snippet: str) -> models.JobType:
        snippet_lower = snippet.lower()
        if "intern" in snippet_lower:
            return models.JobType.INTERNSHIP
        if "contract" in snippet_lower or "freelance" in snippet_lower:
            return models.JobType.CONTRACT
        return models.JobType.FULL_TIME

    @staticmethod
    def extract_work_mode(snippet: str) -> models.WorkMode:
        snippet_lower = snippet.lower()
        if "remote" in snippet_lower:
            return models.WorkMode.REMOTE
        if "hybrid" in snippet_lower:
            return models.WorkMode.HYBRID
        return models.WorkMode.ONSITE


# =============================================================================
# ADZUNA API FETCHER
# =============================================================================

_nlp = NLPProcessor()

def _fetch_adzuna_jobs(query: str, location: str = "India", limit: int = 10) -> List[dict]:
    """
    Calls Adzuna API and returns a normalized list of job dicts.
    
    Each dict has: role, company, link, snippet, source,
                   extracted_location, extracted_type, extracted_mode, extracted_salary
    """
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        logger.error("❌ Adzuna credentials not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY)")
        return []

    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "results_per_page": min(limit, 20),
        "what": query,
        "where": location,
        "content-type": "application/json",
    }

    logger.info(f"🌍 Fetching Adzuna: '{query}' in {location}")

    try:
        response = requests.get(ADZUNA_BASE_URL, params=params, timeout=10)

        if response.status_code != 200:
            logger.error(f"❌ Adzuna API error: {response.status_code}")
            return []

        data = response.json()
        results = data.get("results", [])

        normalized = []
        for job in results:
            redirect_url = job.get("redirect_url")
            if not redirect_url:
                continue

            description = job.get("description", "")
            title = job.get("title", "Unknown Role")
            company = job.get("company", {}).get("display_name", "Unknown")
            loc = job.get("location", {}).get("display_name", location)

            normalized.append({
                "role": title,
                "company": company,
                "link": redirect_url,
                "snippet": _nlp.clean_text(description),
                "source": "Adzuna",
                "extracted_location": _nlp.extract_location(description, loc),
                "extracted_salary": _nlp.extract_salary(description),
                "extracted_type": _nlp.extract_job_type(f"{title} {description}"),
                "extracted_mode": _nlp.extract_work_mode(f"{title} {description}"),
            })

        logger.info(f"📊 Adzuna returned {len(normalized)} jobs")
        return normalized

    except requests.exceptions.Timeout:
        logger.error("❌ Adzuna API timeout")
        return []
    except Exception as e:
        logger.error(f"❌ Adzuna API failed: {e}")
        return []


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def discover_jobs(
    db: Session,
    skills: List[str],
    location: str = None,
    salary_min: str = None,
    limit: int = 10,
    identifier: str = None,
) -> List[models.Opportunity]:
    """
    Discover jobs based on skills, location, and salary.
    Uses Adzuna API with per-user rate limiting.
    Falls back to existing DB results when rate-limited.
    """
    # Construct a smart query
    query_parts = skills[:3]
    if location:
        query_parts.append(location)

    query = " ".join(query_parts)

    # Rate limit check (keyed on identifier + query)
    rate_key = f"{identifier or 'global'}:{query}"
    if not _check_rate_limit(rate_key):
        logger.info("📦 Rate limited — returning existing DB results as fallback")
        existing_opps, _ = opportunity_crud.list_opportunities(db, limit=limit)
        return existing_opps

    logger.info(f"Agent searching for jobs with query: {query}")
    raw_jobs = _fetch_adzuna_jobs(query, location=location or "India", limit=limit)

    saved_opportunities = []
    for job in raw_jobs:
        # Check if link already exists to avoid duplicates
        existing = opportunity_crud.get_opportunity_by_link(db, job["link"])
        if existing:
            continue

        # Source is always Adzuna now
        source_enum = models.OpportunitySource.OTHER

        # Use extracted data if available, else fallback
        final_location = job.get("extracted_location", location if location else "Unknown")

        # Create Opportunity object
        opportunity_in = schemas.OpportunityBase(
            company_name=job["company"],
            role_title=job["role"],
            job_type=job.get("extracted_type", models.JobType.FULL_TIME),
            work_mode=job.get("extracted_mode", models.WorkMode.HYBRID),
            location=final_location,
            apply_link=job["link"],
            source=source_enum,
            status=models.OpportunityStatus.OPEN,
            source_metadata={
                "snippet": job["snippet"],
                "origin": "adzuna_discover",
                "query": query,
                "salary_extracted": job.get("extracted_salary"),
            },
        )

        try:
            new_op = opportunity_crud.create_opportunity(db, opportunity_in)
            saved_opportunities.append(new_op)
        except Exception as e:
            logger.error(f"Failed to save opportunity: {e}")

    return saved_opportunities
