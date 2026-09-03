import React from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, ShieldCheck, Server, Key, Terminal } from 'lucide-react';
import { getFirebaseConfig, isFirebaseConfigured } from '@/config/firebase.config';
import { StatusCard } from '@/components/StatusCard';
import type { SystemStatus } from '@/types';

export default function StatusPage() {
  const config = getFirebaseConfig();
  const configured = isFirebaseConfigured();

  const status: SystemStatus = {
    frontendConnected: true,
    firebaseConfigured: configured || Boolean(config.apiKey),
    environmentLoaded: Boolean(config.apiKey),
    emulatorActive: config.useEmulator,
    environmentName: process.env.NODE_ENV || 'development',
  };

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            System Health & Diagnostics
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1">Status Dashboard</h1>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Landing Page</span>
        </Link>
      </div>

      {/* Grid of Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusCard
          title="Frontend Application"
          statusText={status.frontendConnected ? 'Connected' : 'Disconnected'}
          isOk={status.frontendConnected}
          description="Next.js App Router client engine initialized and responsive."
        />

        <StatusCard
          title="Firebase Configuration"
          statusText={status.environmentLoaded ? 'Loaded' : 'Missing Configuration'}
          isOk={status.environmentLoaded}
          description={
            status.environmentLoaded
              ? 'Environment variables detected safely (Secrets hidden).'
              : 'Please configure environment variables in .env.local'
          }
        />
      </div>

      {/* Configuration Details Panel (Non-sensitive) */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Environment Verification</h2>
            <p className="text-xs text-slate-400">
              Safe runtime check for client-side Firebase environment keys
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              API Key Config
            </div>
            <div className="font-semibold text-slate-200">
              {config.apiKey ? 'PRESENT (Masked)' : 'NOT FOUND'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Auth Domain
            </div>
            <div className="font-semibold text-slate-200">
              {config.authDomain ? 'PRESENT' : 'NOT FOUND'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Project ID
            </div>
            <div className="font-semibold text-slate-200">
              {config.projectId ? 'PRESENT' : 'NOT FOUND'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Storage Bucket
            </div>
            <div className="font-semibold text-slate-200">
              {config.storageBucket ? 'PRESENT' : 'NOT FOUND'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Emulator Mode
            </div>
            <div className="font-semibold text-amber-400">
              {status.emulatorActive ? 'ENABLED' : 'DISABLED'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Environment
            </div>
            <div className="font-semibold text-slate-200 uppercase">
              {status.environmentName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
