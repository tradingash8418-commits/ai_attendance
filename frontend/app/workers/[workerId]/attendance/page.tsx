'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { WorkersService } from '@/services/workers.service';
import WorkerProfileDossierModal from '@/components/WorkerProfileDossierModal';
import type { Worker } from '@/types/worker';

export default function WorkerAttendancePage() {
  const params = useParams();
  const workerId = params?.workerId as string;

  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadWorker = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    try {
      const workerData = await WorkersService.getWorkerById(workerId);
      setWorker(workerData);
    } catch (err) {
      console.error('Failed to load worker profile:', err);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    loadWorker();
  }, [loadWorker]);

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/workers"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workers Directory</span>
        </Link>
      </div>

      {loading ? (
        <div className="py-24 text-center text-xs text-slate-500 animate-pulse">
          Loading worker 360° profile intelligence...
        </div>
      ) : !worker ? (
        <div className="razorpay-card p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-base font-extrabold text-slate-800">Worker record not found</p>
          <p className="text-xs text-slate-500">
            The requested worker profile could not be found or has been deleted.
          </p>
          <Link
            href="/workers"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow transition-all"
          >
            <span>Go to Workers Directory</span>
          </Link>
        </div>
      ) : (
        <WorkerProfileDossierModal
          worker={worker}
          isFullPage={true}
          onWorkerUpdated={loadWorker}
        />
      )}
    </div>
  );
}

