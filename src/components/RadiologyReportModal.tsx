"use client";

import React from "react";
import { MRICase } from "@/lib/mriData";
import { Printer, X, ShieldCheck, CheckCircle2, AlertOctagon, Download, FileText, Activity } from "lucide-react";

interface Props {
  mriCase: MRICase;
  onClose: () => void;
}

export const RadiologyReportModal: React.FC<Props> = ({ mriCase, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const isMalignant = mriCase.severity === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 sm:p-8">
        {/* Top Modal Controls */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-mono font-semibold tracking-wider text-cyan-300 uppercase">
              Machine Learning Diagnostic Evaluation &amp; Research Analysis Report
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center px-4 py-2 text-xs font-semibold text-slate-100 bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-md transition-colors"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print / Save Research Report (PDF)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Hospital Radiology Document */}
        <div
          id="printable-report"
          className="p-8 bg-white text-slate-900 rounded-xl shadow-lg font-sans text-xs leading-relaxed border border-slate-300"
        >
          {/* Document Header */}
          <div className="text-center pb-4 mb-6 border-b-2 border-slate-900">
            <div className="flex justify-between items-start mb-2">
              <div className="text-left">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Project Type</span>
                <span className="font-mono font-bold text-slate-800 text-xs">Academic ML Research Tool</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-wide uppercase text-slate-950 font-serif">
                  NEUROSCAN MACHINE LEARNING DIAGNOSTIC REPORT
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Academic Research &amp; Educational Evaluation Platform • Multi-Class Brain MRI Analysis
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Evaluation Date</span>
                <span className="font-mono font-bold text-slate-800 text-xs">17-Nov-2026</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-1 mt-1">
              Deep Learning Diagnostic Workstation • 3.0T Axial Cranial MRI Study • Ref: NEUROSCAN-RUO-EVAL-REPORT
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-cyan-800 font-mono bg-cyan-50 px-2.5 py-1 rounded border border-cyan-200">
              <span>Deep Learning Holdout Benchmark: 94.44% Accuracy (Cohen&apos;s κ = 0.9247)</span>
              <span>Zero Data Leakage Sealed Test Cohort (N=90)</span>
            </div>
          </div>

          {/* Patient Demographic Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-100 border border-slate-300 rounded-lg mb-6 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Patient Name</span>
              <span className="font-bold text-slate-900 text-sm">{mriCase.patientName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Medical Record # (MRN)</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{mriCase.mrn}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Age / Sex</span>
              <span className="font-semibold text-slate-900">{mriCase.age} Years • {mriCase.gender}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Pulse Protocol</span>
              <span className="font-semibold text-slate-900">{mriCase.scanType}</span>
            </div>
          </div>

          {/* Primary AI Classification Headline */}
          <div className={`mb-6 p-4 rounded-xl border-l-4 ${
            isMalignant
              ? "border-l-red-600 bg-red-50 border border-red-200"
              : mriCase.severity === "warning"
              ? "border-l-amber-600 bg-amber-50 border border-amber-200"
              : "border-l-emerald-600 bg-emerald-50 border border-emerald-200"
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                isMalignant ? "text-red-900" : mriCase.severity === "warning" ? "text-amber-900" : "text-emerald-900"
              }`}>
                {isMalignant ? <AlertOctagon className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                <span>AI Clinical Impression:</span>
              </span>
              <span className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded ${
                isMalignant ? "bg-red-200 text-red-950" : mriCase.severity === "warning" ? "bg-amber-200 text-amber-950" : "bg-emerald-200 text-emerald-950"
              }`}>
                Model Confidence: {mriCase.confidence}%
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-950 font-serif">
              {mriCase.diagnosis}
            </h2>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
              {mriCase.clinicalSummary}
            </p>
          </div>

          {/* Detailed Localization & Detected Portion Biometrics */}
          <div className="mb-6 p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 pb-2">
              <Activity className="w-3.5 h-3.5 text-cyan-600" />
              <span>Anatomical Localization & Detected Portion Biometrics</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Detected Portion</span>
                <span className="font-bold text-slate-900 text-xs">{mriCase.brainRegion}</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Centroid Coordinates</span>
                <span className="font-mono font-bold text-cyan-700 text-xs">
                  X: {mriCase.tumorCentroid.x}, Y: {mriCase.tumorCentroid.y}
                </span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Tumor Cross-Section</span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {mriCase.tumorAreaMm2 > 0 ? `${mriCase.tumorAreaMm2} mm²` : "0.0 mm²"}
                </span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Mass Effect Status</span>
                <span className="font-bold text-slate-900 text-xs">{mriCase.massEffect}</span>
              </div>
            </div>
          </div>

          {/* Differential Diagnosis Probabilities Table */}
          <div className="mb-6">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2">
              Deep Neural Network Differential Softmax Probability Spectrum
            </h3>
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold">
                  <th className="p-2 border border-slate-300">Pathological Classification</th>
                  <th className="p-2 border border-slate-300">WHO Grade / Type</th>
                  <th className="p-2 border border-slate-300 text-right">Probability</th>
                  <th className="p-2 border border-slate-300">Clinical Risk Level</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-slate-300 font-semibold">Glioma (Glioblastoma / Astrocytoma)</td>
                  <td className="p-2 border border-slate-300 text-slate-600">WHO Grade II - IV Intra-Axial</td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold text-red-600">
                    {mriCase.probabilities.glioma}%
                  </td>
                  <td className="p-2 border border-slate-300 text-red-700 font-bold">CRITICAL MALIGNANT</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 font-semibold">Meningioma (Convexity / Dural)</td>
                  <td className="p-2 border border-slate-300 text-slate-600">WHO Grade I - II Extra-Axial</td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold text-amber-600">
                    {mriCase.probabilities.meningioma}%
                  </td>
                  <td className="p-2 border border-slate-300 text-amber-700 font-bold">HIGH (SURGICAL CANDIDATE)</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 font-semibold">Pituitary Adenoma</td>
                  <td className="p-2 border border-slate-300 text-slate-600">Sellar / Suprasellar Neoplasm</td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold text-purple-600">
                    {mriCase.probabilities.pituitary}%
                  </td>
                  <td className="p-2 border border-slate-300 text-purple-700 font-bold">MODERATE (ENDOCRINE FOLLOWUP)</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 font-semibold">Healthy Control</td>
                  <td className="p-2 border border-slate-300 text-slate-600">Normal Neuroanatomy</td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold text-emerald-600">
                    {mriCase.probabilities.healthy}%
                  </td>
                  <td className="p-2 border border-slate-300 text-emerald-700 font-bold">NEGATIVE / BENIGN</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Radiologist Notes & Surgical Recommendations */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg">
              <span className="font-bold text-slate-800 text-[11px] block uppercase mb-1">
                Radiologist Technical Impression:
              </span>
              <p className="text-slate-700 text-xs leading-relaxed">
                {mriCase.radiologistNotes}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg">
              <span className="font-bold text-slate-800 text-[11px] block uppercase mb-1">
                Recommended Neurosurgical Plan:
              </span>
              <p className="text-slate-700 text-xs leading-relaxed">
                {mriCase.classification === "Glioma"
                  ? "Urgent multidisciplinary neuro-oncology board review, stereotactic image-guided craniotomy planning, and baseline spectroscopy."
                  : mriCase.classification === "Meningioma"
                  ? "Surgical resection consultation (Simpson Grade I/II goal) and contrast MR venography to evaluate venous sinus patency."
                  : mriCase.classification === "Pituitary"
                  ? "Humphrey 30-2 visual field perimetry, complete anterior pituitary hormone panel, and transsphenoidal surgical evaluation."
                  : "No operative intervention indicated. Routine clinical follow-up as symptomatic indication dictates."}
              </p>
            </div>
          </div>

          {/* Statutory Medical & Legal Regulatory Disclaimer */}
          <div className="mb-5 p-3 rounded-lg bg-amber-50/80 border border-amber-300 text-[10px] text-amber-950 leading-relaxed">
            <span className="font-bold uppercase tracking-wider block mb-0.5 text-amber-900">
              ⚠️ Academic Research Demonstration Notice (Research Use Only - RUO)
            </span>
            This automated radiology report was compiled by an academic deep convolutional neural network for machine learning research demonstration and engineering evaluation only. It is <strong>NOT</strong> an approved Software as a Medical Device (SaMD) and has not been cleared by FDA/EMA/CDSCO. It must <strong>NOT</strong> be used for primary medical diagnosis, patient care, surgical intervention, or therapeutic decision-making. All clinical determinations must be made by licensed neuroradiologists and medical professionals.
          </div>

          {/* Academic Research Attribution & Algorithmic Verification Block (No clinical signature) */}
          <div className="pt-4 border-t-2 border-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-end text-xs gap-4">
            <div>
              <p className="font-bold text-slate-900 text-xs">Research Project: NeuroScan-AI Multi-Class Diagnostic Engine</p>
              <p className="text-slate-600 text-[11px]">
                Supervised by <strong>Dr. Syed Wajid Alam*</strong> (Department of Artificial Intelligence, IUST)
              </p>
              <p className="text-slate-500 text-[10px]">
                Student Researchers: Dar Rehan Rasool, Shafiya Bashir Pampori &amp; Muneeb Syed Shah
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] text-slate-600 space-y-0.5">
              <div className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold text-slate-800">
                STATUS: RESEARCH USE ONLY (RUO)
              </div>
              <p className="text-slate-500">Automated PyTorch CNN &amp; Grad-CAM XAI Verification</p>
              <p className="text-slate-400">Non-Clinical Educational Evaluation • No Physician Signature Required</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
