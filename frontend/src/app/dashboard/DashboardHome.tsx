"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import AppLayout from "@/components/AppLayout";
import {
  Loader2,
  Sparkles,
  Search,
  Bookmark,
  LayoutGrid,
  List,
  MapPin,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { checkOnboardingStatus } from "@/utils/onboarding";
import ScanLoader from "@/components/ScanLoader";
// Hardcode Render Backend URL as requested
const BACKEND_URL = "https://karyasync.onrender.com";
// import { API_BASE_URL } from "@/utils/supabase/client";

import { motion, AnimatePresence } from "framer-motion";
import { clsx } from 'clsx';
import { useAutoAnimate } from '@formkit/auto-animate/react';

interface Job {
  id: string;
  role_title: string;
  company_name: string;
  location: string;
  apply_link: string;
  salary_min?: number;
  salary_max?: number;
  work_mode?: string;
  created_at: string;
  job_type?: string;
  source_metadata?: any;
}

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[...Array(5)].map((_, i) => (
      <td key={i} className="p-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
      </td>
    ))}
  </tr>
);

export default function DashboardPage() {
  /* 
    PAGINATION STATE 
    - Simplified to a single list as per user request.
    - Tab switching relies on Backend Cache for speed.
  */
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [tableBodyRef] = useAutoAnimate<HTMLTableSectionElement>();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters & UI State
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [activeTab, setActiveTab] = useState<'INTERNSHIP' | 'FULL_TIME'>('FULL_TIME');
  const [isBackendDown, setIsBackendDown] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const isComplete = await checkOnboardingStatus(user.id);
      if (!isComplete) {
        router.push("/onboarding");
        return;
      }
      // Initial Load
      fetchJobs(1, true);
      fetchSavedJobs(user.id);
    };
    checkAuth();
  }, [router, supabase]);

  // Trigger fetch when Tab changes (Reset pagination)
  useEffect(() => {
    fetchJobs(1, true);
  }, [activeTab]);

  // Realtime Listener
  useEffect(() => {
    const channel = supabase
      .channel('job-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_listings' },
        (payload) => {
          const newJob = payload.new as Job;
          // Only prepend if it matches current view
          const isIntern = checkIsInternship(newJob);
          const visibleTab = isIntern ? 'INTERNSHIP' : 'FULL_TIME';

          if (visibleTab === activeTab) {
            setJobs((prev) => [newJob, ...prev]);
            setTotal((t) => t + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, activeTab]);

  // Helper moved up
  const checkIsInternship = (job: Job) => {
    const type = job.job_type ? String(job.job_type).toUpperCase() : '';
    const title = job.role_title ? String(job.role_title).toLowerCase() : '';
    return type === 'INTERNSHIP' || title.includes('intern');
  };

  const fetchJobs = async (pageNum = 1, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const offset = (pageNum - 1) * limit; // For verification, though backend handles page param

      // Use configured BACKEND_URL
      // Construct URL with query params
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        job_type: activeTab
      });

      const res = await fetch(`${BACKEND_URL}/opportunities?${params.toString()}`);

      if (!res.ok) throw new Error(`API Error: ${res.status}`);

      const response = await res.json();

      // 1. Validate Response Shape (Safety First)
      const data = response.data || [];
      const totalCount = response.total || 0;

      // 2. State Updates
      // 2. State Updates
      if (!append) {
        setJobs(data);
      } else {
        // Append new jobs (filtering out potential duplicates if any)
        setJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          const newUnique = data.filter((j: Job) => !existingIds.has(j.id));
          return [...prev, ...newUnique];
        });
      }

      setTotal(totalCount);
      setPage(pageNum); // Sync page state
      setIsBackendDown(false);

    } catch (err) {
      console.error("🔥 Error fetching jobs via API:", err);
      if (!append) setJobs([]); // Clear on error if it was a reset
      setIsBackendDown(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    fetchJobs(nextPage, false);
  };

  const fetchSavedJobs = async (userId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/users/${userId}/saved_jobs`);
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }
      const data = await res.json();
      const ids = new Set<string>(data.map((item: any) => item.opportunity_id));
      setSavedJobIds(ids);
      setIsBackendDown(false);
    } catch (error) {
      console.error("Failed to fetch saved jobs", error);
      setIsBackendDown(true);
      alert("⚠️ Backend Disconnected. Check if the Python terminal is running.");
    }
  };

  const toggleSaveJob = async (jobId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic Update
    const isSaved = savedJobIds.has(jobId);
    setSavedJobIds(prev => {
      const newSet = new Set(prev);
      if (isSaved) newSet.delete(jobId);
      else newSet.add(jobId);
      return newSet;
    });

    try {
      const res = await fetch(`${BACKEND_URL}/users/${user.id}/saved_jobs/${jobId}`, {
        method: "POST"
      });
      if (!res.ok) {
        throw new Error("Failed to toggle save");
      }
    } catch (error) {
      console.error("Error toggling save:", error);
      // Revert on error
      setSavedJobIds(prev => {
        const newSet = new Set(prev);
        if (isSaved) newSet.add(jobId);
        else newSet.delete(jobId);
        return newSet;
      });
      alert("Failed to save job. Please try again.");
    }
  };

  /*
    REFRESH LOGIC:
    1. Fetch latest user preferences (DB).
    2. Build dynamic query (join roles with OR).
    3. Trigger Agent Scan.
    4. Auto-update list on completion.
  */
  const handleRefresh = async () => {
    // Re-fetch jobs first (just in case)
    await fetchJobs(1, true);
    // Trigger a fresh fast scan
    await triggerDiscovery('FAST');
  };

  const triggerDiscovery = async (mode: 'FAST' | 'DEEP' = 'FAST') => {
    setScanning(true);
    setScanMessage(mode === 'DEEP' ? "Initializing Deep Scan..." : "Syncing latest preferences...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Latest Preferences
      // Note: User requested 'profiles.job_titles', but schema is 'job_preferences.desired_roles'.
      // Fetching fresh data to ensure we catch any new profile updates.
      const { data: prefs, error: prefError } = await supabase
        .from('job_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle to avoid 406 if row missing

      if (prefError) console.warn("Error fetching prefs:", prefError);

      let searchQuery = "Software Engineer";
      let location = "India";
      // Enable Auto-Deep Fallback by default to ensure results
      let filters: any = { scan_mode: mode, auto_deep_fallback: true };

      if (prefs) {
        // Multi-Title Support: Join all roles with " OR "
        const roles = prefs.desired_roles || [];

        if (roles.length > 0) {
          searchQuery = roles.join(" OR ");
        } else {

        }

        location = prefs.preferred_locations?.[0] || "India";

        // Check if ANY role implies internship
        if (searchQuery.toLowerCase().includes("intern")) filters.is_internship = true;

        if (location.toLowerCase().includes("remote")) filters.is_remote = true;
        else filters.location = location;

        // Pass experience level to avoid "Bouncer" filtering out senior roles
        if (prefs.experience_years) {
          filters.experience_years = prefs.experience_years;
        }
      }

      // UX Feedback
      alert(`Hunting for: ${searchQuery}\nLocation: ${location}`);



      // 2. Queue the Task
      // 2. Call Backend API to Queue Task & Trigger Agent
      // Schema: DiscoverRequest needs skills/locations. user_id is a query param in backend.
      // User requested body: { user_id, scan_type: "deep" }
      // We merge requirements: Send valid DiscoverRequest body + requested fields + user_id in query just in case.
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://karyasync.onrender.com";

      const response = await fetch(`${backendUrl}/opportunities/discover?user_id=${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Required by Backend Schema (DiscoverRequest)
          skills: prefs?.priority_skills || ["Software Engineer"],
          preferred_locations: prefs?.preferred_locations || [],
          location: location,
          limit: 20,
          // Requested by User (Extra context, helpful if backend schema evolves)
          user_id: user.id,
          scan_type: "deep"
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend Error: ${response.status}`);
      }

      const task = await response.json();

      // 3. Poll for Completion
      const taskId = task.id;
      setScanMessage("Agent hunting for jobs...");

      const pollInterval = setInterval(async () => {
        const { data: currentTask, error: pollError } = await supabase
          .from('search_queue')
          .select('status')
          .eq('id', taskId)
          .single();

        if (pollError || currentTask.status === 'FAILED') {
          clearInterval(pollInterval);
          setScanning(false);
          alert("Job Hunt Failed. Please try again.");
          return;
        }

        if (currentTask.status === 'COMPLETED') {
          clearInterval(pollInterval);
          setScanMessage("Fresh Jobs Found! Updating...");
          setScanMessage("Fresh Jobs Found! Updating...");
          await fetchJobs(1, true); // 4. Fetch the new jobs
          setTimeout(() => setScanning(false), 1500);
        }
      }, 2000);

    } catch (err: any) {
      console.error("Scan failed:", err);
      setScanning(false);
    }
  };


  // Formatter updated for Indian Lakhs (LPA)
  const formatSalary = (min?: number, max?: number) => {
    if ((!min || min === 0) && (!max || max === 0)) return "Not disclosed";

    // Helper to format individual numbers
    const formatNum = (val: any) => {
      const num = Number(val);
      if (isNaN(num)) return val;

      if (num >= 100000) {
        // Convert to Lakhs (e.g., 500000 -> 5)
        const inLakhs = num / 100000;
        // Remove .0 if it's an integer (5.0 -> 5)
        const formatted = inLakhs % 1 === 0 ? inLakhs.toFixed(0) : inLakhs.toFixed(1);
        return `${formatted} LPA`;
      }
      if (num >= 1000) {
        return `${(num / 1000).toFixed(0)}k`;
      }
      return `${num.toLocaleString('en-IN')}`;
    };

    if (min && max) {
      // If both are large, we can say "₹5 - 12 LPA" to be cleaner? 
      // Or just keep it explicit "₹5 LPA - ₹12 LPA"
      return `${formatNum(min)} - ${formatNum(max)}`;
    }
    if (min) return `${formatNum(min)}+`;
    if (max) return `Up to ${formatNum(max)}`;
    return "Not disclosed";
  };



  // Strict Filtering Logic
  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'FULL_TIME') return true;

    // Internship Rules
    const type = (job.job_type || '').toLowerCase();
    const title = (job.role_title || '').toLowerCase();

    // 1. Must be an internship
    const isIntern = type === 'internship' || type.includes('intern') || title.includes('intern');

    // 2. Must NOT be full-time (Strict Exclusion)
    const isFullTime = type.includes('full') || title.includes('full-time');

    return isIntern && !isFullTime;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0F1014]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
      </div>
    );
  }

  return (
    <AppLayout>
      <ScanLoader isOpen={scanning} message={scanMessage} />

      <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-[#0F1014] text-gray-900 dark:text-gray-50 transition-colors duration-300">
        {isBackendDown && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3 text-red-800 dark:text-red-200">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="font-bold text-sm">Backend Disconnected</h3>
              <p className="text-xs text-red-600/80">Unable to reach the API server. Please ensure the Python backend is running.</p>
            </div>
            <button
              onClick={() => { setIsBackendDown(false); fetchJobs(1, false); fetchSavedJobs((supabase.auth as any).user?.id || ''); }}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Job Opportunities</h1>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Toggles */}
            <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'}`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'}`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>



            <button
              onClick={() => triggerDiscovery('FAST')}
              disabled={scanning}
              className="flex items-center gap-2 btn-primary-premium px-5 py-2.5 rounded-full disabled:opacity-70 text-sm"
            >
              <Sparkles className="h-4 w-4" /> Auto-Discover
            </button>

            <button
              onClick={() => {
                if (confirm("Deep Scan takes about 60s. Proceed?")) triggerDiscovery('DEEP');
              }}
              disabled={scanning}
              className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg hover:bg-amber-700 transition shadow-sm disabled:opacity-70 font-medium text-sm"
            >
              <Search className="h-4 w-4" /> Deep Scan
            </button>
          </div>
        </div>

        {/* Premium Tab Navigation */}
        <div className="mb-6 flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-full md:w-max relative overflow-x-auto no-scrollbar border border-slate-200 dark:border-slate-700">
          {[
            { id: 'INTERNSHIP', label: '🎓 Internships' },
            { id: 'FULL_TIME', label: '💼 Full-Time' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "relative z-10 px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap",
                activeTab === tab.id
                  ? "text-indigo-700 dark:text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white dark:bg-indigo-600 shadow-sm rounded-lg border border-slate-200 dark:border-indigo-500"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {filteredJobs.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-center py-16 bg-white dark:bg-[#1E1E2E] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800"
            >
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full inline-block shadow-sm mb-4">
                <Search className="h-8 w-8 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {`No ${activeTab.toLowerCase().replace('_', '-')} positions found`}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Try running a Deep Scan to find more opportunities!
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Table View */}
              {viewMode === 'table' && (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1E1E2E]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800">
                          <tr>
                            <th className="p-4 w-[35%] min-w-[250px]">
                              <span className="font-bold leading-none opacity-90 text-gray-600 dark:text-gray-400 uppercase tracking-wider text-xs block">
                                Role
                              </span>
                            </th>
                            <th className="p-4 w-[25%] min-w-[200px]">
                              <span className="font-bold leading-none opacity-90 text-gray-600 dark:text-gray-400 uppercase tracking-wider text-xs block">
                                Company
                              </span>
                            </th>
                            <th className="p-4 w-[15%] whitespace-nowrap">
                              <span className="font-bold leading-none opacity-90 text-gray-600 dark:text-gray-400 uppercase tracking-wider text-xs block">
                                Type
                              </span>
                            </th>
                            <th className="p-4 w-[15%] whitespace-nowrap">
                              <span className="font-bold leading-none opacity-90 text-gray-600 dark:text-gray-400 uppercase tracking-wider text-xs block">
                                Salary
                              </span>
                            </th>
                            <th className="p-4 text-right">
                              <span className="font-bold leading-none opacity-90 text-gray-600 dark:text-gray-400 uppercase tracking-wider text-xs block">
                                Action
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody ref={tableBodyRef} className="divide-y divide-gray-200 dark:divide-gray-800">
                          {loading ? (
                            [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                          ) : (
                            filteredJobs.map((job, index) => {
                              const isInternship = job.job_type === 'INTERNSHIP' || job.role_title.toLowerCase().includes('intern');
                              return (
                                <tr
                                  key={job.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 group"
                                >
                                  {/* Role */}
                                  <td className="p-4 align-top">
                                    <span className="block font-bold text-gray-900 dark:text-gray-100 text-base capitalize">
                                      {job.role_title}
                                    </span>
                                  </td>

                                  {/* Company */}
                                  <td className="p-4 align-top">
                                    <span className="block font-normal opacity-90 text-gray-600 dark:text-gray-400">
                                      {job.company_name}
                                    </span>
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                                      <MapPin className="h-3 w-3" /> {job.location || "Remote"}
                                    </div>
                                  </td>

                                  {/* Job Type with Badges */}
                                  <td className="p-4 align-top">
                                    <div className="w-max">
                                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${isInternship
                                        ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/50'
                                        : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50'
                                        }`}>
                                        {isInternship ? 'Internship' : 'Full Time'}
                                      </span>
                                    </div>
                                    <span className="block mt-1 font-medium opacity-80 text-gray-500 dark:text-gray-400 text-xs capitalize">
                                      {job.work_mode?.toLowerCase().replace('_', ' ') || "Hybrid"}
                                    </span>
                                  </td>

                                  {/* Salary */}
                                  <td className="p-4 align-top">
                                    <span className="block font-medium text-gray-900 dark:text-gray-100">
                                      {formatSalary(job.salary_min, job.salary_max)}
                                    </span>
                                  </td>

                                  {/* Action Button */}
                                  <td className="p-4 align-top text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <motion.button
                                        whileTap={{ scale: 0.8 }}
                                        onClick={() => toggleSaveJob(job.id)}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                        title={savedJobIds.has(job.id) ? "Unsave" : "Save Job"}
                                      >
                                        <Bookmark className={`h-5 w-5 ${savedJobIds.has(job.id) ? "fill-current text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"}`} />
                                      </motion.button>

                                      <motion.a
                                        whileTap={{ scale: 0.95 }}
                                        href={job.apply_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full shadow-sm font-bold text-xs uppercase tracking-wide btn-primary-premium"
                                      >
                                        Apply
                                      </motion.a>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Card List (Table Mode) */}
                  <div className="md:hidden flex flex-col gap-4">
                    {filteredJobs.map((job) => {
                      const isInternship = checkIsInternship(job);
                      return (
                        <div
                          key={`mobile-${job.id}`}
                          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-none flex flex-col gap-3"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{job.role_title}</h3>
                              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{job.company_name}</p>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={() => toggleSaveJob(job.id)}
                              className="p-2 -mr-2 -mt-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Bookmark className={`h-5 w-5 ${savedJobIds.has(job.id) ? "fill-current text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
                            </motion.button>
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            {isInternship ? (
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                                Internship
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                Full Time
                              </span>
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full">
                              <MapPin className="h-3 w-3" /> {job.location || "Remote"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50 mt-1">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Salary</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                                {formatSalary(job.salary_min, job.salary_max)}
                              </span>
                            </div>
                            <motion.a
                              whileTap={{ scale: 0.95 }}
                              href={job.apply_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-2 rounded-md shadow-sm border border-transparent font-bold text-xs uppercase tracking-wide btn-primary-premium"
                            >
                              Apply
                            </motion.a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Grid View (Fallback) */}
              {viewMode === 'grid' && (
                <div className="grid gap-4 md:grid-cols-1">
                  {filteredJobs.map((job) => {
                    const isInternship = checkIsInternship(job);
                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -2, transition: { duration: 0.2 } }}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex flex-col md:flex-row justify-between items-start gap-4"
                      >
                        <div>
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white capitalize">{job.role_title}</h3>
                          <p className="text-slate-600 dark:text-slate-400">{job.company_name}</p>
                          <div className="flex gap-2 mt-2">
                            {isInternship ? (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wide">Internship</span>
                            ) : (
                              <span
                                className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wide"
                              >Full Time</span>
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {job.location || "Remote"}
                            </span>
                          </div>
                        </div>
                        <motion.a whileTap={{ scale: 0.95 }} href={job.apply_link} target="_blank" className="btn-primary-premium px-4 py-2 rounded-md text-sm font-bold shadow-sm border border-transparent transition-all">Apply</motion.a>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Load More Button */}
              {jobs.length < total && (
                <div className="mt-8 flex justify-center pb-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="group relative px-6 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
