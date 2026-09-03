'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { SitesService } from '@/services/sites.service';
import { AttendanceService } from '@/services/attendance.service';
import { SiteAssignmentsService } from '@/services/siteAssignments.service';
import { WorkersService } from '@/services/workers.service';
import { getWorkerDisplayName, getTodayDateString } from '@/lib/formatters';
import type { Site } from '@/types/site';
import type { AttendanceRecord } from '@/types/attendance';
import type { Worker } from '@/types/worker';

export default function SiteAttendancePage() {
  const params = useParams();
  const siteId = params?.siteId as string;

  const [site, setSite] = useState<Site | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<Worker[]>([]);
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

      const siteAssignments = await SiteAssignmentsService.getAssignmentsBySite(siteId, today);
      const allWorkers = await WorkersService.getWorkers();

      const assignedWorkerList = allWorkers.filter((w) =>
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

  return (
    <div className="flex-1 max-w-md md:max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Site Attendance
          </span>
          <h1 className="text-2xl font-extrabold text-white">
            {site ? site.name : 'Site Attendance'}
          </h1>
        </div>

        <Link
          href="/sites"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sites</span>
        </Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
          Loading site attendance details...
        </div>
      ) : !site ? (
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
          Construction site not found.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Site Overview Banner */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">{site.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Date: {today}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Present</span>
              <span className="text-2xl font-black text-emerald-400">
                {attendanceRecords.filter((r) => r.status === 'present').length} / {assignedWorkers.length}
              </span>
            </div>
          </div>

          {/* Assigned Workers Status List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Assigned Workers Attendance Status ({assignedWorkers.length})
            </h3>

            {assignedWorkers.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                No workers currently assigned to this site.
              </div>
            ) : (
              <div className="space-y-2">
                {assignedWorkers.map((w) => {
                  const record = attendanceRecords.find((r) => r.workerId === w.id);
                  const isPresent = record?.status === 'present';

                  return (
                    <div
                      key={w.id}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        {/* Disambiguated Name Display */}
                        <span className="font-bold text-slate-200 block">
                          {getWorkerDisplayName(w)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {w.role || 'General Worker'}
                        </span>
                      </div>

                      <div>
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-500 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            Not Checked In
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
