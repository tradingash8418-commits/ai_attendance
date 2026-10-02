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
import type { TaskAssignment, TaskStatus, WorkerTaskDetail } from '@/types/task';
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
  const [formOverallCompletionDate, setFormOverallCompletionDate] = useState<string>(todayStr);
  const [formSiteId, setFormSiteId] = useState<string>('');
  const [formSupervisorId, setFormSupervisorId] = useState<string>('');
  const [formSupervisorTasks, setFormSupervisorTasks] = useState<string>('');
  const [formSelectedWorkerIds, setFormSelectedWorkerIds] = useState<string[]>([]);
  const [formWorkerTasksMap, setFormWorkerTasksMap] = useState<Record<string, string>>({});
  const [formWorkerCompletionDateMap, setFormWorkerCompletionDateMap] = useState<Record<string, string>>({});
  const [formContactName, setFormContactName] = useState<string>('Contractor Admin');
  const [formContactPhone, setFormContactPhone] = useState<string>('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState<string>('');

  // Processing Action States
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notifyingWorkerId, setNotifyingWorkerId] = useState<string | null>(null);
  const [notifyingSupervisorTaskId, setNotifyingSupervisorTaskId] = useState<string | null>(null);
  const [dispatchingAllTaskId, setDispatchingAllTaskId] = useState<string | null>(null);
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
    setFormOverallCompletionDate(selectedDate || todayStr);
    setFormSiteId(sites[0]?.id || '');
    setFormSupervisorId(supervisors[0]?.id || '');
    setFormSupervisorTasks('');
    setFormSelectedWorkerIds([]);
    setFormWorkerTasksMap({});
    setFormWorkerCompletionDateMap({});
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
    setFormOverallCompletionDate(task.completionDate || task.completionTime || task.date || selectedDate || todayStr);
    setFormSiteId(task.siteId);
    setFormSupervisorId(task.supervisorId);
    setFormSupervisorTasks(task.supervisorTasks || '');
    setFormSelectedWorkerIds(task.assignedWorkerIds || []);

    // Map per-worker task details if available
    const tasksMap: Record<string, string> = {};
    const compDatesMap: Record<string, string> = {};
    if (task.workerDetails && task.workerDetails.length > 0) {
      task.workerDetails.forEach((wd) => {
        tasksMap[wd.workerId] = wd.tasks || '';
        compDatesMap[wd.workerId] = wd.completionDate || task.date || selectedDate;
      });
    }
    setFormWorkerTasksMap(tasksMap);
    setFormWorkerCompletionDateMap(compDatesMap);

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
      const foundSupervisor = supervisors.find((sup) => sup.id === formSupervisorId);
      const foundWorkerSup = workers.find((w) => w.id === formSupervisorId);

      const supervisorName = foundSupervisor
        ? foundSupervisor.name
        : foundWorkerSup
          ? getWorkerDisplayName(foundWorkerSup)
          : 'Supervisor';

      const supervisorPhone = foundSupervisor?.phone || foundWorkerSup?.phone || '';

      const assignedWorkerNames = formSelectedWorkerIds.map((id) => {
        const w = workers.find((wrk) => wrk.id === id);
        return w ? getWorkerDisplayName(w) : id;
      });

      const assignedWorkerPhones = formSelectedWorkerIds.map((id) => {
        const w = workers.find((wrk) => wrk.id === id);
        return w?.phone || '';
      });

      const workerDetails: WorkerTaskDetail[] = formSelectedWorkerIds.map((wId) => {
        const w = workers.find((wrk) => wrk.id === wId);
        const existingDetail = editingTask?.workerDetails?.find((wd) => wd.workerId === wId);

        return {
          workerId: wId,
          workerName: w ? getWorkerDisplayName(w) : wId,
          workerPhone: w?.phone || '',
          tasks: (formWorkerTasksMap[wId] || formDescription || '').trim(),
          completionDate: formWorkerCompletionDateMap[wId] || formOverallCompletionDate || formDate,
          notified: existingDetail?.notified || false,
          notifiedAt: existingDetail?.notifiedAt || null,
        };
      });

      const taskData = {
        title: formTitle,
        description: formDescription,
        siteId: formSiteId,
        siteName: selectedSite?.name || 'Site',
        date: formDate,
        completionDate: formOverallCompletionDate,
        completionTime: formOverallCompletionDate,
        supervisorId: formSupervisorId,
        supervisorName,
        supervisorPhone,
        supervisorTasks: formSupervisorTasks,
        workerDetails,
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

  // Notify Single Worker (or all workers) via WhatsApp WITHOUT notifying supervisor
  const handleNotifyWorker = async (task: TaskAssignment, workerId: string = 'all') => {
    setNotifyingWorkerId(`${task.id}_${workerId}`);
    setNotificationStatus(null);
    try {
      const res = await TasksService.notifyWorkerViaWhatsApp(task.id, workerId, task.organizationId);
      if (res.success) {
        setNotificationStatus({
          msg: `✅ WhatsApp Task message sent to worker(s)! (${res.notifiedCount} delivered)`,
          type: 'success',
        });
      } else {
        setNotificationStatus({
          msg: `⚠️ Notifications warning: ${res.errors.join(', ')}`,
          type: 'error',
        });
      }
      await loadData();
    } catch (err: any) {
      console.error('Failed to dispatch worker task notification:', err);
      setNotificationStatus({
        msg: `❌ Error sending WhatsApp message: ${err?.message || 'Failed to dispatch'}`,
        type: 'error',
      });
    } finally {
      setNotifyingWorkerId(null);
    }
  };

  // Notify Supervisor Master Deployment Order (Single Consolidated Message)
  const handleNotifySupervisor = async (task: TaskAssignment) => {
    setNotifyingSupervisorTaskId(task.id);
    setNotificationStatus(null);
    try {
      const res = await TasksService.notifySupervisorViaWhatsApp(task.id, task.organizationId);
      if (res.success) {
        setNotificationStatus({
          msg: `✅ Master Team Deployment Order sent to Supervisor ${task.supervisorName} via WhatsApp!`,
          type: 'success',
        });
      } else {
        setNotificationStatus({
          msg: `⚠️ Supervisor notification warning: ${res.errors.join(', ')}`,
          type: 'error',
        });
      }
      await loadData();
    } catch (err: any) {
      console.error('Failed to dispatch supervisor master deployment order:', err);
      setNotificationStatus({
        msg: `❌ Error sending WhatsApp to supervisor: ${err?.message || 'Failed to dispatch'}`,
        type: 'error',
      });
    } finally {
      setNotifyingSupervisorTaskId(null);
    }
  };

  // 1-Click Consolidated Dispatch: Notifies all assigned workers first, then sends Master Summary Order to Supervisor automatically
  const handleDispatchAll = async (task: TaskAssignment) => {
    setDispatchingAllTaskId(task.id);
    setNotificationStatus(null);
    try {
      // Step 1: Send WhatsApp to all assigned workers
      const workerRes = await TasksService.notifyWorkerViaWhatsApp(task.id, 'all', task.organizationId);

      // Step 2: Send Master Summary WhatsApp to Supervisor
      const supRes = await TasksService.notifySupervisorViaWhatsApp(task.id, task.organizationId);

      const isSuccess = workerRes.success || supRes.success;
      const totalDelivered = (workerRes.notifiedCount || 0) + (supRes.notifiedCount || 0);

      if (isSuccess) {
        setNotificationStatus({
          msg: `🚀 1-Click Dispatch Complete! Sent individual task messages to workers (${workerRes.notifiedCount || 0} delivered) and Master Order to Supervisor ${task.supervisorName || 'Duty Lead'}!`,
          type: 'success',
        });
      } else {
        const errors = [...(workerRes.errors || []), ...(supRes.errors || [])];
        setNotificationStatus({
          msg: `⚠️ 1-Click Dispatch Warning (${totalDelivered} delivered): ${errors.join(', ')}`,
          type: 'error',
        });
      }
      await loadData();
    } catch (err: any) {
      console.error('Failed 1-click dispatch:', err);
      setNotificationStatus({
        msg: `❌ Error in 1-Click Dispatch: ${err?.message || 'Failed to dispatch'}`,
        type: 'error',
      });
    } finally {
      setDispatchingAllTaskId(null);
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

  // Helper to determine precise notification target status & badge
  const getTaskNotificationScope = useCallback((task: TaskAssignment) => {
    if (task.status === 'completed') {
      return {
        label: '✓ Task Completed',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    }

    const isSup = Boolean(task.supervisorNotified);
    const workerDetails = task.workerDetails || [];
    const totalWorkers = workerDetails.length || task.assignedWorkerIds.length;
    const notifiedWorkers = workerDetails.filter((w) => w.notified).length;

    if (isSup && totalWorkers > 0 && notifiedWorkers === totalWorkers) {
      return {
        label: '📲 Supervisor + All Workers',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (isSup && notifiedWorkers > 0) {
      return {
        label: `📲 Sup + Workers (${notifiedWorkers}/${totalWorkers})`,
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
      };
    }
    if (isSup && (totalWorkers === 0 || notifiedWorkers === 0)) {
      return {
        label: '📢 Supervisor Only',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    }
    if (!isSup && totalWorkers > 0 && notifiedWorkers === totalWorkers) {
      return {
        label: '👥 All Workers Only',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    if (!isSup && notifiedWorkers > 0) {
      return {
        label: `👥 Workers Only (${notifiedWorkers}/${totalWorkers})`,
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    }

    return {
      label: '⏳ Draft (Unsent)',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }, []);

  // Group filtered tasks into Sections: Draft (Unsent), Notified & Active, Completed
  const { draftTasks, notifiedTasks, completedTasks } = useMemo(() => {
    const draft: TaskAssignment[] = [];
    const notified: TaskAssignment[] = [];
    const completed: TaskAssignment[] = [];

    filteredTasks.forEach((t) => {
      if (t.status === 'completed') {
        completed.push(t);
        return;
      }
      const hasNotifiedWorker = t.workerDetails?.some((w) => w.notified);
      const isNotified = t.supervisorNotified || hasNotifiedWorker || t.status === 'notified';

      if (isNotified) {
        notified.push(t);
      } else {
        draft.push(t);
      }
    });

    return { draftTasks: draft, notifiedTasks: notified, completedTasks: completed };
  }, [filteredTasks]);

  // Metrics Computation
  const metrics = useMemo(() => {
    const total = tasks.length;
    const notified = tasks.filter((t) => t.status === 'notified' || t.supervisorNotified).length;
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
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6 min-w-0 overflow-x-hidden">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-5 min-w-0 w-full">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-start sm:items-center gap-2.5 min-w-0">
            <ClipboardList className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words min-w-0 flex-1">Task Management &amp; Individual Labour Dispatch</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1 break-words">
            Assign individual tasks to workers, notify labours via WhatsApp, and dispatch a single Master Summary to supervisors.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => {
              resetForm();
              setShowTaskModal(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Task</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationStatus && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl border flex items-center justify-between text-xs font-bold transition-all min-w-0 ${notificationStatus.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
        >
          <span className="break-words min-w-0 flex-1">{notificationStatus.msg}</span>
          <button onClick={() => setNotificationStatus(null)} className="p-1 hover:bg-black/5 rounded shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Metrics Top Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
        <div className="razorpay-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3.5 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Tasks</div>
            <div className="text-base sm:text-xl font-extrabold text-slate-900 truncate">{metrics.total}</div>
          </div>
        </div>

        <div className="razorpay-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3.5 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Workers Assigned</div>
            <div className="text-base sm:text-xl font-extrabold text-purple-700 truncate">{metrics.assignedWorkersCount}</div>
          </div>
        </div>

        <div className="razorpay-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3.5 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">WhatsApp Sent</div>
            <div className="text-base sm:text-xl font-extrabold text-emerald-700 truncate">{metrics.notified}</div>
          </div>
        </div>

        <div className="razorpay-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3.5 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Completed</div>
            <div className="text-base sm:text-xl font-extrabold text-amber-700 truncate">{metrics.completed}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="razorpay-card p-3 sm:p-4 space-y-3 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0 w-full">
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 min-w-0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 max-w-xl w-full min-w-0">
            <div className="relative w-full min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-600 min-w-0"
              />
            </div>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600 truncate min-w-0"
            >
              <option value="all">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600 truncate min-w-0"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="notified">Notified</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Grid List Rendered in 3 Sections: Drafts -> Notified -> Completed */}
      {(() => {
        const renderTaskCard = (task: TaskAssignment) => {
          const isSupervisorNotifying = notifyingSupervisorTaskId === task.id;
          const workerDetails = task.workerDetails || [];
          const scope = getTaskNotificationScope(task);

          return (
            <div
              key={task.id}
              className="razorpay-card p-4 sm:p-5 space-y-4 flex flex-col justify-between hover:border-blue-300 transition-all shadow-xs w-full min-w-0 overflow-hidden"
            >
              <div className="space-y-3 min-w-0">
                {/* Card Header: Title & Target Notification Scope Badge */}
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug break-words">{task.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-blue-700 min-w-0 flex-wrap">
                      <div className="flex items-center gap-1 min-w-0">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                        <span className="truncate">{task.siteName}</span>
                      </div>
                      {(task.completionDate || task.completionTime) && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3 text-indigo-600" />
                          <span>Target Completion: {task.completionDate || task.completionTime}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border shrink-0 ${scope.badgeClass}`}
                  >
                    {scope.label}
                  </span>
                </div>

                {/* Overview Description */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-line max-h-28 overflow-y-auto break-words min-w-0">
                  {task.description}
                </div>

                {/* Supervisor Header Info */}
                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-purple-900">
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-purple-700" />
                      <span>Supervisor on Duty:</span>
                    </span>
                    <span>{task.supervisorName}</span>
                  </div>
                  <div className="text-[11px] text-purple-700 font-mono flex items-center justify-between">
                    <span>Phone: {task.supervisorPhone || 'No phone'}</span>
                    <span className="font-extrabold">
                      {task.supervisorNotified ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Notified ✓</span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Pending ⏳</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Individual Worker Task Allocation List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Labours Assigned ({workerDetails.length || task.assignedWorkerNames.length}):</span>
                    </span>
                    <button
                      onClick={() => handleNotifyWorker(task, 'all')}
                      disabled={Boolean(notifyingWorkerId)}
                      className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-800 underline"
                    >
                      Notify All Workers
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {workerDetails.length > 0
                      ? workerDetails.map((wd) => {
                        const isNotifyingThisWorker = notifyingWorkerId === `${task.id}_${wd.workerId}`;

                        return (
                          <div
                            key={wd.workerId}
                            className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs space-y-1 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-bold text-slate-900 truncate">{wd.workerName}</span>
                                {wd.notified ? (
                                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0">
                                    ✓ Sent
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                                    Unsent ⏳
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleNotifyWorker(task, wd.workerId)}
                                disabled={isNotifyingThisWorker}
                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[10px] border border-emerald-200 flex items-center gap-1 active:scale-95 transition-all shrink-0 ml-auto"
                              >
                                <Send className="w-2.5 h-2.5" />
                                <span>{isNotifyingThisWorker ? 'Sending...' : 'Notify Worker'}</span>
                              </button>
                            </div>

                            {wd.completionDate && (
                              <div className="text-[10px] font-bold text-purple-700 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>Target Completion: {wd.completionDate}</span>
                              </div>
                            )}

                            <div className="text-[11px] text-slate-600 whitespace-pre-line bg-slate-50 p-1.5 rounded border border-slate-100 font-normal">
                              {wd.tasks || task.description}
                            </div>
                          </div>
                        );
                      })
                      : task.assignedWorkerNames.map((wName, idx) => (
                        <div key={idx} className="p-2 rounded-lg border border-slate-200 bg-white text-xs flex items-center justify-between">
                          <span className="font-bold text-slate-800">{wName}</span>
                          <span className="text-[10px] font-semibold text-slate-400">Default task</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {/* 1-Click Dispatch All Button (Workers + Supervisor) */}
                <button
                  onClick={() => handleDispatchAll(task)}
                  disabled={dispatchingAllTaskId === task.id || isSupervisorNotifying || Boolean(notifyingWorkerId)}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>
                    {dispatchingAllTaskId === task.id
                      ? '🚀 Dispatching to Workers & Supervisor...'
                      : '🚀 1-Click Dispatch All (Workers + Supervisor)'}
                  </span>
                </button>

                <div className="flex items-center justify-between gap-1.5 pt-1 text-xs">
                  {/* Secondary Supervisor Only Dispatch Button */}
                  <button
                    onClick={() => handleNotifySupervisor(task)}
                    disabled={isSupervisorNotifying || dispatchingAllTaskId === task.id}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shrink-0"
                    title="Notify Supervisor Only with Master Summary Order"
                  >
                    <span>{isSupervisorNotifying ? 'Sending...' : '📢 Sup. Only'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleComplete(task)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border font-bold text-[11px] transition-colors truncate ${task.status === 'completed'
                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      }`}
                  >
                    {task.status === 'completed' ? 'Reopen' : '✓ Complete'}
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(task)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
                    title="Edit Task"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 shrink-0"
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        };

        if (loading) {
          return <div className="py-16 text-center text-xs text-slate-400">Loading tasks...</div>;
        }

        if (filteredTasks.length === 0) {
          return (
            <div className="razorpay-card p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-extrabold text-slate-800">No tasks found for {selectedDate}</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click &quot;Create New Task&quot; above to assign tasks to your supervisors and worker teams for this site.
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-8 min-w-0 w-full">
            {/* SECTION 1: DRAFT TASKS (UNSENT) */}
            {draftTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900">
                  <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span>📌 Pending Draft Tasks ({draftTasks.length})</span>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hidden sm:inline">
                      Pending WhatsApp Dispatch
                    </span>
                  </div>
                  <span className="text-[11px] font-extrabold text-amber-800">
                    {draftTasks.length} {draftTasks.length === 1 ? 'task' : 'tasks'} waiting to be sent
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                  {draftTasks.map(renderTaskCard)}
                </div>
              </div>
            )}

            {/* SECTION 2: DISPATCHED & NOTIFIED TASKS */}
            {notifiedTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900">
                  <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>📲 Dispatched &amp; Notified Tasks ({notifiedTasks.length})</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-emerald-800">
                    {notifiedTasks.length} active {notifiedTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                  {notifiedTasks.map(renderTaskCard)}
                </div>
              </div>
            )}

            {/* SECTION 3: COMPLETED TASKS */}
            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
                  <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>✅ Completed Tasks ({completedTasks.length})</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-600">
                    {completedTasks.length} finished {completedTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                  {completedTasks.map(renderTaskCard)}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Create / Edit Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-white rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <span>{editingTask ? 'Edit Work Task Assignment' : 'Create Daily Work Task Assignment'}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign individual specific tasks to labours and supervisor with decoupled WhatsApp dispatch.
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
              {/* Task Title, Date & Overall Completion Time */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">General Work Title *</label>
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

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Overall Completion Date *</label>
                  <input
                    type="date"
                    required
                    value={formOverallCompletionDate}
                    onChange={(e) => setFormOverallCompletionDate(e.target.value)}
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
                    <optgroup label="Supervisors List">
                      {supervisors.map((sup) => (
                        <option key={`sup_${sup.id}`} value={sup.id}>
                          {sup.name} ({sup.phone || 'No phone'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Workers List">
                      {workers.map((w) => (
                        <option key={`wrk_${w.id}`} value={w.id}>
                          {getWorkerDisplayName(w)} ({w.phone || 'No phone'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* General Description */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  General Task Overview (Default tasks if worker tasks not specified)
                </label>
                <textarea
                  rows={2}
                  placeholder={`1. Complete column shuttering by 1 PM\n2. Tie rebar mesh`}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Supervisor Directives */}
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

              {/* Worker Selection & Per-Worker Specific Tasks Grid */}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Assign Labours & Individual Worker Tasks ({formSelectedWorkerIds.length} Selected)
                  </label>
                  <span className="text-[11px] font-semibold text-blue-600">
                    Specify custom tasks per worker below
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter workers to assign..."
                    value={workerSearchTerm}
                    onChange={(e) => setWorkerSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                {/* Worker Checkboxes */}
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50">
                  {modalFilteredWorkers.map((worker) => {
                    const isSelected = formSelectedWorkerIds.includes(worker.id);
                    return (
                      <label
                        key={worker.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected
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

                {/* Per-Worker Task Input Accordion / Cards */}
                {formSelectedWorkerIds.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <label className="font-extrabold text-slate-800 text-xs block">
                      📝 Per-Worker Individual Tasks &amp; Completion Date:
                    </label>
                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                      {formSelectedWorkerIds.map((wId) => {
                        const worker = workers.find((w) => w.id === wId);
                        const workerName = worker ? getWorkerDisplayName(worker) : wId;

                        return (
                          <div key={wId} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-bold text-xs text-slate-900 border-b border-slate-100 pb-2">
                              <span>Task for: {workerName}</span>
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-semibold text-purple-800 shrink-0 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Completion Date:</span>
                                </label>
                                <input
                                  type="date"
                                  value={formWorkerCompletionDateMap[wId] || formDate}
                                  onChange={(e) =>
                                    setFormWorkerCompletionDateMap({
                                      ...formWorkerCompletionDateMap,
                                      [wId]: e.target.value,
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                                />
                              </div>
                            </div>

                            <textarea
                              rows={2}
                              placeholder={`Individual tasks for ${workerName} (e.g. • Task 1: Column shuttering • Task 2: Rebar binding)`}
                              value={formWorkerTasksMap[wId] !== undefined ? formWorkerTasksMap[wId] : formDescription}
                              onChange={(e) =>
                                setFormWorkerTasksMap({
                                  ...formWorkerTasksMap,
                                  [wId]: e.target.value,
                                })
                              }
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-normal text-slate-900 focus:outline-none focus:border-blue-600"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Query Contact Phone Number</label>
                  <select
                    value={formContactPhone}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setFormContactPhone(selectedVal);
                      const foundW = workers.find((w) => w.phone === selectedVal || w.id === selectedVal);
                      const foundS = supervisors.find((sup) => sup.phone === selectedVal || sup.id === selectedVal);
                      if (foundW) {
                        setFormContactName(getWorkerDisplayName(foundW));
                        if (foundW.phone) setFormContactPhone(foundW.phone);
                      } else if (foundS) {
                        setFormContactName(foundS.name);
                        if (foundS.phone) setFormContactPhone(foundS.phone);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">-- Select from All Workers / Contacts --</option>
                    <optgroup label="Default Admin">
                      <option value="+919936364036">Contractor Admin (+919936364036)</option>
                    </optgroup>
                    <optgroup label="All Workers List">
                      {workers.map((w) => (
                        <option key={`contact_wrk_${w.id}`} value={w.phone || w.id}>
                          {getWorkerDisplayName(w)} ({w.phone || 'No phone'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Supervisors List">
                      {supervisors.map((sup) => (
                        <option key={`contact_sup_${sup.id}`} value={sup.phone || sup.id}>
                          {sup.name} ({sup.phone || 'No phone'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    placeholder="Or type custom phone number..."
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
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
