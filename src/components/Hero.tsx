"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function Hero() {
  const titleVariants = {
    hidden: { y: 100, opacity: 0 },
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }
    })
  };

  return (
    <div className="relative w-full min-h-[70vh] flex flex-col justify-center px-6 md:px-20 overflow-hidden">
      
      {/* Background Grid */}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      <div className="z-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        {/* Huge Kinetic Typography */}
        <div className="font-heading font-black tracking-tighter leading-[0.85]">
          <motion.div
            custom={0}
            variants={titleVariants}
            initial="hidden"
            animate="visible"
            className="text-[14vw] md:text-[10vw] uppercase text-gradient"
          >
            Variant
          </motion.div>
          <div className="flex items-center gap-4 md:gap-8">
            <motion.div
              custom={1}
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              className="w-12 h-2 md:w-32 md:h-4 bg-gradient-to-r from-primary via-tertiary to-secondary mt-4 md:mt-8"
            />
            <motion.div
              custom={2}
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              className="text-[14vw] md:text-[10vw] text-white uppercase"
            >
              Lens
            </motion.div>
          </div>
        </div>

        {/* What VariantLens Does */}
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="rounded-2xl border border-white/10 bg-surface/60 p-6 backdrop-blur-sm lg:mt-6"
        >
          <h2 className="text-xl font-semibold text-white md:text-2xl">What VariantLens Does</h2>
          <ul className="mt-4 space-y-3 text-sm text-foreground-muted md:text-base">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Aggregates ClinVar, structure, and literature context</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Maps variants onto experimental or AlphaFold structures</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Explicitly highlights unknowns and gaps</span>
            </li>
          </ul>
        </motion.aside>
      </div>

      {/* Tagline */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="mt-12 md:ml-2 flex items-center gap-4"
      >
        <div className="text-primary font-mono text-xs md:text-sm tracking-[0.2em] uppercase">
            [ Research Tool ]
        </div>
        <div className="h-px w-20 bg-surface-light" />
        <p className="text-foreground-muted font-normal text-sm md:text-base max-w-md">
            Structure-aware evidence briefing for genetic variant research.
        </p>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-foreground-muted/50"
      >
        <span className="text-xs font-mono tracking-widest uppercase">Scroll to analyze</span>
        <ChevronDown className="w-5 h-5 scroll-indicator" />
      </motion.div>

    </div>
  );
}
