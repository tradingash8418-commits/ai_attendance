'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, CheckCircle, RefreshCw, AlertCircle, Camera, Play, Upload, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { AttendanceSessionsService } from '@/services/attendanceSessions.service';
import { SeedService } from '@/services/seed.service';
import type { AttendanceSession } from '@/types/attendance';
import { compressImageFile } from '@/lib/image-compress';

interface RecognizedWorkerInfo {
  id: string;
  name: string;
  code: string;
}

interface AnalysisResultData {
  totalFacesDetected: number;
  recognizedCount: number;
  recognizedWorkers: RecognizedWorkerInfo[];
  diagnosticLogs?: string[];
  facesDetail?: {
    workerId: string | null;
    status: string;
    confidence: number;
    distance: number;
  }[];
}

export default function TestWhatsAppPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Manual Photo AI Recognition Tester State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzingFile, setAnalyzingFile] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultData | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const activeSessions = await AttendanceSessionsService.getAttendanceSessions();
      setSessions(activeSessions);
    } catch (err) {
      console.error('Error loading WhatsApp session logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    setNotice(null);
    try {
      const res = await SeedService.seedTestData();
      setNotice(
        `Seeded successfully! ${res.workersCreated} workers, ${res.sitesCreated} sites, ${res.embeddingsCreated} SFace embeddings.`
      );
      await loadLogs();
    } catch (err) {
      console.error('Error seeding test data:', err);
      setNotice('Failed to seed test data. Check console.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSimulatePhotoSubmit = async () => {
    setSimulating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/webhooks/simulate-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderNumber: '+918418082692' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice('Group photo processed! Workers recognized & WhatsApp report dispatched to +918418082692.');
      } else {
        setNotice(`Simulation notice: ${data.error || 'Check server logs'}`);
      }
      await loadLogs();
    } catch (err) {
      console.error('Error running simulation:', err);
      setNotice('Simulation error occurred.');
    } finally {
      setSimulating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysisResult(null);
      setLiveLogs([]);
    }
  };

  const handleManualAnalyzePhoto = async () => {
    if (!selectedFile) return;
    setAnalyzingFile(true);
    setAnalysisResult(null);
    
    const startTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLiveLogs([
      `[${startTime}] Starting AI Analysis for file: ${selectedFile.name}...`,
      `[${startTime}] Uploading image payload & calling /api/test-ai-upload...`
    ]);

    try {
      const compressed = await compressImageFile(selectedFile, 1280, 0.85);
      const formData = new FormData();
      formData.append('file', compressed);

      const res = await fetch('/api/test-ai-upload', {
        method: 'POST',
        body: formData,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.status === 413
            ? 'Image file too large for server.'
            : `Server returned HTTP ${res.status}`
        );
      }
      if (res.ok && data.success) {
        setAnalysisResult(data as AnalysisResultData);
        if (data.diagnosticLogs && Array.isArray(data.diagnosticLogs)) {
          setLiveLogs(data.diagnosticLogs);
        }
      } else {
        alert(`Analysis error: ${data.error || 'Failed to analyze image'}`);
        if (data.diagnosticLogs && Array.isArray(data.diagnosticLogs)) {
          setLiveLogs(data.diagnosticLogs);
        }
      }
    } catch (err: any) {
      console.error('Error in manual AI photo analysis:', err);
      alert('Error analyzing photo');
      const errTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      setLiveLogs((prev) => [...prev, `[${errTime}] ERROR: ${err?.message || 'Network exception'}`]);
    } finally {
      setAnalyzingFile(false);
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            WhatsApp Live Diagnostics
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900">WhatsApp Attendance Monitor</h1>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          <span>Dashboard</span>
        </Link>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{notice}</span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="razorpay-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Live Webhook Receiver & Test Engine</h2>
              <p className="text-xs text-slate-500 font-medium">Receives WhatsApp selfies & dispatches reports</p>
            </div>
          </div>

          <button
            onClick={loadLogs}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleSimulatePhotoSubmit}
            disabled={simulating}
            className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{simulating ? 'Processing SFace AI...' : 'Run WhatsApp Group Photo AI Test'}</span>
          </button>

          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-2 border border-slate-200 transition-all active:scale-98"
          >
            <span>{seeding ? 'Seeding...' : 'Seed SFace Embeddings'}</span>
          </button>
        </div>
      </div>

      {/* Direct Photo AI Recognition Tester */}
      <div className="razorpay-card p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Direct Photo AI Recognition Tester</h2>
            <p className="text-xs text-slate-500 font-medium">
              Upload any photo (WhatsApp selfie / street photo / building) to test AI face recognition output instantly
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* File Upload Box */}
          <div className="space-y-3">
            <label className="block p-5 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 hover:bg-blue-50 cursor-pointer text-center transition-all">
              <Upload className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <span className="text-xs font-extrabold text-blue-900 block">
                {selectedFile ? selectedFile.name : 'Select or Drop Any WhatsApp Image File'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block mt-1">Supports JPG, PNG, JPEG</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {previewUrl && (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-48 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Upload preview" className="max-h-48 w-auto object-contain" />
                </div>

                <button
                  onClick={handleManualAnalyzePhoto}
                  disabled={analyzingFile}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{analyzingFile ? 'YuNet AI Scanning Faces & Generating Logs...' : 'Analyze Photo with YuNet AI'}</span>
                </button>
              </div>
            )}
          </div>

          {/* AI Analysis Output Display */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 min-h-[220px]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2 flex items-center justify-between">
              <span>YuNet AI Output Analysis</span>
              {analyzingFile && (
                <span className="text-[10px] text-blue-600 flex items-center gap-1 font-bold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Processing...
                </span>
              )}
            </h3>

            {!analysisResult ? (
              <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                <p>Upload a photo on the left and click <strong className="text-blue-600">Analyze Photo with YuNet AI</strong> to execute real-time face detection & generate live diagnostic execution logs.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Detected Faces</span>
                    <span className="text-base font-extrabold text-slate-900">{analysisResult.totalFacesDetected}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Recognized Workers</span>
                    <span className="text-base font-extrabold text-emerald-600">{analysisResult.recognizedCount}</span>
                  </div>
                </div>

                {analysisResult.totalFacesDetected === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>0 Human Faces Detected</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      YuNet Deep Learning AI scanned this photo and found 0 human faces (Non-human / Street / Building image).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-800 block">Recognized Workers:</span>
                    {analysisResult.recognizedWorkers.length === 0 ? (
                      <span className="text-amber-600 font-semibold block">None matched within threshold</span>
                    ) : (
                      <div className="space-y-2">
                        {analysisResult.recognizedWorkers.map((w) => (
                          <div
                            key={w.id}
                            className="p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-emerald-600" />
                              <div>
                                <span className="font-bold text-slate-900">{w.name}</span>
                                <span className="text-[11px] text-slate-500 ml-1.5">({w.code})</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                              PRESENT
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {liveLogs.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                <div className="text-slate-400 font-bold border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                  <span>LIVE DIAGNOSTIC LOGS</span>
                  <span className="text-[10px] text-emerald-400 font-bold">READY</span>
                </div>
                {liveLogs.map((log, i) => (
                  <div key={i} className="leading-tight text-slate-300">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


      </div>

      {/* Session Logs Feed */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Received WhatsApp Attendance Sessions ({sessions.length})
        </h2>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Checking live session records...</div>
        ) : sessions.length === 0 ? (
          <div className="razorpay-card p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No sessions recorded yet today</p>
            <p className="text-xs text-slate-500">
              When a WhatsApp photo is received or simulated, it will appear here instantly with processing status.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="razorpay-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{s.siteId}</span>
                    <span className="text-[11px] text-slate-500">({s.date})</span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {s.status}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>Sender: {s.whatsappSenderNumber || 'WhatsApp Sender'}</span>
                  <span>Message ID: {s.whatsappMessageId || 'N/A'}</span>
                </div>

                {s.attendancePhotoUrl && (
                  <div className="pt-2 border-t border-slate-100">
                    <a
                      href={s.attendancePhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>View Saved Attendance Photo</span>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
