from __future__ import annotations

import logging
from typing import List, Optional

from duckduckgo_search import DDGS
from sqlalchemy.orm import Session

from app import models, schemas
from app.crud import opportunity as opportunity_crud

logger = logging.getLogger(__name__)

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
        # Simple heuristic: check for common cities if default is generic
        cities = ["Bangalore", "Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Pune", "Chennai", "Gurgaon", "Noida", "Remote"]
        for city in cities:
            if city.lower() in snippet.lower():
                return city
        return default

    @staticmethod
    def extract_salary(snippet: str) -> str:
        # Regex to find salary patterns like "10 LPA", "10-15 LPA", "$100k"
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

class SourceHandler:
    def search(self, query: str, limit: int, ddgs: DDGS) -> List[dict]:
        raise NotImplementedError

class LinkedInHandler(SourceHandler):
    def search(self, query: str, limit: int, ddgs: DDGS) -> List[dict]:
        # Targeted LinkedIn search
        search_query = f"site:linkedin.com/jobs {query}"
        results = []
        try:
            # DDGS context manager handles headers/User-Agent
            raw_res = ddgs.text(search_query, max_results=limit)
            for res in raw_res:
                title = res.get("title", "").split("|")[0].split("-")[0].strip()
                company = "LinkedIn Job"
                if " at " in title:
                    parts = title.split(" at ")
                    title = parts[0].strip()
                    company = parts[1].strip()
                
                results.append({
                    "role": title,
                    "company": company,
                    "link": res.get("href"),
                    "source": "LinkedIn",
                    "snippet": res.get("body", "")
                })
        except Exception as e:
            logger.error(f"LinkedIn search failed: {e}")
        return results

class IndeedHandler(SourceHandler):
    def search(self, query: str, limit: int, ddgs: DDGS) -> List[dict]:
        search_query = f"site:indeed.com/viewjob {query}"
        results = []
        try:
            raw_res = ddgs.text(search_query, max_results=limit)
            for res in raw_res:
                title = res.get("title", "").split("-")[0].strip()
                results.append({
                    "role": title,
                    "company": "Indeed Listing",
                    "link": res.get("href"),
                    "source": "Indeed",
                    "snippet": res.get("body", "")
                })
        except Exception as e:
            logger.error(f"Indeed search failed: {e}")
        return results

class UnstopHandler(SourceHandler):
    def search(self, query: str, limit: int, ddgs: DDGS) -> List[dict]:
        search_query = f"site:unstop.com/competitions {query}"
        results = []
        try:
            raw_res = ddgs.text(search_query, max_results=limit)
            for res in raw_res:
                results.append({
                    "role": res.get("title", "").split("|")[0].strip(),
                    "company": "Unstop Opportunity",
                    "link": res.get("href"),
                    "source": "Unstop",
                    "snippet": res.get("body", "")
                })
        except Exception as e:
            logger.error(f"Unstop search failed: {e}")
        return results

class CareerPageHandler(SourceHandler):
    def search(self, query: str, limit: int, ddgs: DDGS) -> List[dict]:
        search_query = f'"careers" "jobs" {query} -site:linkedin.com -site:indeed.com'
        results = []
        try:
            raw_res = ddgs.text(search_query, max_results=limit)
            for res in raw_res:
                results.append({
                    "role": res.get("title", "").split("-")[0].strip(),
                    "company": "Official Career Page",
                    "link": res.get("href"),
                    "source": "Official",
                    "snippet": res.get("body", "")
                })
        except Exception as e:
            logger.error(f"Career page search failed: {e}")
        return results

class AdvancedJobAgent:
    def __init__(self):
        self.handlers = [
            LinkedInHandler(),
            IndeedHandler(),
            UnstopHandler(),
            # CareerPageHandler() # Skipped as per user request
        ]
        self.nlp = NLPProcessor()

    def search_jobs(self, query: str, limit_per_source: int = 3) -> List[dict]:
        all_results = []
        # Use Context Manager for DDGS
        with DDGS() as ddgs:
            for handler in self.handlers:
                found = handler.search(query, limit_per_source, ddgs)
                # Post-process with NLP
                for job in found:
                    job["snippet"] = self.nlp.clean_text(job["snippet"])
                    job["extracted_location"] = self.nlp.extract_location(job["snippet"], "Unknown")
                    job["extracted_salary"] = self.nlp.extract_salary(job["snippet"])
                    job["extracted_type"] = self.nlp.extract_job_type(job["snippet"])
                    job["extracted_mode"] = self.nlp.extract_work_mode(job["snippet"])
                all_results.extend(found)
        return all_results

def discover_jobs(db: Session, skills: List[str], location: str = None, salary_min: str = None, limit: int = 10) -> List[models.Opportunity]:
    """
    Discover jobs based on skills, location, and salary.
    """
    agent = AdvancedJobAgent()
    
    # Construct a smart query
    query_parts = skills[:3]
    if location:
        query_parts.append(location)
    
    query = " ".join(query_parts)
    
    logger.info(f"Agent searching for jobs with query: {query}")
    raw_jobs = agent.search_jobs(query, limit_per_source=3)
    
    saved_opportunities = []
    for job in raw_jobs:
        # Check if link already exists to avoid duplicates
        existing = opportunity_crud.get_opportunity_by_link(db, job["link"])
        if existing:
            continue

        # Map source string to Enum
        source_enum = models.OpportunitySource.OTHER
        if "LinkedIn" in job["source"]:
            source_enum = models.OpportunitySource.LINKEDIN
        elif "Unstop" in job["source"]:
            source_enum = models.OpportunitySource.UNSTOP
        elif "Official" in job["source"]:
            source_enum = models.OpportunitySource.OFFICIAL

        # Use extracted data if available, else fallback
        final_location = job.get("extracted_location", location if location else "Unknown")
        
        # Create Opportunity object
        opportunity_in = schemas.OpportunityBase(
            company_name=job["company"],
            role_title=job["role"],
            job_type=job.get("extracted_type", models.JobType.FULL_TIME),
            work_mode=job.get("extracted_mode", models.WorkMode.HYBRID),
            location=final_location,
            link_url=job["link"],
            source=source_enum,
            status=models.OpportunityStatus.OPEN,
            source_metadata={
                "snippet": job["snippet"], 
                "origin": "ai_agent", 
                "query": query,
                "salary_extracted": job.get("extracted_salary")
            }
        )
        
        try:
            new_op = opportunity_crud.create_opportunity(db, opportunity_in)
            saved_opportunities.append(new_op)
        except Exception as e:
            logger.error(f"Failed to save opportunity: {e}")

    return saved_opportunities
