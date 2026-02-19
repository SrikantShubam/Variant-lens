"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export type StructureViewerErrorBoundaryProps = {
  children: React.ReactNode;
  pdbId?: string;
  source?: "PDB" | "AlphaFold";
};

type StructureViewerErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export class StructureViewerErrorBoundary extends React.Component<
  StructureViewerErrorBoundaryProps,
  StructureViewerErrorBoundaryState
> {
  state: StructureViewerErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "Viewer crashed unexpectedly";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[StructureViewer] ErrorBoundary caught", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { pdbId, source } = this.props;
    const cleanId = pdbId ? pdbId.toLowerCase() : "";
    const externalUrl = cleanId
      ? source === "AlphaFold" || cleanId.startsWith("af-")
        ? `https://alphafold.ebi.ac.uk/entry/${cleanId}`
        : `https://www.rcsb.org/structure/${cleanId}`
      : "https://www.rcsb.org";

    return (
      <div className="w-full h-[400px] bg-gray-900 text-white rounded-lg flex flex-col items-center justify-center text-center p-6 border border-gray-700">
        <p className="font-bold mb-2">Structure Viewer Unavailable</p>
        <p className="text-sm text-gray-400 mb-4">
          {this.state.message || "An unknown error occurred"}
        </p>
        <a
          href={externalUrl}
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 text-sm"
        >
          <ExternalLink size={14} /> Open in External Viewer
        </a>
      </div>
    );
  }
}
