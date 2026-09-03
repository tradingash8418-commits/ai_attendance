'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Building2, Plus, Users, UserCheck, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { SitesService } from '@/services/sites.service';
import { SupervisorsService } from '@/services/supervisors.service';
import { WorkersService } from '@/services/workers.service';
import { SiteAssignmentsService } from '@/services/siteAssignments.service';
import { getWorkerDisplayName } from '@/lib/formatters';
import type { Site, SiteAssignment } from '@/types/site';
import type { Supervisor } from '@/types/supervisor';
import type { Worker } from '@/types/worker';

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<SiteAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Site Modal
  const [showAddSiteModal, setShowAddSiteModal] = useState<boolean>(false);
  const [siteName, setSiteName] = useState<string>('');
  const [siteAddress, setSiteAddress] = useState<string>('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [submittingSite, setSubmittingSite] = useState<boolean>(false);

  // Assign Worker Modal
  const [selectedSiteForAssign, setSelectedSiteForAssign] = useState<Site | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState<string>('');
  const [submittingAssign, setSubmittingAssign] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sitesData, supsData, workersData, assignData] = await Promise.all([
        SitesService.getSites(),
        SupervisorsService.getSupervisors(),
        WorkersService.getWorkers(),
        SiteAssignmentsService.getSiteAssignments(),
      ]);
      setSites(sitesData);
      setSupervisors(supsData);
      setWorkers(workersData);
      setAssignments(assignData);
    } catch (err) {
      console.error('Failed to load sites data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim()) return;
    setSubmittingSite(true);
    try {
      await SitesService.createSite({
        name: siteName,
        address: siteAddress,
        supervisorId: selectedSupervisorId,
      });
      setSiteName('');
      setSiteAddress('');
      setSelectedSupervisorId('');
      setShowAddSiteModal(false);
      await loadData();
    } catch (err) {
      console.error('Error creating site:', err);
    } finally {
      setSubmittingSite(false);
    }
  };

  const handleAssignWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteForAssign || !assignWorkerId) return;
    setSubmittingAssign(true);
    try {
      await SiteAssignmentsService.assignWorkerToSite(assignWorkerId, selectedSiteForAssign.id);
      setSelectedSiteForAssign(null);
      setAssignWorkerId('');
      await loadData();
    } catch (err) {
      console.error('Error assigning worker:', err);
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleToggleSiteActive = async (siteId: string, currentActive: boolean) => {
    try {
      await SitesService.toggleSiteActive(siteId, !currentActive);
      await loadData();
    } catch (err) {
      console.error('Error toggling site status:', err);
    }
  };

  return (
    <div className="flex-1 max-w-md md:max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Construction Projects
          </span>
          <h1 className="text-2xl font-extrabold text-white">Sites ({sites.length})</h1>
        </div>

        <button
          onClick={() => setShowAddSiteModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Site</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
          Loading construction sites...
        </div>
      ) : sites.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No construction sites registered</p>
          <p className="text-xs text-slate-500">
            Click &quot;Add Site&quot; to register your active project locations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sites.map((site) => {
            const supervisor = supervisors.find((s) => s.id === site.supervisorId);
            const siteWorkerAssignments = assignments.filter((a) => a.siteId === site.id && a.active);

            return (
              <div
                key={site.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                  site.active
                    ? 'bg-slate-900/80 border-slate-800'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-100">{site.name}</h3>
                    <button
                      onClick={() => handleToggleSiteActive(site.id, site.active)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        site.active
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-slate-500 border-slate-800 bg-slate-900'
                      }`}
                    >
                      {site.active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                  </div>

                  {site.address && (
                    <p className="text-xs text-slate-400 mt-1">{site.address}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>{supervisor ? supervisor.name : 'No Supervisor Assigned'}</span>
                    </div>

                    <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      <span>{siteWorkerAssignments.length} Worker(s) Assigned</span>
                    </div>
                  </div>
                </div>

                {/* Site Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-xs font-medium">
                  <button
                    onClick={() => setSelectedSiteForAssign(site)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assign Worker</span>
                  </button>

                  <Link
                    href={`/sites/${site.id}/attendance`}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Attendance</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Site Modal */}
      {showAddSiteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Create Construction Site</h2>

            <form onSubmit={handleCreateSite} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Site Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Andheri Office Commercial"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Plot 42, Andheri West, Mumbai"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Assigned Supervisor</label>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Select Supervisor --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.whatsappNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSite}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg"
                >
                  {submittingSite ? 'Creating...' : 'Create Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {selectedSiteForAssign && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">
              Assign Worker to {selectedSiteForAssign.name}
            </h2>

            <form onSubmit={handleAssignWorker} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Select Worker</label>
                <select
                  required
                  value={assignWorkerId}
                  onChange={(e) => setAssignWorkerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Worker --</option>
                  {workers
                    .filter((w) => w.active)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {getWorkerDisplayName(w)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSiteForAssign(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg"
                >
                  {submittingAssign ? 'Assigning...' : 'Assign Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
