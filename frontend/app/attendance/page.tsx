'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  Users,
  RefreshCw,
  Sparkles,
  History,
  CheckCircle2,
} from 'lucide-react';
import { AttendanceService } from '@/services/attendance.service';
import { AttendanceSessionsService } from '@/services/attendanceSessions.service';
import { SitesService } from '@/services/sites.service';
import { WorkersService } from '@/services/workers.service';
import { getWorkerDisplayName, getTodayDateString, formatTime } from '@/lib/formatters';
import type { AttendanceSession, AttendanceRecord } from '@/types/attendance';
import type { Site } from '@/types/site';
import type { Worker } from '@/types/worker';

export default function AttendancePage() {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'selected_date' | 'all_history'>('selected_date');

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [siteFilter, setSiteFilter] = useState<string>('all');

  // Manual Attendance Record Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualDate, setManualDate] = useState<string>(todayStr);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [submittingRecord, setSubmittingRecord] = useState<boolean>(false);

  const loadAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      const isAllHistory = viewMode === 'all_history';
      const dateParam = isAllHistory ? undefined : selectedDate;

      const [sessionsData, recordsData, sitesData, workersData] = await Promise.all([
        AttendanceSessionsService.getAttendanceSessions(dateParam || 'all'),
        AttendanceService.getAttendanceRecords(dateParam ? { date: dateParam } : undefined),
        SitesService.getSites(),
        WorkersService.getWorkers(),
      ]);

      setSessions(sessionsData);
      setRecords(recordsData);
      setSites(sitesData);
      setWorkers(workersData);
    } catch (err) {
      console.error('Failed to load attendance data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Date Navigation Helpers
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setViewMode('selected_date');
  };

  const handleManualRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteId || !selectedWorkerId) return;
    setSubmittingRecord(true);

    try {
      let sessionId = sessions.find((s) => s.siteId === selectedSiteId)?.id;
      if (!sessionId) {
        const siteObj = sites.find((s) => s.id === selectedSiteId);
        sessionId = await AttendanceSessionsService.createAttendanceSession({
          siteId: selectedSiteId,
          supervisorId: siteObj?.supervisorId || 'manual_owner',
          date: manualDate,
          status: 'completed',
        });
      }

      await AttendanceService.recordWorkerAttendance({
        attendanceSessionId: sessionId,
        workerId: selectedWorkerId,
        siteId: selectedSiteId,
        date: manualDate,
        attendancePhotoUrl: '',
        submittedBy: 'Owner Dashboard Manual Review',
      });

      setShowManualModal(false);
      setSelectedWorkerId('');
      await loadAttendanceData();
    } catch (err) {
      console.error('Error creating manual attendance record:', err);
    } finally {
      setSubmittingRecord(false);
    }
  };

  const getHajriBadgeStyle = (hajri: number | null | undefined) => {
    if (hajri === 1.0) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (hajri === 1.5) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (hajri === 2.0) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (hajri === 2.5) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (hajri === 3.0) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  // Filtered records based on search & site filter
  const filteredRecords = records.filter((r) => {
    const worker = workers.find((w) => w.id === r.workerId || w.workerCode === r.workerId);
    const workerName = worker ? worker.name.toLowerCase() : '';
    const workerCode = worker?.workerCode ? worker.workerCode.toLowerCase() : '';
    const q = searchTerm.toLowerCase();

    const matchesSearch = !searchTerm || workerName.includes(q) || workerCode.includes(q) || r.workerId.toLowerCase().includes(q);
    const matchesSite = siteFilter === 'all' || r.siteId === siteFilter;
    return matchesSearch && matchesSite;
  });

  const totalHajriInView = filteredRecords.reduce((sum, r) => {
    const h = typeof r.hajri === 'number' ? r.hajri : 1.0;
    return sum + h;
  }, 0);

  const uniqueWorkersCount = new Set(filteredRecords.map((r) => r.workerId)).size;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daily Attendance & Hajri Logs</h1>
            <span className="razorpay-badge-ai">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>LIVE SYNC</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time multi-site workforce check-ins, time-slab Hajri calculation, and historical attendance audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAttendanceData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm transition-all"
            title="Refresh Attendance Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setManualDate(selectedDate || todayStr);
              setShowManualModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Entry</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Date Navigation Bar & History Toggle (Razorpay Signature Style) */}
      <div className="razorpay-card p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Left: View Mode Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setViewMode('selected_date')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              viewMode === 'selected_date'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Single Day Log</span>
          </button>

          <button
            onClick={() => setViewMode('all_history')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              viewMode === 'all_history'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-amber-600" />
            <span>All Historical Logs 📜</span>
          </button>
        </div>

        {/* Right: Date Picker Controls (Active in Single Day Mode) */}
        {viewMode === 'selected_date' ? (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-sm"
            />

            <button
              onClick={() => handleShiftDate(1)}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors"
              >
                Today
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200">
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
            <span>Viewing All Past & Present Attendance Logs</span>
          </div>
        )}
      </div>

      {/* 3. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="razorpay-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>TOTAL HAJRI UNITS</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {totalHajriInView.toFixed(1)} <span className="text-sm font-bold text-slate-400">Hajri</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {viewMode === 'all_history' ? 'Across all recorded dates' : `Calculated for ${selectedDate}`}
          </p>
        </div>

        <div className="razorpay-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>UNIQUE WORKERS PRESENT</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight">
            {uniqueWorkersCount} <span className="text-sm font-bold text-slate-400">Workers</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Total active workforce: {workers.length}
          </p>
        </div>

        <div className="razorpay-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>CHECK-IN RECORDS</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-600 tracking-tight">
            {filteredRecords.length} <span className="text-sm font-bold text-slate-400">Entries</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {sessions.length} WhatsApp sessions processed
          </p>
        </div>
      </div>

      {/* 4. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by worker name or code..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">Filter Site:</span>
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none shadow-sm"
          >
            <option value="all">All Sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Attendance Records Table */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading attendance records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="razorpay-card p-12 text-center space-y-3">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              No attendance records found for {viewMode === 'all_history' ? 'the selected filter' : selectedDate}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Use the date picker at the top to switch to another date (e.g. yesterday), click &quot;All Historical Logs&quot;, or click &quot;Manual Entry&quot; to log attendance.
            </p>
          </div>
        ) : (
          <div className="razorpay-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    {viewMode === 'all_history' && <th className="py-3 px-4">Date</th>}
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Site</th>
                    <th className="py-3 px-4">Check-In</th>
                    <th className="py-3 px-4">Check-Out</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Hajri Value</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r) => {
                    const worker = workers.find(
                      (w) => w.id === r.workerId || w.workerCode === r.workerId
                    );
                    const site = sites.find((s) => s.id === r.siteId);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        {viewMode === 'all_history' && (
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                            {r.date}
                          </td>
                        )}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {worker ? getWorkerDisplayName(worker) : r.workerId}
                          </div>
                          {worker?.phone && (
                            <span className="text-[10px] text-slate-500 font-mono">{worker.phone}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {site ? site.name : 'Unknown Site'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {formatTime(r.checkInTime, '10:00 AM')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {formatTime(r.checkOutTime, '-')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-semibold">
                          {r.workedHours || 'In Progress'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-md font-extrabold text-[11px] border ${getHajriBadgeStyle(
                              r.hajri
                            )}`}
                          >
                            {r.hajri !== undefined && r.hajri !== null
                              ? `${r.hajri} (${r.hajriLabel || 'Normal'})`
                              : '1.0 (Normal)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-200">
            <h2 className="text-lg font-extrabold text-slate-900">Manual Attendance Record</h2>

            <form onSubmit={handleManualRecordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Attendance Date *
                </label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Construction Site *
                </label>
                <select
                  required
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Choose Site --</option>
                  {sites
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Worker *
                </label>
                <select
                  required
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Choose Worker --</option>
                  {workers
                    .filter((w) => w.active)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {getWorkerDisplayName(w)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecord}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md shadow-blue-600/20 transition-all"
                >
                  {submittingRecord ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
