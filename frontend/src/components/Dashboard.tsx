"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Sparkles,
  Briefcase,
  Bookmark,
  Send,
  RefreshCw,
  MapPin,
  Layers
} from "lucide-react";
import { motion } from "framer-motion";
import JobCard from "./JobCard";
import JobDetailModal from "./JobDetailModal";
import { useToast } from "@/context/ToastContext";

interface Opportunity {
  id: string;
  company_name: string;
  role_title: string;
  job_type: string;
  work_mode: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  apply_link: string;
  source: string;
  status: string;
  status_note: string | null;
  source_metadata: any;
  last_checked_at: string;
  created_at: string;
}

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Opportunity | null>(null);
  const [filter, setFilter] = useState("all");
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    loadOpportunities();

    // Realtime Subscription
    const channel = supabase.channel('custom-insert-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_listings' },
        (payload) => {

          // Update the local state to append the new job immediately
          setOpportunities((prev) => [payload.new as Opportunity, ...prev]);
          showToast("New job found!", "success");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadOpportunities = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // 1. Fetch from DB
    const { data: dbOps, error } = await supabase
      .from("opportunities")
      .select("*")
      .order("last_checked_at", { ascending: false });

    if (dbOps && dbOps.length > 0) {
      setOpportunities(dbOps);
    } else {
      // Fallback to demo data if DB is empty (for prototype)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/opportunities`);
        if (res.ok) {
          const data = await res.json();
          setOpportunities(data);
        }
      } catch (err) {
        console.error("Failed to load demo data", err);
      }
    }
    setLoading(false);
  };

  const handleDiscoverJobs = async () => {
    setDiscovering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user preferences for better targeting
      const { data: prefs } = await supabase
        .from("job_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const { data: profile } = await supabase
        .from("academic_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Construct payload
      const payload = {
        skills: prefs?.priority_skills || ["Software Engineer", "React", "Python"], // Fallback
        location: (prefs?.preferred_locations as string[])?.[0] || "Bangalore",
        salary_min: prefs?.salary_min ? String(prefs.salary_min) : "0",
        limit: 5
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/opportunities/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Job Hunt Started! The agent is searching in the background...", "info");
        // We don't reload immediately as it's async now. 
        // User can refresh later or we can implement polling.
      } else {
        throw new Error("Failed to start discovery");
      }
    } catch (error) {
      console.error("Discovery failed:", error);
      showToast("Failed to start job discovery", "error");
    } finally {
      setDiscovering(false);
    }
  };

  const filteredOpportunities = opportunities.filter(op => {
    if (filter === "all") return true;
    if (filter === "remote") return op.work_mode?.toLowerCase().includes("remote");
    if (filter === "internship") return op.job_type?.toLowerCase().includes("intern");
    return true;
  });

  const stats = {
    total: opportunities.length,
    new: opportunities.filter(op => new Date(op.created_at) > new Date(Date.now() - 86400000 * 2)).length,
    applied: opportunities.filter(op => op.status === 'applied').length
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Job Radar</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Finding the best opportunities for you based on your profile.
          </p>
        </div>
        <button
          onClick={handleDiscoverJobs}
          disabled={discovering}
          className="relative overflow-hidden group px-6 py-3 rounded-full btn-primary-premium text-white font-bold transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <span className="flex items-center gap-2 relative z-10">
            {discovering ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Scanning Web...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Auto-Discover Jobs
              </>
            )}
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1E1E2E] border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Matches</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E2E] border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">New (48h)</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{stats.new}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1E1E2E] border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Applied</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{stats.applied}</p>
          </div>
        </div>
      </div>

      {/* Filters & Content */}
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${filter === "all"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-50 dark:text-gray-900 dark:border-gray-50"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-[#1E1E2E] dark:text-gray-300 dark:border-slate-700 dark:hover:bg-white/5"
              }`}
          >
            All Jobs
          </button>
          <button
            onClick={() => setFilter("remote")}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap flex items-center gap-2 ${filter === "remote"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-50 dark:text-gray-900 dark:border-gray-50"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-[#1E1E2E] dark:text-gray-300 dark:border-slate-700 dark:hover:bg-white/5"
              }`}
          >
            <MapPin className="w-3 h-3" /> Remote
          </button>
          <button
            onClick={() => setFilter("internship")}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap flex items-center gap-2 ${filter === "internship"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-50 dark:text-gray-900 dark:border-gray-50"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-[#1E1E2E] dark:text-gray-300 dark:border-slate-700 dark:hover:bg-white/5"
              }`}
          >
            <Layers className="w-3 h-3" /> Internships
          </button>
        </div>

        {/* Job Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-[var(--surface-container)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOpportunities.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => setSelectedJob(job)}
              />
            ))}
          </div>
        )}

        {!loading && filteredOpportunities.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-[var(--surface-container)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-[var(--foreground)]">No jobs found</h3>
            <p className="text-slate-500">Try adjusting filters or run Auto-Discover again.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={(id) => {
          if (selectedJob?.apply_link) window.open(selectedJob.apply_link, "_blank");
        }}
      />
    </div>
  );
}
