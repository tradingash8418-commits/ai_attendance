'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  Receipt,
  DollarSign,
  Calendar,
  CreditCard,
  Plus,
  Printer,
  ExternalLink,
  X,
  Filter,
  ArrowDownLeft,
  Truck,
  Store,
  ShieldCheck,
  CheckCircle,
  Clock,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { PaymentLedgerService } from '@/services/payment-ledger.service';
import { getTodayDateString } from '@/lib/formatters';
import type { VendorSummary } from '@/services/vendors.service';
import type { PaymentLedgerEntry } from '@/types/payment';

interface VendorProfileDossierProps {
  vendor: VendorSummary;
  onVendorUpdated?: () => void;
}

export default function VendorProfileDossier({
  vendor,
  onVendorUpdated,
}: VendorProfileDossierProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'details'>('overview');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_week'>('all');

  // Quick Record Payment Modal
  const [showAddPaymentModal, setShowAddPaymentModal] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'cash' | 'bank_transfer'>('gpay');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payUpi, setPayUpi] = useState<string>(vendor.upiId || '');
  const [paySubmitting, setPaySubmitting] = useState<boolean>(false);

  // Zoom Receipt Screenshot Modal
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  const today = getTodayDateString();

  // Filter payments by period
  const filteredPayments = useMemo(() => {
    if (periodFilter === 'all') return vendor.allPayments;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (periodFilter === 'this_month') {
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      return vendor.allPayments.filter((p) => (p.paymentDate || '').startsWith(monthPrefix));
    }

    if (periodFilter === 'last_month') {
      const prevDate = new Date(currentYear, currentMonth - 1, 1);
      const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      return vendor.allPayments.filter((p) => (p.paymentDate || '').startsWith(prevMonthPrefix));
    }

    if (periodFilter === 'this_week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const cutoff = oneWeekAgo.toISOString().split('T')[0];
      return vendor.allPayments.filter((p) => (p.paymentDate || '') >= cutoff);
    }

    return vendor.allPayments;
  }, [vendor.allPayments, periodFilter]);

  const totalPaidInPeriod = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  const avgBillAmount = useMemo(() => {
    return filteredPayments.length > 0 ? Math.round(totalPaidInPeriod / filteredPayments.length) : 0;
  }, [totalPaidInPeriod, filteredPayments]);

  // Site breakdown for this vendor
  const siteBreakdown = useMemo(() => {
    const siteMap: Record<string, { amount: number; count: number; name: string }> = {};
    filteredPayments.forEach((p) => {
      const sId = p.siteId || 'unassigned';
      if (!siteMap[sId]) {
        siteMap[sId] = {
          name: p.siteName || (sId === 'unassigned' ? 'General Site Expenses' : `Site #${sId.slice(0, 6)}`),
          amount: 0,
          count: 0,
        };
      }
      siteMap[sId].amount += p.amount;
      siteMap[sId].count += 1;
    });

    return Object.entries(siteMap).map(([sId, data]) => {
      const pct = totalPaidInPeriod > 0 ? Math.round((data.amount / totalPaidInPeriod) * 100) : 0;
      return {
        siteId: sId,
        siteName: data.name,
        amount: data.amount,
        count: data.count,
        pct,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [filteredPayments, totalPaidInPeriod]);

  // Handle Record New Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return;

    setPaySubmitting(true);
    try {
      await PaymentLedgerService.recordPayment({
        paidTo: vendor.name,
        amount: amt,
        category: 'vendor',
        paymentMethod: payMethod,
        upiId: payUpi || vendor.upiId || '',
        paymentDate: today,
        paymentTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        notes: payNotes || `Manual Entry for Vendor: ${vendor.name}`,
        recordedBy: 'Admin (Vendor 360° Profile)',
      });

      setPayAmount('');
      setPayNotes('');
      setShowAddPaymentModal(false);
      if (onVendorUpdated) onVendorUpdated();
    } catch (err) {
      console.error('Failed to record vendor payment:', err);
      alert('Failed to record vendor payment. Please try again.');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-6">
      {/* =====================================================================
          1. HEADER BANNER & VENDOR ENTITY IDENTITY
          ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Entity Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-400/40 flex items-center justify-center text-amber-300 font-black text-2xl shadow-xl shrink-0">
              <Store className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
            </div>

            {/* Vendor Information */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {vendor.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-extrabold text-xs uppercase border border-amber-400/30">
                  {vendor.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
                  {vendor.billsCount} Bills Logged
                </span>
              </div>

              <p className="text-xs text-slate-300 font-medium flex flex-wrap items-center gap-3">
                {vendor.upiId && (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-mono">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>UPI: {vendor.upiId}</span>
                  </span>
                )}
                <span className="text-slate-400">
                  Latest Bill: <strong className="text-white">{vendor.latestPaymentDate}</strong>
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => setShowAddPaymentModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-lg transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Record Vendor Bill / Payment</span>
            </button>

            <button
              onClick={handlePrintStatement}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition-colors"
              title="Print Vendor Statement"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print Slip</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. PERIOD FILTER & FINANCIAL KPI METRICS
          ===================================================================== */}
      <div className="p-5 sm:p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span>Vendor Expense Period:</span>
          </span>

          {/* Period Filter Buttons */}
          <div className="inline-flex p-1 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold">
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'all' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
            >
              All Time
            </button>
            <button
              onClick={() => setPeriodFilter('this_month')}
              className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'this_month' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriodFilter('last_month')}
              className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'last_month' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
            >
              Last Month
            </button>
            <button
              onClick={() => setPeriodFilter('this_week')}
              className={`px-3 py-1 rounded-lg transition-all ${periodFilter === 'this_week' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
            >
              This Week
            </button>
          </div>
        </div>

        {/* 4 Financial Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Paid */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Total Paid to Date</span>
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-700">
              ₹{totalPaidInPeriod.toLocaleString('en-IN')}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Across all sites
            </p>
          </div>

          {/* Invoices Count */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Total Bills / Receipts</span>
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {filteredPayments.length}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              OCR & Manual Entries
            </p>
          </div>

          {/* Average Bill Amount */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Average Payout / Bill</span>
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-indigo-700">
              ₹{avgBillAmount.toLocaleString('en-IN')}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Per receipt average
            </p>
          </div>

          {/* Latest Payment */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Latest Bill Date</span>
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-base font-black text-slate-900 truncate">
              {vendor.latestPaymentDate}
            </div>
            <p className="mt-1 text-[11px] text-emerald-700 font-bold">
              Method: {(vendor.paymentMethod || 'gpay').toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. INTERACTIVE TABS & CONTENT
          ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 bg-slate-50/50">
          <div className="flex items-center gap-6 text-xs font-extrabold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Overview & Site Expenses ({siteBreakdown.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`py-3.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'payments'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Invoices & Receipts ({filteredPayments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('details')}
              className={`py-3.5 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'details'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Bank & Account Info</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {activeTab === 'overview' ? (
            /* TAB 1: OVERVIEW & SITE-WISE EXPENSES */
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span>Site-Wise Material & Expense Allocation</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Kaun-kaun se construction site par is vendor / thekedar ka kitna bill laga hai:
                </p>
              </div>

              {siteBreakdown.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                  No site expenses logged for this vendor in the selected period.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {siteBreakdown.map((s) => (
                    <div
                      key={s.siteId}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-amber-300 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{s.siteName}</h4>
                          <span className="text-[10px] font-bold text-amber-600">
                            {s.count} bills ({s.pct}% of vendor total)
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
                          ₹{s.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'payments' ? (
            /* TAB 2: INVOICES & PAYMENT RECEIPTS */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-600" />
                    <span>Vendor Payment Receipts Log</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kab-kab kitne paise kis bill / receipt par diye gaye hain (Full Proof Log):
                  </p>
                </div>

                <button
                  onClick={() => setShowAddPaymentModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Record Payment</span>
                </button>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-3">
                  <Receipt className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-800">No payment receipts logged for this vendor in this period.</p>
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
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                              Vendor / Material
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              {(p.paymentMethod || 'gpay').toUpperCase()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 mt-1 space-y-0.5 font-medium">
                            {p.upiId && (
                              <p className="text-slate-700 font-mono text-[11px]">
                                UPI Handle: <span className="text-blue-700">{p.upiId}</span>
                              </p>
                            )}
                            {p.notes && <p className="text-slate-600 italic">&ldquo;{p.notes}&rdquo;</p>}
                            <p className="text-[10px] text-slate-400">
                              Recorded via {p.recordedBy || 'WhatsApp AI OCR'}
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
          ) : (
            /* TAB 3: DETAILS & BANK INFO */
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>Vendor Account & Entity Summary</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Automatic profile details extracted from payment receipts and bills:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Entity / Business Name</span>
                  <span className="text-sm font-black text-slate-900">{vendor.name}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                  <span className="text-sm font-black text-amber-700 uppercase">{vendor.category}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Latest UPI Handle</span>
                  <span className="text-sm font-mono font-bold text-blue-700">{vendor.upiId || 'Direct Bank / QR Transfer'}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Transactions Count</span>
                  <span className="text-sm font-black text-slate-900">{vendor.billsCount} Invoices Processed</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODAL: QUICK RECORD VENDOR PAYMENT
          ===================================================================== */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  <span>Record Vendor Payment</span>
                </h3>
                <p className="text-xs text-slate-500">Record bill payment to {vendor.name}</p>
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
                  placeholder="e.g. 50000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="gpay">GPay / Google Pay</option>
                    <option value="phonepe">PhonePe</option>
                    <option value="paytm">Paytm</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash (Nagad)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">UPI ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. vendor@upi"
                    value={payUpi}
                    onChange={(e) => setPayUpi(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Notes / Material Description</label>
                <input
                  type="text"
                  placeholder="e.g. Cement 50 bags / Steel supply"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {paySubmitting ? 'Saving to Vendor Ledger...' : 'Confirm & Save to Vendor Ledger'}
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
              <span className="text-xs font-bold text-slate-900">Vendor Bill Screenshot Proof</span>
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden max-h-[70vh] bg-slate-100 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewReceiptUrl} alt="Vendor Receipt" className="max-h-[70vh] object-contain w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
