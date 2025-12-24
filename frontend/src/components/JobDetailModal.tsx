import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Building2, Briefcase, ExternalLink, Calendar, DollarSign, CheckCircle } from "lucide-react";

interface JobDetailModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onApply: (id: string) => void;
}

export default function JobDetailModal({ job, isOpen, onClose, onApply }: JobDetailModalProps) {
  if (!isOpen || !job) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-xl bg-white dark:bg-[#1E1E2E] shadow-2xl z-[70] overflow-y-auto border-l border-gray-200 dark:border-gray-800"
          >
            <div className="p-6 lg:p-8 flex flex-col h-full">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-3xl font-bold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                    {job.company_name?.[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{job.role_title}</h2>
                    <p className="text-lg text-indigo-600 dark:text-indigo-400 font-medium">{job.company_name}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Location</span>
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <MapPin className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    {job.location || "Remote"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Salary</span>
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <DollarSign className="w-4 h-4 text-teal-500 dark:text-teal-400" />
                    {job.salary_min ? `₹${job.salary_min}L - ₹${job.salary_max}L` : job.source_metadata?.salary_extracted || "Not Disclosed"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Work Mode</span>
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <Building2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    {job.work_mode || "Hybrid"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Posted</span>
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(job.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Description / Snippet */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Job Description</h3>
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                  {job.source_metadata?.snippet || "No description available. Please check the official listing."}
                </div>
              </div>

              {/* Match Reason */}
              {job.source_metadata?.match_reason && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Why it matched</h3>
                  <div className="flex flex-wrap gap-2">
                    {(job.source_metadata.match_reason as string[]).map((skill, i) => (
                      <span key={i} className="px-3 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" /> {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-800 flex gap-4">
                <button
                  onClick={() => onApply(job.id)}
                  className="flex-1 py-3.5 rounded-full btn-primary-premium text-white font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  Apply Now <ExternalLink className="w-4 h-4" />
                </button>
                <button className="px-6 py-3.5 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white font-medium transition-colors">
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
