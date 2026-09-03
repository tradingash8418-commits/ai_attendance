'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { WorkersService } from '@/services/workers.service';
import { AttendanceService } from '@/services/attendance.service';
import { getWorkerDisplayName } from '@/lib/formatters';
import type { Worker } from '@/types/worker';
import type { AttendanceRecord } from '@/types/attendance';

export default function WorkerAttendancePage() {
  const params = useParams();
  const workerId = params?.workerId as string;

  const [worker, setWorker] = useState<Worker | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadWorkerAttendanceData = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    try {
      const workerData = await WorkersService.getWorkerById(workerId);
      setWorker(workerData);

      const workerRecords = await AttendanceService.getAttendanceRecords({ workerId });
      setRecords(workerRecords);
    } catch (err) {
      console.error('Failed to load worker attendance history:', err);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    loadWorkerAttendanceData();
  }, [loadWorkerAttendanceData]);

  return (
    <div className="flex-1 max-w-md md:max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
            Attendance History
          </span>
          <h1 className="text-2xl font-extrabold text-white">
            {worker ? getWorkerDisplayName(worker) : 'Worker Attendance'}
          </h1>
        </div>

        <Link
          href="/workers"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workers</span>
        </Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
          Loading worker history...
        </div>
      ) : !worker ? (
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
          Worker record not found.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Worker Info Card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">
                  {getWorkerDisplayName(worker)}
                </h2>
                <p className="text-xs text-slate-400">
                  {worker.role || 'General Worker'} • Status:{' '}
                  <span className={worker.active ? 'text-emerald-400' : 'text-slate-500'}>
                    {worker.active ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Days</span>
              <span className="text-lg font-black text-slate-200">{records.length}</span>
            </div>
          </div>

          {/* Attendance History Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Recorded Attendance Sessions
            </h3>

            {records.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                No historical attendance records logged for this worker.
              </div>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-200 block">{r.date}</span>
                        <span className="text-[10px] text-slate-400">
                          Method: {r.method === 'face_recognition' ? 'AI Face Match' : 'Manual Review'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          r.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
