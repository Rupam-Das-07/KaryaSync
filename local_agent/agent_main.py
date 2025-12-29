import time
import os
import sys
import requests
import json
import re
import io
import pandas as pd
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from jobspy import scrape_jobs
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pypdf import PdfReader

# Add backend to path to import models
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.models.queue import SearchQueue, SearchStatus
from app.models import Opportunity, OpportunitySource, JobType, WorkMode, OpportunityStatus, JobPreference

# =============================================================================
# CONFIGURATION & SETUP
# =============================================================================

# Load Environment Variables
env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(env_path)

# Adzuna Credentials
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "232e9909")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "8684c36be9f52ee7718e33d523f96845")

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, pool_size=1, max_overflow=0)
SessionLocal = sessionmaker(bind=engine)

# =============================================================================
# CONSTANTS & UTILITIES
# =============================================================================

# Common Tech Keywords for ATS Filtering
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

class ATSAnalyzer:
    """Helper class to analyze resume vs job description."""
    
    def calculate_score(self, resume_text, jd_text):
        if not resume_text or not jd_text:
            return 0
        text_list = [resume_text, jd_text]
        cv = CountVectorizer()
        count_matrix = cv.fit_transform(text_list)
        match_percentage = cosine_similarity(count_matrix)[0][1] * 100
        return round(match_percentage, 2)

    def get_missing_keywords(self, resume_text, jd_text):
        if not jd_text:
            return []
            
        # 1. Extract potential keywords from JD
        cv = CountVectorizer(stop_words='english', max_features=100)
        try:
            cv.fit([jd_text])
            jd_keywords = cv.get_feature_names_out()
        except ValueError:
            return []
        
        resume_lower = resume_text.lower()
        missing_candidates = []
        
        # 2. Identify missing keywords
        for keyword in jd_keywords:
            if not re.search(r'\b' + re.escape(keyword) + r'\b', resume_lower):
                missing_candidates.append(keyword)
                
        # 3. Filter against known tech keywords
        clean_missing = [word for word in missing_candidates if word in TECH_KEYWORDS]
        
        # 4. Fallback if no specific tech keywords found
        if not clean_missing:
             return missing_candidates[:5]
             
        return clean_missing[:10]

def is_entry_level(title, description, experience_years=0):
    """
    Returns True if the job matches the experience level requirements.
    Acts as a 'Strict Bouncer' for freshers.
    """
    if experience_years > 0:
        return True # Handled by query logic for experienced roles
        
    title_lower = title.lower()
    desc_lower = description.lower()
    
    senior_titles = ["senior", "lead", "principal", "manager", "architect", "head", "vp", "director"]
    junior_titles = ["junior", "jr", "intern", "trainee", "entry level", "fresher", "graduate"]

    # 1. Block Senior Titles
    if any(t in title_lower for t in senior_titles):
        print(f"   🚫 Bounced by Title: {title}")
        return False
        
    # 2. Allow Junior Titles (Bypass desc check)
    if any(t in title_lower for t in junior_titles):
        return True

    # 3. Check Description for Experience Requirements
    # Matches "Minimum 2+ years", "Requires 3 years"
    strict_min_exp_pattern = r"(minimum|required|requires|experience)\s*(?:of|:)?\s*[2-9]\s*(?:\+|plus)?\s*(?:years|yrs)"
    
    match = re.search(strict_min_exp_pattern, desc_lower)
    if match:
        print(f"   🚫 Bounced by Desc (Strict Exp): {title} | Matched: '{match.group(0)}'")
        return False
        
    return True

def detect_job_type(title, description):
    """Determines JobType based on keywords."""
    t_lower = title.lower()
    d_lower = description.lower()
    
    def has_word(text, word):
        return re.search(r'\b' + re.escape(word) + r'\b', text) is not None

    intern_keywords = ['intern', 'internship', 'trainee', 'apprentice', 'students', 'summer', 'placement']
    if any(k in t_lower for k in intern_keywords) or any(has_word(d_lower, k) for k in intern_keywords):
        return JobType.INTERNSHIP

    contract_keywords = ['contract', 'freelance', 'temporary', 'part-time', 'part time']
    if any(k in t_lower for k in contract_keywords) or any(has_word(d_lower, k) for k in contract_keywords):
        return JobType.CONTRACT

    return JobType.FULL_TIME

def extract_salary(description):
    """Extracts salary from description using Regex."""
    if not description: return None, None
    desc = description.lower()
    
    # Pattern 1: LPA
    lpa_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*lpa', desc)
    if lpa_match:
        try:
            min_lpa = float(lpa_match.group(1))
            max_lpa = float(lpa_match.group(2)) if lpa_match.group(2) else min_lpa
            return int(min_lpa * 100000), int(max_lpa * 100000)
        except: pass

    # Pattern 2: Monthly 'k'
    k_matches = re.findall(r'(\d{2,3})\s*k', desc)
    if k_matches:
        try:
            vals = [int(x) * 1000 for x in k_matches]
            vals.sort()
            if len(vals) >= 2: return vals[0], vals[-1]
            return vals[0], vals[0]
        except: pass

    # Pattern 3: Explicit Rupees
    rs_matches = re.findall(r'(?:rs\.?|₹|inr)\s*(\d{1,3}(?:,\d{3})*(?:000|500))', desc)
    if rs_matches:
        try:
            vals = [int(x.replace(',', '')) for x in rs_matches]
            vals.sort()
            clean_vals = [v for v in vals if v > 1000]
            if clean_vals:
                if len(clean_vals) >= 2: return clean_vals[0], clean_vals[-1]
                return clean_vals[0], clean_vals[0]
        except: pass

    return None, None

# =============================================================================
# DATA PROCESSING HELPERS
# =============================================================================

def _process_adzuna_job(job_data, db, location, query, experience_years):
    """Parses and saves a single Adzuna job result."""
    apply_link = job_data.get("redirect_url")
    if not apply_link: return False
    
    if db.query(Opportunity).filter(Opportunity.apply_link == apply_link).first():
        return False

    description = job_data.get("description", "")
    role_title = job_data.get("title")
    
    if not is_entry_level(role_title, description, experience_years):
        print(f"🚫 Adzuna Bouncer Skipped: {role_title}")
        return False

    # Smart Parsing
    job_type = detect_job_type(role_title, description)
    
    work_mode = WorkMode.ONSITE
    if "remote" in location.lower() or "remote" in description.lower():
        work_mode = WorkMode.REMOTE
    elif "hybrid" in description.lower():
        work_mode = WorkMode.HYBRID
    
    salary_min = job_data.get("salary_min")
    salary_max = job_data.get("salary_max")
    
    if not salary_min:
        salary_min, salary_max = extract_salary(description)
        if salary_min: print(f"   💰 Extracted Salary: ₹{salary_min}")

    op = Opportunity(
        company_name=job_data.get("company", {}).get("display_name", "Unknown"),
        role_title=role_title,
        apply_link=apply_link,
        location=job_data.get("location", {}).get("display_name", location),
        source=OpportunitySource.OTHER, 
        status=OpportunityStatus.OPEN,
        job_type=job_type,
        work_mode=work_mode,
        salary_min=salary_min,
        salary_max=salary_max,
        source_metadata={
            "origin": "adzuna", 
            "query": query,
            "description": description,
            "adzuna_id": job_data.get("id")
        }
    )
    db.add(op)
    return True

def _process_jobspy_row(row, db, location, experience_years):
    """Parses and saves a single JobSpy result row."""
    job_url = row.get('job_url')
    if not job_url or pd.isna(job_url): return False
    
    def safe_get(key, default=""):
        val = row.get(key)
        if pd.isna(val): return default
        return str(val)

    description = safe_get('description')
    role_title = safe_get('title', 'Unknown Role')
    
    if not description: return False
    
    if not is_entry_level(role_title, description, experience_years):
        print(f"🚫 JobSpy Bouncer Skipped: {role_title}")
        return False
        
    if db.query(Opportunity).filter(Opportunity.apply_link == job_url).first():
        return False
    
    source = OpportunitySource.OTHER
    if any(d in job_url for d in ['greenhouse', 'workday', 'lever']):
        source = OpportunitySource.OFFICIAL
    
    job_type = detect_job_type(role_title, description)
    
    work_mode = WorkMode.ONSITE
    loc_val = safe_get('location', location)
    if "remote" in loc_val.lower() or "remote" in description.lower():
        work_mode = WorkMode.REMOTE
    elif "hybrid" in description.lower():
        work_mode = WorkMode.HYBRID

    s_min = row.get('min_amount')
    s_max = row.get('max_amount')
    if pd.isna(s_min): s_min = None
    if pd.isna(s_max): s_max = None
    
    if not s_min:
        s_min, s_max = extract_salary(description)
        if s_min: print(f"   💰 Extracted Salary: ₹{s_min}")

    op = Opportunity(
        company_name=safe_get('company', 'Unknown'),
        role_title=role_title,
        apply_link=job_url,
        location=loc_val,
        source=source,
        status=OpportunityStatus.OPEN,
        job_type=job_type,
        work_mode=work_mode,
        salary_min=s_min,
        salary_max=s_max,
        source_metadata={
            "origin": "JobSpy",
            "site": safe_get('site'),
            "description": description[:500]
        }
    )
    db.add(op)
    return True

def _scan_company_portal(company, portal_link, role_filters, db):
    """
    Crawls a single company career page.
    Returns number of jobs saved.
    """
    try:
        resp = requests.get(portal_link, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return 0, resp.status_code
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        links = soup.find_all('a', href=True)
        
        # Static Link Detection
        job_links = set()
        trusted_domains = ["greenhouse.io", "lever.co", "workday.com", "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com"]
        path_keywords = ["/job/", "/careers/", "/position/", "/opening/", "/role/"]
        
        for link in links:
            href = link['href']
            full_url = urljoin(portal_link, href)
            
            is_ats = any(d in full_url for d in trusted_domains)
            is_internal = any(k in full_url for k in path_keywords) and len(full_url) > len(portal_link) + 5
            
            if is_ats or is_internal:
                job_links.add(full_url)

        if not job_links:
            return 0, "NO_LINKS"

        # Limit to avoid hanging on massive sites
        job_links = list(job_links)[:8]
        saved_count = 0
        
        for j_url in job_links:
            if db.query(Opportunity).filter(Opportunity.apply_link == j_url).first():
                continue
            
            try:
                j_resp = requests.get(j_url, timeout=6, headers={"User-Agent": "Mozilla/5.0"})
                j_soup = BeautifulSoup(j_resp.text, 'html.parser')
                
                title = ""
                if j_soup.h1: title = j_soup.h1.get_text().strip()
                elif j_soup.title: title = j_soup.title.get_text().strip()
                
                if not title: continue
                
                # Check against ALL desired roles
                title_match = any(r.lower() in title.lower() for r in role_filters)
                if not title_match: continue

                description = j_soup.get_text()
                if not is_entry_level(title, description, 0): continue
                
                desc_lower = description.lower()
                if "india" not in desc_lower and "bangalore" not in desc_lower and "remote" not in desc_lower:
                    continue

                op = Opportunity(
                    company_name=company,
                    role_title=title,
                    apply_link=j_url,
                    location="India (Official)",
                    source=OpportunitySource.OFFICIAL, 
                    status=OpportunityStatus.OPEN,
                    job_type=detect_job_type(title, description),
                    work_mode=WorkMode.ONSITE,
                    source_metadata={"origin": "kb_trusted_crawl", "portal": portal_link}
                )
                db.add(op)
                saved_count += 1
                
            except Exception: continue
            
        return saved_count, "OK"
        
    except Exception as e:
        return 0, str(e)

# =============================================================================
# MAIN FETCHERS
# =============================================================================

def fetch_adzuna(task, db):
    """Fetches jobs from Adzuna API."""
    filters = task.filters or {}
    print(f"🕵️ DEBUG: Adzuna Task Received. RAW Filters: {filters}")
    
    try: experience_years = int(filters.get("experience_years", 0))
    except: experience_years = 0
    print(f"   🎓 Experience Level: {experience_years} Years")

    # Construct excluded keywords logic
    excluded_keywords = ""
    if experience_years == 0:
        excluded_keywords = "Senior Lead Principal Manager Architect Head VP Director"
    elif 1 <= experience_years <= 3:
        excluded_keywords = "Principal Director VP Head Architect"

    query_extras = " Internship" if filters.get("is_internship") else ""
    
    location = "India"
    if filters.get("is_remote"): location = "Remote"
    elif filters.get("location"): location = filters.get("location")

    raw_query = task.query or ""
    sub_queries = [q.strip() for q in raw_query.split(" OR ")] if " OR " in raw_query else [raw_query]
    sub_queries = sub_queries[:3] # Rate limit protection
    
    total_saved = 0
    
    for q in sub_queries:
        if not q: continue
        full_query = q + query_extras
        
        params = {
            "app_id": ADZUNA_APP_ID,
            "app_key": ADZUNA_APP_KEY,
            "results_per_page": 20,
            "what": full_query, 
            "what_exclude": excluded_keywords,
            "where": location,
            "content-type": "application/json"
        }
        
        print(f"🌍 Fetching Adzuna (FAST): '{full_query}' in {location}")
        
        try:
            url = "https://api.adzuna.com/v1/api/jobs/in/search/1"
            response = requests.get(url, params=params)
            data = response.json() if response.status_code == 200 else {}
            results = data.get("results", [])
            
            for job in results:
                if _process_adzuna_job(job, db, location, q, experience_years):
                    total_saved += 1
                    
        except Exception as e:
            print(f"❌ Adzuna Error for '{q}': {e}")
            continue
            
    print(f"💾 Adzuna Saved Total: {total_saved}")
    return total_saved

def fetch_jobspy(task, db):
    """Fetches jobs using JobSpy scraper (Deep Scan)."""
    filters = task.filters or {}
    query = task.query
    
    try: experience_years = int(filters.get("experience_years", 0))
    except: experience_years = 0
        
    print(f"🕵️ DEBUG: JobSpy Task. Query: '{query}', Exp: {experience_years}")
    
    location = "India"
    if filters.get("is_remote"): location = "Remote"
    elif filters.get("location"): location = filters.get("location")

    print(f"🕵️‍♀️ Triggering JobSpy (DEEP): {query} in {location}")
    try:
        job_type_param = "internship" if filters.get("is_internship") else "fulltime"
        
        jobs: pd.DataFrame = scrape_jobs(
            site_name=["indeed", "linkedin", "glassdoor", "google", "zip_recruiter"],
            search_term=query,
            location=location,
            results_wanted=20,
            job_type=job_type_param,
            country_indeed='India'
        )
        
        if not jobs.empty:
            print(f"📊 JobSpy Results by Site:\n{jobs['site'].value_counts()}")
        else:
            print("⚠️ JobSpy returned 0 results.")

        spy_count = 0
        for index, row in jobs.iterrows():
            if _process_jobspy_row(row, db, location, experience_years):
                spy_count += 1
                
        print(f"💾 JobSpy Saved: {spy_count}")
        return spy_count
    except Exception as e:
        print(f"❌ JobSpy Failed: {e}")
        return 0

def fetch_knowledge_base_career_pages(task, db, role_filters):
    """
    Crawls official career pages using 'career_page_status.json'.
    Self-optimizes by skipping known 'NON-WORKING' sites.
    """
    base_dir = os.path.dirname(__file__)
    kb_path = os.path.join(base_dir, 'career_page_status.json')

    if not os.path.exists(kb_path):
        print("⚠️ career_page_status.json not found. Skipping Official Layer.")
        return 0

    try:
        with open(kb_path, 'r') as f:
            company_status = json.load(f)
    except Exception:
        print("⚠️ Failed to load Knowledge Base JSON.")
        return 0
    
    # Identify Working Candidates
    scan_queue = []
    skipped_count = 0
    for company, data in company_status.items():
        if data.get('status') == 'NON-WORKING':
            skipped_count += 1
            continue
        if not data.get('portal'): continue
        scan_queue.append({"company": company, "portal": data.get('portal')})

    print(f"📉 Optimization: Skipped {skipped_count} known non-working companies.")
    print(f"🔍 Deep Scan started for {len(scan_queue)} optimized companies...")

    saved_count = 0
    total_companies = len(scan_queue)
    
    for idx, item in enumerate(scan_queue):
        company = item["company"]
        portal = item["portal"]
        prefix = f"[{idx+1}/{total_companies}] 🏢 {company}"
        
        # Scan
        count, status = _scan_company_portal(company, portal, role_filters, db)
        
        # Logging & Learning
        if status == "NO_LINKS":
            print(f"{prefix} → NON-WORKING (JS-rendered/No links)")
            company_status[company] = {
                "status": "NON-WORKING", 
                "reason": "No static links",
                "last_checked": str(datetime.now())
            }
        elif isinstance(status, int) and status != 200:
             print(f"{prefix} → ⚠️ Unreachable ({status})")
             if status in [403, 404]:
                 company_status[company] = {
                    "status": "NON-WORKING",
                    "reason": f"HTTP {status}",
                    "last_checked": str(datetime.now())
                }
        elif status == "OK":
             print(f"{prefix} → WORKING ({count} saved)")
             saved_count += count
             company_status[company]['last_checked'] = str(datetime.now())
             company_status[company]['status'] = 'WORKING'
        else:
             print(f"{prefix} → ERROR ({status})")

    # Persist Knowledge Base
    try:
        with open(kb_path, 'w') as f:
            json.dump(company_status, f, indent=2)
    except Exception as e:
        print(f"⚠️ Failed to save KB cache: {e}")

    if saved_count > 0:
        db.commit()
    
    print(f"💎 Knowledge Base Scan Saved Total: {saved_count}")
    return saved_count

# =============================================================================
# HANDLERS
# =============================================================================

def handle_search_task(task, db):
    """Orchestrates job search based on mode (FAST vs DEEP)."""
    print(f"🚀 Processing SEARCH task {task.id}")
    filters = task.filters or {}
    scan_mode = filters.get("scan_mode", "FAST")

    # 1. Resolve Preferences (DB > Task)
    user_prefs = db.query(JobPreference).filter(JobPreference.user_id == task.user_id).first()
    
    search_roles = []
    if user_prefs and user_prefs.desired_roles:
        search_roles = user_prefs.desired_roles
        print(f"✅ Found Profile Roles in DB: {search_roles}")
    else:
        raw_query = task.query or ""
        search_roles = [q.strip() for q in raw_query.split(" OR ")] if " OR " in raw_query else [raw_query]
        print(f"⚠️ Using Task Query: {search_roles}")

    search_roles = list(set([r for r in search_roles if r]))
    if not search_roles:
        print("❌ No roles to search for! Aborting.")
        return

    experience_years = 0
    if user_prefs:
        experience_years = user_prefs.experience_years
        print(f"🎓 Profile Experience: {experience_years} Years")
    else:
        try: experience_years = int(filters.get("experience_years", 0))
        except: pass
        print(f"🎓 Filter Experience: {experience_years} Years")

    # 2. External Aggregator Loop (One pass per role)
    for role in search_roles:
        print(f"🔎 Hunting for Role: {role}")
        
        # Temporary patch for fetchers
        original_query = task.query
        task.query = role 
        if user_prefs:
             if task.filters is None: task.filters = {}
             task.filters['experience_years'] = experience_years
        
        if scan_mode == "DEEP":
            fetch_jobspy(task, db)
        else:
            saved_count = fetch_adzuna(task, db)
            if saved_count < 3 and filters.get("auto_deep_fallback", False):
                 print(f"⚠️ Low results for '{role}'. Auto-triggering Deep Scan...")
                 fetch_jobspy(task, db)
                 
        task.query = original_query

    # 3. Official Layer (Run ONCE)
    # Skipped as per user request
    # if scan_mode == "DEEP":
    #     print(f"🏁 Starting Official Career Scan for roles: {search_roles}")
    #     try:
    #         fetch_knowledge_base_career_pages(task, db, search_roles)
    #     except Exception as e:
    #         print(f"⚠️ KB Scan Error: {e}")

    db.commit()
    print("✅ Deep Scan task completed")

def handle_ats_task(task, db):
    """Analyzes a resume against a job description."""
    print(f"📄 Processing ATS task {task.id}")
    payload = task.payload or {}
    resume_text = payload.get("resume_text", "")
    resume_url = payload.get("resume_url")
    job_description = payload.get("job_description", "")
    job_id = payload.get("job_id")

    if resume_url:
        print(f"   📥 Downloading Resume: {resume_url}")
        try:
            response = requests.get(resume_url)
            if response.status_code == 200:
                with io.BytesIO(response.content) as f:
                    reader = PdfReader(f)
                    extracted = ""
                    for page in reader.pages: extracted += page.extract_text() + "\n"
                    
                    if extracted.strip():
                        resume_text = extracted
                        print(f"   ✅ Extracted {len(resume_text)} chars")
            else:
                print(f"   ❌ Failed to download PDF: {response.status_code}")
        except Exception as e:
            print(f"   ❌ PDF Error: {e}")

    analyzer = ATSAnalyzer()
    score = analyzer.calculate_score(resume_text, job_description)
    missing = analyzer.get_missing_keywords(resume_text, job_description)
    
    recommendations = []
    if missing: recommendations.append(f"Missing keywords: {', '.join(missing[:5])}")
    if score < 50: recommendations.append("Low match score. Tailor your resume.")
    
    try:
        stmt = text("""
            INSERT INTO resume_scores (user_id, job_id, score, missing_keywords, recommendations)
            VALUES (:user_id, :job_id, :score, :missing, :recs)
        """)
        db.execute(stmt, {
            "user_id": task.user_id, "job_id": job_id, "score": score,
            "missing": json.dumps(missing), "recs": json.dumps(recommendations)
        })
        print(f"✅ ATS Score Saved: {score}")
    except Exception as e:
        print(f"❌ Failed to save ATS score: {e}")
    db.commit()

# =============================================================================
# MAIN ORCHESTRATOR
# =============================================================================


# =============================================================================
# MAIN ORCHESTRATOR
# =============================================================================

LAST_RUN_FILE = "agent_last_run.txt"

def check_deep_scan_guard():
    """Checks if a deep scan ran in the last 6 hours."""
    if os.path.exists(LAST_RUN_FILE):
        try:
            with open(LAST_RUN_FILE, "r") as f:
                last_ts = float(f.read().strip())
            
            hours_diff = (time.time() - last_ts) / 3600
            if hours_diff < 6:
                print(f"⏱️ Safety Guard: Last run was {hours_diff:.2f} hours ago (< 6h).")
                return False
        except Exception:
            pass # File corrupt or unreadable, ignore
    return True

def update_deep_scan_guard():
    """Updates the last run timestamp."""
    try:
        with open(LAST_RUN_FILE, "w") as f:
            f.write(str(time.time()))
    except Exception as e:
        print(f"⚠️ Failed to update lock file: {e}")

def main():
    print("🚀 Agent Starting... (Single Execution Mode)")
    
    try:
        db = SessionLocal()
        print("✅ Database Connected")
    except Exception as e:
        print(f"❌ Fatal Error: DB Connection Failed: {e}")
        sys.exit(1)

    try:
        # Fetch all pending tasks
        stmt = select(SearchQueue).where(SearchQueue.status == SearchStatus.PENDING)
        tasks = db.execute(stmt).scalars().all()

        if not tasks:
            print("📭 No pending tasks found in queue.")
        else:
            print(f"📋 Found {len(tasks)} pending tasks.")

        for task in tasks:
            print(f"⚡ Picking up Task ID: {task.id} [{task.status}]")
            
            try:
                task.status = SearchStatus.PROCESSING
                db.commit()

                filters = task.filters or {}
                scan_mode = filters.get("scan_mode", "FAST")
                task_type = getattr(task, 'task_type', 'SEARCH')

                # DEEP SCAN SAFETY GUARD
                if task_type == 'SEARCH' and scan_mode == "DEEP":
                    if not check_deep_scan_guard():
                        print("🛑 Skipping run: agent executed recently")
                        task.status = SearchStatus.PENDING # Revert to pending? Or Failed? User said "exit gracefully".
                        # If we exit, the task remains PROCESSING if we don't fix it.
                        # But we already set it to PROCESSING.
                        # Ideally, we should set it back to PENDING or SKIPPED.
                        # Since user wants to "exit", let's revert and exit.
                        task.status = SearchStatus.PENDING
                        db.commit()
                        sys.exit(0)
                
                # EXECUTE
                if task_type == 'ATS':
                    handle_ats_task(task, db)
                else:
                    handle_search_task(task, db)
                    if scan_mode == "DEEP":
                        update_deep_scan_guard()

                task.status = SearchStatus.COMPLETED
                db.commit()
                print(f"✅ Task {task.id} Completed.")

            except Exception as e:
                print(f"❌ Task {task.id} Failed: {e}")
                task.status = SearchStatus.FAILED
                try: db.commit()
                except: db.rollback()
                # We do not exit on individual task failure, try next
        
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        try:
            db.close()
            print("🔌 DB Connection Closed.")
        except: pass
        
    print("🏁 Agent Execution Finished.")

if __name__ == "__main__":
    main()