"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Play, ExternalLink, Loader2 } from "lucide-react";

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
type ScriptLoadState = { component: boolean };

function StructureViewerContent({ pdbId, source = 'PDB', structureUrl, sifts, uniprotResidue }: StructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const activeInstanceRef = useRef(0);
  const widgetIdRef = useRef(`pdbe-molstar-widget-${Math.random().toString(36).slice(2, 10)}`);
  
  // State Machine
  const [viewState, setViewState] = useState<ViewerState>('lite');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scriptLoadState, setScriptLoadState] = useState<ScriptLoadState>(() => {
    if (typeof window === 'undefined') return { component: false };
    const hasElement = typeof customElements !== 'undefined' && !!customElements.get('pdbe-molstar');
    const hasPlugin = !!(window as any).PDBeMolstarPlugin;
    return { component: hasElement || hasPlugin };
  });
  const [viewerInstanceId, setViewerInstanceId] = useState(0);
  const scriptsReady = scriptLoadState.component;

  // Computed IDs
  const isAlphaFold = source === 'AlphaFold' || pdbId.startsWith('AF-');
  const cleanPdbId = isAlphaFold ? pdbId : pdbId.toLowerCase();
  
  // Reset on prop change
  useEffect(() => {
    setViewState('lite');
    setLoadError(null);
    setViewerInstanceId(prev => prev + 1);
  }, [pdbId, source]);

  useEffect(() => {
    activeInstanceRef.current = viewerInstanceId;
  }, [viewerInstanceId]);

  useEffect(() => {
    if (scriptsReady) return;
    if (typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const probe = () => {
      if (done) return;
      const hasElement = typeof customElements !== 'undefined' && !!customElements.get('pdbe-molstar');
      const hasPlugin = !!(window as any).PDBeMolstarPlugin;
      if (hasElement || hasPlugin) {
        done = true;
        setScriptLoadState({ component: true });
        return;
      }
      timeoutId = setTimeout(probe, 120);
    };

    probe();
    return () => {
      done = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [scriptsReady, viewerInstanceId, cleanPdbId]);

  // Handle known async plugin crashes gracefully (prevents global runtime crash overlay).
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = String(event.error?.message || event.message || "");
      if (msg.includes("reading 'transform'") || msg.includes("Invalid data cell")) {
        event.preventDefault?.();
        setLoadError("Viewer engine crashed while switching structures. Please retry.");
        setViewState('error');
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = String(reason?.message || reason || "");
      if (msg.includes("reading 'transform'") || msg.includes("Invalid data cell")) {
        event.preventDefault?.();
        setLoadError("Viewer engine crashed while processing structure data.");
        setViewState('error');
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
      if (!scriptsReady) return;
      if (viewState !== 'loading') return;

      const currentId = viewerInstanceId;
      let hardTimeoutId: NodeJS.Timeout | undefined;
      let containerTimeoutId: NodeJS.Timeout | undefined;
      let canvasProbeId: NodeJS.Timeout | undefined;
      let instanceProbeId: NodeJS.Timeout | undefined;
      let observer: ResizeObserver | undefined;
      let cleanupFns: Array<() => void> = [];
      let finished = false;

      const viewer = viewerRef.current;
      const container = containerRef.current;
      
      if (!viewer || !container) return;

      console.log(`[StructureViewer] Init attempt #${currentId} for ${cleanPdbId}`);

      const isStale = () => activeInstanceRef.current !== currentId;

      const completeWithError = (message: string) => {
          if (finished || isStale()) return;
          finished = true;
          console.error(`[StructureViewer] ${message}`);
          setLoadError(message);
          setViewState('error');
      };

      const completeReady = () => {
          if (finished || isStale()) return;
          finished = true;
          console.log(`[StructureViewer] viewer ready`);
          setViewState('ready');
      };

      // Global timeout across the full initialization path (instance + events + data fetch).
      hardTimeoutId = setTimeout(() => {
          if (isStale() || finished) return;
          completeWithError("Initialization timed out after 60s (network, data, or viewer engine issue)");
      }, 60000);

      const hasContainerSize = () => {
          const rect = container.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
      };

      const bindEvents = () => {
          if (isStale() || finished) return;

          const eventTargets: Array<{ target: EventTarget; name: string }> = [
            { target: viewer, name: 'PDB.molstar.view.event' },
            { target: viewer, name: 'pdbe-molstar-event' }
          ];

          const onViewerEvent = (e: any) => {
              if (isStale() || finished) return;
              const detail = e?.detail || {};
              const eventType = String(detail.eventType || detail.type || '').toLowerCase();
              const status = String(detail.status || '').toLowerCase();
              const message = detail.message || '';

              if (
                eventType.includes('loadcomplete') ||
                eventType.includes('load-complete') ||
                eventType.includes('ready') ||
                status === 'ready'
              ) {
                completeReady();
                return;
              }

              if (
                eventType.includes('loaderror') ||
                eventType.includes('error') ||
                status === 'error'
              ) {
                completeWithError(message || "Structure failed to load");
              }
          };

          eventTargets.forEach(({ target, name }) => {
            target.addEventListener(name, onViewerEvent as EventListener);
            cleanupFns.push(() => target.removeEventListener(name, onViewerEvent as EventListener));
          });

          const loadCompleteEvent = viewer?.viewerInstance?.events?.loadComplete;
          if (loadCompleteEvent && typeof loadCompleteEvent.subscribe === 'function') {
            const subscription = loadCompleteEvent.subscribe((payload: any) => {
              if (isStale() || finished) return;
              const success = typeof payload === 'boolean'
                ? payload
                : payload?.success !== false;
              if (success) {
                completeReady();
              } else {
                completeWithError("Structure failed to load");
              }
            });
            cleanupFns.push(() => {
              if (subscription && typeof subscription.unsubscribe === 'function') {
                subscription.unsubscribe();
              }
            });
          }

          // Fallback for event mismatch: if a canvas appears, treat viewer as loaded.
          canvasProbeId = setInterval(() => {
            if (isStale() || finished) return;
            if (viewer.querySelector("canvas") || viewer.querySelector(".msp-plugin")) {
              completeReady();
            }
          }, 400);

      };

      const waitForContainerAndBind = () => {
          if (isStale() || finished) return;

          const waitForInstanceAndBind = () => {
            if (isStale() || finished) return;
            const startedAt = Date.now();
            const poll = () => {
              if (isStale() || finished) return;
              if (viewer.viewerInstance) {
                bindEvents();
                return;
              }
              if (Date.now() - startedAt > 8000) {
                completeWithError("Viewer engine did not initialize");
                return;
              }
              instanceProbeId = setTimeout(poll, 120);
            };
            poll();
          };

          if (hasContainerSize()) {
            waitForInstanceAndBind();
            return;
          }

          observer = new ResizeObserver(() => {
            if (isStale() || finished) return;
            if (hasContainerSize()) {
              observer?.disconnect();
              observer = undefined;
              waitForInstanceAndBind();
            }
          });
          observer.observe(container);

          // Prevent indefinite wait when parent keeps the viewer collapsed/hidden.
          containerTimeoutId = setTimeout(() => {
            if (isStale() || finished) return;
            completeWithError("Viewer container has zero size. Open the section and retry.");
          }, 10000);
      };

      customElements.whenDefined('pdbe-molstar').then(() => {
          if (isStale() || finished) return;
          console.log(`[StructureViewer] <pdbe-molstar> defined`);

          if (!(window as any).PDBeMolstarPlugin) {
             console.warn("[StructureViewer] PDBeMolstarPlugin missing after script load");
          }

          waitForContainerAndBind();
      });

      return () => {
          cleanupFns.forEach((fn) => fn());
          cleanupFns = [];
          if (observer) observer.disconnect();
          if (hardTimeoutId) clearTimeout(hardTimeoutId);
          if (containerTimeoutId) clearTimeout(containerTimeoutId);
          if (canvasProbeId) clearInterval(canvasProbeId);
          if (instanceProbeId) clearTimeout(instanceProbeId);
      };
  }, [viewState, scriptsReady, viewerInstanceId, cleanPdbId]);

  // Viewer Props
  const alphaFoldSourceUrl = structureUrl || `https://alphafold.ebi.ac.uk/files/${cleanPdbId}-model_v4.cif`;
  // Normalize AlphaFold loads to CIF to avoid BCIF parse/runtime crashes in this PDBe bundle.
  const alphaFoldDataUrl = alphaFoldSourceUrl.replace(/\.bcif(\b|$)/i, '.cif$1');
  const alphaFoldFormat = /\.pdb(\b|$)/i.test(alphaFoldDataUrl) ? 'pdb' : 'cif';

  const viewerProps = isAlphaFold 
    ? { 
        'custom-data-url': alphaFoldDataUrl,
        'custom-data-format': alphaFoldFormat,
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
        <Script
            src="/pdbe/pdbe-molstar-component.js"
            strategy="afterInteractive"
            onLoad={() => setScriptLoadState({ component: true })}
            onError={() => {
              setLoadError("Failed to load viewer component script");
              setViewState('error');
            }}
        />

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
                                setLoadError(null);
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
        {/* Only mount when scripts are ready AND we are in loading/ready state */}
        {scriptsReady && (viewState === 'loading' || viewState === 'ready') && (
            <pdbe-molstar
                ref={viewerRef}
                key={`${cleanPdbId}-${viewerInstanceId}`} // Force fresh mount on retry/new request
                id={`${widgetIdRef.current}-${viewerInstanceId}`}
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
