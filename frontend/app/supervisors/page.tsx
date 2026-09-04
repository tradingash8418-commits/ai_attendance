'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Plus, CheckCircle, XCircle, Phone, MessageSquare, Search } from 'lucide-react';
import { SupervisorsService } from '@/services/supervisors.service';
import type { Supervisor } from '@/types/supervisor';

export default function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Add Supervisor Form
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadSupervisors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await SupervisorsService.getSupervisors();
      setSupervisors(data);
    } catch (err) {
      console.error('Failed to load supervisors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

  const handleCreateSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsappNumber.trim()) {
      setErrorMsg('Name and WhatsApp number are required.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await SupervisorsService.createSupervisor({
        name,
        phone,
        whatsappNumber,
        email,
      });
      setName('');
      setPhone('');
      setWhatsappNumber('');
      setEmail('');
      setShowAddModal(false);
      await loadSupervisors();
    } catch (err) {
      console.error('Error creating supervisor:', err);
      setErrorMsg('Failed to create supervisor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await SupervisorsService.toggleSupervisorActive(id, !currentActive);
      await loadSupervisors();
    } catch (err) {
      console.error('Error toggling supervisor active status:', err);
    }
  };

  const filteredSupervisors = supervisors.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.whatsappNumber && s.whatsappNumber.toLowerCase().includes(term)) ||
      (s.phone && s.phone.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header - Razorpay Style */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Site Contacts & Leads
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900">Supervisors ({supervisors.length})</h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supervisor</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          placeholder="Search by supervisor name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-600 shadow-sm"
        />
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
          Loading site supervisors...
        </div>
      ) : filteredSupervisors.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <UserCheck className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No supervisors found</p>
          <p className="text-xs text-slate-500">
            Supervisors receive and send group selfie photos on WhatsApp for site attendance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSupervisors.map((s) => (
            <div
              key={s.id}
              className={`bg-white border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 ${
                s.active
                  ? 'border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300'
                  : 'border-slate-200 bg-slate-50/60 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{s.name}</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp: {s.whatsappNumber}</span>
                    </div>

                    {s.phone && s.phone !== s.whatsappNumber && (
                      <div className="flex items-center gap-2 text-slate-500 px-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>Alt: {s.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleActive(s.id, s.active)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    s.active
                      ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                      : 'text-slate-400 border-slate-200 bg-slate-100'
                  }`}
                  title={s.active ? 'Active Supervisor' : 'Inactive Supervisor'}
                >
                  {s.active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Supervisor Modal - Razorpay White Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-2xl text-slate-900">
            <h2 className="text-lg font-extrabold text-slate-900">Register Site Supervisor</h2>
            {errorMsg && (
              <p className="text-xs p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {errorMsg}
              </p>
            )}

            <form onSubmit={handleCreateSupervisor} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Supervisor Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Supervisor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  WhatsApp Number (For Bot Messages) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Alternate Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 91234 56789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all"
                >
                  {submitting ? 'Registering...' : 'Register Supervisor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
