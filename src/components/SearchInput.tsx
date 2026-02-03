"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, ArrowRight, AlertCircle, Terminal } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

interface SearchInputProps {
  onSearch: (hgvs: string) => void;
  loading: boolean;
}

export default function SearchInput({ onSearch, loading }: SearchInputProps) {
  const [value, setValue] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const validateHGVS = (input: string) => {
    // Basic regex for HGVS (p., c., g.) - supports 1-letter and 3-letter codes
    const regex = /^[A-Z0-9]+:p\.([A-Z][a-z]{2}|[A-Z])\d+([A-Z][a-z]{2}|[A-Z]|\*)$|^p\.([A-Z][a-z]{2}|[A-Z])\d+([A-Z][a-z]{2}|[A-Z]|\*)$/i;
    const valid = regex.test(input.trim());
    setIsValid(valid);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    validateHGVS(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !loading) {
      onSearch(value.trim());
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 mb-20 relative z-20">
      
      {/* Input Container */}
      <form onSubmit={handleSubmit} className="relative group">
        
        {/* Label / Status */}
        <div className="flex justify-between text-xs font-mono text-gray-500 mb-2 uppercase tracking-widest">
            <span>Query Interface</span>
            <span className={clsx(
                "transition-colors duration-300",
                isValid ? "text-primary" : "text-gray-600"
            )}>
                {isValid ? "TARGET LOCKED" : "WAITING FOR INPUT"}
            </span>
        </div>

        {/* Input Field */}
        <div className={clsx(
            "relative flex items-center bg-surface border rounded-lg transition-all duration-300",
            isFocused ? "border-primary/50 glow-border-focus" : "border-white/10"
        )}>
            <div className="pl-6 text-muted">
               {loading ? <Loader2 className="animate-spin w-5 h-5 text-primary"/> : <Terminal className="w-5 h-5" />}
            </div>
            
            <input 
               type="text"
               value={value}
               onChange={handleChange}
               onFocus={() => setIsFocused(true)}
               onBlur={() => setIsFocused(false)}
               placeholder="ENTER VARIANT (e.g. BRCA1:p.Cys61Gly)"
               className="w-full bg-transparent p-6 text-lg md:text-xl font-mono text-white placeholder-gray-700 focus:outline-none uppercase tracking-wider"
               disabled={loading}
            />

            {/* Enter Button */}
            <AnimatePresence>
                {value.length > 0 ? (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        type="submit"
                        disabled={!isValid || loading}
                        className={clsx(
                            "mr-6 p-2 rounded-full transition-all duration-300",
                            isValid ? "bg-primary text-black hover:bg-white" : "bg-gray-800 text-gray-500"
                        )}
                    >
                        <ArrowRight className="w-5 h-5" />
                    </motion.button>
                ) : null}
            </AnimatePresence>
        </div>

        {/* Decorative corner markers */}
        <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-white/30" />
        <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-white/30" />
        <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-white/30" />
        <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-white/30" />

      </form>
    </div>
  );
}
