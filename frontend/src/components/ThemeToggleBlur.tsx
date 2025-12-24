"use client";

import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

// Add type support for View Transition API
interface ViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
}

declare global {
  interface Document {
    startViewTransition(callback: () => Promise<void> | void): ViewTransition;
  }
}

export default function ThemeToggleBlur() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";

    // Fallback for browsers without View Transition API
    if (!document.startViewTransition) {
      setTheme(newTheme);
      return;
    }

    // Capture click position
    const button = buttonRef.current;
    if (!button) {
      setTheme(newTheme);
      return;
    }
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Calculate radius to the furthest corner
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    );

    // Start Validity Transition
    const transition = document.startViewTransition(async () => {
      setTheme(newTheme);
      // Wait for React to reconcile (optional but recommended for strictly async state updates)
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Wait for the pseudo-elements to be created
    await transition.ready;

    // Animate the circle clip
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
    ];

    // Animate the "new" view (the incoming theme) growing over the old one
    document.documentElement.animate(
      {
        clipPath: clipPath,
      },
      {
        duration: 750,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)", // This targets the NEW snapshot
      }
    );
  };

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors relative z-50 pointer-events-auto"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-gray-600" />
      )}
    </button>
  );
}
