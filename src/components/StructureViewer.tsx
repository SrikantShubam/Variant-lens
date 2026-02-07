"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

import { getViewerConfig } from "./structure-utils";

interface StructureViewerProps {
  pdbId: string;
  source?: 'PDB' | 'AlphaFold'; // Phase-4: Support AlphaFold
  structureUrl?: string; // Phase-4: API-provided URL for AlphaFold (avoids hardcoding version)
  sifts?: {
    mapped: boolean;
    chain: string;
    pdbResidue: string;
    source: string;
  };
  uniprotResidue: number;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'pdbe-molstar': any;
    }
  }
}

export default function StructureViewer({ pdbId, source = 'PDB', structureUrl, sifts, uniprotResidue }: StructureViewerProps) {
  const viewerRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  
  // Handle both PDB IDs and AlphaFold IDs
  const isAlphaFold = source === 'AlphaFold' || pdbId.startsWith('AF-');
  const cleanPdbId = isAlphaFold ? pdbId : pdbId.toLowerCase();
  
  const config = getViewerConfig(sifts, uniprotResidue);

  // Reset viewerReady when pdbId changes
  useEffect(() => {
    setViewerReady(false);
  }, [pdbId]);
  
  useEffect(() => {
    if (!scriptLoaded || !viewerRef.current) return;
    const viewer = viewerRef.current;

    const handleLoad = () => {
      console.log("Structure loaded:", pdbId);
      setViewerReady(true);
      
      // Apply highlight ONLY if mapped and valid
      if (config.highlight) {
        setTimeout(() => {
            try {
                viewer.visual?.select?.({
                    data: [config.highlight],
                    nonSelectedColor: { r: 255, g: 255, b: 255 }
                });
            } catch (e) {
                console.warn("Highlight failed:", e);
            }
        }, 500); 
      }
    };

    // Listen for load events
    const eventHandler = (e: any) => {
        if (e.detail?.eventType === 'loadComplete') {
            handleLoad();
        }
    };
    
    viewer.addEventListener('PDB.molstar.view.event', eventHandler);
    
    // Fallback: If event doesn't fire, assume loaded after timeout
    const fallbackTimer = setTimeout(() => {
        if (!viewerReady) {
            console.log("Fallback: Assuming viewer ready after timeout");
            setViewerReady(true);
        }
    }, 8000);
    
    return () => {
        viewer.removeEventListener('PDB.molstar.view.event', eventHandler);
        clearTimeout(fallbackTimer);
    };
  }, [scriptLoaded, pdbId, sifts, config.highlight, viewerReady]);

  // AlphaFold uses custom-data attribute instead of molecule-id
  // Use API-provided structureUrl if available (handles version changes)
  // OPTIMIZATION: Use BCIF (Binary CIF) format for faster parsing of large proteins
  const viewerProps = isAlphaFold 
    ? { 
        // Prefer BCIF over CIF for faster loading (5-10x faster parsing)
        'custom-data-url': structureUrl?.replace('.cif', '.bcif') || 
                           `https://alphafold.ebi.ac.uk/files/${cleanPdbId}-model_v4.bcif`,
        'custom-data-format': 'bcif',
        'loading-overlay': 'true',
        'hide-water': 'true', // Optimization: Don't render water
        'visual-style': 'cartoon', // Optimization: Simpler representation
      }
    : { 
        'molecule-id': cleanPdbId,
        'hide-water': 'true',
        'visual-style': 'cartoon',
      };

  return (
    <div className="relative w-full h-[400px] bg-white text-black rounded-lg overflow-hidden border border-gray-700">
      <link rel="stylesheet" type="text/css" href="/pdbe/pdbe-molstar-light.css" />
      <Script 
        src="/pdbe/pdbe-molstar-plugin.js" 
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <Script 
        src="/pdbe/pdbe-molstar-component.js" 
        strategy="afterInteractive"
      />

      {/* Banner */}
      <div className="absolute top-0 left-0 right-0 z-10 p-2 bg-black/80 text-white text-xs backdrop-blur-sm">
        <div className={`flex items-center gap-2 ${config.banner.type === 'success' ? 'text-green-400' : 'text-yellow-400'}`}>
            <span className="font-bold">{config.banner.icon}</span>
            <span>{config.banner.text}</span>
            {isAlphaFold && <span className="ml-2 text-blue-400">(AlphaFold Predicted)</span>}
        </div>
      </div>

      {/* Viewer */}
      <div className="w-full h-full">
          <pdbe-molstar
            ref={viewerRef}
            key={pdbId} // Force re-mount on ID change
            id="pdbe-molstar-widget"
            {...viewerProps}
            hide-controls="true"
            bg-color-r="255"
            bg-color-g="255"
            bg-color-b="255"
          ></pdbe-molstar>
      </div>
      
      {(!scriptLoaded || !viewerReady) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500 z-20">
              Loading 3D Viewer...
          </div>
      )}
    </div>
  );
}
