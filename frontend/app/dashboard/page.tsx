'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  CalendarCheck,
  RefreshCw,
  Activity,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Briefcase,
  UserCheck,
  IndianRupee,
  ClipboardList,
  Megaphone,
} from 'lucide-react';
import { AttendanceService, type TodayDashboardSummary } from '@/services/attendance.service';
import { AttendanceSessionsService } from '@/services/attendanceSessions.service';
import { getTodayDateString } from '@/lib/formatters';
import type { AttendanceSession } from '@/types/attendance';

export default function DashboardPage() {
  const [summary, setSummary] = useState<TodayDashboardSummary | null>(null);
  const [recentSessions, setRecentSessions] = useState<AttendanceSession[]>([]);

  const [loading, setLoading] = useState<boolean>(true);

  const today = getTodayDateString();

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumData, sessionsData] = await Promise.all([
        AttendanceService.getTodayDashboardSummary(today),
        AttendanceSessionsService.getAttendanceSessions(today),
      ]);
      setSummary(sumData);
      setRecentSessions(sessionsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);



  const recommendedPills = [
    { label: 'Home', href: '/dashboard', icon: Briefcase, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { label: 'Attendance', href: '/attendance', icon: CalendarCheck, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { label: 'Khata / Ledger', href: '/payments', icon: IndianRupee, color: 'bg-violet-50 text-violet-600 border-violet-200' },
    { label: 'Tasks 📋', href: '/tasks', icon: ClipboardList, color: 'bg-teal-50 text-teal-600 border-teal-200' },
    { label: 'Broadcast 📢', href: '/broadcast', icon: Megaphone, color: 'bg-rose-50 text-rose-600 border-rose-200' },
    { label: 'Workers', href: '/workers', icon: Users, color: 'bg-sky-50 text-sky-600 border-sky-200' },
    { label: 'Sites', href: '/sites', icon: Building2, color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { label: 'Supervisors', href: '/supervisors', icon: UserCheck, color: 'bg-purple-50 text-purple-600 border-purple-200' },
    { label: 'AI Diagnostics', href: '/test-whatsapp', icon: Activity, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  ];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Recommended For You Pill Bar (Razorpay Signature Style) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Recommended for you</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{today}</span>
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm transition-all"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {recommendedPills.map((pill) => {
            const Icon = pill.icon;
            return (
              <Link
                key={pill.label}
                href={pill.href}
                className="razorpay-card p-3.5 flex flex-col items-center justify-center text-center group cursor-pointer hover:-translate-y-0.5"
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2 shadow-sm ${pill.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {pill.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 2. Connected Flow Chart Card (Razorpay "Your business with Razorpay" Style) */}
      <div className="razorpay-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Your workforce with Contractor AI</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time attendance & time-slab Hajri balance pipeline</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700">
              Today: {today}
            </span>
          </div>
        </div>

        {/* Connected Flow Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2">
          {/* Box 1: Attendance Today */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>WORKERS PRESENT</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">
              {summary?.presentCount ?? 0} <span className="text-sm font-semibold text-slate-500">/ {summary?.expectedCount ?? 0}</span>
            </div>
            <div className="text-xs text-slate-600 font-medium flex items-center gap-2 pt-1 border-t border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Online Attendance: {summary?.percentage ?? 0}% Rate</span>
            </div>
          </div>

          {/* SVG Connector Flow Arrow */}
          <div className="relative p-5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2 text-center">
            <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              ACTIVE HAJRI BALANCE
            </div>
            <div className="text-3xl font-extrabold text-blue-900">
              {summary?.totalHajriToday ? `${summary.totalHajriToday} Hajri` : '0.0 Hajri'}
            </div>
            <p className="text-xs text-blue-700 font-medium">
              {summary?.totalHajriToday ? "Calculated from Today's Checkouts" : 'Shift Inactive (Asia/Kolkata IST)'}
            </p>
          </div>

          {/* Box 3: WhatsApp Automation */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>WHATSAPP REPORTS</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">
              {recentSessions.length > 0 ? `${recentSessions.length}` : '0'}{' '}
              <span className="text-sm font-semibold text-emerald-600">Dispatched</span>
            </div>
            <div className="text-xs text-slate-600 font-medium flex items-center gap-2 pt-1 border-t border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero-cost YuNet + SFace AI engine</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Payment Insights / Metric Cards (Razorpay Signature 3-Col Layout) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900">Workforce Insights</h2>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Metric 1 */}
          <div className="razorpay-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Workers Present Today
              </span>
              <div className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{summary?.percentage ?? 0}% Attendance Rate</span>
              </div>
            </div>

            <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {summary?.presentCount ?? 0}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="razorpay-badge-ai">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>INSIGHT BY SFACE AI</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">Verified by YuNet</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="razorpay-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                AI Recognition Accuracy
              </span>
              <div className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{summary?.aiRecognitionAccuracy ?? 100}% Verified</span>
              </div>
            </div>

            <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {summary?.aiRecognitionAccuracy ?? 100}%
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="razorpay-badge-ai">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>INSIGHT BY YUNET AI</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">128-d Cosine Vector</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="razorpay-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Sites & Projects
              </span>
              <div className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>{summary?.siteSummaries.length ?? 0} Sites Active</span>
              </div>
            </div>

            <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {summary?.siteSummaries.length ?? 0}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="razorpay-badge-ai">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>INSIGHT BY FIRESTORE</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">Multi-tenant Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live WhatsApp Submissions Table & Active Sites */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Left 2-Cols: Recent WhatsApp Submissions */}


        {/* Right 1-Col: Active Sites Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>Active Sites ({summary?.siteSummaries.length ?? 0})</span>
            </h2>
            <Link href="/sites" className="text-xs font-bold text-blue-600 hover:text-blue-700">
              Manage
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading sites...</div>
          ) : summary?.siteSummaries.length === 0 ? (
            <div className="razorpay-card p-6 text-center text-xs text-slate-500">
              No active sites found. Click &quot;Seed Test Data&quot; to initialize.
            </div>
          ) : (
            <div className="space-y-2.5">
              {summary?.siteSummaries.map((site) => (
                <Link
                  key={site.siteId}
                  href={`/sites/${site.siteId}/attendance`}
                  className="razorpay-card p-4 flex items-center justify-between gap-3 hover:-translate-y-0.5"
                >
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{site.siteName}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {site.presentCount} / {site.expectedCount} workers present • {site.totalHajri} Hajri
                    </p>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700">
                    {site.expectedCount > 0
                      ? `${Math.round((site.presentCount / site.expectedCount) * 100)}%`
                      : '0%'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
