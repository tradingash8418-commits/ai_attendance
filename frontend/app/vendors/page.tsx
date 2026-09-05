'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Store,
  Plus,
  Search,
  Receipt,
  DollarSign,
  TrendingUp,
  Calendar,
  Building2,
  ExternalLink,
  CreditCard,
  Truck,
  ShieldCheck,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { VendorsService, VendorSummary } from '@/services/vendors.service';
import { PaymentLedgerService } from '@/services/payment-ledger.service';
import { getTodayDateString } from '@/lib/formatters';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [totalVendorPaidAll, setTotalVendorPaidAll] = useState<number>(0);
  const [totalBillsAll, setTotalBillsAll] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'material' | 'thekedar' | 'transport'>('all');

  // Quick Add Vendor Payment Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [vendorName, setVendorName] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'bank_transfer' | 'cash'>('gpay');
  const [payUpi, setPayUpi] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const today = getTodayDateString();

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await VendorsService.getVendorsSummary();
      setVendors(data.vendors);
      setTotalVendorPaidAll(data.totalVendorPaidAll);
      setTotalBillsAll(data.totalBillsAll);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleCreateVendorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return;

    setSubmitting(true);
    try {
      await PaymentLedgerService.recordPayment({
        paidTo: vendorName.trim(),
        amount: amt,
        category: 'vendor',
        paymentMethod: payMethod,
        upiId: payUpi.trim(),
        paymentDate: today,
        paymentTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        notes: payNotes.trim() || `Manual Entry for Vendor: ${vendorName.trim()}`,
        recordedBy: 'Admin (Vendors Directory)',
      });

      setSuccessNotice(`Payment of ₹${amt.toLocaleString('en-IN')} recorded for ${vendorName.trim()}!`);
      setVendorName('');
      setPayAmount('');
      setPayUpi('');
      setPayNotes('');
      setShowAddModal(false);
      await loadVendors();
    } catch (err) {
      console.error('Failed to record vendor payment:', err);
      alert('Failed to record vendor payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        v.name.toLowerCase().includes(term) ||
        (v.upiId && v.upiId.toLowerCase().includes(term)) ||
        (v.notes && v.notes.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (categoryFilter !== 'all') {
        return v.category === categoryFilter;
      }
      return true;
    });
  }, [vendors, searchTerm, categoryFilter]);

  const avgPayoutPerVendor = vendors.length > 0 ? Math.round(totalVendorPaidAll / vendors.length) : 0;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5" />
            <span>Vendors & Material Suppliers OS</span>
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Vendors & Suppliers ({vendors.length})
          </h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Record Vendor Bill / Payment</span>
        </button>
      </div>

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Vendors</span>
            <Store className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{vendors.length}</div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Active Suppliers & Thekedars</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Vendor Paid</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700">₹{totalVendorPaidAll.toLocaleString('en-IN')}</div>
          <p className="mt-1 text-[11px] text-amber-600 font-bold">Material & Expenses Done</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Bills Logged</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">{totalBillsAll}</div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Invoices & Receipts</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Average Payout / Vendor</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-700">₹{avgPayoutPerVendor.toLocaleString('en-IN')}</div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Per Vendor Average</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Filter Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-slate-200/80 text-slate-700 text-xs font-bold self-start">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              categoryFilter === 'all' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            All Vendors ({vendors.length})
          </button>
          <button
            onClick={() => setCategoryFilter('material')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              categoryFilter === 'material' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Material & Hardware
          </button>
          <button
            onClick={() => setCategoryFilter('thekedar')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              categoryFilter === 'thekedar' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Subcontractors / Thekedar
          </button>
          <button
            onClick={() => setCategoryFilter('transport')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              categoryFilter === 'transport' ? 'bg-white text-amber-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Transport & Vehicles
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search vendor name, UPI, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-amber-600 shadow-sm"
          />
        </div>
      </div>

      {/* Vendors Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 animate-pulse">Loading vendor directory...</div>
      ) : filteredVendors.length === 0 ? (
        <div className="razorpay-card p-12 text-center space-y-3">
          <Store className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No vendors found</p>
          <p className="text-xs text-slate-500">
            Send WhatsApp payment screenshots with caption &quot;v&quot; or click &quot;+ Record Vendor Bill&quot; to add vendors.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="razorpay-card p-5 flex flex-col justify-between gap-4 hover:shadow-lg hover:border-amber-200 transition-all"
            >
              {/* Top Vendor Entity Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-extrabold text-sm shrink-0">
                    {vendor.name.charAt(0)}
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {vendor.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-200">
                        {vendor.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        {vendor.billsCount} Bills
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* UPI & Payment info */}
              <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                {vendor.upiId ? (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">UPI Handle:</span>
                    <span className="font-mono font-bold text-blue-700 truncate max-w-[150px]">{vendor.upiId}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">Payment Method:</span>
                    <span className="font-bold text-slate-700 uppercase">{vendor.paymentMethod || 'Direct'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">Latest Payment:</span>
                  <span className="text-slate-700 font-bold">{vendor.latestPaymentDate}</span>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="py-2.5 px-3 rounded-xl bg-amber-50/50 border border-amber-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-600 font-bold">Total Paid to Date:</span>
                <span className="text-base font-black text-amber-800">
                  ₹{vendor.totalPaid.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Card Action: View Details */}
              <div className="pt-1 border-t border-slate-100">
                <Link
                  href={`/vendors/${vendor.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold shadow transition-all active:scale-95 text-xs"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Vendor Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-600" />
                  <span>Record Vendor / Material Bill</span>
                </h3>
                <p className="text-xs text-slate-500">Record bill or invoice payment to vendor</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateVendorPayment} className="space-y-3.5 text-xs font-semibold">
              <div>
                <label className="text-slate-700 block mb-1">Vendor / Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sri Cements / Dinesh Bhai"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 45000"
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
                <label className="text-slate-700 block mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Sand 2 dumpers / Steel rods"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Confirm & Save to Vendor Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
