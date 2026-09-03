'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Plus, CheckCircle, XCircle, Phone, MessageSquare } from 'lucide-react';
import { SupervisorsService } from '@/services/supervisors.service';
import { normalizeWhatsAppNumber } from '@/lib/formatters';
import type { Supervisor } from '@/types/supervisor';

export default function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  return (
    <div className="flex-1 max-w-md md:max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Site Contacts
          </span>
          <h1 className="text-2xl font-extrabold text-white">Supervisors ({supervisors.length})</h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supervisor</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
          Loading site supervisors...
        </div>
      ) : supervisors.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <UserCheck className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No supervisors registered</p>
          <p className="text-xs text-slate-500">
            Supervisors receive and send group selfie photos on WhatsApp for site attendance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {supervisors.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                s.active
                  ? 'bg-slate-900/80 border-slate-800'
                  : 'bg-slate-950/60 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-100">{s.name}</h3>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp: {s.whatsappNumber}</span>
                    </div>

                    {s.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Phone: {s.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleActive(s.id, s.active)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    s.active
                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                      : 'text-slate-500 border-slate-800 bg-slate-900'
                  }`}
                >
                  {s.active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Supervisor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Register Supervisor</h2>
            {errorMsg && <p className="text-xs text-rose-400 font-semibold">{errorMsg}</p>}

            <form onSubmit={handleCreateSupervisor} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Supervisor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Supervisor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">WhatsApp Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
                {whatsappNumber && (
                  <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
                    Normalized: {normalizeWhatsAppNumber(whatsappNumber)}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Contact Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg"
                >
                  {submitting ? 'Saving...' : 'Save Supervisor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
