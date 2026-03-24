"use client";

import React, { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { checkOnboardingStatus } from "@/utils/onboarding";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  FileSignature,
  Download,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";

export default function TailorCVPage() {
  const router = useRouter();
  const supabase = createClient();
  const printRef = useRef<HTMLIFrameElement>(null);

  // States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form inputs
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [originalCV, setOriginalCV] = useState("");

  // Editor Output
  const [tailoredCV, setTailoredCV] = useState("");
  const [isTailoredView, setIsTailoredView] = useState(true);

  // Editor explicitly visible content
  const currentEditorContent = isTailoredView && tailoredCV ? tailoredCV : originalCV;

  // ATS Feedback
  const [atsFeedback, setAtsFeedback] = useState<{
    score: number;
    matched: string[];
    missing: string[];
  } | null>(null);

  useEffect(() => {
    const initPage = async () => {
      try {
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

        // Try to fetch existing CV content from profile
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://karyasync.onrender.com";
        const res = await fetch(`${apiBase}/users/${user.id}`);
        if (res.ok) {
          const profile = await res.json();
          // Assuming CV text might be saved here, or a URL. 
          // For now, let's keep it to simple string extraction if exists.
          if (profile.cv_text) {
              setOriginalCV(profile.cv_text);
          } else {
             // Fallback to checking cvUploads if we have an endpoint, 
             // but user requested to "auto-fill if exists, else empty"
          }
        }
      } catch (e) {
        console.error("Initialization error", e);
      } finally {
        setLoadingInitial(false);
      }
    };
    initPage();
  }, [router, supabase]);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isTailoredView && tailoredCV) {
      setTailoredCV(e.target.value);
    } else {
      setOriginalCV(e.target.value);
    }
  };

  const handleTailorSubmit = async () => {
    if (!companyName.trim() || !jobDescription.trim() || !originalCV.trim()) {
      setErrorMsg("Please fill in Company Name, Job Description, and Current CV.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setAtsFeedback(null);
    setIsTailoredView(true);

    try {
      // Mock API Delay
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Mock Response Generation
      const optimizedText = `[OPTIMIZED FOR ${companyName.toUpperCase()}]\n\n` + 
        `PROFESSIONAL SUMMARY\nHighly motivated professional with strong background in relevant skills matching the requested position.\n\n` +
        `CORE COMPETENCIES\n- React, Next.js, TypeScript\n- Problem Solving, Team Leadership\n- Backend Integration\n\n` +
        `EXPERIENCE\n\nSoftware Engineer | Previous Corp\n` +
        `- Optimized rendering performance by 40% using Next.js caching strategies.\n` +
        `- Developed responsive dashboards and intuitive UI systems conforming to strict design guides.\n\n` +
        `[Original Context Merged and Refined...]`;

      setTailoredCV(optimizedText);
      setAtsFeedback({
        score: 85,
        matched: ["React", "TypeScript", "Next.js", "Problem Solving"],
        missing: ["GraphQL", "Docker"]
      });

    } catch (e) {
      console.error("Tailor CV Error", e);
      setErrorMsg("Something went wrong. Please try again.");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (confirm("Reset editor to your original CV? This will clear tailored changes.")) {
      setTailoredCV("");
      setIsTailoredView(false);
      setAtsFeedback(null);
    }
  };

  const handleDownloadPDF = () => {
    if (!printRef.current) return;
    const iframe = printRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const contentToPrint = currentEditorContent.replace(/\n/g, '<br/>');

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Tailored CV - ${companyName || 'Document'}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }
            h1, h2, h3 { color: #111; margin-top: 0; }
          </style>
        </head>
        <body>
          ${contentToPrint}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  if (loadingInitial) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto min-h-screen text-gray-900 dark:text-gray-50 transition-colors duration-300">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <FileSignature className="h-7 w-7 text-emerald-600" />
            Tailor CV
          </h1>
        </div>

        {/* Global Error Toast */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800/50 shadow-sm flex items-center gap-3"
            >
               <XCircle className="h-5 w-5" />
               <span className="font-medium text-sm">{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ATS Feedback Panel (Top Section) */}
        <AnimatePresence>
          {atsFeedback && tailoredCV && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                 {/* Score Circle */}
                 <div className="flex flex-col items-center justify-center relative w-24 h-24 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-100 dark:text-slate-800"
                        strokeDasharray="100, 100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        stroke="currentColor" strokeWidth="3" fill="none"
                      />
                      <path
                        className="text-emerald-500 transition-all duration-1000 ease-out"
                        strokeDasharray={`${atsFeedback.score}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        stroke="currentColor" strokeWidth="3" fill="none"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-xl font-bold">{atsFeedback.score}%</span>
                      <span className="text-[10px] text-gray-500 font-medium uppercase mt-0.5">Match</span>
                    </div>
                 </div>

                 <div className="h-px w-full md:w-px md:h-20 bg-gray-200 dark:bg-slate-800"></div>

                 <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full">
                   {/* Matched */}
                   <div className="flex-1">
                     <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                       <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Keywords Found
                     </h4>
                     <div className="flex flex-wrap gap-2">
                       {atsFeedback.matched.map((kw, i) => (
                         <span key={i} className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50">
                           {kw}
                         </span>
                       ))}
                     </div>
                   </div>
                   
                   {/* Missing */}
                   <div className="flex-1">
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                       <XCircle className="h-3.5 w-3.5 text-amber-500" /> Missing Keywords
                     </h4>
                     <div className="flex flex-wrap gap-2">
                       {atsFeedback.missing.map((kw, i) => (
                         <span key={i} className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50">
                           {kw}
                         </span>
                       ))}
                     </div>
                   </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          
          {/* LEFT PANEL: Inputs */}
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col h-full">
             <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Requirements</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Provide the job details to optimize against.</p>
             </div>

             <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Company Name</label>
                  <input 
                    type="text"
                    value={companyName}
                    onChange={(e)=>setCompanyName(e.target.value)}
                    placeholder="e.g. Google, Stripe"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Job Description</label>
                  <textarea 
                    value={jobDescription}
                    onChange={(e)=>setJobDescription(e.target.value)}
                    placeholder="Paste the full job description here..."
                    className="w-full h-32 px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow resize-none"
                  />
                </div>

                <div className="flex-1 flex flex-col min-h-[250px]">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Current CV</label>
                  <textarea 
                    value={originalCV}
                    onChange={(e)=>setOriginalCV(e.target.value)}
                    placeholder="Paste your current CV here..."
                    className="w-full flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">Your CV will be optimized based on the job description.</p>
                </div>
             </div>

             <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
               <button
                  onClick={handleTailorSubmit}
                  disabled={isProcessing}
                  className="w-full flex justify-center items-center gap-2 btn-primary-premium py-3 rounded-xl shadow-sm text-sm font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed"
               >
                 {isProcessing ? (
                   <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                      Optimizing CV...
                   </>
                 ) : (
                   <>
                     <Sparkles className="h-4 w-4" />
                     Tailor My CV
                   </>
                 )}
               </button>
             </div>
          </div>

          {/* RIGHT PANEL: Output & Editor */}
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col h-full lg:min-h-[700px]">
             
             {/* Toolbar Header */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    CV Editor
                    {tailoredCV && (
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {isTailoredView ? "Tailored" : "Original"}
                      </span>
                    )}
                  </h2>
                </div>

                {tailoredCV && (
                  <div className="flex items-center gap-2">
                     {/* Toggle View */}
                     <button
                        onClick={() => setIsTailoredView(!isTailoredView)}
                        className="p-2 flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors"
                        title={isTailoredView ? "Show Original" : "Show Tailored"}
                     >
                       {isTailoredView ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                       <span className="hidden xl:inline">{isTailoredView ? "View Original" : "View Tailored"}</span>
                     </button>

                     {/* Reset */}
                     <button
                        onClick={handleReset}
                        className="p-2 flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:border-red-800 dark:hover:text-red-400 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors"
                        title="Reset to Original"
                     >
                        <RotateCcw className="h-3.5 w-3.5" />
                     </button>

                     {/* Download */}
                     <button
                        onClick={handleDownloadPDF}
                        disabled={!currentEditorContent}
                        className="p-2 flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Download as PDF"
                     >
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Export PDF</span>
                     </button>
                  </div>
                )}
             </div>

             {/* Editor Area */}
             <div className="flex-1 flex flex-col relative h-full">
                {(!tailoredCV && !originalCV) ? (
                  // Empty State Placeholder
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                      <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-4 border border-dashed border-gray-200 dark:border-slate-700">
                        <FileSignature className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">Your tailored CV will appear here after processing.</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-xs">Fill out the left panel and click &quot;Tailor My CV&quot; to begin formatting.</p>
                   </div>
                ) : (
                  // Active Editor
                  <textarea 
                    value={currentEditorContent}
                    onChange={handleEditorChange}
                    className="w-full h-full min-h-[500px] p-4 rounded-xl border border-transparent focus:border-indigo-300 dark:focus:border-indigo-500/50 bg-gray-50 dark:bg-slate-800/50 text-gray-800 dark:text-gray-200 font-mono text-sm leading-relaxed resize-none outline-none transition-colors"
                  />
                )}
             </div>
          </div>
        </div>
      </div>
      
      {/* Hidden iframe for native printing without external PDF libraries */}
      <iframe ref={printRef} style={{ display: 'none' }} title="Print Frame" />
    </AppLayout>
  );
}
