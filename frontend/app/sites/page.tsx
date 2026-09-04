'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Users,
  UserCheck,
  Calendar,
  CheckCircle,
  XCircle,
  MapPin,
  QrCode,
  Printer,
  Crosshair,
  ExternalLink,
} from 'lucide-react';
import { SitesService } from '@/services/sites.service';
import { SupervisorsService } from '@/services/supervisors.service';
import { WorkersService } from '@/services/workers.service';
import { SiteAssignmentsService } from '@/services/siteAssignments.service';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
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

  // Set Location Modal
  const [selectedSiteForLocation, setSelectedSiteForLocation] = useState<Site | null>(null);
  const [locationLat, setLocationLat] = useState<string>('');
  const [locationLon, setLocationLon] = useState<string>('');
  const [locationRadius, setLocationRadius] = useState<number>(150);
  const [fetchingGps, setFetchingGps] = useState<boolean>(false);
  const [submittingLocation, setSubmittingLocation] = useState<boolean>(false);
  const [locationStatusNotice, setLocationStatusNotice] = useState<string | null>(null);

  // View QR Poster Modal
  const [selectedSiteForQR, setSelectedSiteForQR] = useState<Site | null>(null);
  const [qrCheckInUrl, setQrCheckInUrl] = useState<string>('');

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

  // Open Location Modal
  const handleOpenLocationModal = (site: Site) => {
    setSelectedSiteForLocation(site);
    setLocationLat(site.latitude !== undefined && site.latitude !== null ? site.latitude.toString() : '');
    setLocationLon(site.longitude !== undefined && site.longitude !== null ? site.longitude.toString() : '');
    setLocationRadius(site.radiusMeters || 150);
    setLocationStatusNotice(null);
  };

  // Capture Browser Current GPS Location
  const handleCaptureCurrentGPS = () => {
    if (!navigator.geolocation) {
      setLocationStatusNotice('❌ Geolocation is not supported by your browser.');
      return;
    }
    setFetchingGps(true);
    setLocationStatusNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLat(pos.coords.latitude.toFixed(6));
        setLocationLon(pos.coords.longitude.toFixed(6));
        setFetchingGps(false);
        setLocationStatusNotice(`✅ Acquired GPS location (Accuracy: ~${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setFetchingGps(false);
        setLocationStatusNotice(`❌ GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Save Location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteForLocation) return;
    const lat = parseFloat(locationLat);
    const lon = parseFloat(locationLon);
    if (isNaN(lat) || isNaN(lon)) {
      setLocationStatusNotice('❌ Please enter valid numerical latitude and longitude.');
      return;
    }

    setSubmittingLocation(true);
    try {
      await SitesService.updateSite(selectedSiteForLocation.id, {
        latitude: lat,
        longitude: lon,
        radiusMeters: locationRadius > 0 ? locationRadius : 150,
      });
      setSelectedSiteForLocation(null);
      await loadData();
    } catch (err: any) {
      console.error('Error saving site location:', err);
      setLocationStatusNotice(`❌ Failed to save: ${err?.message || 'Server error'}`);
    } finally {
      setSubmittingLocation(false);
    }
  };

  // Open QR Code Modal
  const handleOpenQRModal = async (site: Site) => {
    setSelectedSiteForQR(site);
    try {
      const token = await SitesService.ensureSiteCheckInToken(site.id);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setQrCheckInUrl(`${origin}/checkin/${token}`);
    } catch (err) {
      console.error('Failed to generate site check-in QR:', err);
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
            const hasLocation =
              site.latitude !== undefined &&
              site.latitude !== null &&
              site.longitude !== undefined &&
              site.longitude !== null;

            return (
              <div
                key={site.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                  site.active
                    ? 'bg-slate-900/80 border-slate-800'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{site.name}</h3>
                      {site.address && (
                        <p className="text-xs text-slate-400 mt-0.5">{site.address}</p>
                      )}
                    </div>
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

                  {/* Geofence Location Status Badge */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        hasLocation
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {hasLocation
                          ? `GPS Set • Radius ${site.radiusMeters || 150}m`
                          : 'Location Not Set'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenLocationModal(site)}
                      className="text-[11px] font-bold text-slate-300 hover:text-amber-400 underline underline-offset-2 transition-colors"
                    >
                      {hasLocation ? 'Update Location' : 'Set Location'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
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

                {/* Site Actions: QR Poster, Assign Worker, Attendance */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs font-semibold">
                  <button
                    onClick={() => handleOpenQRModal(site)}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all active:scale-95"
                  >
                    <QrCode className="w-3.5 h-3.5 shrink-0" />
                    <span>View QR</span>
                  </button>

                  <button
                    onClick={() => setSelectedSiteForAssign(site)}
                    className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assign</span>
                  </button>

                  <Link
                    href={`/sites/${site.id}/attendance`}
                    className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Logs</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Set Location Modal */}
      {selectedSiteForLocation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <MapPin className="w-4 h-4" />
                <span>Set Geofence Coordinates</span>
              </div>
              <button
                onClick={() => setSelectedSiteForLocation(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-white">{selectedSiteForLocation.name}</h2>
              <p className="text-xs text-slate-400">
                Workers scanning the QR must be physically within this site boundary.
              </p>
            </div>

            {/* Quick 1-Click GPS Capture Button */}
            <button
              type="button"
              onClick={handleCaptureCurrentGPS}
              disabled={fetchingGps}
              className="w-full py-3 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Crosshair className={`w-4 h-4 ${fetchingGps ? 'animate-spin' : ''}`} />
              <span>{fetchingGps ? 'Acquiring GPS Signal...' : 'Use My Current GPS Location (1-Click)'}</span>
            </button>

            {locationStatusNotice && (
              <div className="text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                {locationStatusNotice}
              </div>
            )}

            <form onSubmit={handleSaveLocation} className="space-y-3 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 19.0596"
                    value={locationLat}
                    onChange={(e) => setLocationLat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 72.8295"
                    value={locationLon}
                    onChange={(e) => setLocationLon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Allowed Geofence Radius (in meters) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="20"
                    max="2000"
                    required
                    value={locationRadius}
                    onChange={(e) => setLocationRadius(parseInt(e.target.value, 10) || 150)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-400">meters</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Standard construction gate radius is 150m. Larger sites can be 250m+.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedSiteForLocation(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLocation}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-lg transition-all"
                >
                  {submittingLocation ? 'Saving...' : 'Save Geofence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View QR Code & Printable Poster Modal */}
      {selectedSiteForQR && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 print:p-0 print:bg-white">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black">
            {/* Modal Header */}
            <div className="flex items-center justify-between print:hidden">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                <QrCode className="w-3.5 h-3.5" />
                <span>Site Entrance Attendance Poster</span>
              </div>
              <button
                onClick={() => setSelectedSiteForQR(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Printable Poster Card */}
            <div className="bg-white text-slate-900 rounded-2xl p-6 text-center space-y-4 shadow-xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                  Contractor AI • Gate Check-In
                </span>
                <h2 className="text-xl font-black text-slate-950 tracking-tight">
                  {selectedSiteForQR.name}
                </h2>
                {selectedSiteForQR.address && (
                  <p className="text-xs text-slate-600">{selectedSiteForQR.address}</p>
                )}
              </div>

              {/* QR Code */}
              <div className="py-2">
                {qrCheckInUrl ? (
                  <QRCodeDisplay value={qrCheckInUrl} size={220} className="mx-auto" />
                ) : (
                  <div className="w-48 h-48 mx-auto flex items-center justify-center text-xs text-slate-400">
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Simple Bilingual Instructions for Workers */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1.5 text-xs text-slate-800">
                <p className="font-extrabold text-slate-950 text-[11px] uppercase tracking-wider text-center">
                  📱 Attendance Kaise Lagayein:
                </p>
                <div className="space-y-1 text-[11px] text-slate-700">
                  <p>1️⃣ Apne mobile camera ya WhatsApp se is QR ko scan karein.</p>
                  <p>2️⃣ Browser me <strong>Allow Location</strong> par tap karein.</p>
                  <p>3️⃣ WhatsApp open hoga ➡ Apni <strong>Live Selfie</strong> bhejein!</p>
                </div>
              </div>

              <div className="text-[9px] text-slate-500 uppercase tracking-wider">
                Geofence Protected • AI Face Recognition
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print Poster (A4)</span>
              </button>

              {qrCheckInUrl && (
                <a
                  href={qrCheckInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Test Link</span>
                </a>
              )}
            </div>
          </div>
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
