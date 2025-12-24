"use client";

import { useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "info";

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
  duration?: number;
}

export default function Toast({ id, message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const variants = {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  const bgColors = {
    success: "bg-[var(--surface)] border-[var(--primary)]",
    error: "bg-[var(--surface)] border-[var(--error)]",
    info: "bg-[var(--surface)] border-[var(--accent)]",
  };

  const textColors = {
    success: "text-[var(--primary)]",
    error: "text-[var(--error)]",
    info: "text-[var(--accent)]",
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <AlertCircle className="w-5 h-5" />,
  };

  return (
    <motion.div
      layout
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${bgColors[type]} min-w-[300px] max-w-md`}
    >
      <div className={`${textColors[type]}`}>{icons[type]}</div>
      <p className="flex-1 text-sm font-medium text-[var(--foreground)]">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="p-1 rounded-full hover:bg-[var(--surface-container)] transition-colors text-[var(--text-secondary)]"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
