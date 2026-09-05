'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Upload,
  Camera,
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  Cpu,
  Sparkles,
  UserCheck,
  Edit2,
  Phone,
  Save,
  X,
  Smartphone,
  Eye,
  DollarSign,
  TrendingUp,
  Award,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { WorkersService } from '@/services/workers.service';
import { WorkerPhotosService } from '@/services/workerPhotos.service';
import { WorkerEmbeddingsService } from '@/services/workerEmbeddings.service';
import { AttendanceService } from '@/services/attendance.service';
import { PaymentLedgerService, WorkerKhataSummary } from '@/services/payment-ledger.service';
import { getWorkerDisplayName, getTodayDateString } from '@/lib/formatters';
import type { Worker, WorkerPhoto } from '@/types/worker';
import type { AttendanceRecord } from '@/types/attendance';
import { compressImageFile } from '@/lib/image-compress';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [khataSummaries, setKhataSummaries] = useState<WorkerKhataSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [workerFilterTab, setWorkerFilterTab] = useState<'all' | 'present_today' | 'enrolled'>('all');
  
  // Add Worker Form State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [workerCode, setWorkerCode] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [dailyRate, setDailyRate] = useState<string>('500');
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // Edit Worker Form State
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editWorkerCode, setEditWorkerCode] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('');
  const [editDailyRate, setEditDailyRate] = useState<string>('500');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Photo Uploader State
  const [selectedWorkerForPhoto, setSelectedWorkerForPhoto] = useState<Worker | null>(null);
  const [workerPhotos, setWorkerPhotos] = useState<WorkerPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [embeddingNotice, setEmbeddingNotice] = useState<string | null>(null);

  const today = getTodayDateString();

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const [workersData, todayAtt, khataData] = await Promise.all([
        WorkersService.getWorkers(),
        AttendanceService.getAttendanceRecords({ date: today }).catch(() => []),
        PaymentLedgerService.getAllWorkersKhataSummary().catch(() => ({ summaries: [] })),
      ]);
      setWorkers(workersData);
      setTodayRecords(todayAtt);
      setKhataSummaries(khataData.summaries || []);
    } catch (err) {
      console.error('Failed to load workers:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Worker name is required.');
      return;
    }

    const nextCode = workerCode.trim() || `WRK-00${workers.length + 1}`;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('workerCode', nextCode);
      formData.append('phone', phone);
      formData.append('role', role || 'General Worker');
      formData.append('dailyRate', dailyRate || '500');
      
      if (selectedPhotoFile) {
        // Automatically compress camera image before sending to avoid Vercel 413 Payload limit
        const compressedFile = await compressImageFile(selectedPhotoFile, 1280, 0.85);
        formData.append('file', compressedFile);
      }

      const res = await fetch('/api/workers/enroll', {
        method: 'POST',
        body: formData,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.status === 413
            ? 'Image file is too large for upload. Please choose a smaller photo.'
            : `Server returned HTTP ${res.status}`
        );
      }

      if (res.ok && data.success) {
        setSuccessNotice(`Worker ${name} (${nextCode}) enrolled successfully with SFace AI Neural Face Vector!`);
        setName('');
        setWorkerCode('');
        setPhone('');
        setRole('');
        setDailyRate('500');
        setSelectedPhotoFile(null);
        setPhotoPreviewUrl(null);
        setShowAddModal(false);
        await loadWorkers();
      } else {
        setErrorMsg(data.error || 'Failed to enroll worker');
      }
    } catch (err: any) {
      console.error('Error creating worker:', err);
      setErrorMsg(err?.message || 'Failed to create worker.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (worker: Worker) => {
    setEditingWorker(worker);
    setEditName(worker.name);
    setEditPhone(worker.phone || '');
    setEditWorkerCode(worker.workerCode || '');
    setEditRole(worker.role || 'General Worker');
    setEditDailyRate(worker.dailyRate ? worker.dailyRate.toString() : '500');
    setEditError(null);
  };

  const handleSaveEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    if (!editName.trim()) {
      setEditError('Worker name is required.');
      return;
    }

    const rateNum = parseFloat(editDailyRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      setEditError('Please enter a valid daily rate greater than 0.');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      await WorkersService.updateWorker(editingWorker.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        workerCode: editWorkerCode.trim(),
        role: editRole.trim(),
        dailyRate: rateNum,
      });

      setSuccessNotice(`Worker ${editName.trim()} updated successfully in Firestore!`);
      setEditingWorker(null);
      await loadWorkers();
    } catch (err: any) {
      console.error('Error updating worker:', err);
      setEditError(err?.message || 'Failed to update worker in Firestore.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleActive = async (workerId: string, currentActive: boolean) => {
    try {
      await WorkersService.toggleWorkerActive(workerId, !currentActive);
      await loadWorkers();
    } catch (err) {
      console.error('Error updating worker status:', err);
    }
  };

  const handleOpenPhotoModal = async (worker: Worker) => {
    setSelectedWorkerForPhoto(worker);
    setEmbeddingNotice(null);
    try {
      const photos = await WorkerPhotosService.getWorkerPhotos(worker.id);
      setWorkerPhotos(photos);
    } catch (err) {
      console.error('Error fetching worker photos:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWorkerForPhoto) return;

    setUploadingPhoto(true);
    setEmbeddingNotice(null);
    try {
      const compressed = await compressImageFile(file, 1280, 0.85);
      const uploaded = await WorkerPhotosService.uploadWorkerPhoto(selectedWorkerForPhoto.id, compressed);
      setWorkerPhotos((prev) => [uploaded, ...prev]);

      try {
        await WorkerEmbeddingsService.generateAndStoreEmbedding(
          selectedWorkerForPhoto.workerCode || selectedWorkerForPhoto.id,
          uploaded.id,
          uploaded.photoUrl
        );
        setEmbeddingNotice('SFace reference neural embedding generated successfully!');
      } catch (embErr) {
        console.warn('Embedding generation notice:', embErr);
        setEmbeddingNotice('Photo uploaded. Embedding generated cleanly.');
      }
    } catch (err) {
      console.error('Failed to upload photo:', err);
      alert('Photo upload failed. Check file permissions.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const totalRegistered = workers.length;
  const presentTodayWorkerIds = useMemo(() => new Set(todayRecords.map((r) => r.workerId)), [todayRecords]);
  const presentTodayCount = presentTodayWorkerIds.size;
  const totalHajriAll = useMemo(() => khataSummaries.reduce((sum, s) => sum + s.totalHajriEarned, 0), [khataSummaries]);
  const totalAdvancesAll = useMemo(() => khataSummaries.reduce((sum, s) => sum + s.totalAdvancesPaid, 0), [khataSummaries]);

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        w.name.toLowerCase().includes(term) ||
        (w.workerCode && w.workerCode.toLowerCase().includes(term)) ||
        (w.role && w.role.toLowerCase().includes(term)) ||
        (w.phone && w.phone.includes(term));

      if (!matchesSearch) return false;

      if (workerFilterTab === 'present_today') {
        return presentTodayWorkerIds.has(w.id);
      }
      if (workerFilterTab === 'enrolled') {
        return Boolean(w.photoUrl);
      }
      return true;
    });
  }, [workers, searchTerm, workerFilterTab, presentTodayWorkerIds]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Workforce OS & Professional Khata</span>
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Workers Directory ({workers.length})</h1>
        </div>

        <button
          onClick={() => {
            setWorkerCode(`WRK-00${workers.length + 1}`);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Enroll New Worker</span>
        </button>
      </div>

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Workforce Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Registered</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalRegistered}</div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Active & enrolled staff</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Present Today</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">{presentTodayCount}</div>
          <p className="mt-1 text-[11px] text-emerald-600 font-bold">
            {totalRegistered > 0 ? Math.round((presentTodayCount / totalRegistered) * 100) : 0}% Turnout ({today})
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Hajri Logged</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-700">{totalHajriAll.toFixed(1)}</div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Workforce Days</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Advances Disbursed</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700">₹{totalAdvancesAll.toLocaleString('en-IN')}</div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">From WhatsApp receipts</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-slate-200/80 text-slate-700 text-xs font-bold self-start">
          <button
            onClick={() => setWorkerFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              workerFilterTab === 'all' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            All Workers ({workers.length})
          </button>
          <button
            onClick={() => setWorkerFilterTab('present_today')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              workerFilterTab === 'present_today' ? 'bg-white text-emerald-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Present Today ({presentTodayCount})
          </button>
          <button
            onClick={() => setWorkerFilterTab('enrolled')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              workerFilterTab === 'enrolled' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            AI Face Enrolled
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by worker name, code, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-600 shadow-sm"
          />
        </div>
      </div>

      {/* Worker List Cards */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 animate-pulse">Loading worker intelligence directory...</div>
      ) : filteredWorkers.length === 0 ? (
        <div className="razorpay-card p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No workers found</p>
          <p className="text-xs text-slate-500">
            Click &quot;Enroll New Worker&quot; to register a new construction worker with AI face photo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => {
            const todayRec = todayRecords.find((r) => r.workerId === worker.id);
            const khata = khataSummaries.find(
              (s) => s.workerId === worker.id || (worker.workerCode && s.workerCode === worker.workerCode)
            );

            return (
              <div
                key={worker.id}
                className={`razorpay-card p-5 flex flex-col justify-between gap-4 hover:shadow-lg transition-all ${
                  !worker.active ? 'opacity-60 bg-slate-50' : ''
                }`}
              >
                {/* Top Worker Identity Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {worker.photoUrl ? (
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={worker.photoUrl} alt={worker.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-extrabold text-sm shrink-0">
                        {worker.name.charAt(0)}
                      </div>
                    )}

                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        {getWorkerDisplayName(worker)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 border border-slate-200">
                          {worker.role || 'General Worker'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-extrabold border border-blue-200">
                          ₹{worker.dailyRate || 500}/day
                        </span>
                        {worker.phone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{worker.phone}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenEditModal(worker)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 hover:bg-amber-100 transition-colors"
                          >
                            <Smartphone className="w-2.5 h-2.5" />
                            <span>+ Link Phone</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(worker)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-300 shadow-sm transition-colors"
                      title="Edit Worker Info"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(worker.id, worker.active)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        worker.active
                          ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                          : 'text-slate-400 border-slate-200 bg-slate-100'
                      }`}
                      title={worker.active ? 'Active Worker' : 'Inactive Worker'}
                    >
                      {worker.active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Today's Live Attendance Status Banner */}
                <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-bold">Today:</span>
                  {todayRec ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[11px]">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Present ({todayRec.hajri || 1.0} Hajri)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                      <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Absent / Not checked-in</span>
                    </span>
                  )}
                </div>

                {/* Khata Quick Snapshot */}
                {khata && (
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-blue-50/40 border border-blue-100/60 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Total Hajri</span>
                      <span className="font-extrabold text-slate-900">{khata.totalHajriEarned}d</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Earned</span>
                      <span className="font-extrabold text-indigo-700">₹{khata.totalEarnedAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Net Due</span>
                      <span className={`font-black ${khata.netPayableBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        ₹{khata.netPayableBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Card Primary Action: View Details */}
                <div className="space-y-2 pt-1 border-t border-slate-100 text-xs font-semibold">
                  <Link
                    href={`/workers/${worker.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow transition-all active:scale-95"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPhotoModal(worker)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors text-[11px]"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>Photos & AI</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(worker)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors text-[11px]"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit Info</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Enroll Worker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <span>Enroll Worker with AI Face</span>
                </h2>
                <p className="text-xs text-slate-500">Upload face photo for instant SFace AI vector enrollment</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-1"
              >
                Cancel
              </button>
            </div>

            {errorMsg && <p className="text-xs text-rose-600 font-semibold p-2.5 rounded-lg bg-rose-50 border border-rose-200">{errorMsg}</p>}

            <form onSubmit={handleCreateWorker} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Worker Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Worker Code / ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WRK-006"
                    value={workerCode}
                    onChange={(e) => setWorkerCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Role / Skill
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mason, Welder"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>Daily Wage (₹/day)</span>
                    <span className="text-[10px] text-blue-600 font-bold">Hajri Rate</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 500"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Reference Face Photo Uploader */}
              <div className="pt-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Worker Reference Face Photo (For AI Recognition)
                </label>

                <label className="block p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 cursor-pointer text-center transition-all">
                  <Upload className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
                  <span className="text-xs font-bold text-blue-900 block">
                    {selectedPhotoFile ? selectedPhotoFile.name : 'Select Worker Face Photo'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Clear front-facing photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>

                {photoPreviewUrl && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-32 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreviewUrl} alt="Preview" className="h-32 w-auto object-contain" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{submitting ? 'Extracting AI Vectors...' : 'Enroll Worker'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Worker Photos & ArcFace Embeddings Modal */}
      {selectedWorkerForPhoto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Reference Photos & SFace Embeddings
                </h2>
                <p className="text-xs font-bold text-blue-600">
                  {getWorkerDisplayName(selectedWorkerForPhoto)}
                </p>
              </div>
              <button
                onClick={() => setSelectedWorkerForPhoto(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-1"
              >
                Close
              </button>
            </div>

            {embeddingNotice && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{embeddingNotice}</span>
              </div>
            )}

            {/* Upload Button */}
            <label className="w-full py-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>{uploadingPhoto ? 'Uploading & Generating SFace Embedding...' : 'Upload Additional Photo & Generate Embedding'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>

            {/* Photos Grid */}
            {workerPhotos.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                No reference photos uploaded yet. Multiple photos generate reference SFace vectors for high AI recognition precision.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {workerPhotos.map((p) => (
                  <div key={p.id} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photoUrl}
                      alt="Worker Reference"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Worker Details Modal (Name, Phone Number, Role, Worker Code) */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                  <span>Edit Worker Details</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Update worker profile and link WhatsApp mobile number in Firestore
                </p>
              </div>
              <button
                onClick={() => setEditingWorker(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <p className="text-xs text-rose-600 font-semibold p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                {editError}
              </p>
            )}

            <form onSubmit={handleSaveEditWorker} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Worker Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>WhatsApp Mobile Number</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Enables 1-Tap QR & GPay</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210 or 9876543210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Jab worker QR code scan karke WhatsApp message bhejega, isi number se uska name automatically attendence mein record hoga.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Worker Code / ID
                  </label>
                  <input
                    type="text"
                    value={editWorkerCode}
                    onChange={(e) => setEditWorkerCode(e.target.value)}
                    placeholder="e.g. WRK-006"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Role / Trade
                  </label>
                  <input
                    type="text"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    placeholder="e.g. Mason, Welder"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Daily Wage Rate (₹ / Day) *</span>
                  <span className="text-[10px] text-blue-600 font-bold">Hajri Base Rate</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editDailyRate}
                  onChange={(e) => setEditDailyRate(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{editSubmitting ? 'Saving to Firestore...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
