"use client";

import React, { useState, useEffect } from "react";
import { Brain3DViewer } from "@/components/Brain3DViewer";
import { PRELOADED_MRI_CASES, MRICase } from "@/lib/mriData";
import { Sparkles, ArrowLeft, Monitor } from "lucide-react";
import Link from "next/link";

export default function ProjectorPage() {
  const [currentCase, setCurrentCase] = useState<MRICase>(PRELOADED_MRI_CASES[0]);

  // Sync with main presenter window
  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = new BroadcastChannel("neuroscan_projector_sync");

    channel.onmessage = (event) => {
      if (event.data?.type === "CASE_CHANGE") {
        const found = PRELOADED_MRI_CASES.find((c) => c.id === event.data.caseId);
        if (found) {
          setCurrentCase(found);
        }
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-white relative">
      {/* Return to Dashboard overlay on hover */}
      <div className="absolute top-3 left-3 z-30 opacity-20 hover:opacity-100 transition-opacity flex items-center space-x-2">
        <Link
          href="/"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 text-cyan-300 border border-slate-700 text-xs backdrop-blur font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Projector Mode</span>
        </Link>
      </div>

      {/* 3D Volumetric Stage Viewer */}
      <Brain3DViewer currentCase={currentCase} isProjectorStandalone={true} />
    </div>
  );
}
