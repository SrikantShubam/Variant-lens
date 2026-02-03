"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, Microscope, AlertTriangle, CheckCircle, ExternalLink, ChevronDown, ChevronUp, Share2, Download, Hexagon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { clsx } from "clsx";

interface ReportViewProps {
  data: any;
}

export default function ReportView({ data }: ReportViewProps) {
  const { variant, structure, hypothesis, validation } = data;
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl mx-auto pb-32 px-4 md:px-8"
    >
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-white/10 pb-6">
         <div>
             <div className="font-mono text-xs text-primary mb-2 tracking-widest uppercase">Analysis Complete</div>
             <h2 className="text-4xl md:text-6xl font-heading font-bold text-white tracking-tight uppercase">
                {variant}
             </h2>
         </div>
         <div className="flex items-center gap-4 mt-4 md:mt-0 font-mono text-xs text-gray-400">
             <span>ID: {structure.id || 'N/A'}</span>
             <span>|</span>
             <span>{new Date(data.timestamp).toLocaleDateString()}</span>
         </div>
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">
        
        {/* 1. Structure (Large Square) */}
        <div className="md:col-span-2 md:row-span-2 glass-panel p-1 rounded-2xl relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-surface to-black z-0" />
             <div className="absolute inset-0 opacity-20 bg-[url('https://cdn.rcsb.org/images/structures/boundary.png')] bg-cover bg-center mix-blend-overlay transition-transform duration-[10s] ease-linear group-hover:scale-110" />
             
             <div className="relative z-10 h-full flex flex-col justify-between p-8">
                 <div className="flex justify-between items-start">
                    <span className="glass-light px-3 py-1 text-xs font-mono uppercase text-white rounded-full border border-white/10">
                        {structure.source} Model
                    </span>
                    <Hexagon className="text-primary w-6 h-6 animate-pulse opacity-50"/>
                 </div>
                 
                 <div>
                    <h3 className="text-2xl font-light text-white mb-2">Structural Context</h3>
                    <p className="text-foreground-muted text-sm max-w-xs">{structure.resolution ? `Resolution: ${structure.resolution}Å` : 'Predicted confidence metric unavailable.'}</p>
                    <button className="mt-6 border border-white/20 hover:bg-white hover:text-black hover:border-white text-white px-6 py-2 text-xs font-mono uppercase tracking-widest transition-all rounded-full">
                        Launch Viewer
                    </button>
                 </div>
             </div>
        </div>

        {/* 2. Validation Status (Wide) */}
        <div className="md:col-span-2 glass-panel p-8 flex flex-col justify-center relative overflow-hidden rounded-2xl">
             <div className="absolute right-0 top-0 p-4 opacity-10">
                 <CheckCircle className="w-24 h-24" />
             </div>
             <h4 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">Validation Protocols</h4>
             <div className="flex items-center gap-3">
                 <div className={clsx("w-3 h-3 rounded-full shadow-glow", validation.flags.length === 0 ? "bg-primary" : "bg-red-500 shadow-none")} />
                 <span className="text-xl md:text-2xl text-white font-medium">
                     {validation.flags.length === 0 ? "No Biological Hallucinations" : "Potential Conflicts Detected"}
                 </span>
             </div>
        </div>

        {/* 3. Confidence Score (Small) */}
        <div className="glass-panel p-8 flex flex-col justify-between rounded-2xl">
             <span className="font-mono text-xs text-muted uppercase">Certainty</span>
             <div className="text-5xl font-bold text-white tracking-tighter">
                {hypothesis.confidence === 'high' ? '92%' : hypothesis.confidence === 'moderate' ? '65%' : '30%'}
             </div>
             <div className="w-full bg-surface-light h-1 mt-4 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: hypothesis.confidence === 'high' ? '92%' : '65%' }}
                    className="h-full bg-primary shadow-glow"
                 />
             </div>
        </div>

         {/* 4. Export (Small) */}
         <div className="glass-panel p-8 flex flex-col justify-center gap-2 group cursor-pointer hover:bg-white/5 transition-colors rounded-2xl border-white/5 hover:border-primary/30">
             <Share2 className="w-6 h-6 text-foreground-muted group-hover:text-primary transition-colors" />
             <span className="font-mono text-xs text-foreground-muted group-hover:text-white mt-2 transition-colors">SHARE REPORT</span>
         </div>


        {/* 5. Hypothesis Narrative (Large Tall) */}
        <div className="md:col-span-2 lg:col-span-3 lg:row-span-2 glass-panel p-8 md:p-10 rounded-2xl">
             <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                 <FileText className="text-primary w-5 h-5" />
                 <h3 className="font-heading text-2xl text-white">Mechanism Hypothesis</h3>
             </div>
             
             <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-white max-w-none prose-lg">
                <div className="text-foreground-muted font-light leading-relaxed">
                   <ReactMarkdown>{hypothesis.text}</ReactMarkdown>
                </div>
             </div>

             <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                 {hypothesis.structural_basis.map((basis: string, i: number) => (
                     <div key={i} className="bg-surface-light/30 p-4 rounded-xl border-l-2 border-primary/50 backdrop-blur-sm">
                         <span className="text-xs font-mono text-primary block mb-1">EVIDENCE {i+1}</span>
                         <p className="text-sm text-gray-300">{basis}</p>
                     </div>
                 ))}
             </div>
        </div>
        
        {/* 6. Citations (Tall list) */}
        <div className="lg:col-span-1 lg:row-span-2 glass-panel p-0 overflow-hidden flex flex-col rounded-2xl">
            <div className="p-6 border-b border-white/5 bg-surface/50 backdrop-blur-xl sticky top-0 z-10">
                <h4 className="font-mono text-xs text-muted uppercase tracking-widest">
                    References
                </h4>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {hypothesis.citations.length > 0 ? hypothesis.citations.map((cite: any, i: number) => (
                    <a key={i} href={`https://pubmed.ncbi.nlm.nih.gov/${cite.pmid}`} target="_blank" className="block p-4 rounded-lg bg-surface-light/20 border border-transparent hover:border-primary/30 hover:bg-surface-light/40 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                             <span className="text-xs font-mono text-muted group-hover:text-primary transition-colors">[{i+1}]</span>
                             <ExternalLink className="w-3 h-3 text-muted group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed group-hover:text-white transition-colors">{cite.title || 'Untitled Reference'}</p>
                        <span className="text-[10px] text-muted mt-2 block font-mono">PMID: {cite.pmid}</span>
                    </a>
                )) : (
                    <div className="text-muted text-xs italic p-4">No direct citations available.</div>
                )}
            </div>
        </div>

      </div>
    </motion.div>
  );
}
