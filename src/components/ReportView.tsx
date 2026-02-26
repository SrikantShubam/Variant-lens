"use client";

import React from "react";
import { motion } from "framer-motion";
import { FileText, AlertTriangle, Hexagon, AlertCircle, Info, Beaker, HelpCircle, ExternalLink, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { clsx } from "clsx";
import StructureViewer from "./StructureViewer";
import PAEViewer from "./PAEViewer";
import { HonestReportData } from '../lib/types/honest-response';
import { generateMarkdown } from '../lib/report-utils';
// ==========================================
// TYPES FOR HONEST RESPONSE
// ==========================================



interface ReportViewProps {
  data: HonestReportData;
}

// ==========================================
// TOOLTIP COMPONENT
// ==========================================

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="relative group inline-flex items-center">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-xs text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-50 border border-white/10 max-w-[16rem] sm:max-w-xs text-wrap">
        {text}
      </div>
    </div>
  );
}

// ==========================================
// EVIDENCE STATUS INDICATOR
// ==========================================

function StatusBadge({ status, label, tooltip }: { status: 'good' | 'warn' | 'none'; label: string; tooltip?: string }) {
  const content = (
    <div className="flex items-center gap-2">
      <div className={clsx(
        "w-2 h-2 rounded-full flex-shrink-0",
        status === 'good' && "bg-green-400",
        status === 'warn' && "bg-yellow-400",
        status === 'none' && "bg-gray-600"
      )} />
      <span className="text-sm text-gray-300 break-words leading-snug">{label}</span>
      {tooltip && <HelpCircle className="w-3 h-3 text-gray-500" />}
    </div>
  );
  
  return tooltip ? <Tooltip text={tooltip}>{content}</Tooltip> : content;
}

function buildQuickContext(data: HonestReportData): string {
  const { variant, coverage, curatedInfo } = data;
  const parts: string[] = [];

  if (coverage.domain.inAnnotatedDomain && coverage.domain.domainName) {
    parts.push(`Residue ${variant.residue} sits in ${coverage.domain.domainName}.`);
  } else if (curatedInfo.domains.length === 0) {
    parts.push(`Domain annotations are currently sparse for ${variant.gene} in UniProt/Pfam/Gene3D.`);
  } else {
    parts.push(`Residue ${variant.residue} is outside current UniProt/Pfam/Gene3D domain annotations.`);
  }

  if (coverage.clinical.status !== 'none') {
    const significance = coverage.clinical.significance || coverage.clinical.status.replace(/_/g, ' ');
    const stars = typeof coverage.clinical.stars === 'number' ? ` (${coverage.clinical.stars}/4 stars)` : '';
    parts.push(`ClinVar: ${significance}${stars}.`);
  } else {
    parts.push('No ClinVar classification found for this exact variant.');
  }

  if (coverage.structure.status === 'predicted') {
    parts.push(`Only predicted structure is available (${coverage.structure.id || 'AlphaFold'}).`);
  } else if (coverage.structure.status === 'experimental') {
    parts.push(`Experimental structure is available (${coverage.structure.id || 'PDB'}).`);
  } else {
    parts.push('No structure currently available.');
  }

  parts.push(`Direct PubMed matches: ${coverage.literature.variantSpecificCount}.`);

  const why = buildWhyItMatters(data);
  if (why) parts.push(`Why it matters: ${why}`);

  return parts.join(' ');
}

function buildWhyItMatters(data: HonestReportData): string | null {
  const canonical = data.variant.normalizedHgvs || data.variant.hgvs || '';
  const protein = canonical.match(/:p\.([A-Z*])(\d+)([A-Z*]+|fs|del|ins|dup)/i);
  const ref = protein?.[1]?.toUpperCase();
  const alt = protein?.[3]?.toUpperCase();
  const domainName = (data.coverage.domain.domainName || '').toLowerCase();

  if (data.variant.gene.toUpperCase() === 'NDUFAF6' && /(sqs|psy|prenyl)/.test(domainName)) {
    return 'Residue lies in the SQS/PSY-like assembly core used for mitochondrial complex I biogenesis.';
  }

  if (alt === 'P' && data.coverage.domain.inAnnotatedDomain && data.coverage.domain.domainName) {
    return `Proline is a helix-breaker; this can destabilize local structure inside ${data.coverage.domain.domainName}.`;
  }

  if (alt === 'FS' || alt === 'DEL' || alt === 'INS' || alt === 'DUP') {
    return 'Indel/frameshift variants can alter sequence context beyond one residue and are often functionally disruptive.';
  }

  if (data.curatedInfo.nearFunctionalSite && data.curatedInfo.functionalSites.length > 0) {
    const nearest = [...data.curatedInfo.functionalSites]
      .sort((a, b) => Math.abs(a.residue - data.variant.residue) - Math.abs(b.residue - data.variant.residue))[0];
    const distance = Math.abs(nearest.residue - data.variant.residue);
    const distanceText = distance === 0 ? 'at' : distance === 1 ? 'adjacent to' : `${distance} residues from`;
    const label = nearest.description || nearest.type.replace(/_/g, ' ');
    if ((label || '').toLowerCase().includes('zinc')) {
      return `Variant is ${distanceText} a zinc-coordinating site (${label}).`;
    }
    return `Variant is ${distanceText} a curated functional site (${label}).`;
  }

  if (ref && alt && data.coverage.domain.inAnnotatedDomain) {
    return `Substitution ${ref}->${alt} occurs inside an annotated domain, so local functional effects are plausible.`;
  }

  return null;
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function ReportView({ data }: ReportViewProps) {
  const { variant, coverage, unknowns, curatedInfo } = data;
  const canonicalHgvs = variant.normalizedHgvs || variant.hgvs;
  const reportDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(data.timestamp || Date.now()));
  const quickContext = buildQuickContext(data);
  
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'error'>('idle');

  // Phase-4: Multi-Structure Selection State
  const [selectedStructureId, setSelectedStructureId] = React.useState<string | null>(
     coverage.structure.id || null
  );

  // Derived Structure Data
  const availableStructures = coverage.structure.availableStructures || [];
  
  // Find currently selected structure data
  // Logic: 
  // 1. If matches primary (best) structure, use full primary object (contains sifts)
  // 2. Else find in availableStructures list and construct pseudo-object
  const isPrimary = selectedStructureId === coverage.structure.id;
  
  const foundStructure = availableStructures.find(s => s.id === selectedStructureId);
  const normalizedStructure = foundStructure ? {
      status: foundStructure.source === 'PDB' ? 'experimental' : 'predicted',
      source: foundStructure.source,
      id: foundStructure.id,
      resolution: foundStructure.resolution,
      paeUrl: foundStructure.paeUrl, // Phase-4
      sifts: {
          mapped: foundStructure.mapped,
          chain: foundStructure.chain,
          pdbResidue: foundStructure.pdbResidue || '?',
          source: 'PDBe-KB',
          pdbId: foundStructure.id
      }
  } : null;
  
  const currentStructure = isPrimary 
    ? coverage.structure 
    : (normalizedStructure || coverage.structure);

    // Cast currentStructure to any to avoid strict type checks on union for now, or ensure types align
    const displayStructure = currentStructure as any;

  // Construct SIFTS object for viewer
  // Since we normalized both paths to have a 'sifts' property (or not), we can just use it.
  const currentSifts = displayStructure.sifts;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="report-printable w-full max-w-7xl mx-auto pb-24 md:pb-32 px-3 sm:px-4 md:px-8"
    >
      {/* RESEARCH USE ONLY - Visible without scrolling */}
      <div className="mb-4 text-center">
        <span className="inline-block text-[10px] sm:text-xs font-mono text-yellow-500 bg-yellow-500/10 px-2 sm:px-3 py-1 rounded-full border border-yellow-500/30 break-words">
          ⚠️ RESEARCH USE ONLY — NOT FOR CLINICAL DECISIONS
        </span>
      </div>

      {/* HEADER ACTIONS (Export) */}
      <div className="flex flex-wrap justify-start md:justify-end gap-2 mb-4 print:hidden">
        <button 
            onClick={async () => {
                const md = generateMarkdown(data);
                try {
                    if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(md);
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = md;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.focus();
                        textarea.select();
                        const ok = document.execCommand('copy');
                        document.body.removeChild(textarea);
                        if (!ok) throw new Error('copy failed');
                    }
                    setCopyStatus('copied');
                } catch (error) {
                    console.error("Copy markdown failed:", error);
                    setCopyStatus('error');
                } finally {
                    window.setTimeout(() => setCopyStatus('idle'), 2000);
                }
            }}
            className="flex-1 sm:flex-none min-w-[7.5rem] flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] sm:text-xs font-mono text-gray-300 transition-colors border border-white/10"
            title={copyStatus === 'error' ? 'Copy failed' : 'Copy markdown to clipboard'}
        >
            <Copy className="w-3 h-3" />
            {copyStatus === 'copied' ? 'COPIED' : copyStatus === 'error' ? 'FAILED' : 'COPY MD'}
        </button>
        <button 
            onClick={() => {
                const md = generateMarkdown(data);
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.variant.hgvs.replace(/[^a-zA-Z0-9]/g, '_')}_briefing.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }}
            className="flex-1 sm:flex-none min-w-[7.5rem] flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] sm:text-xs font-mono text-gray-300 transition-colors border border-white/10"
        >
            <FileText className="w-3 h-3" />
            MARKDOWN
        </button>
        <button 
            onClick={() => window.print()}
            className="flex-1 sm:flex-none min-w-[6rem] flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] sm:text-xs font-mono text-gray-300 transition-colors border border-white/10"
        >
            <ExternalLink className="w-3 h-3" />
            PDF
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 border-b border-white/10 pb-6 gap-4">
         <div>
             <div className="font-mono text-xs text-primary mb-2 tracking-widest uppercase">Evidence Briefing</div>
             <h2 className="text-2xl sm:text-4xl md:text-6xl font-heading font-bold text-white tracking-tight uppercase break-words leading-tight">
                {canonicalHgvs.toUpperCase()}
             </h2>
             
             {/* Identity Metadata */}
             <div className="flex flex-col gap-1 mt-2">
                 {/* 1. Transcript Badge (if present) */}
                 {variant.transcript && (
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">Transcript</span>
                        <span className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-primary text-xs font-mono">
                            {variant.transcript}
                        </span>
                    </div>
                 )}
                 
                 {/* 2. Original Input (if different) */}
                 {variant.originalHgvs && variant.originalHgvs !== canonicalHgvs && (
                    <div className="font-mono text-xs text-gray-500">
                        Submitted: <span className="text-gray-400 border-b border-gray-700 border-dashed">{variant.originalHgvs}</span>
                    </div>
                 )}
             </div>
         </div>
         <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-0 font-mono text-xs text-gray-400">
             <span>{variant.gene}</span>
             <span>|</span>
             <span>{reportDate}</span>
         </div>
      </div>

      {/* ⚠️ UNKNOWNS FIRST (Critical Trust Element) */}
      {unknowns.items.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={clsx(
            "mb-8 p-4 sm:p-6 rounded-xl border",
            unknowns.severity === 'critical' && "bg-red-500/10 border-red-500/30",
            unknowns.severity === 'moderate' && "bg-yellow-500/10 border-yellow-500/30",
            unknowns.severity === 'minor' && "bg-blue-500/10 border-blue-500/30"
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className={clsx(
              "w-5 h-5",
              unknowns.severity === 'critical' && "text-red-400",
              unknowns.severity === 'moderate' && "text-yellow-400",
              unknowns.severity === 'minor' && "text-blue-400"
            )} />
            <h3 className="font-mono text-sm uppercase tracking-widest text-white">
              Evidence Limitations
            </h3>
          </div>
          <ul className="space-y-2">
            {unknowns.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-gray-500">-</span>
                <span className="break-words">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <div className="mb-8 p-4 sm:p-6 rounded-xl border border-white/10 bg-white/5">
        <h3 className="font-mono text-xs text-muted uppercase tracking-widest mb-2">Quick Context</h3>
        <p className="text-sm text-gray-300 break-words leading-relaxed">{quickContext}</p>
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-[minmax(160px,auto)]">
        
        {/* 1. Evidence Coverage Panel */}
        <div className="md:col-span-2 glass-panel p-4 sm:p-6 rounded-2xl">
          <h4 className="font-mono text-xs text-muted uppercase tracking-widest mb-4">
            Evidence Coverage
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <StatusBadge 
              status={coverage.structure.status === 'experimental' ? 'good' : coverage.structure.status === 'predicted' ? 'warn' : 'none'}
              label={
                coverage.structure.status === 'none' 
                  ? 'No structure' 
                  : coverage.structure.sifts?.mapped
                    ? `${coverage.structure.source} ${coverage.structure.id} (Chain ${coverage.structure.sifts.chain}:${coverage.structure.sifts.pdbResidue})`
                    : `${coverage.structure.source} ${coverage.structure.id || ''}`
              }
              tooltip={
                coverage.structure.sifts?.mapped 
                  ? `Mapped via SIFTS (Source: ${coverage.structure.sifts.source}). Visualizes residue ${coverage.structure.sifts.pdbResidue} on Chain ${coverage.structure.sifts.chain}.`
                  : coverage.structure.status !== 'none' && coverage.structure.source === 'PDB'
                    ? "Residue mapping not available via SIFTS. Structure may be truncated or disordered in this region."
                    : coverage.structure.status === 'predicted'
                      ? 'Predicted structure only. Use the PAE view to assess local confidence.'
                      : undefined
              }
            />
            {/* ClinVar Status - Phase-2 */}
            {coverage.clinical.status !== 'none' && coverage.clinical.url ? (
              <a 
                href={coverage.clinical.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-2 hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-300 break-words leading-snug">
                  {coverage.clinical.significance || coverage.clinical.status}
                  {coverage.clinical.stars !== undefined && (
                    <span className="text-yellow-400 ml-1">[{coverage.clinical.stars}/4 stars]</span>
                  )}
                </span>
                <ExternalLink className="w-3 h-3 text-gray-500" />
              </a>
            ) : (
              <StatusBadge 
                status={'none'}
                label={'No ClinVar data'}
              />
            )}
            <StatusBadge 
              status={coverage.domain.inAnnotatedDomain ? 'good' : curatedInfo.domains.length === 0 ? 'warn' : 'none'}
              label={coverage.domain.domainName 
                ? `Domain annotation: ${coverage.domain.domainName}` 
                : curatedInfo.domains.length === 0
                  ? 'No domain annotations'
                  : 'Outside domains'}
              tooltip={coverage.domain.domainName 
                ? "Domain presence alone does not imply functional or clinical impact." 
                : curatedInfo.domains.length === 0
                  ? 'No domain range annotations are currently available from UniProt/Pfam/Gene3D for this protein.'
                  : undefined}
            />
            {coverage.literature.variantSpecificCount > 0 ? (
              <a 
                href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(coverage.literature.query || '')}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-2 hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors"
                title={`Search Query: ${coverage.literature.query}\n\nCount reflects PubMed Title/Abstract matches, not curated variant studies.`}
              >
                <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                <span className="text-sm text-gray-300 break-words leading-snug">
                  {coverage.literature.variantSpecificCount} papers mention this variant
                </span>
                <ExternalLink className="w-3 h-3 text-gray-500" />
              </a>
            ) : (
              <StatusBadge 
                status={'none'}
                label={'No papers found'}
                tooltip={`Search Query: ${coverage.literature.query || 'None'}\n\nCount reflects PubMed Title/Abstract matches.`}
              />
            )}
          </div>
          {coverage.structure.note && (
            <p className="text-xs text-yellow-400/70 mt-4 italic">
              Note: {coverage.structure.note}
            </p>
          )}
        </div>

        {/* 2. Structure Card */}
        <div className="md:col-span-2 md:row-span-2 glass-panel p-1 rounded-2xl relative group flex flex-col min-w-0">
          {/* Structure Selector Dropdown */}
          {availableStructures.length > 0 && (
             <div className="px-2 py-2 border-b border-white/10">
                <label className="text-xs text-gray-400 mb-1 block">Select Structure:</label>
                <select 
                   value={selectedStructureId || ''} 
                   onChange={(e) => setSelectedStructureId(e.target.value)}
                   className="w-full bg-surface/90 backdrop-blur border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer hover:bg-white/10 focus:border-primary/50"
                >
                   {availableStructures.map(s => (
                      <option key={s.id} value={s.id} className="bg-gray-900">
                         {s.source} {s.id} {s.resolution ? `(${s.resolution})` : ''} {s.mapped ? '(mapped)' : '(unmapped)'}
                      </option>
                   ))}
                </select>
             </div>
          )}

          {/* 3D Viewer */}
          <div className="flex-1 overflow-hidden relative">
            {(displayStructure.status === 'experimental' || displayStructure.source === 'AlphaFold') && displayStructure.id ? (
               <div className="flex flex-col gap-4 h-full">
                  <StructureViewer 
                    key={`${displayStructure.source || 'PDB'}-${displayStructure.id}`}
                    pdbId={displayStructure.id}
                    source={displayStructure.source as 'PDB' | 'AlphaFold'}
                    structureUrl={foundStructure?.url} // Phase-4: Pass API-provided URL for AlphaFold
                    sifts={currentSifts ? {
                      mapped: currentSifts.mapped,
                      chain: currentSifts.chain,
                      pdbResidue: currentSifts.pdbResidue,
                      source: currentSifts.source
                    } : undefined}
                    uniprotResidue={data.variant.residue}
                  />
                  
                  {displayStructure.source === 'AlphaFold' && displayStructure.paeUrl && (
                    <PAEViewer url={displayStructure.paeUrl} />
                  )}
               </div>
             ) : (

             <>
               <div className="absolute inset-0 bg-gradient-to-br from-surface to-black z-0" />
               
               <div className="relative z-10 h-full flex flex-col justify-between p-5 sm:p-8">
                   {coverage.structure.status !== 'none' ? (
                     <>
                       <div className="flex justify-between items-start">
                          <span className="glass-light px-3 py-1 text-xs font-mono uppercase text-white rounded-full border border-white/10">
                              {coverage.structure.source} ({coverage.structure.status})
                          </span>
                          <Hexagon className="text-primary w-6 h-6 animate-pulse opacity-50"/>
                       </div>
                       
                       <div>
                          <h3 className="text-2xl font-light text-white mb-2">Structure Exists</h3>
                          <p className="text-foreground-muted text-sm max-w-xs">
                            {coverage.structure.status === 'experimental' 
                              ? `Experimental structure exists for this protein region.`
                              : `Predicted structure (AlphaFold) available.`}
                          </p>
                          {coverage.structure.resolution && (
                            <p className="text-xs text-gray-400 mt-1">Resolution: {coverage.structure.resolution}Å</p>
                          )}
                          <p className="text-xs text-yellow-400/60 mt-2 italic">
                            ⚠️ Interactive view not available for this source.
                          </p>
                       </div>
                     </>
                   ) : (
                     <div className="flex flex-col items-center justify-center h-full text-foreground-muted opacity-50">
                        <Hexagon className="w-12 h-12 mb-4 stroke-1"/>
                        <p>No Structure</p>
                     </div>
                   )}
               </div>
             </>
            )}
          </div>
        </div>

        {/* 3. Curated Context */}
        <div className="md:col-span-2 glass-panel p-4 sm:p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Beaker className="w-4 h-4 text-primary" />
            <h4 className="font-mono text-xs text-muted uppercase tracking-widest">Curated Context (UniProt)</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Protein</span>
              <span className="text-white text-right break-words">{curatedInfo.proteinName}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Length</span>
              <span className="text-white text-right">{curatedInfo.proteinLength} aa</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500">Variant Position</span>
              <span className="text-white text-right">{curatedInfo.variantPosition}</span>
            </div>
            {curatedInfo.variantInDomain && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Annotated Domain (UniProt)</span>
                <span className="text-primary text-right break-words">{curatedInfo.variantInDomain}</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-3 pt-2 border-t border-white/5 mt-2">
              <span className="text-gray-600 text-xs">Isoform</span>
              <span className="text-gray-500 text-xs text-right">Canonical UniProt isoform used</span>
            </div>
          </div>
        </div>

        {/* 4. Domains List (Moved up since Summary Removed) */}
        <div className="md:col-span-2 glass-panel p-4 sm:p-6 rounded-2xl">
          <h4 className="font-mono text-xs text-muted uppercase tracking-widest mb-4">
            Annotated Domains (UniProt)
          </h4>
          {curatedInfo.domains && curatedInfo.domains.length > 0 ? (
            <div className="space-y-2">
              {curatedInfo.domains.slice(0, 5).map((domain: any, i: number) => (
                <div key={i} className="text-xs p-2 bg-surface-light/20 rounded break-words">
                  <span className="text-white">{domain.name}</span>
                  <span className="text-gray-500 ml-2">({domain.start}-{domain.end})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No domains annotated in UniProt</p>
          )}
        </div>

      </div>

      {/* RESEARCH DISCLAIMER (always shown, prominent) */}
      <div className="mt-8 p-4 sm:p-6 rounded-xl bg-surface border border-yellow-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-400 whitespace-pre-line">
            DISCLAIMER: This report is for RESEARCH USE ONLY. It aggregates data from public databases (UniProt, ClinVar, PubMed, PDBe) but has not been manually verified by a clinical geneticist. Do not use for medical decision making.
          </div>
        </div>
      </div>
    </motion.div>
  );
}

