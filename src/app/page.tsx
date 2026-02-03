"use client";

import { useState } from "react";
import Hero from "@/components/Hero";
import SearchInput from "@/components/SearchInput";
import ReportView from "@/components/ReportView";
import { motion, AnimatePresence } from "framer-motion";

// Types
interface ReportData {
  variant: string;
  structure: {
    source: string;
    id: string;
    resolution?: number;
    experimental: boolean;
  };
  hypothesis: {
    text: string;
    confidence: string;
    structural_basis: string[];
    citations: any[];
  };
  validation: {
    flags: string[];
    alignment_score?: number;
  };
  timestamp: string;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);

  const handleSearch = async (hgvs: string) => {
    setLoading(true);
    setError(null);
    // setData(null); // Optional: clear previous results or keep them while loading? User likely wants to clear

    try {
      const res = await fetch('/api/variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hgvs }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to analyze variant');
      }

      setData(json);
      // Smooth scroll to results
      setTimeout(() => {
        window.scrollTo({ top: 500, behavior: 'smooth' });
      }, 100);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative">
       {/* Animated Mesh Gradient Background */}
       <div className="mesh-bg" />
       
       <div className="relative z-10 p-4 md:p-8">
         <Hero />
         
         <SearchInput onSearch={handleSearch} loading={loading} />

         {/* Error Message */}
         <AnimatePresence>
           {error ? (
             <motion.div 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0 }}
               className="max-w-md mx-auto mt-6 glass border-red-500/30 text-red-400 p-4 rounded-xl text-center"
             >
               <p className="font-medium">Analysis Failed</p>
               <p className="text-sm opacity-80 mt-1">{error}</p>
             </motion.div>
           ) : null}
         </AnimatePresence>

         {/* Results */}
         <AnimatePresence mode="wait">
            {data ? (
              <ReportView key={data.variant} data={data} />
            ) : null}
         </AnimatePresence>
       </div>
    </main>
  );
}
