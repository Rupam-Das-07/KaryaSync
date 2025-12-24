"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Save, Upload, FileText, Sparkles, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AutocompleteInput } from "./AutocompleteInput";
import { SelectInput } from "./SelectInput";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "next-themes";
import { UNIVERSITIES, DEGREES, MAJORS, LOCATIONS, ROLES, getRoleColor, getGraduationYears } from "@/utils/constants";

const apiBase = "http://localhost:8000";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  initialData?: any;
}

export function EditPhoneModal({ isOpen, onClose, onSuccess, userId, initialData }: ModalProps) {
  const [phone, setPhone] = useState(initialData || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) setPhone(initialData || "");
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Optimistic update
      const res = await fetch(`${apiBase}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          email: "placeholder@example.com", // Schema requires email, but backend handles partial updates via upsert
          phone: phone
        }),
      });

      if (!res.ok) throw new Error("Failed to update phone");
      showToast("Phone number updated successfully", "success");
      onSuccess();
      onClose();
    } catch (err) {
      setError("Failed to save phone number");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Phone Number">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg px-4 py-3 outline-none transition-all bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="+91 98765 43210"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg btn-primary-premium px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

export function EditAcademicModal({ isOpen, onClose, onSuccess, userId, initialData }: ModalProps) {
  const [formData, setFormData] = useState({
    university: "",
    degree: "",
    major: "",
    location: "", // New field
    grad_year: "",
    gpa: "",
    highlights: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        university: initialData.university || "",
        degree: initialData.degree || "",
        major: initialData.major || "",
        location: initialData.location || "", // Load location
        grad_year: initialData.grad_year?.toString() || "",
        gpa: initialData.gpa || "",
        highlights: initialData.highlights || ""
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${apiBase}/users/${userId}/academic-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          grad_year: formData.grad_year ? parseInt(formData.grad_year) : null
        }),
      });

      if (!res.ok) throw new Error("Failed to update academic profile");
      showToast("Academic details updated successfully", "success");
      onSuccess();
      onClose();
    } catch (err) {
      setError("Failed to save academic details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Academic Details">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AutocompleteInput
          label="University / College"
          value={formData.university}
          onChange={(val) => setFormData({ ...formData, university: val })}
          suggestions={UNIVERSITIES}
          placeholder="e.g. IIT Bombay"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AutocompleteInput
            label="Degree"
            value={formData.degree}
            onChange={(val) => setFormData({ ...formData, degree: val })}
            suggestions={DEGREES}
            placeholder="e.g. B.Tech"
          />
          <AutocompleteInput
            label="Major / Stream"
            value={formData.major}
            onChange={(val) => setFormData({ ...formData, major: val })}
            suggestions={MAJORS}
            placeholder="e.g. Computer Science"
          />
        </div>

        <AutocompleteInput
          label="University Location"
          value={formData.location}
          onChange={(val) => setFormData({ ...formData, location: val })}
          suggestions={LOCATIONS}
          placeholder="e.g. Mumbai"
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">Graduation Year</label>
            <SelectInput
              value={formData.grad_year}
              onChange={(val) => setFormData({ ...formData, grad_year: val })}
              options={getGraduationYears()}
              placeholder="Select Year"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">CGPA / Percentage</label>
            <input
              type="text"
              value={formData.gpa}
              onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
              className="w-full rounded-lg px-4 py-3 outline-none transition-all bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-[#272732] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              placeholder="9.5"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">Highlights / Achievements</label>
          <textarea
            value={formData.highlights}
            onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
            className="h-24 w-full rounded-lg px-4 py-3 outline-none transition-all bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Dean's List, Hackathon Winner..."
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg btn-primary-premium px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

export function EditPreferencesModal({ isOpen, onClose, onSuccess, userId, initialData, userProfile }: ModalProps & { userProfile?: any }) {
  const [formData, setFormData] = useState({
    desired_roles: "",
    salary_min: "",
    locations: "",
    experience_years: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        desired_roles: initialData?.desired_roles?.join(", ") || "",
        salary_min: initialData?.salary_min?.toString() || "",
        locations: userProfile?.preferred_locations?.join(", ") || "",
        experience_years: initialData?.experience_years || 0,
      });
    }
  }, [isOpen, initialData, userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const roles = formData.desired_roles.split(",").map(s => s.trim()).filter(Boolean);
      const locations = formData.locations.split(",").map(s => s.trim()).filter(Boolean);

      // 1. Update Job Preferences
      const prefRes = await fetch(`${apiBase}/users/${userId}/job-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desired_roles: roles,
          salary_min: formData.salary_min ? parseFloat(formData.salary_min) : null,
          experience_years: formData.experience_years,
        }),
      });

      if (!prefRes.ok) {
        const err = await prefRes.json();
        throw new Error(err.detail || "Failed to update preferences");
      }

      // 2. Update User Locations
      const userRes = await fetch(`${apiBase}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          email: "placeholder@example.com",
          preferred_locations: locations
        }),
      });

      if (!userRes.ok) {
        const err = await userRes.json();
        throw new Error(err.detail || "Failed to update locations");
      }

      onSuccess();
      showToast("Job preferences updated successfully", "success");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Job Preferences">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AutocompleteInput
          label="Desired Roles (comma separated)"
          value={formData.desired_roles}
          onChange={(val) => setFormData({ ...formData, desired_roles: val })}
          suggestions={ROLES}
          placeholder="Software Engineer, Data Scientist..."
        />
        {/* Animated Chips for Desired Roles */}
        <div className="flex flex-wrap gap-2 mt-2 min-h-[32px]">
          <AnimatePresence mode="popLayout">
            {formData.desired_roles.split(',').map(role => role.trim()).filter(Boolean).map((role, idx) => {
              const colorClass = getRoleColor(role);
              return (
                <motion.span
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  key={`${role}-${idx}`}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all duration-300 ${colorClass}`}
                >
                  {role}
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">Minimum Expected Salary (LPA)</label>
          <input
            type="number"
            value={formData.salary_min}
            onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
            className="w-full rounded-lg px-4 py-3 outline-none transition-all bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-[#272732] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            placeholder="12"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">
            Years of Experience: {formData.experience_years}
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600 dark:bg-slate-700"
            />
            <span className="w-12 text-center font-bold text-indigo-600 dark:text-indigo-400">
              {formData.experience_years}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Set to 0 if you are a Fresher.</p>
        </div>

        <AutocompleteInput
          label="Preferred Locations (comma separated)"
          value={formData.locations}
          onChange={(val) => setFormData({ ...formData, locations: val })}
          suggestions={LOCATIONS}
          placeholder="Bengaluru, Pune, Remote..."
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg btn-primary-premium px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

export function EditResumeModal({ isOpen, onClose, onSuccess, userId }: ModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { showToast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // We use the analyze-cv endpoint as it handles parsing and saving to cv_uploads
      const res = await fetch(`${apiBase}/analyze-cv?user_id=${userId}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload resume");

      showToast("Resume uploaded successfully", "success");
      onSuccess();
      onClose();
    } catch (err) {
      showToast("Failed to upload resume. Please try again.", "error");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Upload Resume">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-[#272732] dark:hover:bg-gray-700/50">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <div className="mb-2 rounded-full bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {file ? file.name : "Click to Upload Resume (PDF)"}
          </p>
          {file && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Ready to upload
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10">Cancel</button>
          <button type="submit" disabled={loading || !file} className="flex items-center gap-2 rounded-lg btn-primary-premium px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {analyzing ? "Uploading..." : "Save Resume"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

export function ModalWrapper({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl p-6 shadow-xl glass-surface"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
                <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
                  <X className="h-5 w-5 fill-current" />
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
