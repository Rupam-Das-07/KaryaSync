"use client";

import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Github } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "github") => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--foreground)]">
      <motion.div
        layout // animate layout changes
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isSignUp ? "signup" : "signin"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
                {isSignUp ? "Create account" : "Welcome back"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {isSignUp
                  ? "Start your journey to the perfect job"
                  : "Enter your details to access your dashboard"}
              </p>
            </div>

            {/* 1. Primary Auth (Email/Pass) */}
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-container)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-container)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
                  {error}
                </div>
              )}

              {/* Sign In Button Refined: Border-only, minimal, very faint bg, hover uplift */}
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center rounded-xl border-2 border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 py-3.5 font-bold text-slate-900 dark:text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isSignUp ? (
                  "Sign up"
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* 2. Divider Fixed & Softened text */}
            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-[var(--border)]"></div>
              <span className="text-sm font-medium text-slate-400">or continue with</span>
              <div className="h-px flex-1 bg-[var(--border)]"></div>
            </div>

            {/* 3. Social Login: Reduced Gap (space-y-3), Updated Text */}
            <div className="space-y-3">
              <button
                onClick={() => handleSocialLogin("google")}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container)] py-3 font-medium transition hover:bg-[var(--surface-container)]/80 hover:-translate-y-0.5"
              >
                {/* Google Icon SVG */}
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {isSignUp ? "Sign up with Google" : "Sign in with Google"}
              </button>
              <button
                onClick={() => handleSocialLogin("github")}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container)] py-3 font-medium transition hover:bg-[var(--surface-container)]/80 hover:-translate-y-0.5"
              >
                <Github className="h-5 w-5" />
                {isSignUp ? "Sign up with GitHub" : "Sign in with GitHub"}
              </button>
            </div>

            {/* 4. Auth Link: Neutral Hover */}
            <div className="text-center text-sm">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                type="button"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
