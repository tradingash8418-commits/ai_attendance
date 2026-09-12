'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Phone,
  Calendar,
  DollarSign,
  Building2,
  Receipt,
  Camera,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownLeft,
  Filter,
  Download,
  Printer,
  Sparkles,
  ExternalLink,
  Plus,
  ShieldCheck,
  X,
  CreditCard,
  Award,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { AttendanceService } from '@/services/attendance.service';
import { PaymentLedgerService } from '@/services/payment-ledger.service';
import { SitesService } from '@/services/sites.service';
import { WorkerPhotosService } from '@/services/workerPhotos.service';
import { getWorkerDisplayName, getTodayDateString, formatTime } from '@/lib/formatters';
import type { Worker, WorkerPhoto } from '@/types/worker';
import type { AttendanceRecord } from '@/types/attendance';
import type { PaymentLedgerEntry } from '@/types/payment';
import type { Site } from '@/types/site';

interface WorkerProfileDossierModalProps {
  worker: Worker;
  onClose?: () => void;
  onWorkerUpdated?: () => void;
  isFullPage?: boolean;
}

export default function WorkerProfileDossierModal({
  worker,
  onClose,
  onWorkerUpdated,
  isFullPage = false,
}: WorkerProfileDossierModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'attendance' | 'photos'>('overview');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_week'>('all');
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentLedgerEntry[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [photos, setPhotos] = useState<WorkerPhoto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quick Advance Modal State inside profile
  const [showAddPaymentModal, setShowAddPaymentModal] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payCategory, setPayCategory] = useState<'advance' | 'wage' | 'kharcha'>('advance');
  const [payMethod, setPayMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'cash' | 'bank_transfer'>('gpay');
  const [payNotes, setPayNotes] = useState<string>('');
  const [paySubmitting, setPaySubmitting] = useState<boolean>(false);

  // Image zoom modal
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  const today = getTodayDateString();

  // Interactive Month Calendar State for Attendance History Tab
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    const todayParts = getTodayDateString().split('-');
    return parseInt(todayParts[0] || '2026', 10) || new Date().getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    const todayParts = getTodayDateString().split('-');
    return (parseInt(todayParts[1] || '9', 10) || (new Date().getMonth() + 1)) - 1; // 0-indexed
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleGoToCurrentMonth = () => {
    const todayParts = getTodayDateString().split('-');
    setCalendarYear(parseInt(todayParts[0] || '2026', 10) || new Date().getFullYear());
    setCalendarMonth((parseInt(todayParts[1] || '9', 10) || (new Date().getMonth() + 1)) - 1);
    setSelectedCalendarDate(null);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allAttendance, allPayments, allSites, workerPhotos] = await Promise.all([
        AttendanceService.getAttendanceRecords({ workerId: worker.id }),
        PaymentLedgerService.getPayments(),
        SitesService.getSites(),
        WorkerPhotosService.getWorkerPhotos(worker.id).catch(() => []),
      ]);

      // Filter payments strictly matching this worker (by workerId or workerCode or exact name)
      const workerNameClean = (worker.name || '').trim().toLowerCase();
      const workerPayments = allPayments.filter((p) => {
        if (p.workerId && p.workerId === worker.id) return true;
        if (worker.workerCode && p.workerCode && p.workerCode === worker.workerCode) return true;
        if (p.workerName && p.workerName.trim().toLowerCase() === workerNameClean) return true;
        if (p.paidTo && p.paidTo.trim().toLowerCase() === workerNameClean) return true;
        return false;
      });

      setAttendanceRecords(allAttendance);
      setPayments(workerPayments);
      setSites(allSites);
      setPhotos(workerPhotos);
    } catch (err) {
      console.error('Failed to load worker dossier details:', err);
    } finally {
      setLoading(false);
    }
  }, [worker]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map of siteId -> Site Name
  const siteMap = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sites]);

  // Today's Attendance Status
  const todayRecord = useMemo(() => {
    return attendanceRecords.find((r) => r.date === today);
  }, [attendanceRecords, today]);

  // Filter records by period
  const filteredAttendance = useMemo(() => {
    if (periodFilter === 'all') return attendanceRecords;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    if (periodFilter === 'this_month') {
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      return attendanceRecords.filter((r) => r.date.startsWith(monthPrefix));
    }

    if (periodFilter === 'last_month') {
      const prevDate = new Date(currentYear, currentMonth - 1, 1);
      const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      return attendanceRecords.filter((r) => r.date.startsWith(prevMonthPrefix));
    }

    if (periodFilter === 'this_week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const cutoffStr = oneWeekAgo.toISOString().split('T')[0] || '';
      return attendanceRecords.filter((r) => r.date >= cutoffStr);
    }

    return attendanceRecords;
  }, [attendanceRecords, periodFilter]);

  const filteredPayments = useMemo(() => {
    if (periodFilter === 'all') return payments;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (periodFilter === 'this_month') {
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      return payments.filter((p) => (p.paymentDate || '').startsWith(monthPrefix));
    }

    if (periodFilter === 'last_month') {
      const prevDate = new Date(currentYear, currentMonth - 1, 1);
      const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      return payments.filter((p) => (p.paymentDate || '').startsWith(prevMonthPrefix));
    }

    if (periodFilter === 'this_week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const cutoffStr = oneWeekAgo.toISOString().split('T')[0] || '';
      return payments.filter((p) => (p.paymentDate || '') >= cutoffStr);
    }

    return payments;
  }, [payments, periodFilter]);

  // Calculated Metrics
  const dailyRate = typeof worker.dailyRate === 'number' && worker.dailyRate >= 0 ? worker.dailyRate : 0;

  const totalHajri = useMemo(() => {
    return filteredAttendance.reduce((sum, r) => sum + (typeof r.hajri === 'number' ? r.hajri : 0), 0);
  }, [filteredAttendance]);

  const fullDaysCount = useMemo(() => {
    return filteredAttendance.filter((r) => (typeof r.hajri === 'number' ? r.hajri : 0) === 1.0).length;
  }, [filteredAttendance]);

  const halfDaysCount = useMemo(() => {
    return filteredAttendance.filter((r) => (typeof r.hajri === 'number' ? r.hajri : 0) === 0.5).length;
  }, [filteredAttendance]);

  const overtimeCount = useMemo(() => {
    return filteredAttendance.filter((r) => (typeof r.hajri === 'number' ? r.hajri : 0) > 1.0).length;
  }, [filteredAttendance]);

  const grossEarnings = Math.round(totalHajri * dailyRate);

  const totalAdvancesPaid = useMemo(() => {
    return filteredPayments
      .filter((p) => p.category === 'advance' || p.category === 'kharcha')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  const totalWagesPaid = useMemo(() => {
    return filteredPayments
      .filter((p) => p.category === 'wage')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  const totalPaidAll = totalAdvancesPaid + totalWagesPaid;
  const netPayableBalance = grossEarnings - totalPaidAll;

  // Site-wise breakdown
  const siteBreakdown = useMemo(() => {
    const siteHajriMap: Record<string, number> = {};
    filteredAttendance.forEach((r) => {
      const sId = r.siteId || 'unassigned';
      const hajriVal = typeof r.hajri === 'number' ? r.hajri : 0;
      siteHajriMap[sId] = (siteHajriMap[sId] || 0) + hajriVal;
    });

    return Object.entries(siteHajriMap).map(([sId, hajriCount]) => {
      const siteName = siteMap.get(sId) || (sId === 'unassigned' ? 'Headquarters / General Site' : `Site #${sId.slice(0, 6)}`);
      const siteEarnings = Math.round(hajriCount * dailyRate);
      const pct = totalHajri > 0 ? Math.round((hajriCount / totalHajri) * 100) : 0;
      return {
        siteId: sId,
        siteName,
        hajriCount: Number(hajriCount.toFixed(1)),
        siteEarnings,
        pct,
      };
    }).sort((a, b) => b.hajriCount - a.hajriCount);
  }, [filteredAttendance, siteMap, dailyRate, totalHajri]);

  // Computed Month Name for Attendance Calendar
  const monthName = useMemo(() => {
    const d = new Date(calendarYear, calendarMonth, 1);
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }, [calendarYear, calendarMonth]);

  // Calendar days grid computation
  const calendarDays = useMemo(() => {
    const totalDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sun, 1 = Mon, ...
    
    // Map of dateStr -> AttendanceRecord[]
    const attendanceMap = new Map<string, AttendanceRecord[]>();
    attendanceRecords.forEach((r) => {
      if (!r.date) return;
      if (!attendanceMap.has(r.date)) {
        attendanceMap.set(r.date, []);
      }
      attendanceMap.get(r.date)!.push(r);
    });

    const days = [];

    // Empty cells before first day
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNumber: null,
        dateStr: '',
        records: [] as AttendanceRecord[],
        isPresent: false,
        totalHajri: 0,
        isToday: false,
        isFuture: false,
      });
    }

    const todayStr = getTodayDateString();

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const records = attendanceMap.get(dateStr) || [];
      const isPresent = records.length > 0;
      const totalHajri = records.reduce((sum, r) => sum + (typeof r.hajri === 'number' ? r.hajri : 0), 0);
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      days.push({
        dayNumber: d,
        dateStr,
        records,
        isPresent,
        totalHajri: Number(totalHajri.toFixed(1)),
        isToday,
        isFuture,
      });
    }

    return days;
  }, [calendarYear, calendarMonth, attendanceRecords]);

  // Total present days and hajri in active calendar month
  const calendarMonthStats = useMemo(() => {
    const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const monthRecords = attendanceRecords.filter((r) => r.date && r.date.startsWith(monthPrefix));
    const uniqueDays = new Set(monthRecords.map((r) => r.date)).size;
    const totalHajri = monthRecords.reduce((sum, r) => sum + (typeof r.hajri === 'number' ? r.hajri : 0), 0);
    const totalEarnings = Math.round(totalHajri * dailyRate);
    return { uniqueDays, totalHajri: Number(totalHajri.toFixed(1)), totalEarnings };
  }, [calendarYear, calendarMonth, attendanceRecords, dailyRate]);

  // Selected date record details (if user clicks on a date in the calendar)
  const selectedDateDetails = useMemo(() => {
    if (!selectedCalendarDate) return null;
    const records = attendanceRecords.filter((r) => r.date === selectedCalendarDate);
    const isPresent = records.length > 0;
    const totalHajri = records.reduce((sum, r) => sum + (typeof r.hajri === 'number' ? r.hajri : 0), 0);
    const dayEarnings = Math.round(totalHajri * dailyRate);
    return {
      date: selectedCalendarDate,
      records,
      isPresent,
      totalHajri: Number(totalHajri.toFixed(1)),
      dayEarnings,
    };
  }, [selectedCalendarDate, attendanceRecords, dailyRate]);

  // Displayed attendance logs (filtered if date clicked, or all month logs if matching)
  const displayedAttendance = useMemo(() => {
    if (selectedCalendarDate) {
      return attendanceRecords.filter((r) => r.date === selectedCalendarDate);
    }
    return filteredAttendance;
  }, [selectedCalendarDate, attendanceRecords, filteredAttendance]);

  // Handle Record Advance / Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return;

    setPaySubmitting(true);
    try {
      await PaymentLedgerService.recordPayment({
        paidTo: worker.name,
        workerId: worker.id,
        workerName: worker.name,
        workerCode: worker.workerCode,
        workerPhone: worker.phone,
        amount: amt,
        category: payCategory,
        paymentMethod: payMethod,
        paymentDate: today,
        paymentTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        notes: payNotes || `Manual Entry via Worker Profile: ${payCategory}`,
        recordedBy: 'Admin (Worker 360° Profile)',
      });

      setPayAmount('');
      setPayNotes('');
      setShowAddPaymentModal(false);
      await loadData();
      if (onWorkerUpdated) onWorkerUpdated();
    } catch (err) {
      console.error('Failed to record advance:', err);
      alert('Failed to record advance payment. Please try again.');
    } finally {
      setPaySubmitting(false);
    }
  };

  // 1-Click Print Worker Statement
  const handlePrintStatement = () => {
    window.print();
  };

  // 1-Click Download Worker Complete Hisab & Khata Statement as CSV / Excel
  const handleDownloadCsv = () => {
    const periodLabel = periodFilter === 'all'
      ? 'All_Time'
      : periodFilter === 'this_month'
      ? 'This_Month'
      : periodFilter === 'last_month'
      ? 'Last_Month'
      : 'This_Week';

    const safeWorkerName = (worker.name || 'Worker').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeWorkerName}_Hisab_Ledger_${periodLabel}_${getTodayDateString()}.csv`;

    const lines: string[] = [];

    // 1. Worker Header Dossier
    lines.push(`"WORKER HISAB & KHATA STATEMENT"`);
    lines.push(`"Worker Name","${(worker.name || '').replace(/"/g, '""')}"`);
    lines.push(`"Worker Code","${(worker.workerCode || 'N/A').replace(/"/g, '""')}"`);
    lines.push(`"Phone","${(worker.phone || 'N/A').replace(/"/g, '""')}"`);
    lines.push(`"Role","${(worker.role || 'General Worker').replace(/"/g, '""')}"`);
    lines.push(`"Daily Wage Rate","₹${dailyRate}/day"`);
    lines.push(`"Statement Period","${periodFilter.toUpperCase()}"`);
    lines.push(`"Generated On","${new Date().toLocaleString('en-IN')}"`);
    lines.push(``);

    // 2. Financial Summary KPI
    lines.push(`"FINANCIAL SUMMARY"`);
    lines.push(`"Total Hajri Units","${totalHajri.toFixed(1)} Hajri"`);
    lines.push(`"Total Gross Wages Earned","₹${grossEarnings}"`);
    lines.push(`"Total Advances / Payments Received","₹${totalPaidAll}"`);
    lines.push(`"Net Balance (Payable / Due)","₹${netPayableBalance}"`);
    lines.push(`"Status","${netPayableBalance > 0 ? 'Payment Due' : netPayableBalance === 0 ? 'Settled' : 'Advance Excess'}"`);
    lines.push(``);

    // 3. Site-Wise Hajri Distribution
    lines.push(`"SITE-WISE HAJRI BREAKDOWN"`);
    lines.push(`"Site Name","Hajri Count","Earnings (₹)","% of Total"`);
    siteBreakdown.forEach((s) => {
      lines.push(`"${s.siteName.replace(/"/g, '""')}","${s.hajriCount} Hajri","₹${s.siteEarnings}","${s.pct}%"`);
    });
    lines.push(``);

    // 4. Detailed Attendance & Hajri Logs
    lines.push(`"DAILY ATTENDANCE & HAJRI LOGS"`);
    lines.push(`"Date","Site","Check-In","Check-Out","Worked Hours","Hajri","Daily Earnings (₹)","Status"`);
    filteredAttendance
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .forEach((r) => {
        const sName = siteMap.get(r.siteId) || 'Site';
        const hVal = typeof r.hajri === 'number' ? r.hajri : 0;
        const dayEarn = Math.round(hVal * dailyRate);
        const inTime = formatTime(r.checkInTime, '10:00 AM');
        const outTime = formatTime(r.checkOutTime, '-');
        lines.push(
          `"${r.date}","${sName.replace(/"/g, '""')}","${inTime}","${outTime}","${r.workedHours || '-'}","${hVal} Hajri","₹${dayEarn}","${r.status || 'present'}"`
        );
      });
    lines.push(``);

    // 5. Payment & Advance Ledger History
    lines.push(`"PAYMENTS & ADVANCES HISTORY"`);
    lines.push(`"Date","Time","Category","Payment Method","Amount (₹)","UPI / Payee Details","Notes / Purpose","Recorded By"`);
    filteredPayments
      .slice()
      .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
      .forEach((p) => {
        lines.push(
          `"${p.paymentDate}","${p.paymentTime || '-'}","${(p.category || 'advance').toUpperCase()}","${(p.paymentMethod || 'gpay').toUpperCase()}","${p.amount}","${(p.upiId || p.paidTo || '').replace(/"/g, '""')}","${(p.notes || '').replace(/"/g, '""')}","${(p.recordedBy || 'Admin').replace(/"/g, '""')}"`
        );
      });

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={isFullPage ? 'w-full' : 'fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto'}>
      <div className={isFullPage ? 'w-full space-y-6' : 'max-w-5xl w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col'}>
        
        {/* =====================================================================
            1. HEADER BANNER & WORKER IDENTITY
            ===================================================================== */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-5 sm:p-7 relative shrink-0">
          {!isFullPage && onClose && (
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close Profile"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Photo / Avatar */}
              <div className="relative">
                {worker.photoUrl ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-blue-400/50 shadow-xl bg-slate-800 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={worker.photoUrl} alt={worker.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white font-black text-2xl shadow-xl shrink-0 border-2 border-white/20">
                    {worker.name.charAt(0)}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-slate-900 ${worker.active ? 'bg-emerald-500' : 'bg-slate-500'}`} title={worker.active ? 'Active Worker' : 'Inactive'} />
              </div>

              {/* Identity Details */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {getWorkerDisplayName(worker)}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-400/30">
                    {worker.workerCode || `#WRK-${worker.id.slice(0, 4)}`}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
                    ₹{dailyRate}/day
                  </span>
                </div>

                <p className="text-xs text-slate-300 font-medium flex flex-wrap items-center gap-3">
                  <span>{worker.role || 'General Construction Worker'}</span>
                  {worker.phone && (
                    <span className="inline-flex items-center gap-1 text-emerald-300 font-mono">
                      <Phone className="w-3 h-3" />
                      <span>{worker.phone}</span>
                    </span>
                  )}
                </p>

                {/* Live Present Day Attendance Status */}
                <div className="pt-1.5 flex items-center gap-2">
                  {todayRecord ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-extrabold animate-pulse">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Present Today at {siteMap.get(todayRecord.siteId) || 'Site'} ({typeof todayRecord.hajri === 'number' ? todayRecord.hajri : 0} Hajri)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/40 text-[11px] font-bold">
                      <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Not Checked-in Today ({today})</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                onClick={() => setShowAddPaymentModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Give Advance / Payment</span>
              </button>
              
              <button
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-extrabold border border-emerald-400/40 transition-all shadow-sm active:scale-95"
                title="Download Complete Hisab / Khata Ledger in Excel CSV format"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
                <span>Download Excel (CSV)</span>
              </button>

              <button
                onClick={handlePrintStatement}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition-colors"
                title="Print Worker Khata Statement"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print Slip</span>
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================================
            2. PERIOD FILTER & FINANCIAL KPI METRICS
            ===================================================================== */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Khata & Hajri Period:</span>
            </span>

            {/* Period Filter Buttons */}
            <div className="inline-flex p-1 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold">
              <button
                onClick={() => setPeriodFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'hover:text-slate-900'}`}
              >
                All Time
              </button>
              <button
                onClick={() => setPeriodFilter('this_month')}
                className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'this_month' ? 'bg-white text-blue-700 shadow-sm' : 'hover:text-slate-900'}`}
              >
                This Month
              </button>
              <button
                onClick={() => setPeriodFilter('last_month')}
                className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'last_month' ? 'bg-white text-blue-700 shadow-sm' : 'hover:text-slate-900'}`}
              >
                Last Month
              </button>
              <button
                onClick={() => setPeriodFilter('this_week')}
                className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'this_week' ? 'bg-white text-blue-700 shadow-sm' : 'hover:text-slate-900'}`}
              >
                This Week
              </button>
            </div>
          </div>

          {/* 4 Core Financial Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Hajri */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Total Hajri Days</span>
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{totalHajri.toFixed(1)}</span>
                <span className="text-xs font-bold text-slate-500">Hajri</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                {fullDaysCount} Full • {halfDaysCount} Half • {overtimeCount} OT
              </p>
            </div>

            {/* Gross Earnings */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Total Salary Earned</span>
                <Award className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-indigo-700">₹{grossEarnings.toLocaleString('en-IN')}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                Rate: ₹{dailyRate}/day
              </p>
            </div>

            {/* Total Advances & Wages Paid */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Total Paid (Advance)</span>
                <ArrowDownLeft className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-700">₹{totalPaidAll.toLocaleString('en-IN')}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                {filteredPayments.length} Payment Receipts
              </p>
            </div>

            {/* Net Balance Payable */}
            <div className={`p-4 rounded-2xl border shadow-sm ${
              netPayableBalance > 0
                ? 'bg-emerald-50/70 border-emerald-200'
                : netPayableBalance < 0
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-slate-100 border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className={netPayableBalance > 0 ? 'text-emerald-800' : netPayableBalance < 0 ? 'text-rose-800' : 'text-slate-700'}>
                  Net Balance Due
                </span>
                <DollarSign className={`w-4 h-4 ${netPayableBalance > 0 ? 'text-emerald-600' : netPayableBalance < 0 ? 'text-rose-600' : 'text-slate-600'}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-2xl font-black ${
                  netPayableBalance > 0 ? 'text-emerald-700' : netPayableBalance < 0 ? 'text-rose-700' : 'text-slate-800'
                }`}>
                  ₹{Math.abs(netPayableBalance).toLocaleString('en-IN')}
                </span>
              </div>
              <p className={`mt-1 text-[11px] font-bold ${
                netPayableBalance > 0 ? 'text-emerald-700' : netPayableBalance < 0 ? 'text-rose-700' : 'text-slate-500'
              }`}>
                {netPayableBalance > 0
                  ? 'To be paid to worker'
                  : netPayableBalance < 0
                  ? 'Worker has excess advance'
                  : 'Settled & Cleared (₹0)'}
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================================
            3. INTERACTIVE TABS & CONTENT
            ===================================================================== */}
        <div className="border-b border-slate-200 px-6 bg-white shrink-0">
          <div className="flex items-center gap-6 text-xs font-extrabold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Overview & Sites ({siteBreakdown.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`py-3.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'payments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Payments & Advances ({filteredPayments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-3.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'attendance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Attendance History ({filteredAttendance.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('photos')}
              className={`py-3.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'photos'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Face Vectors ({photos.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 animate-pulse">
              Loading worker profile intelligence...
            </div>
          ) : activeTab === 'overview' ? (
            /* TAB 1: OVERVIEW & SITE-WISE BREAKDOWN */
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Site-Wise Hajri & Earnings Distribution</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Kaun-kaun se construction site par kitni hajri hui hai aur kitna payment banta hai:
                </p>
              </div>

              {siteBreakdown.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                  No site attendance recorded for this worker in the selected period.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {siteBreakdown.map((s) => (
                    <div
                      key={s.siteId}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{s.siteName}</h4>
                          <span className="text-[10px] font-bold text-blue-600">
                            {s.pct}% of total attendance
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
                          {s.hajriCount} Hajri
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 font-semibold">
                        <span className="text-slate-500">Earned at this site:</span>
                        <span className="font-extrabold text-slate-900">₹{s.siteEarnings.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Settlement Summary Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900 to-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Worker Payout & Settlement Formula</span>
                  </h4>
                  <span className="text-xs font-mono text-slate-400">Period: {periodFilter.toUpperCase()}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">1. Total Wages</span>
                    <span className="text-base font-extrabold text-emerald-400">₹{grossEarnings.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-slate-300">({totalHajri} Hajri × ₹{dailyRate})</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">2. Less Advances Paid</span>
                    <span className="text-base font-extrabold text-rose-400">- ₹{totalPaidAll.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-slate-300">({filteredPayments.length} transactions)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">3. Net Balance</span>
                    <span className="text-base font-extrabold text-yellow-300">₹{netPayableBalance.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-slate-300">
                      {netPayableBalance > 0 ? 'Payable to Worker' : 'Excess Advance'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'payments' ? (
            /* TAB 2: PAYMENTS & ADVANCES LEDGER */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>Advance & Payment Disbursements</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kab-kab kitne paise kis account ya UPI par diye gaye hain (Full Proof Log):
                  </p>
                </div>

                <button
                  onClick={() => setShowAddPaymentModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Record Advance</span>
                </button>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-3">
                  <CreditCard className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-800">No payment receipts or advances logged for this worker.</p>
                  <p className="text-slate-400">Click &quot;+ Record Advance&quot; or send a WhatsApp payment screenshot.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-start gap-3.5">
                        {p.receiptPhotoUrl ? (
                          <button
                            onClick={() => setPreviewReceiptUrl(p.receiptPhotoUrl || null)}
                            className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-sm hover:opacity-90 relative group"
                            title="Click to view full receipt screenshot"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.receiptPhotoUrl} alt="Receipt" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-extrabold text-xs shrink-0">
                            ₹
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">
                              ₹{p.amount.toLocaleString('en-IN')}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                              p.category === 'advance' || p.category === 'kharcha'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {p.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              {(p.paymentMethod || 'gpay').toUpperCase()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 mt-1 space-y-0.5 font-medium">
                            {p.paidTo && p.paidTo !== worker.name && (
                              <p className="text-slate-700 font-bold">
                                Paid to Account: <span className="text-blue-700">{p.paidTo}</span>
                              </p>
                            )}
                            {p.notes && <p className="text-slate-600 italic">&ldquo;{p.notes}&rdquo;</p>}
                            <p className="text-[10px] text-slate-400">
                              Logged via {p.recordedBy || 'WhatsApp AI OCR'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-800 block">
                          {p.paymentDate}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {p.paymentTime || 'Recorded'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'attendance' ? (
            /* TAB 3: ATTENDANCE HISTORY & INTERACTIVE MONTH CALENDAR */
            <div className="space-y-6">
              {/* Header Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-0.5 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Monthly Attendance Calendar & Verification</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Interactive calendar with present dates marked in green • Tap any date to view complete shift logs
                  </p>
                </div>
              </div>

              {/* 1. Interactive Month Calendar Card (Compact & Clean Circular Design) */}
              <div className="max-w-xl mx-auto w-full p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
                {/* Month Navigator Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 capitalize tracking-tight flex items-center gap-2">
                        <span>{monthName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200">
                          {calendarMonthStats.uniqueDays} Days Present • {calendarMonthStats.totalHajri} Hajri
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Monthly Earned: <span className="font-extrabold text-slate-700">₹{calendarMonthStats.totalEarnings.toLocaleString('en-IN')}</span>
                      </p>
                    </div>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleGoToCurrentMonth}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors shadow-2xs"
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar 7-Day Grid */}
                <div className="w-full">
                  {/* Weekday Names Header */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <span className="text-rose-400">Sun</span>
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                  </div>

                  {/* Day Cells (No Boxes, Clean Circular Translucent Badges) */}
                  <div className="grid grid-cols-7 gap-y-2 gap-x-1 sm:gap-x-2 place-items-center">
                    {calendarDays.map((cell, idx) => {
                      if (!cell.dayNumber) {
                        return <div key={`empty-${idx}`} className="w-8 h-8 sm:w-9 sm:h-9" />;
                      }

                      const isSelected = selectedCalendarDate === cell.dateStr;

                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          onClick={() => {
                            if (selectedCalendarDate === cell.dateStr) {
                              setSelectedCalendarDate(null);
                            } else {
                              setSelectedCalendarDate(cell.dateStr);
                            }
                          }}
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm transition-all cursor-pointer relative group ${
                            isSelected
                              ? 'ring-2 ring-blue-600 ring-offset-2 scale-110 font-black z-10 ' + (cell.isPresent ? 'bg-emerald-500/30 border border-emerald-500 text-emerald-950' : 'bg-blue-600 text-white shadow-xs')
                              : cell.isPresent
                              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-900 font-extrabold hover:bg-emerald-500/30 shadow-2xs'
                              : cell.isToday
                              ? 'border border-blue-400 text-blue-600 font-bold hover:bg-blue-50'
                              : cell.isFuture
                              ? 'text-slate-300 opacity-40 hover:bg-slate-50'
                              : 'text-slate-700 hover:bg-slate-100 font-medium'
                          }`}
                          title={`${cell.dateStr}${cell.isPresent ? ` • Present (${cell.totalHajri} Hajri)` : ''}`}
                        >
                          <span>{cell.dayNumber}</span>
                          {cell.isToday && !isSelected && (
                            <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-blue-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Selected Day Inspection Box */}
                {selectedDateDetails && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white shadow-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-black text-white">
                            {new Date(selectedDateDetails.date + 'T00:00:00').toLocaleDateString('en-IN', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </h5>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            selectedDateDetails.isPresent
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'bg-rose-500/80 text-white'
                          }`}>
                            {selectedDateDetails.isPresent ? `Present (${selectedDateDetails.totalHajri} Hajri)` : 'Absent / No Log'}
                          </span>
                        </div>
                        <p className="text-xs text-blue-200 mt-0.5">
                          {selectedDateDetails.isPresent
                            ? `Daily Wages: ₹${selectedDateDetails.dayEarnings.toLocaleString('en-IN')} (${selectedDateDetails.totalHajri} Hajri × ₹${dailyRate})`
                            : 'No attendance was recorded on this date.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedCalendarDate(null)}
                        className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                        title="Close Inspector"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {selectedDateDetails.records.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                        {selectedDateDetails.records.map((rec, i) => (
                          <div key={rec.id || i} className="p-2.5 rounded-xl bg-white/10 space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-emerald-300 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{siteMap.get(rec.siteId) || 'Site'}</span>
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 text-[10px] font-mono">
                                {rec.hajri || 1} Hajri
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 flex items-center gap-3">
                              <span>Check-In: <strong>{formatTime(rec.checkInTime, '10:00 AM')}</strong></span>
                              <span>Check-Out: <strong>{formatTime(rec.checkOutTime, '—')}</strong></span>
                              {rec.workedHours && <span>({rec.workedHours} hrs)</span>}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Method: {rec.method === 'face_recognition' ? 'AI Neural Face Match' : (rec.method === 'worker_qr_whatsapp' ? '1-Tap QR Checkin' : (rec.method || 'Manual Checkin'))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Detailed Attendance Logs Timeline List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Attendance Records List ({displayedAttendance.length})</span>
                  </h4>
                  {selectedCalendarDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarDate(null)}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Showing {selectedCalendarDate} • View All Logs
                    </button>
                  )}
                </div>

                {displayedAttendance.length === 0 ? (
                  <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                    No attendance records found for {selectedCalendarDate ? selectedCalendarDate : 'the selected period'}.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {displayedAttendance
                      .slice()
                      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                      .map((r) => (
                        <div
                          key={r.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-4 text-xs hover:border-blue-300 transition-all"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                              <Clock className="w-4 h-4" />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-sm">{r.date}</span>
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-200">
                                  {typeof r.hajri === 'number' ? r.hajri : 0} Hajri
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
                                  ₹{Math.round((typeof r.hajri === 'number' ? r.hajri : 0) * dailyRate).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <p className="text-slate-500 text-xs font-medium mt-0.5">
                                Site: <span className="font-bold text-slate-700">{siteMap.get(r.siteId) || 'Construction Site'}</span>
                              </p>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                <span>In: <strong>{formatTime(r.checkInTime, '10:00 AM')}</strong></span>
                                <span>Out: <strong>{formatTime(r.checkOutTime, '—')}</strong></span>
                                {r.workedHours && <span>({r.workedHours} hrs)</span>}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Method: {r.method === 'face_recognition' ? 'SFace Neural AI Match' : (r.method === 'worker_qr_whatsapp' ? '1-Tap QR Checkin' : (r.method || 'Manual Log'))}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] uppercase">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Present</span>
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 4: PHOTOS & AI BIOMETRICS */
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>SFace Reference Neural AI Face Vectors</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Worker reference photos stored in Supabase & 128D neural vector embeddings in Firestore:
                </p>
              </div>

              {photos.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
                  <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700">No standalone reference photos uploaded yet.</p>
                  <p className="text-slate-400">Use &quot;Photos & AI&quot; on the workers tab to upload reference angles.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photos.map((ph) => (
                    <div key={ph.id} className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 relative group aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.photoUrl} alt="Worker Face Angle" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold transition-opacity p-2 text-center">
                        <ShieldCheck className="w-5 h-5 text-emerald-400 mb-1" />
                        <span>SFace 128D Vector Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =====================================================================
            FOOTER STATUS BAR
            ===================================================================== */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-[11px] font-medium text-center sm:text-left">
            <span>Worker ID: <code className="font-mono text-slate-700">{worker.id}</code></span>
            <span className="mx-2">•</span>
            <span>Created: {worker.createdAt && typeof (worker.createdAt as any).toDate === 'function' ? (worker.createdAt as any).toDate().toLocaleDateString('en-IN') : new Date(worker.createdAt ? String(worker.createdAt) : Date.now()).toLocaleDateString('en-IN')}</span>
          </div>

          <div className="flex items-center gap-2">
            {!isFullPage && onClose && (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow transition-all active:scale-95"
              >
                Close Profile
              </button>
            )}
          </div>
        </div>

      </div>

      {/* =====================================================================
          MODAL: QUICK RECORD ADVANCE / PAYMENT
          ===================================================================== */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Give Advance / Kharcha</span>
                </h3>
                <p className="text-xs text-slate-500">Directly record payment to {worker.name}&apos;s Khata</p>
              </div>
              <button
                onClick={() => setShowAddPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs font-semibold">
              <div>
                <label className="text-slate-700 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 2000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Category</label>
                  <select
                    value={payCategory}
                    onChange={(e: any) => setPayCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="advance">Worker Advance (Kharcha)</option>
                    <option value="wage">Final Wage Payout</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="gpay">GPay / Google Pay</option>
                    <option value="phonepe">PhonePe</option>
                    <option value="paytm">Paytm</option>
                    <option value="cash">Cash (Nagad)</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Paid to worker's wife / Diwali kharcha"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {paySubmitting ? 'Saving to Khata...' : 'Confirm & Save Advance to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: RECEIPT SCREENSHOT ZOOM
          ===================================================================== */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Payment Screenshot Proof</span>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden max-h-[70vh] bg-slate-100 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewReceiptUrl} alt="Receipt Screenshot" className="max-h-[70vh] object-contain w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
