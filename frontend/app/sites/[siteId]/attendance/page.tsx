'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
} from 'lucide-react';
import { SitesService } from '@/services/sites.service';
import { AttendanceService } from '@/services/attendance.service';
import { SiteAssignmentsService } from '@/services/siteAssignments.service';
import { WorkersService } from '@/services/workers.service';
import { getWorkerDisplayName, getTodayDateString, formatTime } from '@/lib/formatters';
import type { Site } from '@/types/site';
import type { AttendanceRecord } from '@/types/attendance';
import type { Worker } from '@/types/worker';

export default function SiteAttendancePage() {
  const params = useParams();
  const siteId = params?.siteId as string;

  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'selected_date' | 'all_history'>('selected_date');

  const [site, setSite] = useState<Site | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<Worker[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSiteData = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const isAllHistory = viewMode === 'all_history';
      const dateParam = isAllHistory ? undefined : selectedDate;

      const [siteData, records, siteAssignments, workersList] = await Promise.all([
        SitesService.getSiteById(siteId),
        AttendanceService.getAttendanceRecords({ siteId, date: dateParam }),
        SiteAssignmentsService.getAssignmentsBySite(siteId, selectedDate || todayStr),
        WorkersService.getWorkers(),
      ]);

      setSite(siteData);
      setAttendanceRecords(records);
      setAllWorkers(workersList);

      const assignedWorkerList = workersList.filter((w) =>
        siteAssignments.some((a) => a.workerId === w.id)
      );
      setAssignedWorkers(assignedWorkerList);
    } catch (err) {
      console.error('Failed to load site attendance data:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId, selectedDate, viewMode, todayStr]);

  useEffect(() => {
    loadSiteData();
  }, [loadSiteData]);

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

  const getHajriBadgeStyle = (hajri: number | null | undefined) => {
    if (hajri === 1.0) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (hajri === 1.5) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (hajri === 2.0) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (hajri === 2.5) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (hajri === 3.0) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const totalHajriInView = attendanceRecords.reduce((sum, r) => {
    const h = typeof r.hajri === 'number' ? r.hajri : 1.0;
    return sum + h;
  }, 0);

  const uniquePresentCount = new Set(attendanceRecords.map((r) => r.workerId)).size;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/sites"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sites</span>
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {site ? site.name : 'Construction Site'} Logs
          </h1>
          {site?.address && <p className="text-xs text-slate-500 mt-0.5">{site.address}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSiteData}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Interactive Date Navigation Bar & History Toggle */}
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
            <span>Daily Site Log</span>
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
            <span>All Site History 📜</span>
          </button>
        </div>

        {/* Right: Date Navigation Controls */}
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
            <span>Viewing All Past & Present Records for this Site</span>
          </div>
        )}
      </div>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {viewMode === 'all_history' ? 'TOTAL SESSIONS RECORDED' : 'ASSIGNED WORKFORCE'}
          </span>
          <p className="text-2xl font-black text-slate-900">
            {viewMode === 'all_history' ? attendanceRecords.length : assignedWorkers.length}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            {viewMode === 'all_history' ? 'TOTAL UNIQUE WORKERS' : 'PRESENT ON DATE'}
          </span>
          <p className="text-2xl font-black text-emerald-600">{uniquePresentCount}</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            TOTAL HAJRI EARNED
          </span>
          <p className="text-2xl font-black text-blue-600">{totalHajriInView.toFixed(1)} Hajri</p>
        </div>
      </div>

      {/* 4. Attendance Records Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            {viewMode === 'all_history'
              ? `All Historical Logs for ${site?.name || 'Site'} (${attendanceRecords.length})`
              : `Worker Attendance Logs on ${selectedDate} (${attendanceRecords.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading site records...</div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              No attendance recorded on {viewMode === 'all_history' ? 'this site' : selectedDate}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Use the date picker at the top to check yesterday or previous dates, or click &quot;All Site History&quot;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  {viewMode === 'all_history' && <th className="py-3 px-6">Date</th>}
                  <th className="py-3 px-6">Worker</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Worked</th>
                  <th className="py-3 px-4">Hajri</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {attendanceRecords.map((r) => {
                  const workerObj = allWorkers.find(
                    (w) => w.id === r.workerId || w.workerCode === r.workerId
                  );

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {viewMode === 'all_history' && (
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-800">
                          {r.date}
                        </td>
                      )}
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900">
                          {workerObj ? getWorkerDisplayName(workerObj) : r.workerId}
                        </div>
                        {workerObj?.phone && (
                          <span className="text-[10px] text-slate-500 font-mono">{workerObj.phone}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatTime(r.checkInTime, '10:00 AM')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
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
                      <td className="py-3.5 px-6 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{r.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
