"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface StructureViewerProps {
  pdbId: string;
  sifts?: {
    mapped: boolean;
    chain: string;
    pdbResidue: string;
    source: string;
  };
  uniprotResidue: number; // For banner display
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'pdbe-molstar': any;
    }
  }
}

export default function StructureViewer({ pdbId, sifts, uniprotResidue }: StructureViewerProps) {
  const viewerRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

  // Clean PDB ID for the viewer (it tends to like lower case 4-char)
  const cleanPdbId = pdbId.toLowerCase();

  useEffect(() => {
    if (!scriptLoaded || !viewerRef.current) return;

    const viewer = viewerRef.current;

    const handleLoad = () => {
      console.log("Structure loaded");
      setViewerReady(true);
      
      // Apply highlight ONLY if mapped
      if (sifts?.mapped) {
        // Parse PDB residue (might string "60A")
        // PDBe Molstar select inputs: { struct_asym_id: 'A', start_residue_number: 100, end_residue_number: 100 }
        // It handles integer numbers. If insertion code, it's tricker.
        // Let's assume integer for Phase-3 MVP as per constraints unless specific insertion code logic is needed.
        // We will try to parse int.
        const resNum = parseInt(sifts.pdbResidue, 10);
        
        if (!isNaN(resNum)) {
            // Wait a moment for visual to settle
            setTimeout(() => {
                viewer.visual.select({
                    data: [{
                        struct_asym_id: sifts.chain,
                        start_residue_number: resNum,
                        end_residue_number: resNum,
                        color: { r: 255, g: 0, b: 255 }, // Magenta highlight
                        focus: true
                    }],
                    nonSelectedColor: { r: 255, g: 255, b: 255 } // Keep context visible
                });
                
                // Set Focus explicitly
                // viewer.visual.focus(...)
                // The select with focus:true usually handles it.
            }, 500); 
        }
      }
    };

    // Listen for pdbe-molstar event
    // The web component emits 'PDB.molstar.click' etc.
    // 'loadComplete' is common.
    viewer.addEventListener('PDB.molstar.view.event', (e: any) => {
        if (e.detail?.eventType === 'loadComplete') {
            handleLoad();
        }
    });

    // Fallback: If it's already re-rendered
    // Checking internal state is hard.
    
    // Trigger render if needed?
    // <pdbe-molstar> usually auto-loads based on molecule-id attr.

  }, [scriptLoaded, cleanPdbId, sifts]);

  return (
    <div className="relative w-full h-[400px] bg-white text-black rounded-lg overflow-hidden border border-gray-700">
      {/* Script Loading */}
      <link rel="stylesheet" type="text/css" href="/pdbe/pdbe-molstar-light.css" />
      <Script 
        src="/pdbe/pdbe-molstar-plugin.js" 
        strategy="afterInteractive"
        onLoad={() => {
            console.log("Molstar script loaded");
            setScriptLoaded(true);
            // Register component if needed, but pdbe-molstar-plugin usually does it?
            // Actually pdbe-molstar-component.js is the web component definitions.
            // We should load component.js too.
        }}
      />
      <Script 
        src="/pdbe/pdbe-molstar-component.js" 
        strategy="afterInteractive"
        onLoad={() => console.log("Molstar component loaded")}
      />

      {/* Banner */}
      <div className="absolute top-0 left-0 right-0 z-10 p-2 bg-black/80 text-white text-xs backdrop-blur-sm">
        {sifts?.mapped ? (
          <div className="flex items-center gap-2 text-green-400">
            <span className="font-bold">✓ MAPPED</span>
            <span>UniProt {uniprotResidue} → PDB {sifts.chain}:{sifts.pdbResidue} (via SIFTS)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-400">
            <span className="font-bold">⚠ UNMAPPED</span>
            <span>Variant residue {uniprotResidue} is not resolved in this structure.</span>
          </div>
        )}
      </div>

      {/* Viewer */}
      <div className="w-full h-full">
          <pdbe-molstar
            ref={viewerRef}
            id="pdbe-molstar-widget"
            molecule-id={cleanPdbId}
            hide-controls="true"
            bg-color-r="255"
            bg-color-g="255"
            bg-color-b="255"
            // Simple display parameters
          ></pdbe-molstar>
      </div>
      
      {/* Loading State Overlay */}
      {!scriptLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500">
              Loading 3D Viewer...
          </div>
      )}
    </div>
  );
}
