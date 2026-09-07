'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Phone,
  MessageSquare,
  Mail,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Save,
  Sparkles,
  RefreshCw,
  HardHat,
  BadgeCheck,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserProfileService, UserProfile } from '@/services/user-profile.service';
import { normalizeWhatsAppNumber } from '@/lib/formatters';

export default function ProfilePage() {
  const { user, userProfile: initialProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [loading, setLoading] = useState<boolean>(false);

  // Form edit states
  const [displayName, setDisplayName] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  // UI Feedback States
  const [copiedOrgId, setCopiedOrgId] = useState<boolean>(false);
  const [copiedUid, setCopiedUid] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setDisplayName(initialProfile.displayName || '');
      setOrganizationName(initialProfile.organizationName || '');
      setWhatsappNumber(initialProfile.whatsappNumber || '');
      setPhone(initialProfile.phone || initialProfile.whatsappNumber || '');
    } else if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [initialProfile, user]);

  const refreshProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const latest = await UserProfileService.getUserProfile(user.uid);
      if (latest) {
        setProfile(latest);
        setDisplayName(latest.displayName || '');
        setOrganizationName(latest.organizationName || '');
        setWhatsappNumber(latest.whatsappNumber || '');
        setPhone(latest.phone || latest.whatsappNumber || '');
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const cleanWa = normalizeWhatsAppNumber(whatsappNumber);
      const cleanPhone = phone ? normalizeWhatsAppNumber(phone) : cleanWa;

      // 1. Update user profile fields in Firestore
      await UserProfileService.updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        whatsappNumber: cleanWa,
        phone: cleanPhone,
      });

      // 2. Update organization name if modified
      if (profile?.organizationId && organizationName.trim()) {
        await UserProfileService.updateOrganizationName(profile.organizationId, organizationName.trim());
      }

      setSuccessMessage('Profile and organization details saved successfully! Primary supervisor record synced.');
      await refreshProfile();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setErrorMessage(err?.message || 'Failed to update profile details.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: 'orgId' | 'uid') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'orgId') {
      setCopiedOrgId(true);
      setTimeout(() => setCopiedOrgId(false), 2000);
    } else {
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-16 text-center text-slate-500 font-medium">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        Loading registered contractor profile...
      </div>
    );
  }

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'CA';

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Contractor Profile & Settings</h1>
            <span className="razorpay-badge-ai">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>MULTI-TENANT OS</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            View and manage your registered contractor profile, business details, WhatsApp integration number, and tenant credentials.
          </p>
        </div>

        <button
          onClick={refreshProfile}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Alert Banners */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Main Profile Hero Dossier Card */}
      <div className="razorpay-card p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-blue-600/30 border border-white/20">
              {initials}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {displayName || 'Contractor Admin'}
                </h2>
                <BadgeCheck className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-xs font-medium text-slate-400 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{organizationName || profile?.organizationName || "Contractor's Infra"}</span>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                  Role: {profile?.role || 'admin'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                  Plan: Free Trial
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Profile Form & Tenant Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Editable Personal & Business Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveProfile} className="razorpay-card p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Registered Personal & Business Details</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Update your registered contractor name, organization title, and WhatsApp numbers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Contractor Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Contractor Name (Full Name)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Organization / Company Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Company / Organization Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    placeholder="e.g. Sharma Constructions & Infra"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Registered WhatsApp Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Registered WhatsApp Mobile Number
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="e.g. +919876543210"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-blue-500" />
                  Used to receive automated 1-Tap QR check-in reports & OCR payment receipts.
                </p>
              </div>

              {/* Registered Phone Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Primary Contact Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +919876543210"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Email Address (Read Only) */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-slate-700">Registered Email Address (Auth Login)</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={user?.email || profile?.email || ''}
                  disabled
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Submit Save Button */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Changes...' : 'Save Profile Details'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (1 Col): Organization & Tenant Technical Credentials */}
        <div className="space-y-6">
          {/* Tenant Credentials Box */}
          <div className="razorpay-card p-6 space-y-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              <span>Tenant Credentials</span>
            </h3>

            {/* Organization ID */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Organization Context ID
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl bg-slate-900 text-blue-300 font-mono text-[11px] font-bold truncate">
                  {profile?.organizationId || 'org_primary'}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(profile?.organizationId || 'org_primary', 'orgId')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  title="Copy Org ID"
                >
                  {copiedOrgId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* User Auth UID */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                User Authentication UID
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-mono text-[11px] font-bold truncate">
                  {user?.uid || profile?.uid || '-'}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(user?.uid || '', 'uid')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  title="Copy User UID"
                >
                  {copiedUid ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Supervisor Mapping Status */}
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-blue-900">
                <HardHat className="w-4 h-4 text-blue-600" />
                <span>Primary Supervisor Synced</span>
              </div>
              <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                Your registered WhatsApp number (<span className="font-bold">{whatsappNumber || 'Not set'}</span>) is auto-provisioned as the primary supervisor for {organizationName || 'your Infra'}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
