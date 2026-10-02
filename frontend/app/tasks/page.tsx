'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Calendar,
  Building2,
  UserCheck,
  Users,
  Send,
  CheckCircle2,
  Pencil,
  Trash2,
  Search,
  X,
  FileText,
} from 'lucide-react';
import { TasksService } from '@/services/tasks.service';
import { SitesService } from '@/services/sites.service';
import { SupervisorsService } from '@/services/supervisors.service';
import { WorkersService } from '@/services/workers.service';
import { getWorkerDisplayName, getTodayDateString } from '@/lib/formatters';
import type { TaskAssignment, TaskStatus } from '@/types/task';
import type { Site } from '@/types/site';
import type { Supervisor } from '@/types/supervisor';
import type { Worker } from '@/types/worker';

export default function TasksPage() {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State for Create / Edit Task
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<TaskAssignment | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formSiteId, setFormSiteId] = useState<string>('');
  const [formSupervisorId, setFormSupervisorId] = useState<string>('');
  const [formSupervisorTasks, setFormSupervisorTasks] = useState<string>('');
  const [formSelectedWorkerIds, setFormSelectedWorkerIds] = useState<string[]>([]);
  const [formContactName, setFormContactName] = useState<string>('Contractor Admin');
  const [formContactPhone, setFormContactPhone] = useState<string>('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState<string>('');

  // Processing Action States
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notifyingTaskId, setNotifyingTaskId] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, sitesData, supervisorsData, workersData] = await Promise.all([
        TasksService.getTasks({ date: selectedDate }),
        SitesService.getSites(),
        SupervisorsService.getSupervisors(),
        WorkersService.getWorkers(),
      ]);

      setTasks(tasksData);
      setSites(sitesData);
      setSupervisors(supervisorsData);
      setWorkers(workersData);

      // Pre-fill default site and supervisor if creating first time
      if (sitesData.length > 0 && !formSiteId && sitesData[0]) {
        setFormSiteId(sitesData[0].id);
      }
      if (supervisorsData.length > 0 && !formSupervisorId && supervisorsData[0]) {
        setFormSupervisorId(supervisorsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, formSiteId, formSupervisorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset Form
  const resetForm = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(selectedDate || todayStr);
    setFormSiteId(sites[0]?.id || '');
    setFormSupervisorId(supervisors[0]?.id || '');
    setFormSupervisorTasks('');
    setFormSelectedWorkerIds([]);
    setFormContactName('Contractor Admin');
    setFormContactPhone('');
    setWorkerSearchTerm('');
  };

  // Open Edit Modal
  const handleOpenEditModal = (task: TaskAssignment) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormDate(task.date);
    setFormSiteId(task.siteId);
    setFormSupervisorId(task.supervisorId);
    setFormSupervisorTasks(task.supervisorTasks || '');
    setFormSelectedWorkerIds(task.assignedWorkerIds || []);
    setFormContactName(task.contactPersonName || 'Contractor Admin');
    setFormContactPhone(task.contactPersonPhone || '');
    setShowTaskModal(true);
  };

  // Submit Create or Edit Form
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Please enter a task title');
      return;
    }
    if (!formSiteId) {
      alert('Please select a site');
      return;
    }

    setSubmitting(true);
    try {
      const selectedSite = sites.find((s) => s.id === formSiteId);
      const selectedSupervisor = supervisors.find((sup) => sup.id === formSupervisorId);

      const assignedWorkerNames = formSelectedWorkerIds.map((id) => {
        const w = workers.find((wrk) => wrk.id === id);
        return w ? getWorkerDisplayName(w) : id;
      });

      const assignedWorkerPhones = formSelectedWorkerIds.map((id) => {
        const w = workers.find((wrk) => wrk.id === id);
        return w?.phone || '';
      });

      const taskData = {
        title: formTitle,
        description: formDescription,
        siteId: formSiteId,
        siteName: selectedSite?.name || 'Site',
        date: formDate,
        supervisorId: formSupervisorId,
        supervisorName: selectedSupervisor?.name || 'Supervisor',
        supervisorPhone: selectedSupervisor?.phone || '',
        supervisorTasks: formSupervisorTasks,
        assignedWorkerIds: formSelectedWorkerIds,
        assignedWorkerNames,
        assignedWorkerPhones,
        contactPersonName: formContactName,
        contactPersonPhone: formContactPhone,
        status: editingTask ? editingTask.status : ('draft' as TaskStatus),
      };

      if (editingTask) {
        await TasksService.updateTask(editingTask.id, taskData);
      } else {
        await TasksService.createTask(taskData);
      }

      setShowTaskModal(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Failed to save task:', err);
      alert('Failed to save task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Notify Task via WhatsApp
  const handleNotifyTask = async (task: TaskAssignment) => {
    setNotifyingTaskId(task.id);
    setNotificationStatus(null);
    try {
      const res = await TasksService.notifyTaskViaWhatsApp(task.id, task.organizationId);
      if (res.success) {
        setNotificationStatus({
          msg: `✅ WhatsApp Notifications dispatched successfully to ${res.notifiedCount} recipient(s)!`,
          type: 'success',
        });
      } else {
        setNotificationStatus({
          msg: `⚠️ Notifications completed with warnings: ${res.errors.join(', ')}`,
          type: 'error',
        });
      }
      await loadData();
    } catch (err: any) {
      console.error('Failed to dispatch task notifications:', err);
      setNotificationStatus({
        msg: `❌ Error sending WhatsApp notification: ${err?.message || 'Failed to dispatch'}`,
        type: 'error',
      });
    } finally {
      setNotifyingTaskId(null);
    }
  };

  // Toggle Task Completion Status
  const handleToggleComplete = async (task: TaskAssignment) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'notified' : 'completed';
    try {
      await TasksService.updateTask(task.id, { status: newStatus });
      await loadData();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await TasksService.deleteTask(taskId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.supervisorName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSite = siteFilter === 'all' || t.siteId === siteFilter;
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [tasks, searchTerm, siteFilter, statusFilter]);

  // Metrics Computation
  const metrics = useMemo(() => {
    const total = tasks.length;
    const notified = tasks.filter((t) => t.status === 'notified').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const assignedWorkersCount = new Set(tasks.flatMap((t) => t.assignedWorkerIds)).size;

    return { total, notified, completed, assignedWorkersCount };
  }, [tasks]);

  // Filtered Workers for Modal Selection
  const modalFilteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const name = getWorkerDisplayName(w).toLowerCase();
      const code = (w.workerCode || '').toLowerCase();
      const query = workerSearchTerm.toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [workers, workerSearchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-blue-600" />
            <span>Task Management & WhatsApp Dispatch</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Assign daily work tasks to supervisors and labours, and dispatch instant automated WhatsApp notifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowTaskModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Task</span>
          </button>
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

      {/* Summary Metrics Top Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="razorpay-card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tasks</div>
            <div className="text-xl font-extrabold text-slate-900">{metrics.total}</div>
          </div>
        </div>

        <div className="razorpay-card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workers Assigned</div>
            <div className="text-xl font-extrabold text-purple-700">{metrics.assignedWorkersCount}</div>
          </div>
        </div>

        <div className="razorpay-card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Sent</div>
            <div className="text-xl font-extrabold text-emerald-700">{metrics.notified}</div>
          </div>
        </div>

        <div className="razorpay-card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed</div>
            <div className="text-xl font-extrabold text-amber-700">{metrics.completed}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="razorpay-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-3 flex-1 max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tasks, supervisors, site..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Site Filter */}
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="all">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="notified">Notified (WhatsApp Sent)</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Grid List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="razorpay-card p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-extrabold text-slate-800">No tasks found for {selectedDate}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click &quot;Create New Task&quot; above to assign tasks to your supervisors and worker teams for this site.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map((task) => {
            const isNotifying = notifyingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="razorpay-card p-5 space-y-4 flex flex-col justify-between hover:border-blue-300 transition-all shadow-xs"
              >
                <div className="space-y-3">
                  {/* Card Top: Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{task.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-blue-700">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{task.siteName}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border shrink-0 ${
                        task.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : task.status === 'notified'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {task.status === 'notified' ? '📲 Notified' : task.status}
                    </span>
                  </div>

                  {/* Task Description Preview */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-line max-h-32 overflow-y-auto">
                    {task.description}
                  </div>

                  {/* Supervisor & Workers Info */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                        <span>Supervisor:</span>
                      </span>
                      <span className="font-bold text-slate-800">
                        {task.supervisorName} {task.supervisorPhone ? `(${task.supervisorPhone})` : ''}
                      </span>
                    </div>

                    <div className="flex items-start justify-between text-slate-600">
                      <span className="font-semibold flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Assigned Workers ({task.assignedWorkerNames.length}):</span>
                      </span>
                      <div className="text-right max-w-[160px] truncate font-medium text-slate-700">
                        {task.assignedWorkerNames.join(', ') || 'None assigned'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <button
                    onClick={() => handleNotifyTask(task)}
                    disabled={isNotifying}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isNotifying ? 'Sending WhatsApp Messages...' : '🚀 Notify via WhatsApp'}</span>
                  </button>

                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={`flex-1 py-1.5 rounded-lg border font-bold text-[11px] transition-colors ${
                        task.status === 'completed'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      {task.status === 'completed' ? 'Reopen Task' : '✓ Mark Complete'}
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(task)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                      title="Edit Task"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <span>{editingTask ? 'Edit Work Task Assignment' : 'Create Daily Work Task Assignment'}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign site tasks to labours and supervisor with automated WhatsApp dispatch.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowTaskModal(false);
                  resetForm();
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4 text-xs">
              {/* Task Title & Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 4th Floor Shuttering & Rebar Binding"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assignment Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Site & Supervisor Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Construction Site *</label>
                  <select
                    value={formSiteId}
                    onChange={(e) => setFormSiteId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supervisor on Duty *</label>
                  <select
                    value={formSupervisorId}
                    onChange={(e) => setFormSupervisorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {supervisors.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} ({sup.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Detailed Description / Bullet Points */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Task Details & Bullet Points (Sent to Workers & Supervisor) *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={`1. Complete column shuttering by 1 PM\n2. Tie 12mm steel mesh coils\n3. Clear debris before 3 PM`}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Supervisor Specific Directives */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supervisor Directives / Special Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verify material arrival and check safety helmets at gate"
                  value={formSupervisorTasks}
                  onChange={(e) => setFormSupervisorTasks(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Worker Selection Grid */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Assign Labours / Workers ({formSelectedWorkerIds.length} Selected)
                  </label>
                  <span className="text-[11px] font-semibold text-blue-600">
                    Workers will receive bulleted WhatsApp task order
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter workers by name or code..."
                    value={workerSearchTerm}
                    onChange={(e) => setWorkerSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50">
                  {modalFilteredWorkers.map((worker) => {
                    const isSelected = formSelectedWorkerIds.includes(worker.id);
                    return (
                      <label
                        key={worker.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormSelectedWorkerIds([...formSelectedWorkerIds, worker.id]);
                            } else {
                              setFormSelectedWorkerIds(formSelectedWorkerIds.filter((id) => id !== worker.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs">{getWorkerDisplayName(worker)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Query Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Query Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Contractor Admin / Site Engineer"
                    value={formContactName}
                    onChange={(e) => setFormContactName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Query Contact Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +919876543210"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskModal(false);
                    resetForm();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md shadow-blue-600/20 transition-all"
                >
                  {submitting ? 'Saving Task...' : editingTask ? 'Update Task' : 'Create & Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
