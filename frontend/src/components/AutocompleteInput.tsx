import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  className = "",
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    setSelectedIndex(-1);

    if (inputValue.trim()) {
      const filtered = suggestions.filter((item) =>
        item.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === "ArrowDown" && value.trim()) {
        // Open on arrow down if closed but has text
        const filtered = suggestions.filter((item) =>
          item.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredSuggestions(filtered);
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
        handleSelect(filteredSuggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current && selectedIndex !== -1) {
      const activeElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  const handleFocus = () => {
    if (value.trim()) {
      const filtered = suggestions.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setIsOpen(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-controls="autocomplete-list"
          aria-expanded={isOpen}
          className={`w-full rounded-lg px-4 py-3 outline-none transition-all bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 ${className}`}
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>

      <AnimatePresence>
        {isOpen && filteredSuggestions.length > 0 && (
          <motion.div
            ref={dropdownRef}
            id="autocomplete-list"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${index === selectedIndex
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
