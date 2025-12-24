import React from "react";
import { motion } from "framer-motion";
import { MapPin, Building2, Briefcase, ExternalLink, Clock, CheckCircle2 } from "lucide-react";

interface JobCardProps {
  job: any;
  onClick: () => void;
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const isNew = new Date(job.created_at) > new Date(Date.now() - 86400000 * 2); // New if < 2 days

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200"
    >
      {/* Status Pill */}
      <div className="absolute top-4 right-4 flex gap-2">
        {isNew && (
          <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800">
            New
          </span>
        )}
        <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${job.status === 'applied' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800' :
          job.status === 'closed' ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800' :
            'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
          }`}>
          {job.status || "Open"}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
            {job.company_name?.[0] || <Building2 className="w-6 h-6 text-indigo-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50 truncate pr-16 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {job.role_title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              {job.company_name}
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-1" />
              <span className="text-xs opacity-80">{job.source}</span>
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="truncate">{job.location || "Remote"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <span className="truncate">{job.job_type || "Full-time"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="truncate">{job.work_mode || "Hybrid"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="truncate text-xs">
              {new Date(job.last_checked_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Skills / Match Reason */}
        {job.source_metadata?.match_reason && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(job.source_metadata.match_reason as string[]).slice(0, 3).map((skill, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 rounded">
                {skill}
              </span>
            ))}
            {(job.source_metadata.match_reason as string[]).length > 3 && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-slate-400">
                +{job.source_metadata.match_reason.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
