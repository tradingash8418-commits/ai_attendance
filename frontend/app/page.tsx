import React from 'react';
import Link from 'next/link';
import {
  HardHat,
  Activity,
  LayoutDashboard,
  Users,
  Building2,
  ArrowRight,
  CalendarCheck,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Container */}
      <div className="max-w-4xl w-full text-center space-y-8">
        {/* Status Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-dot"></span>
          <span>Stage 4 System Live: Meta WhatsApp Webhooks & SFace AI Ready</span>
        </div>

        {/* Hero Branding */}
        <div className="space-y-4">
          <div className="inline-flex justify-center p-5 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-600/30">
            <HardHat className="w-12 h-12" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900">
            Contractor <span className="text-blue-600">AI</span>
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-slate-600 tracking-wide">
            Construction Workforce OS & WhatsApp Attendance Engine
          </p>
        </div>

        {/* Project Subtext */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-500 leading-relaxed font-medium">
          Autonomous multi-site attendance platform powered by OpenCV YuNet Face Detection, SFace Deep Neural Networks, and continuous time-slab Hajri calculation.
        </p>

        {/* Direct Link to Mobile Owner Dashboard */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base shadow-xl shadow-blue-600/25 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Open Contractor Dashboard</span>
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/test-whatsapp"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-base shadow-sm transition-all hover:-translate-y-0.5"
          >
            <Activity className="w-5 h-5 text-blue-600" />
            <span>AI Diagnostics</span>
          </Link>
        </div>

        {/* Razorpay Recommended Pill Shortcuts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 text-left">
          <Link
            href="/dashboard"
            className="razorpay-card p-5 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Owner Dashboard</h3>
            <p className="text-xs text-slate-500 mt-1">Live today summary & site breakdown</p>
          </Link>

          <Link
            href="/attendance"
            className="razorpay-card p-5 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Attendance Log</h3>
            <p className="text-xs text-slate-500 mt-1">Time-slab Hajri breakdown (1.0 - 3.0)</p>
          </Link>

          <Link
            href="/workers"
            className="razorpay-card p-5 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Workers Registry</h3>
            <p className="text-xs text-slate-500 mt-1">1-Click SFace AI face photo enrollment</p>
          </Link>

          <Link
            href="/sites"
            className="razorpay-card p-5 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Sites & Projects</h3>
            <p className="text-xs text-slate-500 mt-1">Multi-site construction allocation</p>
          </Link>
        </div>

      </div>
    </div>
  );
}
