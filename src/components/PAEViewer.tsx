"use client";

import { useEffect, useRef, useState } from "react";
import { Info, X, Maximize2 } from "lucide-react";

interface PAEViewerProps {
  url: string;
}

export default function PAEViewer({ url }: PAEViewerProps) {
  const smallCanvasRef = useRef<HTMLCanvasElement>(null);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<number[][] | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Helper: Draw matrix to canvas
  const drawToCanvas = (canvas: HTMLCanvasElement, data: number[][]) => {
    const size = data.length;
    
    // Set dimensions to match matrix size 1:1 for crisp pixelation
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Create Image Data
    const imageData = ctx.createImageData(size, size);
    const pixelData = imageData.data;

    // Fill pixels
    for (let i = 0; i < size; i++) {
        const row = data[i];
        for (let j = 0; j < size; j++) {
            const val = row[j];
            const index = (i * size + j) * 4;
            
            // Color Map (Blue -> Red)
            let r, g, b;
            if (val < 5) {
                r = 0; g = 80; b = 180;
            } else if (val < 10) {
                r = 100; g = 180; b = 255;
            } else if (val < 20) {
                r = 250; g = 240; b = 180;
            } else {
                r = 220; g = 60; b = 60;
            }

            pixelData[index] = r;
            pixelData[index + 1] = g;
            pixelData[index + 2] = b;
            pixelData[index + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Fetch Data
  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        console.log("Fetching PAE from:", url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load PAE: ${res.status}`);
        
        const data = await res.json();
        if (!active) return;

        const entry = Array.isArray(data) ? data[0] : data;
        const mat = entry?.predicted_aligned_error;

        if (!mat || !Array.isArray(mat)) {
          throw new Error("Invalid PAE format");
        }

        setMatrix(mat);
        setLoading(false);

      } catch (e) {
        if (active) {
            console.error("PAE Error:", e);
            setError("Could not load reliability graph");
            setLoading(false);
        }
      }
    }

    fetchData();
    return () => { active = false; };
  }, [url]);

  // Draw Small Canvas when matrix loaded
  useEffect(() => {
    if (matrix && smallCanvasRef.current) {
        drawToCanvas(smallCanvasRef.current, matrix);
    }
  }, [matrix]);

  // Draw Large Canvas when expanded
  useEffect(() => {
    if (expanded && matrix && largeCanvasRef.current) {
        // Short timeout to ensure modal DOM is ready
        setTimeout(() => {
            if (largeCanvasRef.current) drawToCanvas(largeCanvasRef.current, matrix!);
        }, 50);
    }
  }, [expanded, matrix]);

  // Prevent scrolling when modal open
  useEffect(() => {
    if (expanded) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [expanded]);

  const matrixSize = matrix?.length || 0;

  return (
    <>
        <div className="w-full flex gap-4 p-2 bg-black/20 rounded-lg">
        {/* Graph Container (Clickable) */}
        <div 
            className={`relative aspect-square w-32 h-32 flex-shrink-0 bg-white shadow-inner border border-white/10 overflow-hidden rounded group ${matrix ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all' : ''}`}
            onClick={() => matrix && setExpanded(true)}
            title={matrix ? "Click to enlarge" : ""}
        >
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 animate-pulse">
                    Loading...
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400 p-1 text-center leading-tight">
                    {error}
                </div>
            )}
            <canvas ref={smallCanvasRef} className="w-full h-full rendering-pixelated" />
            
            {/* Hover Hint */}
            {matrix && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                </div>
            )}
        </div>
        
        {/* Legend / Info */}
        <div className="flex-1 text-xs text-gray-400 flex flex-col justify-center">
                <h5 className="font-bold text-gray-200 mb-1 flex items-center gap-1">
                    PAE Matrix (Alignment Error)
                    <Info className="w-3 h-3 text-gray-500" />
                </h5>
                <p className="mb-2 leading-relaxed">
                    Color indicates predicted error between residue pairs.
                    <br />
                    <span className="text-blue-400 text-[10px] cursor-pointer hover:underline" onClick={() => matrix && setExpanded(true)}>Click graph to enlarge</span>
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#0050B4]"></span>
                        &lt;5Å (Confident)
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#64B4FF]"></span>
                        5-10Å (Good)
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#FAF0B4]"></span>
                        10-20Å (Fair)
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#DC3C3C]"></span>
                        &gt;20Å (Poor)
                    </div>
                </div>
                {matrixSize > 0 && <p className="mt-1 opacity-50">{matrixSize}x{matrixSize} residues</p>}
        </div>
        </div>

        {/* Fullscreen Modal */}
        {expanded && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setExpanded(false)}>
                {/* Modal Content */}
                <div className="relative bg-[#1a1a1a] p-4 rounded-xl shadow-2xl max-w-[90vw] max-h-[90vh] flex flex-col border border-gray-800" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            PAE Matrix (Full Resolution)
                            <span className="text-sm font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{matrixSize}x{matrixSize}</span>
                        </h3>
                        <button 
                            onClick={() => setExpanded(false)}
                            className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6 text-gray-300" />
                        </button>
                    </div>

                    {/* Canvas Container - fit contained */}
                    <div className="relative flex-1 min-h-0 min-w-0 bg-black border border-gray-700 rounded overflow-auto flex items-center justify-center">
                         <canvas 
                            ref={largeCanvasRef} 
                            className="rendering-pixelated shadow-lg max-w-full max-h-[80vh] object-contain"
                            style={{ imageRendering: 'pixelated' }} // Redundant inline style for safety
                         />
                    </div>

                    {/* Footer Legend */}
                    <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-gray-300">
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#0050B4]"></span>&lt;5Å</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#64B4FF]"></span>5-10Å</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#FAF0B4]"></span>10-20Å</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#DC3C3C]"></span>&gt;20Å</div>
                    </div>
                </div>
            </div>
        )}
    </>
  );
}
