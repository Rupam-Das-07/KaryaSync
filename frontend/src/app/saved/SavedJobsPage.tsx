"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, API_BASE_URL } from "@/utils/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Loader2, ExternalLink, Briefcase, Bookmark, Trash2, MapPin } from "lucide-react";
import { checkOnboardingStatus } from "@/utils/onboarding";

interface SavedJob {
  id: number;
  opportunity_id: string;
  user_id: string;
  stage: string;
  created_at: string;
  opportunity: {
    id: string;
    role_title: string;
    company_name: string;
    location: string;
    apply_link: string;
    salary_min?: number;
    salary_max?: number;
    job_type?: string;
    source_metadata?: any;
    work_mode?: string;
  };
}

export default function SavedJobsPage() {
  const [loading, setLoading] = useState(true);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setLoading(false);
      fetchSavedJobs(user.id);
    };
    checkAuth();
  }, [router, supabase]);

  const fetchSavedJobs = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/saved_jobs`);
      if (res.ok) {
        const data = await res.json();
        setSavedJobs(data);
      } else {
        console.error("API Error:", res.status, res.statusText);
      }
    } catch (error) {
      console.error("Failed to fetch saved jobs", error);
    }
  };

  const removeSavedJob = async (jobId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic Update
    const previousJobs = [...savedJobs];
    setSavedJobs(prev => prev.filter(job => job.opportunity_id !== jobId));

    try {
      const res = await fetch(`${API_BASE_URL}/users/${user.id}/saved_jobs/${jobId}`, {
        method: "POST"
      });
      if (!res.ok) {
        throw new Error("Failed to remove job");
      }
    } catch (error) {
      console.error("Error removing job:", error);
      setSavedJobs(previousJobs);
      alert("Failed to remove job. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-[#0F1014] text-gray-900 dark:text-gray-50">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 tracking-tight">
          <Bookmark className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          Saved Jobs
        </h1>

        <div className="grid gap-4 md:grid-cols-1">
          {savedJobs.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#1E1E2E] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full inline-block shadow-sm mb-4">
                <Bookmark className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">No saved jobs yet</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2 font-medium">
                Bookmark jobs from the dashboard to view them here.
              </p>
            </div>
          ) : (
            savedJobs.map((item) => {
              const job = item.opportunity;
              return (
                <div key={item.id} className="group bg-white dark:bg-[#1E1E2E] border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="space-y-2">
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {job.role_title || "Unknown Role"}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-2">
                      <Briefcase className="h-4 w-4 opacity-70" />
                      {job.company_name}
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {job.location || "Remote"}
                      </span>
                      {(job.salary_min || job.salary_max) && (
                        <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-1 rounded-full border border-green-200 dark:border-green-900/30 font-bold">
                          💰 {job.salary_min ? `${job.salary_min}` : ''} - {job.salary_max ? `${job.salary_max}` : ''}
                        </span>
                      )}

                      {/* Badge Logic */}
                      {job.job_type === 'internship' || job.job_type === 'INTERNSHIP' ? (
                        <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-indigo-200 dark:border-indigo-800">
                          🎓 INTERNSHIP
                        </span>
                      ) : (
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-slate-200 dark:border-slate-700 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          Full Time
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => removeSavedJob(item.opportunity_id)}
                      className="p-3 rounded-full border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove from Saved"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    <a
                      href={job.apply_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 md:flex-none text-center btn-primary-premium px-6 py-3 rounded-full text-sm font-bold shadow-sm whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      Apply Now <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
