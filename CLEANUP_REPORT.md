# Project Cleanup Report

## 1. Backend & Agent Renaming
Ambiguous "main.py" files have been renamed to clarify their purpose and scope.

- **Local Agent**: `local_agent/main.py` → `local_agent/agent_main.py`
  - **Action Required**: Run the agent using `python local_agent/agent_main.py`.

- **Backend API**: `backend/app/main.py` → `backend/app/backend_app.py`
  - **Action Required**: Start the server using `uvicorn app.backend_app:app --reload` (or update your run script).
  - Updated imports in `backend/tests/test_discover_handler.py`.

## 2. Frontend Page Renaming
All `page.tsx` files have been renamed to descriptive Component names. Thick business logic now resides in named files, while `page.tsx` serves as a routing wrapper.

| Route | Old File | New Business Logic File | Wrapper |
|-------|----------|-------------------------|---------|
| `/` (Root) | `app/page.tsx` | `app/HomePage.tsx` | `app/page.tsx` |
| `/dashboard` | `app/dashboard/page.tsx` | `app/dashboard/DashboardHome.tsx` | `app/dashboard/page.tsx` |
| `/login` | `app/login/page.tsx` | `app/login/LoginPage.tsx` | `app/login/page.tsx` |
| `/onboarding` | `app/onboarding/page.tsx` | `app/onboarding/OnboardingFlowPage.tsx` | `app/onboarding/page.tsx` |
| `/ats` | `app/ats/page.tsx` | `app/ats/AtsScoringPage.tsx` | `app/ats/page.tsx` |
| `/profile` | `app/profile/page.tsx` | `app/profile/UserProfilePage.tsx` | `app/profile/page.tsx` |
| `/saved` | `app/saved/page.tsx` | `app/saved/SavedJobsPage.tsx` | `app/saved/page.tsx` |

**Verification**: Next.js routing preserved via wrappers.

## 3. Safe Cleanup (Legacy Files)
Unused, one-off, and debugging scripts have been moved to the `_legacy/` directory.

- **Root**: `test_output.txt`, `test_output_2.txt`, `commands.png`
- **Local Agent** (`_legacy/local_agent/`):
  - `check_llm.py`
  - `debug_enum.py`
  - `inspect_browser_use.py`
  - `test_browser_use_llm.py`
  - `special_scan.py`
  - `backfill_internships*.py`
- **Backend** (`_legacy/backend/`):
  - Migration scripts (`add_experience_column.py`, `migrate_opportunities.py`, etc.)
  - Debug scripts (`check_queue.py`, `check_tables.py`, etc.)

## 4. Frontend Cleanup (Unused Components)
The following components were identified as legacy artifacts (replaced by inline logic in `DashboardHome.tsx`) and moved to `_legacy/frontend/components/`:
- `Dashboard.tsx`
- `JobCard.tsx`
- `JobDetailModal.tsx`

## 5. Backend Cleanup (Manual Scripts)
The following manual migration and debug scripts were moved to `_legacy/backend/` as they are effectively replaced by the official Alembic `migrations/` folder and standard tests:
- `add_experience_column.py`
- `add_resolved_locations_source.py`
- `check_columns.py`
- `check_queue.py`
- `check_tables.py`
- `create_queue_table.py`
- `migrate_opportunities.py`
- `super_worker_migration.py`

## 6. Root Cleanup (Misc Files)
The following miscellaneous files were moved from the project root to `_legacy/`:
- `test_output.txt`
- `test_output_2.txt`
- `commands.png`

## 7. Status
- **Backend**: Verified imports & structure.
- **Frontend**: Verified components & wrappers.
- **Agent**: Verified entry point & requirements.
- **Root**: Clean, contains only essential docs and folders.

The project structure is now explicit and easier to navigate.
