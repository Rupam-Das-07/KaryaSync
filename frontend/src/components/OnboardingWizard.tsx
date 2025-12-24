"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

import { useToast } from "@/context/ToastContext";
import { AutocompleteInput } from "./AutocompleteInput";
import { SelectInput } from "./SelectInput";
import { DEGREES, MAJORS, UNIVERSITIES, getGraduationYears } from "@/utils/constants";

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  // Form States
  const [formData, setFormData] = useState({
    fullName: "",
    university: "",
    degree: "",
    major: "",
    gradYear: "",
    skills: "",
    locations: "",
    salaryMin: "",
    experienceYears: 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCvFile(file);
      setAnalyzing(true);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Pass user_id if available
        const url = user
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/analyze-cv?user_id=${user.id}`
          : `${process.env.NEXT_PUBLIC_API_BASE_URL}/analyze-cv`;

        const res = await fetch(url, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        setAnalysisResult(data);

        // Pre-fill form if data extracted
        if (data.skills) {
          setFormData(prev => ({ ...prev, skills: data.skills.join(", ") }));
        }
      } catch (error) {
        console.error("CV Analysis failed", error);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const startLockingIn = async () => {
    setLoading(true);
    setStep(5); // Show animation
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // 1. Update User Profile
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          full_name: formData.fullName,
          is_onboarded: true
        }),
      });

      // 2. Create Academic Profile
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${user.id}/academic-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          university: formData.university,
          degree: formData.degree,
          major: formData.major,
          grad_year: parseInt(formData.gradYear) || 2025,
          gpa: "0.0" // Default
        }),
      });

      // 3. Create Job Preferences
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${user.id}/job-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desired_roles: ["Software Engineer"], // Default
          preferred_locations: formData.locations.split(",").map(s => s.trim()),
          salary_min: parseInt(formData.salaryMin) || 0,
          priority_skills: formData.skills.split(",").map(s => s.trim()),
          experience_years: parseInt(formData.experienceYears as any) || 0
        }),
      });

      // Simulate "Locking In" delay for effect
      await new Promise(resolve => setTimeout(resolve, 2000));

      showToast("Your profile is set up! Let's find jobs for you.", "success");
      router.push("/dashboard");
    } catch (error) {
      console.error("Onboarding failed", error);
      showToast("Something went wrong. Please try again.", "error");
      setLoading(false);
      setStep(4); // Revert on error
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0F1014] p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-[#1E1E2E] shadow-2xl border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {step === 1 && "Let's get to know you"}
            {step === 2 && "Academic Background"}
            {step === 3 && "Upload your CV"}
            {step === 4 && "Job Preferences"}
            {step === 5 && "Locking In..."}
          </h2>
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${step >= i ? "bg-violet-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="flex flex-col gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 opacity-70">Full Name</label>
                  <input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none transition-all"
                    placeholder="e.g. Alex Chen"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="flex flex-col gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 opacity-70">University</label>
                  <AutocompleteInput
                    label="University / College"
                    value={formData.university}
                    onChange={(val) => setFormData({ ...formData, university: val })}
                    suggestions={UNIVERSITIES}
                    placeholder="e.g. Stanford University"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <AutocompleteInput
                      label="Degree"
                      value={formData.degree}
                      onChange={(val) => setFormData({ ...formData, degree: val })}
                      suggestions={DEGREES}
                      placeholder="e.g. B.Tech"
                    />
                  </div>
                  <div>
                    <AutocompleteInput
                      label="Major / Stream"
                      value={formData.major}
                      onChange={(val) => setFormData({ ...formData, major: val })}
                      suggestions={MAJORS}
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                </div>
                <div>
                  <SelectInput
                    label="Graduation Year"
                    value={formData.gradYear}
                    onChange={(val) => setFormData({ ...formData, gradYear: val })}
                    options={getGraduationYears()}
                    placeholder="Select Year"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleCvUpload}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <div className="mb-2 rounded-full bg-violet-100 p-3 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    {analyzing ? <Sparkles className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {analyzing ? "Analyzing Resume..." : "Upload Resume (PDF)"}
                  </p>
                  {cvFile && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> {cvFile.name}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="flex flex-col gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 opacity-70">Top Skills</label>
                  <input
                    name="skills"
                    value={formData.skills}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none transition-all"
                    placeholder="React, Python, AWS..."
                  />
                </div>
                <div>
                  <label className="flex flex-col gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 opacity-70">Preferred Locations</label>
                  <input
                    name="locations"
                    value={formData.locations}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none transition-all"
                    placeholder="Bangalore, Remote..."
                  />
                </div>
                <div>
                  <label className="flex flex-col gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 opacity-70">Min Salary (LPA)</label>
                  <input
                    name="salaryMin"
                    value={formData.salaryMin}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none transition-all"
                    placeholder="12"
                  />
                </div>
                <div>
                  <label className="flex flex-col gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 opacity-70">Years of Experience: {formData.experienceYears || 0}</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      name="experienceYears"
                      min="0"
                      max="20"
                      step="1"
                      value={formData.experienceYears || 0}
                      onChange={handleInputChange}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-violet-600 dark:bg-gray-700"
                    />
                    <span className="w-12 text-center font-bold text-violet-600 dark:text-violet-400">
                      {formData.experienceYears || 0}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Set to 0 if you are a Fresher.</p>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="relative mb-6 h-24 w-24">
                  <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20"></div>
                  <div className="relative flex h-full w-full items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    <Sparkles className="h-10 w-10 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Personalizing your experience...
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  We're setting up your dashboard based on your skills and preferences.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="mt-8 flex justify-between">
            {step > 1 && step < 5 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-xl px-6 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="ml-auto flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-transform hover:scale-105"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : step === 4 ? (
              <button
                onClick={startLockingIn}
                disabled={loading}
                className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105 disabled:opacity-50"
              >
                {loading ? "Locking In..." : "Complete Setup"}
                {!loading && <CheckCircle className="h-4 w-4" />}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
