'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';
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

  const [site, setSite] = useState<Site | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<Worker[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const today = getTodayDateString();

  const loadSiteData = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const siteData = await SitesService.getSiteById(siteId);
      setSite(siteData);

      const records = await AttendanceService.getAttendanceRecords({ siteId, date: today });
      setAttendanceRecords(records);

      const [siteAssignments, workersList] = await Promise.all([
        SiteAssignmentsService.getAssignmentsBySite(siteId, today),
        WorkersService.getWorkers(),
      ]);

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
  }, [siteId, today]);

  useEffect(() => {
    loadSiteData();
  }, [loadSiteData]);

  const getHajriBadgeStyle = (hajri: number | null | undefined) => {
    if (hajri === 1.0) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (hajri === 1.5) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (hajri === 2.0) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (hajri === 2.5) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (hajri === 3.0) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header - Razorpay Style */}
      <div className="flex items-center justify-between">
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

        <div className="text-right">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Work Date
          </span>
          <span className="text-sm font-extrabold text-slate-800 font-mono">{today}</span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Assigned Workforce
          </span>
          <p className="text-2xl font-black text-slate-900">{assignedWorkers.length}</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            Present Today
          </span>
          <p className="text-2xl font-black text-emerald-600">{attendanceRecords.length}</p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Attendance Rate
          </span>
          <p className="text-2xl font-black text-slate-900">
            {assignedWorkers.length > 0
              ? `${Math.round((attendanceRecords.length / assignedWorkers.length) * 100)}%`
              : '100%'}
          </p>
        </div>
      </div>

      {/* Attendance Records Table - Razorpay White Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Today&apos;s Worker Attendance Logs ({attendanceRecords.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading site records...</div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No attendance recorded today</p>
            <p className="text-xs text-slate-500">
              Attendance will appear as workers scan the gate QR or supervisor sends group photo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
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
                      <td className="py-3.5 px-6 font-bold text-slate-900">
                        {workerObj ? getWorkerDisplayName(workerObj) : 'Worker Record'}
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
