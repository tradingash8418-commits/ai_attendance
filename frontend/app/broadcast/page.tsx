'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Megaphone,
  Send,
  Users,
  Building2,
  X,
  Search,
  Sparkles,
  UserCheck,
  Radio,
  FileText,
} from 'lucide-react';
import { BroadcastService } from '@/services/broadcast.service';
import { SitesService } from '@/services/sites.service';
import { WorkersService } from '@/services/workers.service';
import { SupervisorsService } from '@/services/supervisors.service';
import { getTodayDateString } from '@/lib/formatters';
import type { BroadcastLog, BroadcastTargetGroup, BroadcastPresetTemplate } from '@/types/broadcast';
import type { Site } from '@/types/site';

export default function BroadcastPage() {
  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [supervisorCount, setSupervisorCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formMessage, setFormMessage] = useState<string>('');
  const [formCategory, setFormCategory] = useState<'holiday' | 'safety' | 'event' | 'payment' | 'general'>('general');
  const [formTargetGroup, setFormTargetGroup] = useState<BroadcastTargetGroup>('all');
  const [formSiteId, setFormSiteId] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState<string>('');

  const todayStr = getTodayDateString();

  // Preset Announcement Templates
  const presets: BroadcastPresetTemplate[] = [
    {
      id: 'preset_holiday',
      title: '🚨 Holiday Announcement',
      category: 'holiday',
      icon: 'Umbrella',
      defaultTitle: 'Urgent Holiday Notice - Site Closed Tomorrow',
      defaultMessage:
        'Dear Workforce Team,\n\nPlease note that tomorrow will be a full holiday for all workers and supervisors. Work on site will remain closed due to heavy rain / festival. Regular work shift will resume as normal day after tomorrow at 8:00 AM.',
    },
    {
      id: 'preset_safety',
      title: '⚠️ Safety Warning',
      category: 'safety',
      icon: 'AlertTriangle',
      defaultTitle: 'Mandatory Site Safety & Helmet Warning',
      defaultMessage:
        'Safety First Alert ⚠️:\n\nAll labours and supervisors entering the construction site tomorrow must wear mandatory safety helmets, reflective jackets, and safety boots. Entry without complete safety gear will strictly NOT be permitted.',
    },
    {
      id: 'preset_shift',
      title: '🏗️ Shift Change Notice',
      category: 'event',
      icon: 'Clock',
      defaultTitle: 'Revised Work Shift Timings Notice',
      defaultMessage:
        'Attention All Teams:\n\nPlease note revised site shift timing starting tomorrow. Morning shift check-in starts strictly at 8:00 AM. Late check-ins after 9:30 AM will be recorded as late shifts.',
    },
    {
      id: 'preset_payment',
      title: '💵 Wage & Ledger Credit',
      category: 'payment',
      icon: 'IndianRupee',
      defaultTitle: 'Weekly Worker Wages & Ledger Release',
      defaultMessage:
        'Payment Update 💵:\n\nWeekly worker wages and advance payouts for the current cycle have been processed & updated in your Khata ledger. Please check with your site supervisor for cash payout receipts.',
    },
    {
      id: 'preset_general',
      title: '📢 General Meeting Notice',
      category: 'general',
      icon: 'Megaphone',
      defaultTitle: 'Important Site Briefing Meeting',
      defaultMessage:
        'Attention All Workers & Supervisors:\n\nPlease report to the site main office tomorrow morning at 8:30 AM for a brief site safety and work allocation meeting before starting your shift.',
    },
  ];

  // Load Initial Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, sitesData, workersData, supsData] = await Promise.all([
        BroadcastService.getBroadcastLogs(),
        SitesService.getSites(),
        WorkersService.getWorkers(),
        SupervisorsService.getSupervisors(),
      ]);
      setLogs(logsData);
      setSites(sitesData);
      setWorkerCount(workersData.length);
      setSupervisorCount(supsData.length);
    } catch (err) {
      console.error('Failed to load broadcast page data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply Preset Template
  const handleApplyPreset = (preset: BroadcastPresetTemplate) => {
    setFormTitle(preset.defaultTitle);
    setFormMessage(preset.defaultMessage);
    setFormCategory(preset.category);
  };

  // Estimate Audience Recipient Count
  const estimatedRecipientCount = useMemo(() => {
    if (formTargetGroup === 'workers') return workerCount;
    if (formTargetGroup === 'supervisors') return supervisorCount;
    if (formTargetGroup === 'all') return workerCount + supervisorCount;
    return Math.max(1, Math.round((workerCount + supervisorCount) / Math.max(1, sites.length)));
  }, [formTargetGroup, workerCount, supervisorCount, sites.length]);

  // Submit Broadcast Dispatch
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      alert('Please enter an announcement title');
      return;
    }
    if (!formMessage.trim()) {
      alert('Please enter the announcement message content');
      return;
    }

    if (!confirm(`Are you sure you want to dispatch this WhatsApp broadcast to approximately ${estimatedRecipientCount} recipient(s)?`)) {
      return;
    }

    setDispatching(true);
    setNotificationStatus(null);
    try {
      const res = await BroadcastService.sendBroadcast({
        title: formTitle,
        message: formMessage,
        category: formCategory,
        targetGroup: formTargetGroup,
        siteId: formTargetGroup === 'site' ? formSiteId : undefined,
      });

      if (res.success) {
        setNotificationStatus({
          msg: `✅ WhatsApp Broadcast dispatched successfully! (${res.successCount} delivered, ${res.failureCount} failed out of ${res.recipientCount})`,
          type: 'success',
        });
        setFormTitle('');
        setFormMessage('');
        await loadData();
      } else {
        setNotificationStatus({
          msg: `⚠️ Broadcast alert: ${res.error || (res.errors && res.errors.join(', ')) || 'Dispatch incomplete'}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error('Broadcast dispatch error:', err);
      setNotificationStatus({
        msg: `❌ Failed to dispatch broadcast: ${err?.message || 'Network error'}`,
        type: 'error',
      });
    } finally {
      setDispatching(false);
    }
  };

  // Filtered Past Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const query = searchTerm.toLowerCase();
      return (
        log.title.toLowerCase().includes(query) ||
        log.message.toLowerCase().includes(query) ||
        (log.siteName && log.siteName.toLowerCase().includes(query))
      );
    });
  }, [logs, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Megaphone className="w-7 h-7 text-blue-600" />
            <span>Workforce Broadcast & Emergency Notice Board</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Dispatch 1-click WhatsApp notices, holiday updates, safety warnings, and instructions to all labours & supervisors simultaneously.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Total Reach: {workerCount + supervisorCount} Contact Numbers</span>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
            notificationStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <span>{notificationStatus.msg}</span>
          <button onClick={() => setNotificationStatus(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1-Touch Speed Presets Bar */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>1-Touch Announcement Templates (Click to Auto-Fill):</span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 text-left transition-all active:scale-95 space-y-1 shadow-sm"
            >
              <div className="text-xs font-bold text-slate-900 truncate">{preset.title}</div>
              <div className="text-[10px] text-slate-500 font-normal line-clamp-1">{preset.defaultTitle}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Broadcast Composer & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Broadcast Composer Form */}
        <div className="lg:col-span-2 razorpay-card p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-600 animate-pulse" />
              <span>Compose WhatsApp Announcement</span>
            </h2>
            <span className="text-xs font-bold text-slate-500">Asia/Kolkata IST</span>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
            {/* Target Audience Selector Pills */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Select Target Audience *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'all', label: 'Entire Workforce', desc: 'Workers + Supervisors', icon: Users },
                  { key: 'workers', label: 'Workers Only', desc: `${workerCount} Labours`, icon: Users },
                  { key: 'supervisors', label: 'Supervisors Only', desc: `${supervisorCount} Supervisors`, icon: UserCheck },
                  { key: 'site', label: 'Specific Site', desc: 'Select Site Team', icon: Building2 },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = formTargetGroup === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFormTargetGroup(item.key as BroadcastTargetGroup)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-extrabold">
                        <Icon className="w-3.5 h-3.5 text-blue-600" />
                        <span>{item.label}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Site Dropdown (if Target is Specific Site) */}
            {formTargetGroup === 'site' && (
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1 animate-in fade-in duration-150">
                <label className="font-bold text-amber-900 block">Select Target Site *</label>
                <select
                  value={formSiteId}
                  onChange={(e) => setFormSiteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Construction Site --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.address || 'Site Gate'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notice Title */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Announcement Subject / Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Urgent Holiday Notice - Site Closed Tomorrow"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-blue-600 text-sm"
              />
            </div>

            {/* Notice Message Content */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Notice Message Content (WhatsApp Body) *</label>
              <textarea
                rows={5}
                required
                placeholder="Type your announcement details in clear bullet points..."
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-blue-600 text-xs leading-relaxed"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-slate-500">
                Will be delivered to approx. <strong className="text-blue-700">{estimatedRecipientCount}</strong> contacts.
              </span>
              <button
                type="submit"
                disabled={dispatching}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{dispatching ? 'Dispatching WhatsApp Messages...' : '📢 Send One-Click Broadcast'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Live WhatsApp Preview */}
        <div className="space-y-4">
          <div className="razorpay-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Live WhatsApp Message Preview</span>
            </h3>

            {/* WhatsApp Chat Bubble Mockup */}
            <div className="rounded-2xl p-4 bg-[#efeae2] border border-slate-300 text-slate-900 space-y-2 font-sans shadow-inner text-xs leading-relaxed">
              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 space-y-2">
                <div className="font-bold text-emerald-800 text-[11px] uppercase tracking-wide border-b pb-1">
                  📢 OFFICIAL NOTICE / ANNOUNCEMENT
                </div>

                <div className="font-extrabold text-slate-900 text-xs">
                  📌 {formTitle || 'Sample Announcement Subject'}
                </div>

                <div className="text-[11px] text-slate-700 whitespace-pre-line font-normal">
                  {formMessage || 'Your announcement message content will appear here cleanly formatted for workers and supervisors.'}
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium flex items-center justify-between">
                  <span>📅 Date: {todayStr}</span>
                  <span className="text-emerald-600 font-bold">✓ Sent via Averox AI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="razorpay-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Past Broadcast & Notice Logs</h2>
            <p className="text-xs text-slate-500 mt-0.5">Historical record of all dispatched one-click announcements.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 font-medium">Loading broadcast logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 font-medium">
            No past broadcast messages found. Send your first announcement above!
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 hover:border-slate-300 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-sm text-slate-900">{log.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                      Group: {log.targetGroup}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✅ {log.successCount} / {log.recipientCount} Delivered
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 font-normal whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {log.message}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-medium">
                  <span>Category: {log.category.toUpperCase()} {log.siteName ? `• Site: ${log.siteName}` : ''}</span>
                  <span>Dispatched: {log.sentAt?.toDate ? log.sentAt.toDate().toLocaleString() : todayStr}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
