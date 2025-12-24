"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Bookmark,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  Briefcase,
  User,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ThemeToggleBlur from "./ThemeToggleBlur";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [userInitials, setUserInitials] = useState("U");
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  // Create the client once per render, but we won't put it in the dependency array
  const supabase = createClient();




  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Close menus when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("#user-menu-button") && !target.closest("#user-menu-dropdown")) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // FIX: Removed 'supabase' from dependency array to prevent infinite loop
  React.useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to get name from metadata first
        let name = user.user_metadata?.full_name || user.user_metadata?.name;

        // If not in metadata, try backend
        if (!name) {
          try {
            const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
            if (apiBase) {
              const res = await fetch(`${apiBase}/users/${user.id}`);
              if (res.ok) {
                const profile = await res.json();
                name = profile.full_name;
              }
            }
          } catch (e) {
            console.error("Failed to fetch profile", e);
          }
        }

        if (name) {
          setUserInitials(getInitials(name));
        } else if (user.email) {
          setUserInitials(getInitials(user.email));
        }
      }
    };
    fetchUser();
  }, []); // <--- Fixed: Empty dependency array ensures this runs only once on mount

  const getInitials = (nameOrEmail: string) => {
    if (!nameOrEmail) return "U";
    // Check if it's an email
    if (nameOrEmail.includes("@")) {
      return nameOrEmail.split("@")[0].charAt(0).toUpperCase();
    }
    // Full name
    const parts = nameOrEmail.trim().split(/\s+/);
    if (parts.length >= 2) {
      // Added safety check (?.) to prevent crashes on empty parts
      return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Check ATS Score", href: "/ats", icon: Briefcase },
    { name: "Saved Jobs", href: "/saved", icon: Bookmark },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F1014] text-gray-900 dark:text-gray-50 font-[family-name:var(--font-outfit)]">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50 px-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle Menu"
          >
            <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </button>
          <Link href="/" className="flex items-center gap-3 px-2 group">
            {/* 1. The Brand Box (Updated to Indigo) */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <span className="font-mono text-lg font-bold">KS</span>
            </div>
            {/* 2. The Text (Perfectly Aligned) */}
            <div className="flex items-baseline">
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-sans mr-1">
                कार्य
              </span>
              <span className="font-sans text-xl font-light text-slate-800 dark:text-white">
                Sync
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggleBlur />

          {/* User Avatar Dropdown */}
          <div className="relative">
            <button
              id="user-menu-button"
              onClick={toggleUserMenu}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all flex items-center justify-center"
            >
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {userInitials}
              </span>
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div
                  id="user-menu-dropdown"
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 dark:border-slate-800 
                             bg-white dark:bg-slate-900 shadow-xl py-1 z-[999] origin-top-right"
                >
                  <Link
                    href="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header >

      {/* Sidebar (Desktop) */}
      < aside className="hidden lg:flex fixed top-16 left-0 bottom-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col py-6 px-4 z-40" >
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                  ? "sidebar-item-active"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
              >
                <item.icon
                  className={`w-5 h-5 ${isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-500 group-hover:scale-105 transition-transform"
                    }`}
                />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside >

      {/* Mobile Sidebar Drawer */}
      {
        isSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="absolute top-0 left-0 bottom-0 w-3/4 max-w-xs bg-white dark:bg-[#1E1E2E] shadow-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  Menu
                </span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  <X className="w-6 h-6 text-gray-900 dark:text-white" />
                </button>
              </div>
              <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === item.href
                      ? "sidebar-item-active"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )
      }

      {/* Main Content */}
      <main className="pt-20 lg:pl-64 min-h-screen transition-all duration-300">
        <div className="container mx-auto px-4 lg:px-8 pb-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div >
  );
}
