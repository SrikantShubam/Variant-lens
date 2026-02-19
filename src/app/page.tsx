"use client";

import { useState } from "react";
import Hero from "@/components/Hero";
import SearchInput from "@/components/SearchInput";
import ReportView from "@/components/ReportView";
import BatchUpload from "@/components/BatchUpload";
import { motion, AnimatePresence } from "framer-motion";

import { HonestReportData } from '@/lib/types/honest-response';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HonestReportData | null>(null);

  const handleSearch = async (hgvs: string) => {
    setLoading(true);
    setError(null);
    setData(null); // Clear previous results

    try {
      const res = await fetch('/api/variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hgvs }),
      });

      const responseText = await res.text();
      let json: any = null;
      if (responseText) {
        try {
          json = JSON.parse(responseText);
        } catch {
          throw new Error(
            res.ok
              ? 'Server returned a non-JSON response.'
              : `Request failed (${res.status}): ${responseText.slice(0, 200)}`
          );
        }
      }

      if (!res.ok) {
        throw new Error(json?.error || json?.message || `Failed to analyze variant (${res.status})`);
      }

      if (!json) {
        throw new Error('Server returned an empty response.');
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
         
         <div className="mt-8 max-w-2xl mx-auto">
            <BatchUpload />
         </div>

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
              <ReportView key={data.variant.hgvs} data={data} />
            ) : null}
         </AnimatePresence>
       </div>
    </main>
  );
}
