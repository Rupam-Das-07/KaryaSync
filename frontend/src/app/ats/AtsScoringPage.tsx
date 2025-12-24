"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import {
  CheckCircle,
  AlertCircle,
  Sparkles,
  Loader2,
  FileText,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";

export interface AnalysisResult {
  score: number;
  matched_skills: string[];
  matched_keywords?: string[]; // New field
  missing_skills: string[];
  recommendations: string[];
  debug_mode?: string;
}
export default function ATSPage() {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resumeFile, setResumeFile] = useState<{ url: string, filename: string } | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const supabase = createClient();

  // Color logic for score gauge
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // Green
    if (score >= 50) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const fetchResume = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDebugInfo({ error: "No user found" });
        return;
      }

      const { data, error } = await supabase
        .from('cv_uploads')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setDebugInfo({ userId: user.id, data, error });

      if (data) {
        setResumeFile({ url: data.storage_url, filename: data.filename });
      } else {

      }
    } catch (e) {
      console.error("ATS Page: Unexpected error fetching resume", e);
      setDebugInfo({ error: e });
    }
  };

  useEffect(() => {
    fetchResume();
  }, [supabase]);

  const handleAnalyze = async () => {
    if (!resumeFile || !resumeFile.url || !jobDescription.trim()) return;

    setLoading(true);
    setResult(null);

    // Create form data for the new API
    const formData = new FormData();
    formData.append("jobDescription", jobDescription);

    try {
      // Fetch the file blob from the storage URL (or cache)
      const fileRes = await fetch(resumeFile.url);
      const fileBlob = await fileRes.blob();
      formData.append("resume", fileBlob, resumeFile.filename);

      // Call our new Robust API
      const res = await fetch("/api/ats/scan", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Analysis failed");

      const data = await res.json();

      setResult({
        score: data.score,
        matched_skills: [],
        matched_keywords: data.matched_keywords || [],
        missing_skills: data.missing_keywords || [],
        recommendations: [data.summary, ...(data.missing_keywords?.length ? ["Include missing keywords"] : [])],
        debug_mode: data.debug_mode // Store debug mode for badge
      });

    } catch (err) {
      console.error(err);
      alert("Failed to analyze. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 bg-gray-50 dark:bg-[#0F1014] min-h-screen text-gray-900 dark:text-gray-50">

        <div className="mb-0">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <TrendingUp className="text-indigo-600 dark:text-indigo-400" /> ATS Optimizer
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Hack the algorithm. Get more interviews.
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8">

          {/* Input Section */}
          <div className="space-y-6">

            {/* Resume Section */}
            <div className="bg-white dark:bg-[#1E1E2E] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Resume</h2>
              </div>

              {resumeFile ? (
                <div className="w-full h-48 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-3 shadow-sm border border-slate-200 dark:border-slate-800">
                    <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="font-bold text-lg text-slate-900 dark:text-white">{resumeFile.filename}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" /> Latest uploaded resume
                  </p>
                </div>
              ) : (
                <div className="w-full h-auto bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center opacity-70">
                  <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                  <p className="font-semibold text-gray-900 dark:text-white">No Resume Found</p>
                  <div className="flex flex-col gap-2 mt-2 items-center">
                    <a href="/profile" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Click here to upload in Profile</a>
                    <button
                      onClick={fetchResume}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Check Again
                    </button>
                    {/* Debug Info for User */}
                    {debugInfo && (
                      <details className="mt-4 text-left w-full max-w-xs bg-black/5 p-2 rounded text-[10px] font-mono overflow-auto max-h-32 text-gray-500">
                        <summary className="cursor-pointer">Debug Info</summary>
                        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Job Desc Section */}
            <div className="bg-white dark:bg-[#1E1E2E] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Job Description</h2>
              </div>
              <textarea
                className="w-full h-48 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none resize-none transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Paste the target job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !resumeFile || !jobDescription}
              className="w-full py-4 rounded-full btn-primary-premium font-bold text-lg shadow-lg hover:shadow-xl hover:opacity-90 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" /> Analyze Match
                </>
              )}
            </button>
          </div>

          {/* Results Section */}
          <div className={`space-y-6 ${!result && !loading ? 'opacity-50 grayscale pointer-events-none blur-[1px]' : ''} transition-all duration-500`}>

            {result ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#1E1E2E] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-md relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                <div className="flex flex-col items-center mb-8 relative z-10">
                  <div className="relative w-48 h-48 flex items-center justify-center mb-4">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        className="text-slate-100 dark:text-slate-800"
                        strokeWidth="2"
                      />
                      <motion.path
                        initial={{ strokeDasharray: "0, 100" }}
                        animate={{ strokeDasharray: `${result.score}, 100` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={getScoreColor(result.score)}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                        {result.score}
                      </span>
                      <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Score
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    {result.score >= 80 ? (
                      <h3 className="text-xl font-bold text-green-600 dark:text-green-400">Excellent Match! 🚀</h3>
                    ) : result.score >= 50 ? (
                      <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400">Good Start, Needs work. ⚠️</h3>
                    ) : (
                      <h3 className="text-xl font-bold text-red-600 dark:text-red-400">Low Match. Optimize heavily! 🛑</h3>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                      Your resume covers about {result.score}% of the core requirements found in this job description.
                    </p>
                    <div className="flex justify-center mt-4">
                      {result.debug_mode?.includes("AI") ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          <Sparkles className="w-3 h-3" /> AI Precision
                        </span>
                      ) : result.debug_mode?.includes("ALGO") ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          <TrendingUp className="w-3 h-3" /> Algorithmic
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                          <AlertCircle className="w-3 h-3" /> Basic Backup
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  {/* Detailed Feedback */}
                  {/* Detailed Feedback */}
                  <div className="space-y-6">
                    {/* Matched Skills */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" /> Matched Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.matched_keywords && result.matched_keywords.length > 0 ? (
                          result.matched_keywords.map((skill, i) => (
                            <motion.span
                              key={i}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                              className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md text-sm font-bold border border-green-100 dark:border-green-900/30"
                            >
                              {skill}
                            </motion.span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500 italic">No exact matches found yet.</span>
                        )}
                      </div>
                    </div>

                    {/* Missing Skills */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" /> Missing Keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.missing_skills.length > 0 ? (
                          result.missing_skills.map((skill, i) => (
                            <motion.span
                              key={i}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: i * 0.1 }}
                              className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-sm font-bold border border-red-100 dark:border-red-900/30"
                            >
                              {skill}
                            </motion.span>
                          ))
                        ) : (
                          <span className="text-sm text-green-600 dark:text-green-400 italic font-medium">No missing critical keywords found!</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> AI Recommendations
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50">
                      <ul className="space-y-3">
                        {result.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                            <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

              </motion.div>
            ) : (
              /* Placeholder State */
              <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-800/20">
                <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-800">
                  <TrendingUp className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Ready to Optimize?</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  Paste your resume and the job description on the left to get a detailed ATS analysis and match score.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
