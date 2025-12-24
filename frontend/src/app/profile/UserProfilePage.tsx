"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  LogOut,
  User,
  GraduationCap,
  Briefcase,
  FileText,
  MapPin,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { EditPhoneModal, EditAcademicModal, EditPreferencesModal, EditResumeModal } from "@/components/ProfileEditModals";
import { Pencil } from "lucide-react";
import ATSCheckerModal from "@/components/ATSCheckerModal";

// 🎨 Deterministic Color Palette for Role Chips
const ROLE_COLORS = [
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none",
  "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200 dark:shadow-none",
  "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none",
  "bg-amber-600 text-white hover:bg-amber-700 shadow-sm shadow-amber-200 dark:shadow-none",
  "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-200 dark:shadow-none",
  "bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm shadow-cyan-200 dark:shadow-none",
  "bg-fuchsia-600 text-white hover:bg-fuchsia-700 shadow-sm shadow-fuchsia-200 dark:shadow-none",
  "bg-orange-600 text-white hover:bg-orange-700 shadow-sm shadow-orange-200 dark:shadow-none",
  "bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-200 dark:shadow-none",
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none",
];

const getRoleColor = (role: string) => {
  if (!role) return ROLE_COLORS[0];
  let hash = 0;
  for (let i = 0; i < role.length; i++) {
    hash = role.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ROLE_COLORS.length;
  return ROLE_COLORS[index];
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [academic, setAcademic] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isATSModalOpen, setIsATSModalOpen] = useState(false);

  // Modal states
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      // Fetch all data in parallel, allowing failures (Fail Open)
      const results = await Promise.allSettled([
        fetch(`${apiBase}/users/${user.id}`, { signal: controller.signal }),
        fetch(`${apiBase}/users/${user.id}/academic-profile`, { signal: controller.signal }),
        fetch(`${apiBase}/users/${user.id}/job-preferences`, { signal: controller.signal })
      ]);

      clearTimeout(timeoutId);

      // Process User Profile
      if (results[0].status === "fulfilled" && results[0].value.ok) {
        setProfile(await results[0].value.json());
      }

      // Process Academic Profile
      if (results[1].status === "fulfilled" && results[1].value.ok) {
        setAcademic(await results[1].value.json());
      }

      // Process Job Preferences
      if (results[2].status === "fulfilled" && results[2].value.ok) {
        setPreferences(await results[2].value.json());
      }

      // Fetch Resume
      const { data: resumeData } = await supabase
        .from('cv_uploads')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .single();

      if (resumeData) setResume(resumeData);

    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0F1014]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F1014] p-4 md:p-8 text-gray-900 dark:text-gray-50 transition-colors duration-300">
      <ATSCheckerModal isOpen={isATSModalOpen} onClose={() => setIsATSModalOpen(false)} />

      <div className="mx-auto max-w-6xl mt-4 px-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Edit Modals */}
      {user && (
        <>
          <EditPhoneModal
            isOpen={isPhoneModalOpen}
            onClose={() => setIsPhoneModalOpen(false)}
            onSuccess={fetchData}
            userId={user.id}
            initialData={profile?.phone}
          />
          <EditAcademicModal
            isOpen={isAcademicModalOpen}
            onClose={() => setIsAcademicModalOpen(false)}
            onSuccess={fetchData}
            userId={user.id}
            initialData={academic}
          />
          <EditPreferencesModal
            isOpen={isPreferencesModalOpen}
            onClose={() => setIsPreferencesModalOpen(false)}
            onSuccess={fetchData}
            userId={user.id}
            initialData={preferences}
            userProfile={profile}
          />
          <EditResumeModal
            isOpen={isResumeModalOpen}
            onClose={() => setIsResumeModalOpen(false)}
            onSuccess={fetchData}
            userId={user.id}
          />
        </>
      )}

      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 text-2xl font-bold text-white shadow-none border border-indigo-200 dark:border-indigo-700">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{profile?.full_name || "User"}</h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">{academic?.degree || "Student"} • {academic?.university || "University"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E2E] px-6 py-2.5 font-bold text-gray-600 dark:text-gray-400 transition hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-300 dark:hover:border-red-800"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {/* Left Column: Account Info */}
          <div className="space-y-6 md:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E2E] p-6 shadow-sm"
            >
              <h3 className="mb-4 flex items-center gap-2 font-bold text-lg text-indigo-600 dark:text-indigo-400">
                <User className="h-5 w-5" />
                Account Info
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Email</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {user?.email_confirmed_at ? (
                      <span className="flex items-center gap-1 text-white bg-emerald-600 px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                        <CheckCircle className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-white bg-amber-600 px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                        <XCircle className="h-3 w-3" /> Unverified
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Phone</label>
                    <button onClick={() => setIsPhoneModalOpen(true)} className="text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.phone || "Not set"}</p>
                </div>
              </div>
            </motion.div>

            {/* Resume Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E2E] p-6 shadow-sm mt-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-bold text-lg text-indigo-600 dark:text-indigo-400">
                  <FileText className="h-5 w-5" />
                  Resume
                </h3>
                <button onClick={() => setIsResumeModalOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                {resume ? (
                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm line-clamp-1 text-gray-900 dark:text-gray-100">{resume.filename}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Uploaded on {new Date(resume.uploaded_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <a
                      href={resume.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-wide"
                    >
                      View
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No resume uploaded</p>
                    <button
                      onClick={() => setIsResumeModalOpen(true)}
                      className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Upload Resume
                    </button>
                  </div>
                )}
              </div>
            </motion.div>


          </div>

          {/* Right Column: Academic & Preferences */}
          <div className="space-y-6 md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E2E] p-6 shadow-sm relative"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-bold text-lg text-blue-600 dark:text-blue-400">
                  <GraduationCap className="h-5 w-5" />
                  Academic Profile
                </h3>
                <button onClick={() => setIsAcademicModalOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">University</label>
                  <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">{academic?.university || "N/A"}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Location</label>
                  <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">{academic?.location || "N/A"}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Degree</label>
                  <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">{academic?.degree || "N/A"}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Major</label>
                  <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">{academic?.major || "N/A"}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Graduation Year</label>
                  <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">{academic?.grad_year || academic?.graduation_year || "N/A"}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E2E] p-6 shadow-sm relative"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  <Briefcase className="h-5 w-5" />
                  Job Preferences
                </h3>
                <button onClick={() => setIsPreferencesModalOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Desired Roles</label>
                  <motion.div layout className="mt-2 flex flex-wrap gap-2">
                    <AnimatePresence mode="popLayout">
                      {preferences?.desired_roles?.map((role: string) => {
                        const colorClass = getRoleColor(role);
                        return (
                          <motion.span
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            key={role}
                            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 ${colorClass}`}
                          >
                            {role}
                          </motion.span>
                        )
                      }) || preferences?.preferred_roles?.map((role: string) => {
                        const colorClass = getRoleColor(role);
                        return (
                          <motion.span
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            key={role}
                            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 ${colorClass}`}
                          >
                            {role}
                          </motion.span>
                        )
                      }) || <span className="text-sm text-gray-500 dark:text-gray-400 italic">No roles set</span>}
                    </AnimatePresence>
                  </motion.div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Preferred Locations</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile?.preferred_locations?.map((loc: string) => (
                        <span key={loc} className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800/50 px-3 py-1 rounded-full">
                          <MapPin className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> {loc}
                        </span>
                      )) || <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Remote</span>}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 opacity-70">Salary Expectation</label>
                    <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">
                      {preferences?.salary_min ? `${preferences.salary_min} LPA` : "Not set"}
                      {preferences?.salary_max ? ` - ${preferences.salary_max} LPA` : ""}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
