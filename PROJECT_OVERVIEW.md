# CareerSync - Project Overview

**CareerSync** is an intelligent, AI-powered job aggregator designed to streamline the job search process for students and professionals. It leverages a modern **Material You** interface and a sophisticated backend agent to discover, analyze, and recommend opportunities tailored to the user's profile.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
*   **Language**: TypeScript
*   **UI Library**: React 19
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
    *   Custom CSS Variables for dynamic **Material You** theming (Surface-based color system).
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **Authentication**: Supabase Auth (`@supabase/ssr`)
*   **State Management**: React Hooks & Context API
*   **Theming**: `next-themes` (Robust Dark/Light mode support)

### Backend
*   **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.x)
*   **Database ORM**: [SQLAlchemy](https://www.sqlalchemy.org/) (Async support)
*   **Data Validation**: Pydantic
*   **Search & Scraping**:
    *   `duckduckgo-search`: For finding live job listings via search engine results.
    *   `beautifulsoup4`: For parsing HTML content.
    *   `requests`: For HTTP requests.
*   **CV Processing**: `pypdf` (PDF text extraction and analysis).
*   **Utilities**: `python-dotenv`, `email-validator`.

### Infrastructure
*   **Database**: PostgreSQL (managed via Supabase).
*   **Storage**: Supabase Storage (for CV/Resume files).
*   **Authentication Provider**: Supabase (Email/Password, Google, GitHub).

---

## ✅ Features Implemented

### 1. Authentication & Onboarding
*   **Secure Auth**: Email/Password login plus **Social Login** (Google, GitHub).
*   **Smart Onboarding Wizard**: A multi-step flow to capture:
    *   Personal Details
    *   Academic Background (University, Degree, Major, Location)
    *   **CV Analysis**: Uploads PDF, extracts skills, and auto-fills profile data.
    *   Job Preferences (Roles, Salary, Locations).
*   **Route Protection**: Middleware ensures only authenticated users access the dashboard.

### 2. Intelligent Dashboard
*   **Live Radar**: Real-time visualization of job market stats.
*   **AI Job Discovery Agent**:
    *   **"Generate Matches"**: A one-click trigger that scans the web for jobs matching the user's specific skills and location.
    *   **Smart Querying**: Constructs targeted search queries (e.g., `site:linkedin.com/jobs "Python" "Bangalore"`).
    *   **NLP Processing**: Parses raw search results to extract Salary (e.g., "12 LPA"), Location, and Job Type using heuristics.
*   **Opportunities Management**: View, track, and manage job applications (Suggested, Applied, Closed).

### 3. Comprehensive Profile Management
*   **Editable Profile**: Users can update their Personal, Academic, and Preference details.
*   **Autocomplete Integration**: Smart suggestions for Universities, Degrees, Majors, Roles, and Locations to ensure data consistency.
*   **Persistence**: Robust backend logic ensures all user edits are saved and retrieved correctly.

### 4. ATS Resume Checker
*   **CV vs. JD Analysis**: A dedicated tool where users can paste a Job Description.
*   **Scoring Engine**: The backend compares the user's CV keywords against the JD and provides a "Match Score".
*   **Actionable Feedback**: Suggests missing keywords to improve the resume's chance of passing ATS filters.

### 5. Modern UI/UX
*   **Material You Design**: A premium, surface-based design system with dynamic color palettes (Violet/Teal).
*   **Responsive Layout**: Fully optimized for Desktop and Mobile devices.
*   **Dark Mode**: First-class support for dark themes across all components.
*   **Toast Notifications**: Real-time feedback for user actions (Success/Error messages).

---

## 🚧 Features Added (In Progress / Planned)

These features are partially implemented in the codebase or planned for the near future:

### 1. Deep Scraping (Experimental)
*   **Current State**: The agent primarily relies on search engine snippets for speed.
*   **Goal**: Visit the actual job URL to scrape the full description, requirements, and application link directly.
*   **Status**: Basic logic exists in `JobScraper` but is disabled/limited to avoid IP bans and ensure speed.

### 2. Advanced Analytics
*   **Current State**: Basic "Live Radar" stats.
*   **Goal**: Detailed charts showing "Top Skills in Demand", "Salary Trends" for the user's domain.
*   **Status**: Data collection is happening, but frontend visualization is basic.

### 3. Application Automation
*   **Current State**: Users click "Apply" to visit the external link.
*   **Goal**: Semi-automated filling of external application forms using the user's stored profile data.

### 4. Deployment & DevOps
*   **Current State**: Runs locally (`npm run dev`, `uvicorn`).
*   **Goal**: Dockerize the application (`Dockerfile`, `docker-compose.yml`) for easy deployment to cloud platforms like Vercel/Render/AWS.

---

## 📂 Project Structure

```
/
├── frontend/             # Next.js Application
│   ├── src/app/          # App Router Pages (Dashboard, Profile, Login)
│   ├── src/components/   # Reusable UI Components (Modals, Cards, Inputs)
│   ├── src/utils/        # Helper functions (Supabase client, API calls)
│   └── ...
├── backend/              # FastAPI Application
│   ├── app/main.py       # API Entry Point
│   ├── app/models/       # SQLAlchemy Database Models
│   ├── app/schemas/      # Pydantic Data Schemas
│   ├── app/services/     # Business Logic (CV Analysis, Job Agent)
│   └── ...
└── ...
```
