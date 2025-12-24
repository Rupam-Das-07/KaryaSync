import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface SelectInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: SelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < options.length) {
        handleSelect(options[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current && selectedIndex !== -1) {
      const activeElement = dropdownRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, isOpen]);

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">
          {label}
        </label>
      )}
      <div
        className="relative cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div
          className={`w-full rounded-lg px-4 py-3 bg-white border transition-all text-sm flex items-center justify-between
          ${isOpen
              ? "border-indigo-500 ring-2 ring-indigo-500/20"
              : "border-slate-200 dark:border-slate-700"
            }
          dark:bg-slate-900 dark:text-slate-100`}
        >
          <span className={value ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}>
            {value || placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""
              }`}
          />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
            role="listbox"
          >
            {options.map((option, index) => (
              <div
                key={index}
                role="option"
                aria-selected={value === option}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-4 py-2 text-left text-sm cursor-pointer transition-colors ${value === option
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 font-medium"
                  : index === selectedIndex
                    ? "bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100"
                    : "text-slate-700 dark:text-slate-200"
                  }`}
              >
                {option}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
