"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Upload, FileText, Download, AlertCircle, X, Check, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface BatchResult {
  hgvs: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
  md?: string;
}

type SavePickerHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<SavePickerHandle>;
};

export default function BatchUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  const processBatch = async () => {
    if (!file) return;
    setProcessing(true);
    setResults([]);

    try {
      const text = await file.text();
      // Assume CSV with single column "HGVS" or just first column
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      // Basic parsing: remove simple header if "hgvs" or "variant"
      const first = lines[0].toLowerCase();
      const startIndex = (first.includes('hgvs') || first.includes('variant')) ? 1 : 0;
      
      const variants = lines.slice(startIndex).map(l => l.split(',')[0].trim());
      
      const queue: BatchResult[] = variants.map(v => ({ hgvs: v, status: 'pending' }));
      setResults([...queue]);

      // Sequential Processing
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        
        try {
          // Throttling: Wait 1s between requests to be nice to public APIs
          if (i > 0) await new Promise(r => setTimeout(r, 1000));

          const res = await fetch(`/api/variant?format=md`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hgvs: item.hgvs }),
          });

          if (!res.ok) {
            throw new Error(`API Error: ${res.status}`);
          }
          
          const md = await res.text();
          queue[i] = { ...item, status: 'success', md };
        } catch (e) {
          queue[i] = { ...item, status: 'error', error: (e as Error).message };
        }
        
        setResults([...queue]); // Force re-render
        setProgress(Math.round(((i + 1) / queue.length) * 100));
      }

    } catch (e) {
      console.error("Batch processing failed:", e);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    const folder = zip.folder("variant-lens-reports");
    
    let count = 0;
    results.forEach(r => {
      if (r.status === 'success' && r.md) {
        // Safe filename
        const filename = r.hgvs.replace(/[^a-zA-Z0-9_\-\.]/g, '_') + '.md';
        folder?.file(filename, r.md);
        count++;
      }
    });

    if (count === 0) return;

    const zipBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const blob = new Blob([zipBuffer], { type: "application/zip" });
    const filename = `variant-lens-results-${new Date().toISOString().slice(0, 10)}.zip`;
    const pickerWindow = window as SavePickerWindow;

    try {
      if (typeof pickerWindow.showSaveFilePicker === "function") {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "ZIP Archive",
              accept: { "application/zip": [".zip"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setDownloadMessage("Zip saved successfully.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setDownloadMessage("Zip download started in your browser Downloads folder.");
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);
    } catch (error) {
      // AbortError means the user canceled the save dialog.
      if (error instanceof DOMException && error.name === "AbortError") {
        setDownloadMessage("Save canceled.");
        return;
      }
      console.error("Zip download failed:", error);
      setDownloadMessage("Failed to save zip file. Please try again.");
    }
  };

  return (
    <div className="bg-surface-light/50 backdrop-blur rounded-xl border border-white/10 p-4 sm:p-6">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
         <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/20 rounded-lg">
                <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
                <h3 className="text-lg font-light text-white">Batch Processing</h3>
                <p className="text-xs text-gray-400">Upload CSV of variants for bulk Markdown generation.</p>
            </div>
         </div>
       </div>

       {/* Drop/Select Area */}
       {!file && !processing ? (
         <div className="border-2 border-dashed border-white/10 rounded-xl p-5 sm:p-8 text-center hover:bg-white/5 transition-colors cursor-pointer group relative">
            <input 
               type="file" 
               accept=".csv,.txt"
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               onChange={(e) => {
                  if (e.target.files?.[0]) setFile(e.target.files[0]);
               }}
            />
            <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:text-primary transition-colors" />
            <p className="text-sm text-gray-300">Drop CSV file or <span className="text-primary underline">browse</span></p>
         </div>
       ) : (
         <div className="space-y-4">
             {/* File Info */}
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-black/20 p-3 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-sm text-white min-w-0">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{file?.name}</span>
                </div>
                {!processing && (
                    <button 
                        onClick={() => { setFile(null); setResults([]); setProgress(0); }}
                        className="p-1 hover:bg-white/10 rounded"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                )}
             </div>

             {/* Progress / Actions */}
             {processing ? (
                 <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Processing {results.filter(r => r.status !== 'pending').length} / {results.length}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                    </div>
                 </div>
             ) : results.length === 0 ? (
                 <button 
                    onClick={processBatch}
                    className="w-full py-2 bg-primary hover:bg-primary-hover text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                 >
                    Start Batch
                 </button>
             ) : (
                 <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-green-900/20 border border-green-500/20 p-2 rounded text-green-400">
                            {results.filter(r => r.status === 'success').length} Success
                        </div>
                        <div className="bg-red-900/20 border border-red-500/20 p-2 rounded text-red-400">
                            {results.filter(r => r.status === 'error').length} Failed
                        </div>
                        <div className="bg-blue-900/20 border border-blue-500/20 p-2 rounded text-blue-400">
                            {results.length} Total
                        </div>
                    </div>

                    <button 
                        onClick={handleDownload}
                        disabled={results.filter(r => r.status === 'success').length === 0}
                        className="w-full py-2 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        Download Zip
                    </button>
                    {downloadMessage && (
                      <p className="text-xs text-gray-400">{downloadMessage}</p>
                    )}
                 </div>
             )}
         </div>
       )}

       {/* Log View */}
       {results.length > 0 && (
         <div className="mt-4 max-h-40 overflow-y-auto bg-black/40 rounded-lg p-2 text-xs font-mono space-y-1 scrollbar-thin">
            {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    {r.status === 'pending' && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                    {r.status === 'success' && <Check className="w-3 h-3 text-green-500" />}
                    {r.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                    <span className={clsx(
                        "break-all",
                        r.status === 'success' ? "text-gray-300" : 
                        r.status === 'error' ? "text-red-400" : "text-gray-500"
                    )}>
                        {r.hgvs} {r.error ? `(${r.error})` : ''}
                    </span>
                </div>
            ))}
         </div>
       )}
    </div>
  );
}
