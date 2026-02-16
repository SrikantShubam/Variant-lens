"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Script from "next/script";
import { Play, ExternalLink, Loader2 } from "lucide-react";

import { getViewerConfig } from "./structure-utils";
import { StructureViewerErrorBoundary } from "./structure/error-boundary";

interface StructureViewerProps {
  pdbId: string;
  source?: 'PDB' | 'AlphaFold'; 
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

type ViewerState = 'lite' | 'loading' | 'ready' | 'error';

function StructureViewerContent({ pdbId, source = 'PDB', structureUrl, sifts, uniprotResidue }: StructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  
  // State Machine
  const [viewState, setViewState] = useState<ViewerState>('lite');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  
  // Computed IDs
  const isAlphaFold = source === 'AlphaFold' || pdbId.startsWith('AF-');
  const cleanPdbId = isAlphaFold ? pdbId : pdbId.toLowerCase();
  
  const config = useMemo(() => getViewerConfig(sifts, uniprotResidue), [sifts, uniprotResidue]);

  // SINGLE FLIGHT PATTERN
  // requestIdRef increments on every structure change.
  // Async callbacks only proceed if requestId matches current.
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // RESET ON PROP CHANGE
  useEffect(() => {
    requestIdRef.current += 1;
    setViewState('lite');
    setLoadError(null);
    cleanup();
  }, [pdbId, source]);

  // CLEANUP ON UNMOUNT
  useEffect(() => {
      return () => cleanup();
  }, []);

  const cleanup = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      
      // If we had a real molstar plugin instance we would destroy it here.
      // Since we use the web component, we might rely on it cleaning itself up 
      // when unmounted from DOM, but let's be safe.
      if (viewerRef.current) {
          // Remove listeners if any (though we re-add them on init)
      }
  };

  // Initialize Viewer Logic
  const initViewer = useCallback(() => {
    // Start new request
    requestIdRef.current += 1;
    const currentRid = requestIdRef.current; // Capture ID

    setViewState('loading');
    setLoadError(null);

    // Hard Timeout Guard (8s)
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
        if (requestIdRef.current === currentRid) {
            console.warn(`[StructureViewer] Init timed out (8s) for req ${currentRid}`);
            setLoadError("Viewer initialization timed out");
            setViewState('error');
            cleanup(); // Ensure we kill any pending nonsense
        }
    }, 8000);

    // Wait for Script + Container + Web Component definition
    const checkDependency = () => {
        if (requestIdRef.current !== currentRid) return; // Stale request

        // Check if script loaded and custom element defined
        if (window.customElements && window.customElements.get('pdbe-molstar')) {
            // Ready to bind
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setupViewer(currentRid);
        } else {
            // Poll for script load
            setTimeout(checkDependency, 100);
        }
    };
    
    checkDependency();
  }, [scriptLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup viewer instance
  const setupViewer = (rid: number) => {
     if (requestIdRef.current !== rid) return;
     
     // 1. Validate DOM
     if (!viewerRef.current || !containerRef.current) {
         setLoadError("Viewer container reference missing");
         setViewState('error');
         return;
     }

     // Validate Dimensions (Mol* crashes on 0 height)
     if (containerRef.current.clientHeight === 0 || containerRef.current.clientWidth === 0) {
         console.warn(`[StructureViewer] Container has 0 dimensions. Aborting init.`);
         setLoadError("Viewer container not visible");
         setViewState('error');
         return;
     }

     const viewer = viewerRef.current;
     
     // 2. Setup Event Listeners
     const eventHandler = (e: any) => {
        if (requestIdRef.current !== rid) return;

        if (e.detail?.eventType === 'loadComplete') {
            console.log(`[StructureViewer] Load Complete (Req: ${rid})`);
            setViewState('ready');
            // Highlight removed for demo stability (Web Component API mismatch risk)
            // If needed later, use proper PDBe highlight params via props, not imperative API
        } else if (e.detail?.eventType === 'loadError') {
             console.error(`[StructureViewer] Internal Load Error (Req: ${rid})`, e.detail);
             setLoadError("Structure failed to load");
             setViewState('error');
        }
     };

     // Add listener
     // The web component emits 'PDB.molstar.view.event' on the element itself
     if (viewer) {
        viewer.addEventListener('PDB.molstar.view.event', eventHandler);
        
        // STORE CLEANUP FUNCTION
        // We attach this to the viewer element so we can remove it later? 
        // Or better: we rely on React ref cleanup or a custom cleanup method?
        // Actually, we can just remove it in the cleanup() function if we track the handler.
        // But for now, since we remount the whole component on change (key prop), 
        // the element is destroyed and listeners attached to IT are gone.
        // The only risk is global window listeners. PDBe might add some.
     }
  };

  // Removed imperative applyHighlight to prevent "undefined transform" crashes
  // The web component should handle highlighting via props (if supported) or we accept no highlight for stability.

  // Viewer Props (Optimization: BCIF + fewer features)
  const viewerProps = isAlphaFold 
    ? { 
        'custom-data-url': structureUrl?.replace('.cif', '.bcif') || 
                           `https://alphafold.ebi.ac.uk/files/${cleanPdbId}-model_v4.bcif`,
        'custom-data-format': 'bcif',
        'loading-overlay': 'true',
        'hide-water': 'true',
        'visual-style': 'cartoon',
        'alphafold-view': 'true', 
        'bg-color-r': '255', 'bg-color-g': '255', 'bg-color-b': '255'
      }
    : { 
        'molecule-id': cleanPdbId,
        'hide-water': 'true',
        'visual-style': 'cartoon',
        'bg-color-r': '255', 'bg-color-g': '255', 'bg-color-b': '255'
      };

  // Static Image URL (Lite Mode)
  const staticImageUrl = isAlphaFold 
     ? `https://alphafold.ebi.ac.uk/files/${cleanPdbId}-model_v4.png` 
     : `https://cdn.rcsb.org/images/structures/${cleanPdbId.substring(1, 3)}/${cleanPdbId}/${cleanPdbId}_chain_front_A_200.jpg`; 

  // RENDER
  return (
    <div 
        ref={containerRef}
        className="relative w-full h-[400px] bg-white text-black rounded-lg overflow-hidden border border-gray-700 shadow-sm"
    >
        {/* EXTERNAL SCRIPTS */}
        <link rel="stylesheet" type="text/css" href="/pdbe/pdbe-molstar-light.css" />
        <Script 
            src="/pdbe/pdbe-molstar-plugin.js" 
            strategy="lazyOnload" 
            onLoad={() => setScriptLoaded(true)}
            onError={() => {
                if (viewState === 'loading') {
                     setLoadError("Failed to load viewer component");
                     setViewState('error');
                }
            }}
        />
        <Script src="/pdbe/pdbe-molstar-component.js" strategy="lazyOnload" />

        {/* LITE MODE UI */}
        {viewState === 'lite' && (
            <div className="absolute inset-0 z-10 bg-gray-50 flex flex-col items-center justify-center">
                 {/* Placeholder Image */}
                 <div className="absolute inset-0 opacity-50 bg-gray-200" 
                      style={{ 
                          backgroundImage: `url(${staticImageUrl})`, 
                          backgroundSize: 'cover', 
                          backgroundPosition: 'center',
                          filter: 'blur(2px)'
                      }} 
                 />
                 
                 <div className="z-20 flex flex-col items-center gap-4 p-6 bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-200">
                     <div className="text-center">
                         <h3 className="font-bold text-gray-900 text-lg">3D Structure Preview</h3>
                         <p className="text-sm text-gray-500">{pdbId} • {source || 'PDB'}</p>
                     </div>
                     
                     <div className="flex gap-3">
                         <button 
                            onClick={initViewer}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                         >
                            <Play fill="currentColor" size={16} /> Load Interactive 3D
                         </button>
                         <a 
                            href={isAlphaFold ? `https://alphafold.ebi.ac.uk/entry/${cleanPdbId}` : `https://www.rcsb.org/structure/${cleanPdbId}`}
                            target="_blank"
                            className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition-colors"
                         >
                             <ExternalLink size={16} /> RCSB
                         </a>
                     </div>
                     
                     {sifts?.mapped && sifts.pdbResidue && sifts.pdbResidue !== '?' && (
                        <p className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded border border-green-200">
                            ✓ Mapping Available: {sifts.chain}:{sifts.pdbResidue}
                        </p>
                     )}
                 </div>
            </div>
        )}

        {/* LOADING STATE */}
        {viewState === 'loading' && (
            <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <p className="text-gray-500 text-sm">Initializing 3D Viewer...</p>
                <div className="mt-4 flex gap-3 text-xs">
                    <button 
                        onClick={() => { 
                            cleanup(); 
                            setViewState('lite'); // Cancel -> Back to Lite
                        }}
                        className="text-red-500 hover:underline"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        {/* ERROR STATE */}
        {viewState === 'error' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
                 <p className="font-bold mb-2">Structure Viewer Unavailable</p>
                 <p className="text-sm text-gray-400 mb-6">{loadError || "An unknown error occurred"}</p>
                 <div className="flex gap-3">
                     <button onClick={initViewer} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm">Retry</button>
                     <a href={`https://www.rcsb.org/structure/${cleanPdbId}`} target="_blank" className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 text-sm flex items-center gap-2">
                         <ExternalLink size={14}/> Open in RCSB
                     </a>
                 </div>
            </div>
        )}

        {/* ACTUAL VIEWER (Hidden until needed) */}
        {(viewState === 'loading' || viewState === 'ready') && (
            <pdbe-molstar
                ref={viewerRef}
                key={`${cleanPdbId}-${requestIdRef.current}`} // Force remount if needed, though usually stable
                id="pdbe-molstar-widget"
                {...viewerProps}
                hide-controls="true"
            ></pdbe-molstar>
        )}
    </div>
  );
}

// Wrapper with Error Boundary
export default function StructureViewer(props: StructureViewerProps) {
    return (
        <StructureViewerErrorBoundary pdbId={props.pdbId} source={props.source}>
            <StructureViewerContent {...props} />
        </StructureViewerErrorBoundary>
    );
}
