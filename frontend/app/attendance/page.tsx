'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { AttendanceService } from '@/services/attendance.service';
import { AttendanceSessionsService } from '@/services/attendanceSessions.service';
import { SitesService } from '@/services/sites.service';
import { WorkersService } from '@/services/workers.service';
import { getWorkerDisplayName, getTodayDateString, formatTime } from '@/lib/formatters';
import type { AttendanceSession, AttendanceRecord } from '@/types/attendance';
import type { Site } from '@/types/site';
import type { Worker } from '@/types/worker';

export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Manual Attendance Record Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [submittingRecord, setSubmittingRecord] = useState<boolean>(false);

  const today = getTodayDateString();

  const loadAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsData, recordsData, sitesData, workersData] = await Promise.all([
        AttendanceSessionsService.getAttendanceSessions(today),
        AttendanceService.getAttendanceRecords({ date: today }),
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
  }, [today]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

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
          status: 'completed',
        });
      }

      await AttendanceService.recordWorkerAttendance({
        attendanceSessionId: sessionId,
        workerId: selectedWorkerId,
        siteId: selectedSiteId,
        date: today,
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

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Daily Attendance Logs
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900">Attendance Today ({records.length})</h1>
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Entry</span>
        </button>
      </div>

      {/* Attendance Sessions Overview Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Active WhatsApp Sessions ({sessions.length})
        </h2>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading attendance sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="razorpay-card p-6 text-center text-xs text-slate-500">
            No WhatsApp attendance sessions received today. Send a photo on WhatsApp to initiate a session.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((session) => {
              const site = sites.find((s) => s.id === session.siteId);
              return (
                <div
                  key={session.id}
                  className="razorpay-card p-4 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h3 className="font-bold text-slate-900">{site ? site.name : 'Unknown Site'}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Date: {session.date} • Sender: {session.whatsappSenderNumber || 'Supervisor'}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full font-bold text-[10px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {session.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendance Records Table */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Verified Workers Attendance Sheet ({records.length})
        </h2>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading attendance records...</div>
        ) : records.length === 0 ? (
          <div className="razorpay-card p-8 text-center text-xs text-slate-500">
            No attendance records created today yet. Click &quot;Manual Entry&quot; to log attendance.
          </div>
        ) : (
          <div className="razorpay-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Worker</th>
                    <th className="py-3.5 px-4">Site</th>
                    <th className="py-3.5 px-4">Check-In</th>
                    <th className="py-3.5 px-4">Check-Out</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Hajri Value</th>
                    <th className="py-3.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => {
                    const worker = workers.find(
                      (w) => w.id === r.workerId || w.workerCode === r.workerId
                    );
                    const site = sites.find((s) => s.id === r.siteId);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {worker ? getWorkerDisplayName(worker) : 'Worker Record'}
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
                          {r.workedHours || '0h 00m'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-md font-extrabold text-[11px] border ${getHajriBadgeStyle(
                              r.hajri
                            )}`}
                          >
                            {r.hajri !== undefined && r.hajri !== null ? `${r.hajri} (${r.hajriLabel || 'Normal'})` : '1.0 (Normal)'}
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

            <form onSubmit={handleManualRecordSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Construction Site *
                </label>
                <select
                  required
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
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
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Worker *
                </label>
                <select
                  required
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecord}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-extrabold text-xs shadow-md"
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
