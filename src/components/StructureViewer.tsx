"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
  const [scriptsReady, setScriptsReady] = useState(false);
  const [viewerInstanceId, setViewerInstanceId] = useState(0);

  // Computed IDs
  const isAlphaFold = source === 'AlphaFold' || pdbId.startsWith('AF-');
  const cleanPdbId = isAlphaFold ? pdbId : pdbId.toLowerCase();
  
  // Reset on prop change
  useEffect(() => {
    setViewState('lite');
    setLoadError(null);
    setViewerInstanceId(prev => prev + 1);
  }, [pdbId, source]);

  // 1. Script Readiness Check
  useEffect(() => {
    if (scriptsReady) return;
    
    // Poll for global objects
    const interval = setInterval(() => {
        const pluginLoaded = (window as any).PDBeMolstarPlugin && window.customElements && window.customElements.get('pdbe-molstar');
        if (pluginLoaded) {
            setScriptsReady(true);
            clearInterval(interval);
        }
    }, 100);
    
    return () => clearInterval(interval);
  }, [scriptsReady]);

  // 2. Initialization Effect (The Source of Truth)
  useEffect(() => {
      if (viewState !== 'loading') return;

      const currentId = viewerInstanceId;
      let timeoutId: NodeJS.Timeout;
      let cleanupFn: (() => void) | undefined;

      const attemptInit = () => {
          if (currentId !== viewerInstanceId) return; 

          // Wait for scripts
          if (!scriptsReady) return; // Will re-run when scriptsReady changes

          // Wait for Container
          const container = containerRef.current;
          if (!container || container.clientHeight === 0) {
              requestAnimationFrame(attemptInit);
              return;
          }

          // Wait for Web Component
          const viewer = viewerRef.current;
          if (!viewer) {
              requestAnimationFrame(attemptInit);
              return;
          }

          // Ready to bind
          const handleEvent = (e: any) => {
              if (currentId !== viewerInstanceId) return;
              
              if (e.detail?.eventType === 'loadComplete') {
                  setViewState('ready');
                  if (timeoutId) clearTimeout(timeoutId);
              } else if (e.detail?.eventType === 'loadError') {
                  console.error("[StructureViewer] Load Error", e.detail);
                  setLoadError("Structure failed to load");
                  setViewState('error');
                  if (timeoutId) clearTimeout(timeoutId);
              }
          };

          viewer.addEventListener('PDB.molstar.view.event', handleEvent);
          
          // Hard Timeout (15s to be safe for network)
          timeoutId = setTimeout(() => {
              if (currentId === viewerInstanceId) {
                  setLoadError("Initialization timed out");
                  setViewState('error');
              }
          }, 15000);

          cleanupFn = () => {
              viewer.removeEventListener('PDB.molstar.view.event', handleEvent);
          };
      };

      attemptInit();

      // Effect Cleanup
      return () => {
          if (cleanupFn) cleanupFn();
          if (timeoutId) clearTimeout(timeoutId);
      };
  }, [viewState, scriptsReady, viewerInstanceId]);

  // Viewer Props
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

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-[400px] bg-white text-black rounded-lg overflow-hidden border border-gray-700 shadow-sm"
    >
        {/* EXTERNAL SCRIPTS */}
        <link rel="stylesheet" type="text/css" href="/pdbe/pdbe-molstar-light.css" />
        <Script src="/pdbe/pdbe-molstar-plugin.js" strategy="lazyOnload" />
        <Script src="/pdbe/pdbe-molstar-component.js" strategy="lazyOnload" />

        {/* LITE MODE UI */}
        {viewState === 'lite' && (
            <div className="absolute inset-0 z-10 bg-gray-50 flex flex-col items-center justify-center">
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
                            onClick={() => {
                                setViewerInstanceId(prev => prev + 1);
                                setViewState('loading');
                            }}
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
                            setViewState('lite'); 
                            setViewerInstanceId(prev => prev + 1); // Cancel checks
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
                     <button 
                        onClick={() => {
                            setViewerInstanceId(prev => prev + 1);
                            setViewState('loading');
                        }}
                        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm"
                     >
                        Retry
                     </button>
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
                key={`${cleanPdbId}-${viewerInstanceId}`} // Force fresh mount on retry/new request
                id="pdbe-molstar-widget"
                {...viewerProps}
                hide-controls="true"
            ></pdbe-molstar>
        )}
    </div>
  );
}

export default function StructureViewer(props: StructureViewerProps) {
    return (
        <StructureViewerErrorBoundary pdbId={props.pdbId} source={props.source}>
            <StructureViewerContent {...props} />
        </StructureViewerErrorBoundary>
    );
}
