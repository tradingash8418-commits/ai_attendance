'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Store } from 'lucide-react';
import { VendorsService, VendorSummary } from '@/services/vendors.service';
import VendorProfileDossier from '@/components/VendorProfileDossier';

export default function VendorDetailPage() {
  const params = useParams();
  const vendorId = params?.vendorId as string;

  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadVendor = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const vendorData = await VendorsService.getVendorById(vendorId);
      setVendor(vendorData);
    } catch (err) {
      console.error('Failed to load vendor profile:', err);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadVendor();
  }, [loadVendor]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:text-amber-700 hover:border-amber-300 shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← Back to Vendors Directory</span>
        </Link>
      </div>

      {loading ? (
        <div className="py-24 text-center text-xs text-slate-500 animate-pulse font-medium">
          Loading vendor 360° profile intelligence...
        </div>
      ) : !vendor ? (
        <div className="razorpay-card p-12 text-center space-y-3">
          <Store className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-base font-extrabold text-slate-800">Vendor record not found</p>
          <p className="text-xs text-slate-500">
            The requested vendor profile could not be found or has no recorded payments.
          </p>
          <Link
            href="/vendors"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow transition-all"
          >
            <span>Go to Vendors Directory</span>
          </Link>
        </div>
      ) : (
        <VendorProfileDossier
          vendor={vendor}
          onVendorUpdated={loadVendor}
        />
      )}
    </div>
  );
}
