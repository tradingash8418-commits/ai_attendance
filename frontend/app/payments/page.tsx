'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  Plus,
  Upload,
  Receipt,
  Search,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ArrowDownRight,
  FileImage,
  Trash2,
  Users,
  Building2,
  Wallet,
  Eye,
  X,
  Truck,
} from 'lucide-react';
import { PaymentLedgerService, type WorkerKhataSummary } from '@/services/payment-ledger.service';
import { PaymentOcrService } from '@/services/payment-ocr.service';
import { WorkersService } from '@/services/workers.service';
import { SitesService } from '@/services/sites.service';
import { compressImageClient } from '@/lib/image-compress';
import { getTodayDateString } from '@/lib/formatters';
import type { PaymentLedgerEntry, PaymentCategory, PaymentMethod, ExtractedPaymentData } from '@/types/payment';
import type { Worker } from '@/types/worker';
import type { Site } from '@/types/site';

interface VendorSummary {
  vendorName: string;
  totalPaid: number;
  billsCount: number;
  latestDate: string;
  category: string;
  payments: PaymentLedgerEntry[];
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'khata' | 'vendors' | 'ledger' | 'ocr'>('khata');
  const [loading, setLoading] = useState<boolean>(true);
  const [summaries, setSummaries] = useState<WorkerKhataSummary[]>([]);
  const [payments, setPayments] = useState<PaymentLedgerEntry[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [dailyRate, setDailyRate] = useState<number>(500);

  // Totals
  const [totalAdvances, setTotalAdvances] = useState<number>(0);
  const [totalHajri, setTotalHajri] = useState<number>(0);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Manual Entry Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [recipientType, setRecipientType] = useState<'worker' | 'vendor'>('worker');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [formPaidTo, setFormPaidTo] = useState<string>('');
  const [formSiteId, setFormSiteId] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCategory, setFormCategory] = useState<PaymentCategory>('advance');
  const [formMethod, setFormMethod] = useState<PaymentMethod>('gpay');
  const [formDate, setFormDate] = useState<string>(getTodayDateString());
  const [formNotes, setFormNotes] = useState<string>('');
  const [formUpiId, setFormUpiId] = useState<string>('');
  const [formReceiptUrl, setFormReceiptUrl] = useState<string>('');
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // OCR Upload State
  const [ocrAnalyzing, setOcrAnalyzing] = useState<boolean>(false);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<ExtractedPaymentData | null>(null);
  const [ocrAmount, setOcrAmount] = useState<string>('');
  const [ocrPaidToName, setOcrPaidToName] = useState<string>('');
  const [ocrCategory, setOcrCategory] = useState<PaymentCategory>('vendor');
  const [ocrSaveSuccess, setOcrSaveSuccess] = useState<string | null>(null);

  // Receipt Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [khataRes, paymentList, workerList, siteList] = await Promise.all([
        PaymentLedgerService.getAllWorkersKhataSummary(dailyRate),
        PaymentLedgerService.getPayments(),
        WorkersService.getWorkers(),
        SitesService.getSites(),
      ]);

      setSummaries(khataRes.summaries);
      setTotalAdvances(khataRes.totalAdvancesPaidAll);
      setTotalHajri(khataRes.totalHajriAll);
      setPayments(paymentList);
      setWorkers(workerList);
      setSites(siteList);
    } catch (err) {
      console.error('Failed to load Khata & payments data:', err);
    } finally {
      setLoading(false);
    }
  }, [dailyRate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenPaymentModal = (workerId?: string, isVendor = false) => {
    if (isVendor) {
      setRecipientType('vendor');
      setFormCategory('vendor');
      setFormPaidTo('');
      setSelectedWorkerId('');
    } else {
      setRecipientType('worker');
      setFormCategory('advance');
      if (workerId) {
        setSelectedWorkerId(workerId);
        const w = workers.find((x) => x.id === workerId);
        const s = summaries.find((x) => x.workerId === workerId);
        setFormPaidTo(w?.name || s?.workerName.replace(' (Daily/Temp)', '') || '');
      } else {
        setSelectedWorkerId(workers[0]?.id || '');
        setFormPaidTo(workers[0]?.name || '');
      }
    }

    setFormSiteId(sites[0]?.id ?? '');
    setFormAmount('');
    setFormMethod('gpay');
    setFormDate(getTodayDateString());
    setFormNotes('');
    setFormUpiId('');
    setFormReceiptUrl('');
    setModalSuccess(null);
    setModalError(null);
    setShowModal(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setModalError('Please enter a valid amount greater than 0.');
      return;
    }

    let finalName = formPaidTo.trim();
    let linkedWorkerId = '';
    let linkedWorkerCode = '';

    if (recipientType === 'worker') {
      const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
      if (!selectedWorker) {
        setModalError('Please select a registered worker.');
        return;
      }
      finalName = selectedWorker.name;
      linkedWorkerId = selectedWorker.id;
      linkedWorkerCode = selectedWorker.workerCode || '';
    } else {
      if (!finalName) {
        setModalError('Please enter Vendor / Payee Name.');
        return;
      }
    }

    const selectedSite = sites.find((s) => s.id === formSiteId);

    setSubmitting(true);
    setModalError(null);
    try {
      await PaymentLedgerService.recordPayment({
        paidTo: finalName,
        workerId: linkedWorkerId,
        workerName: linkedWorkerId ? finalName : '',
        workerCode: linkedWorkerCode,
        siteId: selectedSite?.id,
        siteName: selectedSite?.name,
        amount: amountNum,
        category: formCategory,
        paymentMethod: formMethod,
        upiId: formUpiId,
        paymentDate: formDate,
        notes: formNotes,
        receiptPhotoUrl: formReceiptUrl,
        recordedBy: 'admin_dashboard',
      });

      setModalSuccess(`₹${amountNum.toLocaleString('en-IN')} recorded for ${finalName}!`);
      setTimeout(() => {
        setShowModal(false);
        loadData();
      }, 1000);
    } catch (err) {
      console.error('Save payment error:', err);
      setModalError('Failed to record payment. Check network/firestore.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
      await PaymentLedgerService.deletePayment(id);
      loadData();
    } catch (err) {
      console.error('Delete payment error:', err);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrAnalyzing(true);
    setOcrResult(null);
    setOcrAmount('');
    setOcrPaidToName('');
    setOcrSaveSuccess(null);

    try {
      const compressedBase64 = await compressImageClient(file, 1280, 0.85);
      setOcrImagePreview(compressedBase64);

      // Perform OCR extraction
      const extracted = await PaymentOcrService.extractPaymentFromBase64(compressedBase64);
      setOcrResult(extracted);
      setOcrAmount(extracted.amount ? String(extracted.amount) : '');
      const rawName = extracted.receiverName || '';
      setOcrPaidToName(rawName);

      // Automatically determine if payee is a registered worker or external vendor
      const matched = workers.find((w) => {
        const nameLower = w.name.toLowerCase();
        const targetLower = rawName.toLowerCase();
        return targetLower && (nameLower === targetLower || nameLower.includes(targetLower) || targetLower.includes(nameLower));
      });

      if (matched) {
        setOcrCategory('advance');
      } else {
        setOcrCategory('vendor');
      }
    } catch (err) {
      console.error('Screenshot OCR error:', err);
    } finally {
      setOcrAnalyzing(false);
    }
  };

  const handleSaveOcrEntry = async () => {
    const amountNum = parseFloat(ocrAmount) || ocrResult?.amount || 0;
    const targetName = ocrPaidToName.trim();
    if (!ocrResult || amountNum <= 0 || !targetName) return;

    // Check if worker match
    const matchedWorker = workers.find((w) => {
      const nameLower = w.name.toLowerCase();
      const targetLower = targetName.toLowerCase();
      return targetLower && (nameLower === targetLower || nameLower.includes(targetLower) || targetLower.includes(nameLower));
    });

    const isWorkerAdvance = ocrCategory === 'advance' && Boolean(matchedWorker);
    const resolvedWorkerId = isWorkerAdvance && matchedWorker ? matchedWorker.id : '';
    const resolvedWorkerName = isWorkerAdvance && matchedWorker ? matchedWorker.name : '';
    const resolvedWorkerCode = isWorkerAdvance && matchedWorker ? matchedWorker.workerCode : '';

    setSubmitting(true);
    try {
      await PaymentLedgerService.recordPayment({
        paidTo: targetName,
        workerId: resolvedWorkerId,
        workerName: resolvedWorkerName,
        workerCode: resolvedWorkerCode,
        amount: amountNum,
        category: ocrCategory,
        paymentMethod: ocrResult.paymentMethod || 'gpay',
        upiId: ocrResult.upiId || undefined,
        paymentDate: getTodayDateString(),
        paymentTime: ocrResult.timestampStr || undefined,
        receiptPhotoUrl: ocrImagePreview || undefined,
        notes: `AI OCR parsed from payment receipt`,
        recordedBy: 'ai_screenshot_ocr',
        rawOcrText: ocrResult.rawText,
      });

      setOcrSaveSuccess(`Payment of ₹${amountNum.toLocaleString('en-IN')} paid to ${targetName} recorded successfully!`);
      setTimeout(() => {
        loadData();
      }, 1200);
    } catch (err) {
      console.error('Error saving OCR payment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Worker Summaries (ONLY Enrolled Workers)
  const filteredSummaries = summaries.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.workerName.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)) || (s.workerCode && s.workerCode.toLowerCase().includes(q));
  });

  // 2. Vendor Summaries (Grouped by Vendor/Supplier Name)
  const vendorPayments = payments.filter((p) => p.category === 'vendor' || p.category === 'material' || p.category === 'equipment' || p.category === 'other' || !p.workerId);
  const totalVendorExpense = vendorPayments.reduce((sum, p) => sum + p.amount, 0);

  const vendorMap = new Map<string, VendorSummary>();
  vendorPayments.forEach((p) => {
    const vName = (p.paidTo || 'Vendor / Expense').trim();
    if (!vendorMap.has(vName)) {
      vendorMap.set(vName, {
        vendorName: vName,
        totalPaid: 0,
        billsCount: 0,
        latestDate: p.paymentDate,
        category: p.category || 'vendor',
        payments: [],
      });
    }
    const item = vendorMap.get(vName)!;
    item.totalPaid += p.amount;
    item.billsCount += 1;
    item.payments.push(p);
  });

  const vendorList = Array.from(vendorMap.values()).filter((v) => {
    if (!searchQuery) return true;
    return v.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 3. All Payments (Chronological timeline)
  const filteredPayments = payments.filter((p) => {
    const target = (p.paidTo || p.workerName || '').toLowerCase();
    const notes = (p.notes || '').toLowerCase();
    const upi = (p.upiId || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || target.includes(q) || notes.includes(q) || upi.includes(q);
    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalCalculatedWages = totalHajri * dailyRate;
  const totalNetBalance = totalCalculatedWages - totalAdvances;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Contractor Khata & Financial Ledger</h1>
            <span className="razorpay-badge-ai">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>AI OCR INTEGRATED</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Separated labour wages &amp; worker advances from material suppliers, vendors, and site expenses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm transition-all"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setActiveTab('ocr')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Scan GPay / UPI Bill</span>
          </button>

          <button
            onClick={() => handleOpenPaymentModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metrics Cards (Razorpay SaaS Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Labour Advances */}
        <div className="razorpay-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>WORKER ADVANCES (PAID)</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-600 tracking-tight">
            ₹{totalAdvances.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Enrolled Karigar Advances</span>
            <span className="font-bold text-slate-700">{summaries.length} Workers</span>
          </div>
        </div>

        {/* Metric 2: Total Vendor & Material Expenses */}
        <div className="razorpay-card p-5 space-y-2 bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>VENDOR &amp; MATERIAL PAID</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-700 tracking-tight">
            ₹{totalVendorExpense.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Material, Equipment &amp; Thekedar</span>
            <span className="font-bold text-amber-700">{vendorList.length} Vendors</span>
          </div>
        </div>

        {/* Metric 3: Total Hajri Earned */}
        <div className="razorpay-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>TOTAL HAJRI EARNED</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {totalHajri.toFixed(1)} <span className="text-sm font-bold text-slate-400">Hajri</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Rate: ₹{dailyRate}/day</span>
            <button
              onClick={() => {
                const r = prompt('Enter default daily wage rate (₹/day):', String(dailyRate));
                if (r && !isNaN(Number(r))) setDailyRate(Number(r));
              }}
              className="font-bold text-blue-600 hover:underline"
            >
              Change Rate
            </button>
          </div>
        </div>

        {/* Metric 4: Net Labour Balance */}
        <div className="razorpay-card p-5 space-y-2 bg-gradient-to-br from-white to-blue-50/50">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>NET LABOUR BALANCE</span>
            <IndianRupee className="w-4 h-4 text-blue-600" />
          </div>
          <div className={`text-3xl font-black tracking-tight ${totalNetBalance >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
            ₹{totalNetBalance.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>{totalNetBalance >= 0 ? 'Remaining to pay workers' : 'Overpaid / Advance excess'}</span>
            <span className="font-bold text-slate-700">Auto Computed</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('khata')}
            className={`pb-3 px-1 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'khata'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Worker Khata Sheet ({summaries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`pb-3 px-1 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'vendors'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Vendor &amp; Material Ledger ({vendorList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 px-1 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'ledger'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Full Payment History ({payments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ocr')}
            className={`pb-3 px-1 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'ocr'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>AI Payment Screenshot Scanner</span>
          </button>
        </nav>
      </div>

      {/* 4. Tab Content: Worker Khata Sheet (ONLY Registered Workers) */}
      {activeTab === 'khata' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search worker by name, code, phone..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="text-xs text-slate-500">
              Worker & Labour Advance Khata ({filteredSummaries.length} entries)
            </div>
          </div>

          <div className="razorpay-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Worker Name</th>
                    <th className="py-3 px-4">Phone / Code</th>
                    <th className="py-3 px-4 text-center">Hajri Earned</th>
                    <th className="py-3 px-4 text-right">Hajri Wages (₹)</th>
                    <th className="py-3 px-4 text-right">Advances Paid (₹)</th>
                    <th className="py-3 px-4 text-right">Net Payable Balance (₹)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Loading Khata balances...
                      </td>
                    </tr>
                  ) : filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No registered workers found. Enroll workers from the Workers page.
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map((summary) => {
                      const isPositive = summary.netPayableBalance >= 0;

                      return (
                        <tr key={summary.workerId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{summary.workerName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                                {summary.workerCode || 'WRK-ID'}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200">
                                ₹{summary.dailyRate}/day
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {summary.phone || '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] border border-blue-200">
                              {summary.totalHajriEarned} Hajri
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ₹{summary.totalEarnedAmount.toLocaleString('en-IN')}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {summary.totalHajriEarned} × ₹{summary.dailyRate}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600">
                            ₹{summary.totalAdvancesPaid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-sm">
                            <span className={isPositive ? 'text-emerald-600' : 'text-amber-600'}>
                              ₹{summary.netPayableBalance.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenPaymentModal(summary.workerId, false)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Give Advance</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab Content: Vendor & Material Ledger */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendor, supplier, contractor..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => handleOpenPaymentModal(undefined, true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Vendor Payment</span>
            </button>
          </div>

          <div className="razorpay-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Vendor / Supplier / Entity</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Bills Count</th>
                    <th className="py-3 px-4">Latest Bill Date</th>
                    <th className="py-3 px-4 text-right">Total Paid (₹)</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Loading vendor ledger...
                      </td>
                    </tr>
                  ) : vendorList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No vendor / material payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    vendorList.map((v) => {
                      const latestPayment = v.payments[0];
                      return (
                        <tr key={v.vendorName} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 uppercase flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>{v.vendorName}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block ml-6">
                              {latestPayment?.upiId || latestPayment?.paymentMethod?.toUpperCase() || 'Direct Payment'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase bg-amber-50 text-amber-800 border border-amber-200">
                              {v.category || 'Vendor / Expense'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                              {v.billsCount} Bills
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700">
                            {v.latestDate}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-rose-600 text-base">
                            ₹{v.totalPaid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {latestPayment?.receiptPhotoUrl ? (
                              <button
                                onClick={() => setPreviewImage(latestPayment.receiptPhotoUrl || null)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Receipt</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab Content: Payments History Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search payments by name, UPI, notes..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="advance">Worker Advance</option>
                <option value="vendor">Vendor / Supplier</option>
                <option value="material">Material Expense</option>
                <option value="equipment">Machinery / Equipment</option>
                <option value="wage">Wage Settlement</option>
              </select>
            </div>
          </div>

          <div className="razorpay-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Paid To / Receiver</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Amount (₹)</th>
                    <th className="py-3 px-4">Receipt</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Loading transaction ledger...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No payment records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{p.paymentDate}</div>
                            {p.paymentTime && (
                              <span className="text-[10px] text-slate-400">{p.paymentTime}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 uppercase">{p.paidTo || p.workerName || 'Recipient'}</div>
                            <span className="text-[10px] text-slate-500 font-mono">{p.upiId || p.workerPhone || 'UPI / Direct'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                              p.category === 'advance'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {p.category === 'advance' ? 'Worker Advance' : p.category.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 capitalize">
                            {p.paymentMethod}
                            {p.upiId && <span className="block text-[10px] text-slate-400">{p.upiId}</span>}
                          </td>
                          <td className="py-3 px-4 font-black text-rose-600 text-sm">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4">
                            {p.receiptPhotoUrl ? (
                              <button
                                onClick={() => setPreviewImage(p.receiptPhotoUrl || null)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Bill</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">No Receipt</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-500">
                            {p.recordedBy === 'ai_screenshot_ocr' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                <Sparkles className="w-3 h-3" /> AI OCR
                              </span>
                            ) : (
                              'Admin'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab Content: AI Payment Screenshot Scanner */}
      {activeTab === 'ocr' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Upload Area */}
          <div className="razorpay-card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upload Google Pay / UPI Screenshot</h3>
              <p className="text-xs text-slate-500">
                AI extracts Amount (₹), Paid-To Name, UPI ID, and Date automatically.
              </p>
            </div>

            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition-all text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleScreenshotUpload}
                className="hidden"
              />
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-2">
                <FileImage className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-700">
                Click to select or drop payment screenshot
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Supports Google Pay, PhonePe, Paytm, BHIM UPI images (PNG, JPG)
              </span>
            </label>

            {ocrImagePreview && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">Uploaded Screenshot:</span>
                <div className="relative max-h-64 overflow-hidden rounded-xl border border-slate-200 bg-black/5 flex items-center justify-center">
                  <img
                    src={ocrImagePreview}
                    alt="Payment receipt preview"
                    className="max-h-64 object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: AI Extraction Preview & Category Assignment */}
          <div className="razorpay-card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Extracted Receipt Details</span>
              </h3>
              {ocrAmount && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-xs border border-emerald-200">
                  Detected ₹{Number(ocrAmount).toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {ocrAnalyzing ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-700">Analyzing payment screenshot...</p>
                <p className="text-[11px] text-slate-400">Extracting ₹ amount, recipient name, timestamp</p>
              </div>
            ) : !ocrResult ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Upload a payment screenshot to view AI extraction and record it in the ledger.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Extracted Fields */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Extracted Amount</span>
                    <span className="text-lg font-black text-rose-600">
                      {ocrAmount ? `₹${Number(ocrAmount).toLocaleString('en-IN')}` : 'Not Detected'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment App</span>
                    <span className="font-bold text-slate-800 uppercase">{ocrResult.paymentMethod || 'UPI'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Paid To (OCR)</span>
                    <span className="font-bold text-slate-800">{ocrResult.receiverName || '—'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">UPI ID</span>
                    <span className="font-mono text-slate-600 text-[11px]">{ocrResult.upiId || '—'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Date &amp; Time</span>
                    <span className="font-semibold text-slate-700">
                      {ocrResult.timestampStr || 'Today'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Confidence Score</span>
                    <span className="font-bold text-emerald-600">{Math.round(ocrResult.confidence * 100)}% Match</span>
                  </div>
                </div>

                {/* Editable Fields: Amount, Paid To Name, and Khata Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Amount (₹) *</span>
                      <span className="text-[10px] text-emerald-600 font-bold">Auto-Detected</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={ocrAmount}
                      onChange={(e) => setOcrAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-black text-rose-600 focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Paid To (Receiver Name) *</span>
                      <span className="text-[10px] text-emerald-600 font-bold">Auto-Detected</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={ocrPaidToName}
                      onChange={(e) => setOcrPaidToName(e.target.value)}
                      placeholder="e.g. MOHD JAKIR"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 uppercase shadow-sm"
                    />
                  </div>
                </div>

                {/* Category Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Khata Category (Worker Advance vs Vendor/Supplier) *
                  </label>
                  <select
                    value={ocrCategory}
                    onChange={(e) => setOcrCategory(e.target.value as PaymentCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-sm"
                  >
                    <option value="vendor">Vendor / Material Supplier (Not a worker)</option>
                    <option value="advance">Worker Advance / Peshgi (Enrolled Worker)</option>
                    <option value="material">Material Purchase (Cement, Sand, Slabs)</option>
                    <option value="equipment">Machinery / JCB / Equipment Rental</option>
                    <option value="other">Site Petty Cash / Other Kharcha</option>
                  </select>
                </div>

                <p className="text-[10px] text-slate-400">
                  {ocrCategory === 'advance'
                    ? 'Records advance against enrolled worker and reconciles with their Hajri.'
                    : 'Records payment under Vendor / Material ledger without polluting the workers list.'}
                </p>

                {ocrSaveSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{ocrSaveSuccess}</span>
                  </div>
                )}

                {/* 1-Click Save Action */}
                <button
                  onClick={handleSaveOcrEntry}
                  disabled={submitting || !ocrAmount || parseFloat(ocrAmount) <= 0 || !ocrPaidToName.trim()}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Saving to Ledger...'
                      : `Confirm & Record ₹${Number(ocrAmount || 0).toLocaleString('en-IN')} Paid to ${ocrPaidToName.trim() || 'Recipient'}`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Manual Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                <span>Record New Payment / Kharcha</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {modalError}
                  </div>
                )}

                {/* Recipient Type Toggle: Worker vs Vendor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Payment To *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientType('worker');
                        setFormCategory('advance');
                      }}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                        recipientType === 'worker'
                          ? 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Registered Worker</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRecipientType('vendor');
                        setFormCategory('vendor');
                      }}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                        recipientType === 'vendor'
                          ? 'bg-amber-50 text-amber-700 border-amber-500 ring-2 ring-amber-500/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Vendor / Supplier</span>
                    </button>
                  </div>
                </div>

                {recipientType === 'worker' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Select Worker *</label>
                    <select
                      value={selectedWorkerId}
                      onChange={(e) => {
                        setSelectedWorkerId(e.target.value);
                        const w = workers.find((x) => x.id === e.target.value);
                        setFormPaidTo(w?.name || '');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold focus:outline-none focus:border-blue-500"
                    >
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.workerCode || 'ID'}) - ₹{w.dailyRate || dailyRate}/day
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Vendor / Payee Name *</label>
                    <input
                      type="text"
                      required
                      value={formPaidTo}
                      onChange={(e) => setFormPaidTo(e.target.value)}
                      placeholder="e.g. SRI LINGALA SLAB INDUSTRIES"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold focus:outline-none focus:border-blue-500 uppercase"
                    />
                  </div>
                )}

                {/* Amount & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-black text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Category & Payment Method */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Category *</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as PaymentCategory)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                    >
                      {recipientType === 'worker' ? (
                        <>
                          <option value="advance">Advance / Kharcha</option>
                          <option value="wage">Wage Settlement</option>
                          <option value="bonus">Bonus</option>
                          <option value="deduction">Deduction</option>
                        </>
                      ) : (
                        <>
                          <option value="vendor">Vendor / Supplier</option>
                          <option value="material">Material Purchase</option>
                          <option value="equipment">Machinery Rental</option>
                          <option value="other">Site Expense / Other</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Method *</label>
                    <select
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="gpay">Google Pay</option>
                      <option value="phonepe">PhonePe</option>
                      <option value="paytm">Paytm</option>
                      <option value="upi">Direct UPI</option>
                      <option value="bank_transfer">Bank Transfer / NEFT</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>

                {/* UPI ID / Ref */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">UPI ID / Ref (Optional)</label>
                  <input
                    type="text"
                    value={formUpiId}
                    onChange={(e) => setFormUpiId(e.target.value)}
                    placeholder="e.g. mobile@upi"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Remarks / Purpose</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Slab material payment / weekly cash advance"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
                  >
                    {submitting ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 9. Receipt Fullscreen Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>Attached Payment Screenshot / Bill</span>
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl bg-black/5 flex items-center justify-center">
              <img src={previewImage} alt="Receipt preview" className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
