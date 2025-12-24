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
import { API_BASE_URL } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";

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

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [activeTab, setActiveTab] = useState<'INTERNSHIP' | 'FULL_TIME'>('FULL_TIME');
  const [isBackendDown, setIsBackendDown] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Helper for consistent salary formatting
  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;

    // Format helper for Indian Lakhs
    const formatNum = (num: number) => {
      const n = Number(num);
      if (isNaN(n)) return "0";
      if (n >= 100000) {
        // e.g. 500000 -> 5 LPA
        const lpa = n / 100000;
        return `${lpa % 1 === 0 ? lpa : lpa.toFixed(1)} LPA`;
      }
      if (n >= 1000) {
        // e.g. 15000 -> 15k
        const k = n / 1000;
        return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
      }
      return n.toLocaleString('en-IN');
    };

    if (min && max) {
      // If same (e.g. 5LPA - 5LPA), show once
      if (min === max) return formatNum(min);
      return `${formatNum(min)} - ${formatNum(max)}`;
    }
    return formatNum(min || max || 0);
  };

  const isInternshipJob = (job: Job) => {
    const type = job.job_type ? String(job.job_type).toUpperCase() : '';
    const title = job.role_title ? String(job.role_title).toLowerCase() : '';
    return type === 'INTERNSHIP' || title.includes('intern');
  };

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
      setLoading(false);
      fetchJobs();
      fetchSavedJobs(user.id);
    };
    checkAuth();
  }, [router, supabase]);

  // Realtime Listener
  useEffect(() => {
    const channel = supabase
      .channel('job-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_listings' },
        (payload) => {

          setJobs((prev) => [payload.new as Job, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('job_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
      setIsBackendDown(false);
    } catch (err) {
      console.error("🔥 Error fetching jobs:", err);
    }
  };

  const fetchSavedJobs = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/saved_jobs`);
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
      const res = await fetch(`${API_BASE_URL}/users/${user.id}/saved_jobs/${jobId}`, {
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

  const triggerDiscovery = async (mode: 'FAST' | 'DEEP' = 'FAST') => {
    setScanning(true);
    setScanMessage(mode === 'DEEP' ? "Initializing Deep Scan..." : "Connecting to Adzuna...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prefs } = await supabase
        .from('job_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let searchQuery = "Software Engineer";
      let location = "India";
      let filters: any = { scan_mode: mode };

      if (prefs) {
        const role = prefs.desired_roles?.[0] || "Developer";
        location = prefs.preferred_locations?.[0] || "India";
        searchQuery = role;

        if (role.toLowerCase().includes("intern")) filters.is_internship = true;
        if (location.toLowerCase().includes("remote")) filters.is_remote = true;
        else filters.location = location;
      }



      const { data: task, error } = await supabase
        .from('search_queue')
        .insert({
          user_id: user.id,
          query: searchQuery,
          status: 'PENDING',
          filters: filters,
          resolved_locations_source: 'request',
          task_type: 'SEARCH'
        })
        .select()
        .single();

      if (error || !task) throw error || new Error("Task creation failed");

      const taskId = task.id;
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
          setScanMessage("Success! Refreshing list...");
          await fetchJobs();
          setTimeout(() => setScanning(false), 1500);
        }
      }, 2000);

    } catch (err: any) {
      console.error("Scan failed:", err);
      setScanning(false);
    }
  };
  const filteredJobs = jobs.filter(job => {
    // Universal helper check
    const isIntern = isInternshipJob(job);

    if (activeTab === 'INTERNSHIP') return isIntern;
    if (activeTab === 'FULL_TIME') return !isIntern;
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
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
              onClick={() => { setIsBackendDown(false); fetchJobs(); fetchSavedJobs((supabase.auth as any).user?.id || ''); }}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Job Opportunities</h1>


        </div>


        {/* Tabs (Animated) */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Tabs */}
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-full md:w-max relative overflow-x-auto no-scrollbar border border-slate-200 dark:border-slate-700">
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
                    layoutId="activeTabHome"
                    className="absolute inset-0 bg-white dark:bg-indigo-600 shadow-sm rounded-lg border border-slate-200 dark:border-indigo-500"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Actions Group */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
            {/* View Toggles */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

            <button
              onClick={() => triggerDiscovery('FAST')}
              disabled={scanning}
              className="flex items-center gap-2 btn-primary-premium px-4 py-2 hover:opacity-90 transition shadow-sm disabled:opacity-70 font-semibold text-sm rounded-full"
            >
              <Sparkles className="h-4 w-4" /> Auto-Discover
            </button>

            <button
              onClick={() => {
                if (confirm("Deep Scan takes about 60s. Proceed?")) triggerDiscovery('DEEP');
              }}
              disabled={scanning}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-full hover:bg-amber-700 transition shadow-sm disabled:opacity-70 font-semibold text-sm"
            >
              <Search className="h-4 w-4" /> Deep Scan
            </button>
          </div>
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
              className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800"
            >
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full inline-block shadow-sm mb-4">
                <Search className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {`No ${activeTab.toLowerCase().replace('_', '-')} positions found`}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
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
              {/* Table View (Desktop) & Mobile Cards (Mobile) */}
              {viewMode === 'table' && (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-4 w-[35%] min-w-[250px]">
                              <span className="font-bold leading-none opacity-90 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs block">
                                Role
                              </span>
                            </th>
                            <th className="p-4 w-[25%] min-w-[200px]">
                              <span className="font-bold leading-none opacity-90 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs block">
                                Company
                              </span>
                            </th>
                            <th className="p-4 w-[15%] whitespace-nowrap">
                              <span className="font-bold leading-none opacity-90 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs block">
                                Type
                              </span>
                            </th>
                            <th className="p-4 w-[15%] whitespace-nowrap">
                              <span className="font-bold leading-none opacity-90 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs block">
                                Salary
                              </span>
                            </th>
                            <th className="p-4 text-right">
                              <span className="font-bold leading-none opacity-90 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs block">
                                Action
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {filteredJobs.map((job) => {
                            const isIntern = isInternshipJob(job);
                            return (
                              <tr
                                key={job.id}
                                className="group row-hover-effect transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                              >
                                {/* Role */}
                                <td className="p-4 align-top">
                                  <span className="block font-bold text-slate-900 dark:text-slate-100 text-base">
                                    {job.role_title}
                                  </span>
                                </td>

                                {/* Company */}
                                <td className="p-4 align-top">
                                  <span className="block font-normal opacity-90 text-slate-600 dark:text-slate-400">
                                    {job.company_name}
                                  </span>
                                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-1 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {job.location || "Remote"}
                                  </div>
                                </td>

                                {/* Job Type with Badges */}
                                <td className="p-4 align-top">
                                  <div className="w-max">
                                    {isIntern ? (
                                      <span className="inline-block px-3 py-1 rounded-full text-xs capitalize font-bold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                                        Internship
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-block px-3 py-1 rounded-full text-xs capitalize font-bold tracking-wide bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-sm"
                                      >
                                        Full Time
                                      </span>
                                    )}
                                  </div>
                                  <span className="block mt-1 font-medium opacity-80 text-slate-500 dark:text-slate-400 text-xs capitalize">
                                    {job.work_mode?.toLowerCase().replace('_', ' ') || "Hybrid"}
                                  </span>
                                </td>

                                {/* Salary */}
                                <td className="p-4 align-top">
                                  <span className="block font-medium text-slate-900 dark:text-slate-100">
                                    {formatSalary(job.salary_min, job.salary_max) || (
                                      <span className="italic opacity-50">Not disclosed</span>
                                    )}
                                  </span>
                                </td>

                                {/* Action Button */}
                                <td className="p-4 align-top text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <motion.button
                                      whileTap={{ scale: 0.8 }}
                                      onClick={() => toggleSaveJob(job.id)}
                                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                      title={savedJobIds.has(job.id) ? "Unsave" : "Save Job"}
                                    >
                                      <Bookmark className={`h-5 w-5 ${savedJobIds.has(job.id) ? "fill-current text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
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
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Card List View (Table Mode) */}
                  <div className="md:hidden flex flex-col gap-4">
                    {filteredJobs.map((job) => {
                      const isIntern = isInternshipJob(job);
                      return (
                        <div
                          key={`mobile-${job.id}`}
                          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{job.role_title}</h3>
                              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{job.company_name}</p>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={() => toggleSaveJob(job.id)}
                              className="p-2 -mr-2 -mt-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            >
                              <Bookmark className={`h-5 w-5 ${savedJobIds.has(job.id) ? "fill-current text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
                            </motion.button>
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            {isIntern ? (
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                                Internship
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                Full Time
                              </span>
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                              <MapPin className="h-3 w-3" /> {job.location || "Remote"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/50 mt-1">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Salary</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                                {formatSalary(job.salary_min, job.salary_max) || "Not disclosed"}
                              </span>
                            </div>
                            <motion.a
                              whileTap={{ scale: 0.95 }}
                              href={job.apply_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-2 rounded-full shadow-sm font-bold text-xs uppercase tracking-wide btn-primary-premium"
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
                    const isIntern = isInternshipJob(job);
                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-xl dark:hover:shadow-slate-900/10 transition-all flex flex-col md:flex-row justify-between items-start gap-4"
                      >
                        <div>
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white">{job.role_title}</h3>
                          <p className="text-slate-600 dark:text-slate-400">{job.company_name}</p>
                          <div className="flex gap-2 mt-2">
                            {isIntern ? (
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
                        <motion.a whileTap={{ scale: 0.95 }} href={job.apply_link} target="_blank" className="btn-primary-premium px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-all">Apply</motion.a>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}