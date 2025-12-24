"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ModalWrapper } from "./ProfileEditModals";

interface ATSCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ATSCheckerModal({ isOpen, onClose }: ATSCheckerModalProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const supabase = createClient();

  // Reset state when closing
  const handleClose = () => {
    setResult(null);
    setJobDescription("");
    onClose();
  };

  const handleCheck = async () => {
    if (!jobDescription.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const resumeText = "Experienced Software Engineer with Python, React, and AWS skills."; // Placeholder for demo

      const { data: task, error } = await supabase
        .from('search_queue')
        .insert({
          user_id: user.id,
          query: "ATS Scan",
          status: 'PENDING',
          task_type: 'ATS',
          payload: {
            resume_text: resumeText,
            job_description: jobDescription
          }
        })
        .select()
        .single();

      if (error) throw error;

      const pollInterval = setInterval(async () => {
        const { data: currentTask } = await supabase
          .from('search_queue')
          .select('status')
          .eq('id', task.id)
          .single();

        if (currentTask && currentTask.status === 'COMPLETED') {
          clearInterval(pollInterval);
          const { data: scoreData } = await supabase
            .from('resume_scores')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (scoreData) {
            setResult({
              score: scoreData.score,
              matched_skills: [],
              missing_skills: scoreData.missing_keywords || [],
              recommendations: scoreData.recommendations || []
            });
          }
          setLoading(false);
        } else if (currentTask && currentTask.status === 'FAILED') {
          clearInterval(pollInterval);
          setLoading(false);
          alert("ATS Scan Failed");
        }
      }, 2000);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setJobDescription("");
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose} title="ATS Resume Checker">
      {!result ? (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <h3 className="flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300 mb-2">
              <Sparkles className="w-5 h-5" /> How it works
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-200/80 leading-relaxed">
              Paste the job description below. Our AI will analyze your resume against the requirements and provide a match score + missing keywords.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-gray-300 mb-2">
              Job Description
            </label>
            <textarea
              className="w-full h-40 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none placeholder-gray-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-[#2A2A35] dark:text-white dark:placeholder-gray-500 transition-all resize-none"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={loading || !jobDescription.trim()}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold shadow-lg hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? "Scanning..." : "Run ATS Check"}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Score Display - Keeping SVG logic but updating containers if needed */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#2A2A35' : '#E2E8F0'}
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={result.score > 70 ? "#10B981" : result.score > 40 ? "#F59E0B" : "#EF4444"}
                  strokeWidth="3"
                  strokeDasharray={`${result.score}, 100`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold text-black dark:text-white">{result.score}%</span>
                <span className="text-xs font-medium text-gray-500">Match</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Matched Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.matched_skills.length > 0 ? (
                  result.matched_skills.map((skill: string) => (
                    <span key={skill} className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 text-xs font-medium">
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-500 italic">No direct matches found</span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Missing Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.missing_skills.length > 0 ? (
                  result.missing_skills.map((skill: string) => (
                    <span key={skill} className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 text-xs font-medium">
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-500 italic">No missing keywords!</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#2A2A35] rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
            <h3 className="font-bold text-black dark:text-white mb-2">Recommendations</h3>
            <ul className="space-y-2">
              {result.recommendations.map((rec: string, i: number) => (
                <li key={i} className="text-sm text-black dark:text-gray-300 flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={reset}
            className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-black dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Scan Another Job
          </button>
        </div>
      )}
    </ModalWrapper>
  );
}
