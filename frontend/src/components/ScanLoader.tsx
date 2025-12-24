import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScanLoaderProps {
  isOpen: boolean;
  message: string;
}

export default function ScanLoader({ isOpen, message }: ScanLoaderProps) {
  // If not open, don't render anything (or let AnimatePresence handle it if we wrap it at usage site, 
  // but here we can just return null if we want simple conditional rendering, 
  // though AnimatePresence works best when the component stays mounted or is conditionally rendered inside it.
  // For simplicity and to match the requirement "Full-screen fixed overlay", we'll rely on the parent to conditionally render or use AnimatePresence there.
  // Actually, let's include AnimatePresence here for self-contained animation if the parent toggles the prop? 
  // No, AnimatePresence needs to wrap the condition. 
  // Let's just make this component render the motion div directly, and the parent handles the "isOpen" check 
  // OR we can wrap it here. Let's wrap it here for smoother exit animations.

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center border border-gray-200 dark:border-slate-700"
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-colors duration-500 ${message.toLowerCase().includes('success')
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
              }`}>
              {message.toLowerCase().includes('success') ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : (
                <Loader2 className="w-8 h-8 animate-spin" />
              )}
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {message.toLowerCase().includes('success') ? 'Discovery Complete' : 'AI Agent Working'}
            </h3>

            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {message}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
