"use client";

import React, { useState, useEffect } from "react";
import { MRICase, PRELOADED_MRI_CASES } from "@/lib/mriData";
import { medicalAudio } from "@/lib/medicalAudioEngine";
import { MRIViewer, VisualizationMode } from "@/components/MRIViewer";
import { Brain3DViewer } from "@/components/Brain3DViewer";
import { RadiologyReportModal } from "@/components/RadiologyReportModal";
import { UploadMRIModal } from "@/components/UploadMRIModal";
import {
  Activity,
  AlertTriangle,
  Volume2,
  VolumeX,
  FileText,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Eye,
  Info,
  Brain,
  Upload,
  Cpu,
  Mic,
  ArrowRight,
  BarChart3,
  Download,
  Scissors,
  SplitSquareVertical,
  Crosshair,
  Radio,
  Play,
  Square,
  PlusCircle,
  Edit3,
  XCircle,
  Database,
  Monitor,
  Box
} from "lucide-react";

export default function Home() {
  const [casesList, setCasesList] = useState<MRICase[]>(PRELOADED_MRI_CASES);
  const [selectedCase, setSelectedCase] = useState<MRICase>(PRELOADED_MRI_CASES[0]);
  const [displayDimension, setDisplayDimension] = useState<"2d" | "3d">("2d");

  // Advanced Visualization Modes
  const [visMode, setVisMode] = useState<VisualizationMode>("fused");
  const [splitPos, setSplitPos] = useState<number>(0.5);

  // Grad-CAM Controls
  const [gradCamOpacity, setGradCamOpacity] = useState<number>(0.75);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showContour, setShowContour] = useState<boolean>(true);
  const [colorMap, setColorMap] = useState<"jet" | "hot" | "plasma">("jet");

  // Audio / Voice Controls
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>("");

  // Modals
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Human-in-the-Loop Active Learning Feedback State
  const [feedbackAction, setFeedbackAction] = useState<"idle" | "accepted" | "correcting" | "corrected" | "rejected">("idle");
  const [correctedDiagnosis, setCorrectedDiagnosis] = useState<string>("Meningioma");
  const [clinicianNotes, setClinicianNotes] = useState<string>("");
  const [feedbackAuditId, setFeedbackAuditId] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);

  const handleSendFeedback = async (action: "accepted" | "corrected" | "rejected") => {
    setIsSubmittingFeedback(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          patientName: selectedCase.patientName,
          aiDiagnosis: selectedCase.diagnosis,
          action,
          correctedDiagnosis: action === "corrected" ? correctedDiagnosis : null,
          clinicianNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackAuditId(data.auditEntry.auditId);
        setFeedbackAction(action);
      }
    } catch (e) {
      console.error("Feedback logging error:", e);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const caseParam = params.get("case");
      const modeParam = params.get("mode") as VisualizationMode | null;
      if (caseParam) {
        const found = PRELOADED_MRI_CASES.find(
          (c) => c.id === caseParam || c.classification.toLowerCase() === caseParam.toLowerCase()
        );
        if (found) setSelectedCase(found);
      }
      if (modeParam && ["fused", "difference", "detected", "wiper"].includes(modeParam)) {
        setVisMode(modeParam);
      }
    }
  }, []);

  // Trigger Sound & Voice upon selecting a case
  const handleSelectCase = (mriCase: MRICase) => {
    setSelectedCase(mriCase);

    // Sync with secondary projector window via BroadcastChannel
    if (typeof window !== "undefined") {
      try {
        const channel = new BroadcastChannel("neuroscan_projector_sync");
        channel.postMessage({ type: "CASE_CHANGE", caseId: mriCase.id });
        channel.close();
      } catch (e) {
        // ignore
      }
    }

    let speechText = "";
    if (mriCase.severity === "danger") {
      medicalAudio.playMalignantAlarm();
      speechText = `Critical diagnostic alert: ${mriCase.diagnosis} detected in the ${mriCase.brainRegion} with ${mriCase.confidence}% model confidence. Bounding centroid is located at X ${mriCase.tumorCentroid.x}, Y ${mriCase.tumorCentroid.y}. Significant mass effect noted with ${mriCase.massEffect}.`;
    } else if (mriCase.severity === "warning") {
      medicalAudio.playCautionAlert();
      speechText = `Diagnostic caution: ${mriCase.diagnosis} localized in the ${mriCase.brainRegion}. Tumor cross-sectional area is approximately ${mriCase.tumorAreaMm2} square millimeters. Endocrine panel and visual field perimetry recommended.`;
    } else {
      medicalAudio.playHealthyChime();
      speechText = `Evaluation complete: Normal brain MRI scan. Intracranial parenchyma, lateral ventricles, and sulcal morphology are completely symmetrical without pathological contrast enhancement.`;
    }

    setSpokenTranscript(speechText);
    if (voiceEnabled) {
      setIsSpeaking(true);
      medicalAudio.speakRadiologyReport(speechText);
      setTimeout(() => setIsSpeaking(false), 7000);
    }
  };

  const handleUploadSuccess = (newCase: MRICase) => {
    setCasesList((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    handleSelectCase(newCase);
  };

  const handleStopVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleReplayVoice = () => {
    if (spokenTranscript) {
      setIsSpeaking(true);
      medicalAudio.speakRadiologyReport(spokenTranscript);
      setTimeout(() => setIsSpeaking(false), 7000);
    }
  };

  // Sync Audio Settings
  useEffect(() => {
    medicalAudio.setMuted(!soundEnabled);
    medicalAudio.setVoiceEnabled(voiceEnabled);
  }, [soundEnabled, voiceEnabled]);

  // Initial setup: populate transcript without autoplaying speech/alarm
  useEffect(() => {
    const mriCase = PRELOADED_MRI_CASES[0];
    const speechText = `Case loaded: ${mriCase.diagnosis} localized in the ${mriCase.brainRegion}. Select any patient case or click play to start voice narration.`;
    setSpokenTranscript(speechText);
  }, []);

  const getSeverityBadge = (severity: MRICase["severity"]) => {
    switch (severity) {
      case "danger":
        return {
          label: "CRITICAL MALIGNANT",
          color: "bg-red-950/80 text-red-400 border-red-500 animate-pulse",
          icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
        };
      case "warning":
        return {
          label: "ELEVATED NEURO CAUTION",
          color: "bg-amber-950/80 text-amber-400 border-amber-500",
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        };
      default:
        return {
          label: "HEALTHY PARENCHYMA",
          color: "bg-emerald-950/80 text-emerald-400 border-emerald-500",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        };
    }
  };

  const badge = getSeverityBadge(selectedCase.severity);

  return (
    <div className="min-h-screen bg-[#03060d] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Prominent Legal & Medical Regulatory Disclaimer Banner */}
      <div className="w-full bg-amber-500/10 border-b border-amber-500/25 px-4 py-1.5 text-center text-[11px] text-amber-300 flex items-center justify-center space-x-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          <strong>ACADEMIC RESEARCH DEMONSTRATION TOOL:</strong> For machine learning engineering & educational evaluation only. <strong>NOT</strong> certified as a diagnostic medical device (SaMD) and <strong>NOT</strong> for clinical diagnosis, patient care, or medical decision-making.
        </span>
      </div>

      {/* Top Clinical Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#060b17]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Clinical Title */}
          <div className="flex items-center space-x-3">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 shadow-lg shadow-cyan-500/10">
              <Brain className="w-6 h-6 text-cyan-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-black tracking-tight text-white font-serif">
                  NEUROSCAN<span className="text-cyan-400 font-sans font-bold text-sm ml-1.5 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">XAI</span>
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                  Zero Data Leakage Sealed
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                Multi-Class Neoplastic Brain MRI Diagnostic & Explainability Workstation
              </p>
            </div>
          </div>

          {/* Right Action Deck */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* UPLOAD MRI SCAN BUTTON (PRIMARY) */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all transform hover:scale-[1.02]"
            >
              <Upload className="w-4 h-4 text-white" />
              <span>Upload MRI Scan</span>
            </button>

            {/* 3D PROJECTOR STAGE BUTTON */}
            <button
              onClick={() => {
                window.open("/projector", "NeuroscanProjector", "width=1280,height=720,menubar=no,toolbar=no");
              }}
              title="Launch Dual-Display Projector Theater"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 border border-purple-400/40 transition-all transform hover:scale-[1.02]"
            >
              <Monitor className="w-4 h-4 text-purple-200" />
              <span className="hidden sm:inline">3D Projector Stage</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute Medical Telemetry" : "Enable Telemetry"}
              className={`p-2 rounded-xl border transition-all ${
                soundEnabled
                  ? "bg-slate-900 border-slate-700 text-cyan-400 hover:border-cyan-500"
                  : "bg-slate-950 border-slate-800 text-slate-500"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Voice Toggle */}
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? "Mute Voice Briefing" : "Enable Voice Briefing"}
              className={`p-2 rounded-xl border transition-all ${
                voiceEnabled
                  ? "bg-cyan-950/60 border-cyan-700 text-cyan-300 shadow-sm shadow-cyan-900/40"
                  : "bg-slate-950 border-slate-800 text-slate-500"
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Clinical Radiology Report Modal Button */}
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Medical Report (PDF)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Cohort Scans Subheader with Upload Button */}
      <section className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 overflow-x-auto py-1">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase mr-1">
              Select Patient Scan:
            </span>

            {/* Quick Upload Action Pill */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Upload New Scan</span>
            </button>

            {casesList.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectCase(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  selectedCase.id === c.id
                    ? c.severity === "danger"
                      ? "bg-red-600 text-white shadow-md shadow-red-900/40"
                      : c.severity === "warning"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-900/40"
                      : "bg-emerald-600 text-white shadow-md shadow-emerald-900/40"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    c.severity === "danger"
                      ? "bg-red-400"
                      : c.severity === "warning"
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                />
                <span>
                  {c.isUploaded ? "Uploaded: " : ""}
                  {c.diagnosis.split(" (")[0]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Deep 5-Stage Residual-SE CNN: Online</span>
          </div>
        </div>
      </section>

      {/* Main Radiology Workstation Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clinical Diagnosis & Class Probabilities (4 cols) */}
        <aside className="lg:col-span-4 flex flex-col space-y-4">
          {/* Active Diagnostic Status Banner */}
          <div className={`p-4 rounded-2xl border shadow-xl backdrop-blur-xl ${badge.color}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono font-bold tracking-wider flex items-center space-x-1.5 uppercase">
                {badge.icon}
                <span>{badge.label}</span>
              </span>
              <span className="text-xs font-mono font-bold bg-black/40 px-2 py-0.5 rounded">
                AI Confidence: {selectedCase.confidence}%
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight font-serif">
              {selectedCase.diagnosis}
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {selectedCase.clinicalSummary}
            </p>
          </div>

          {/* AI Radiologist Voice Synthesis Console */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Mic className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Spoken Radiology Briefing
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                {isSpeaking && (
                  <span className="flex space-x-0.5 items-end h-3 mr-1">
                    <span className="w-1 bg-cyan-400 h-2 animate-bounce rounded-full" />
                    <span className="w-1 bg-cyan-400 h-3 animate-bounce delay-100 rounded-full" />
                    <span className="w-1 bg-cyan-400 h-1.5 animate-bounce delay-200 rounded-full" />
                  </span>
                )}
                <button
                  onClick={isSpeaking ? handleStopVoice : handleReplayVoice}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-cyan-300 flex items-center space-x-1 transition-all"
                >
                  {isSpeaking ? (
                    <>
                      <Square className="w-3 h-3 text-red-400 fill-red-400" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                      <span>Play Voice</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 leading-relaxed font-sans italic">
              "{spokenTranscript || 'Select a patient scan above or click Upload MRI Scan to trigger automated clinical voice briefing.'}"
            </div>
          </div>

          {/* Neural Network Probability Distribution */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Softmax Class Probabilities</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">4-Class Head</span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {/* Glioma */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Glioma (Malignant Astrocytoma)</span>
                  <span className="font-bold text-red-400">
                    {selectedCase.probabilities.glioma}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${selectedCase.probabilities.glioma}%` }}
                  />
                </div>
              </div>

              {/* Meningioma */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Meningioma (Extra-Axial)</span>
                  <span className="font-bold text-amber-400">
                    {selectedCase.probabilities.meningioma}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${selectedCase.probabilities.meningioma}%` }}
                  />
                </div>
              </div>

              {/* Pituitary */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Pituitary Macroadenoma</span>
                  <span className="font-bold text-purple-400">
                    {selectedCase.probabilities.pituitary}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${selectedCase.probabilities.pituitary}%` }}
                  />
                </div>
              </div>

              {/* Healthy */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Healthy Control (Normal)</span>
                  <span className="font-bold text-emerald-400">
                    {selectedCase.probabilities.healthy}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${selectedCase.probabilities.healthy}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quantitative Tumor Biometrics */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 pb-2 border-b border-slate-800">
              <Info className="w-3.5 h-3.5 text-teal-400" />
              <span>Detected Portion Biometrics</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Cross-Section Area</span>
                <span className="text-base font-bold font-mono text-cyan-300">
                  {selectedCase.tumorAreaMm2 > 0 ? `${selectedCase.tumorAreaMm2} mm²` : "0.0 mm²"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Centroid Voxel</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {selectedCase.tumorCentroid.radius > 0
                    ? `[X:${selectedCase.tumorCentroid.x}, Y:${selectedCase.tumorCentroid.y}]`
                    : "None / N/A"}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-500 block uppercase">Anatomical Detected Portion</span>
              <span className="font-semibold text-slate-200">{selectedCase.brainRegion}</span>
            </div>
          </div>
        </aside>

        {/* Center & Right Column: PACS MRI Canvas & Advanced Visualisation Deck (8 cols) */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          {/* Dimension Selector Bar: 2D DICOM vs 3D Holographic Theater */}
          <div className="flex flex-wrap items-center justify-between p-2 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl gap-2">
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setDisplayDimension("2d")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  displayDimension === "2d"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2D DICOM & Grad-CAM Heatmaps</span>
              </button>

              <button
                onClick={() => setDisplayDimension("3d")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  displayDimension === "3d"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Box className="w-3.5 h-3.5 text-purple-300" />
                <span>3D Holographic Volumetric Viewer</span>
                <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700">Projector-Ready</span>
              </button>
            </div>

            <button
              onClick={() => {
                window.open("/projector", "NeuroscanProjector", "width=1280,height=720,menubar=no,toolbar=no");
              }}
              title="Pop out standalone 3D display for external projector screen"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-purple-300 border border-purple-800/60 text-xs font-mono transition-all"
            >
              <Monitor className="w-3.5 h-3.5 text-purple-400" />
              <span>Launch Projector Stage</span>
            </button>
          </div>

          {displayDimension === "2d" ? (
            <>
              {/* Main DICOM / MRI Canvas Viewer */}
              <div className="relative">
                <MRIViewer
                  currentCase={selectedCase}
                  gradCamOpacity={gradCamOpacity}
                  showContour={showContour}
                  showHeatmap={showHeatmap}
                  colorMap={colorMap}
                  visualizationMode={visMode}
                  splitPosition={splitPos}
                  onSplitChange={setSplitPos}
                />

                {/* Quick PACS HUD Status Overlay */}
                <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      selectedCase.severity === "danger"
                        ? "bg-red-500 animate-ping"
                        : selectedCase.severity === "warning"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-xs font-bold font-mono text-white uppercase">
                    {selectedCase.severity === "danger"
                      ? "MALIGNANT LESION DETECTED"
                      : selectedCase.severity === "warning"
                      ? "SUSPICIOUS MASS DETECTED"
                      : "NORMAL BRAIN PARENCHYMA"}
                  </span>
                </div>

                {/* Top Right Mode Badge */}
                <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-lg bg-black/80 text-[11px] font-mono text-cyan-300 border border-white/10 flex items-center space-x-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>
                    Mode:{" "}
                    {visMode === "fused"
                      ? "Fused Overlay"
                      : visMode === "difference"
                      ? "Subtraction Difference"
                      : visMode === "spotlight"
                      ? "Portion Spotlight"
                      : "Split-Screen Wiper"}
                  </span>
                </div>
              </div>

              {/* ADVANCED VISUALISATION CONTROLS & DIFFERENCE ENGINE */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl space-y-4">
                {/* Visualisation Mode Selector Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Advanced Difference & Localization Modes:
                    </h3>
                  </div>

                  {/* 4 Mode Buttons */}
                  <div className="flex flex-wrap rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
                    <button
                      onClick={() => setVisMode("fused")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                        visMode === "fused"
                          ? "bg-cyan-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>Fused Overlay</span>
                    </button>

                    <button
                      onClick={() => setVisMode("difference")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                        visMode === "difference"
                          ? "bg-emerald-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Difference Map</span>
                    </button>

                    <button
                      onClick={() => setVisMode("spotlight")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                        visMode === "spotlight"
                          ? "bg-amber-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Portion Spotlight</span>
                    </button>

                    <button
                      onClick={() => setVisMode("split")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                        visMode === "split"
                          ? "bg-purple-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <SplitSquareVertical className="w-3 h-3" />
                      <span>Interactive Split Wiper</span>
                    </button>
                  </div>
                </div>

                {/* Split Wiper Slider (Active when in split mode) */}
                {visMode === "split" && (
                  <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-purple-300 font-mono flex items-center space-x-1.5">
                        <SplitSquareVertical className="w-3.5 h-3.5 text-purple-400" />
                        <span>Split Wiper Position (Raw MRI vs Detection):</span>
                      </span>
                      <span className="font-mono font-bold text-white">
                        {Math.round(splitPos * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.95"
                      step="0.01"
                      value={splitPos}
                      onChange={(e) => setSplitPos(Number(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-purple-400/80 font-mono">
                      <span>← 100% Raw MRI</span>
                      <span>Drag Slider or Drag Directly on Image</span>
                      <span>100% AI Detection →</span>
                    </div>
                  </div>
                )}

                {/* Heatmap Opacity Slider (When in Fused Mode) */}
                {visMode === "fused" && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 flex items-center space-x-1.5">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Grad-CAM Neural Attention Opacity Blend:</span>
                      </span>
                      <span className="font-mono font-bold text-cyan-300">
                        {Math.round(gradCamOpacity * 100)}% Heatmap
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={gradCamOpacity}
                      onChange={(e) => setGradCamOpacity(Number(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0% (Raw T1-CE MRI)</span>
                      <span>50% (Fused Overlay)</span>
                      <span>100% (Pure Attention Map)</span>
                    </div>
                  </div>
                )}

                {/* Colormaps & Toggles */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={showContour}
                        onChange={(e) => setShowContour(e.target.checked)}
                        className="accent-red-500 rounded"
                      />
                      <span>Show Lesion Contour & Crosshairs</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={showHeatmap}
                        onChange={(e) => setShowHeatmap(e.target.checked)}
                        className="accent-cyan-500 rounded"
                      />
                      <span>Enable Grad-CAM Activation</span>
                    </label>
                  </div>

                  {/* Colormap Selectors */}
                  <div className="flex items-center space-x-1.5 font-mono">
                    <span className="text-slate-500 text-[11px] mr-1">Colormap:</span>
                    {(["jet", "hot", "plasma"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setColorMap(m)}
                        className={`px-2.5 py-1 rounded-md text-[11px] uppercase transition-all ${
                          colorMap === m
                            ? "bg-cyan-600 text-white font-bold"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mathematical Explainable AI Formulation Box */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl text-xs space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Grad-CAM Gradient Attribution & Difference Subtraction Formulation</span>
                </h3>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[10.5px] font-mono text-cyan-300">
                  L_Grad-CAM = ReLU( Σ_k α_k · A^k )  where  α_k = (1/Z) Σ_i Σ_j (∂y^c / ∂A_ij^k)
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Computes gradients of score $y^c$ for class $c$ with respect to feature activation maps $A^k$ of the Stage 5 deep residual convolutional block. Rectified linear activation (ReLU) filters negative attributions, isolating exclusively the pathological pixels that triggered the positive tumor diagnosis.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-900/50 overflow-hidden shadow-2xl bg-black">
                <Brain3DViewer currentCase={selectedCase} isProjectorStandalone={false} />
              </div>

              {/* 3D Volumetric Stage & Dual-Display Projector Guide */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                    <Monitor className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dual-Display Stage & Physical Projector Integration</span>
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    Live BroadcastChannel Sync
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                    <span className="text-purple-400 font-bold block">1. Connect Hardware</span>
                    <p className="text-slate-400 font-sans text-xs">
                      Connect Mac to external projector via USB-C to HDMI adapter. Set macOS to <strong>Extended Display</strong> mode.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                    <span className="text-cyan-400 font-bold block">2. Launch Theater</span>
                    <p className="text-slate-400 font-sans text-xs">
                      Click <strong>Launch Projector Stage</strong> to open <code className="text-cyan-300">/projector</code>. Drag that window to the projector screen and press <kbd className="bg-slate-800 px-1 rounded text-white">F</kbd> for fullscreen.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                    <span className="text-emerald-400 font-bold block">3. Live Present</span>
                    <p className="text-slate-400 font-sans text-xs">
                      Select cases on this laptop dashboard. The 3D hologram on the projector wall updates instantaneously with zero lag.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Regulatory & Institutional Footer */}
      <footer className="w-full border-t border-slate-900 bg-[#040812] py-4 px-6 text-center text-xs text-slate-500 space-y-1">
        <p className="font-mono text-[11px] text-amber-400/90 flex items-center justify-center space-x-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Research Use Only (RUO) • Not Certified as a Medical Device • Not for Primary Clinical Diagnosis</span>
        </p>
        <p className="text-[11px] text-slate-500">
          Developed by Dar Rehan Rasool &amp; Shafiya Pampori • Supervised by Dr. Syed Wajid Alam • Islamic University of Science &amp; Technology (IUST)
        </p>
      </footer>

      {/* Upload MRI Scan Modal */}
      <UploadMRIModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Official Radiology Report Modal */}
      {showReportModal && (
        <RadiologyReportModal
          mriCase={selectedCase}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
