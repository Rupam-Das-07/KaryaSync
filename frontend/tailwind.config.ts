import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Professional SaaS Palette (Strict Indigo/Slate)
        primary: {
          DEFAULT: "#4f46e5", // indigo-600
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f1f5f9", // slate-100
          foreground: "#0f172a", // slate-900
        },
        // Enforce Slate for neutals
        slate: colors.slate,
        gray: colors.slate, // Remap gray to slate for consistency
        indigo: colors.indigo,
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
        outfit: ["var(--font-outfit)"],
      },
    },
  },
  plugins: [],
};

export default config;
