"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const words = [
  { text: "Careers", font: "font-serif italic" },
  { text: "Opportunities", font: "font-mono" },
  { text: "Growth", font: "font-sans font-extrabold tracking-tight" },
  { text: "कार्यSync", font: "font-sans font-bold text-indigo-600 dark:text-indigo-400" },
];

export function EntryPreloader() {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasSeen, setHasSeen] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem("hasSeenPreloader");
    if (!seen) {
      setHasSeen(false);
      document.body.style.overflow = "hidden";
    }
  }, []);

  useEffect(() => {
    if (hasSeen) return;

    // Smooth timing: Faster flow for first few, longer hold for brand name
    const isBrand = index === words.length - 1;
    const duration = isBrand ? 2200 : 1200;

    const timer = setTimeout(() => {
      if (isBrand) {
        setIsVisible(false);
        localStorage.setItem("hasSeenPreloader", "true");
        document.body.style.overflow = "unset";
      } else {
        setIndex((prev) => prev + 1);
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [index, hasSeen]);

  if (hasSeen) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }} // Very slow, gentle fade out
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f8f9fc] dark:bg-[#050511]"
        >
          {/* Constrained height container determines the visual baseline */}
          <div className="relative h-20 w-full max-w-4xl flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={index}
                // Motion Polish: Reduced travel distance (40px) = more stable feel
                initial={{ y: 40, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -40, opacity: 0, filter: "blur(4px)" }}
                transition={{
                  y: { duration: 0.9, ease: [0.16, 1, 0.3, 1] }, // Premium "Expo-out" feel
                  opacity: { duration: 0.6 }, // Fade quickly
                  filter: { duration: 0.6 }
                }}
                className={`absolute text-5xl md:text-7xl text-center whitespace-nowrap ${words[index].font} text-gray-900 dark:text-white`}
              >
                {words[index].text}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
