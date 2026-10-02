import { NextRequest, NextResponse } from 'next/server';
import { OrgContextService } from '@/services/org-context.service';
import { WhatsAppService } from '@/services/whatsapp.service';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import type { TaskAssignment } from '@/types/task';

const COLLECTION_NAME = 'tasks';

/**
 * POST /api/tasks/notify-supervisor
 * Dispatches ONE single consolidated Master Deployment Order WhatsApp message to the assigned supervisor
 * containing all assigned labours and their respective individual tasks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, orgId } = body;

    if (!taskId) {
      return NextResponse.json({ success: false, notifiedCount: 0, errors: ['Missing taskId'] }, { status: 400 });
    }

    const targetOrg = orgId || OrgContextService.getOrgId();
    let docRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, taskId, targetOrg);

    if (!docRes.data && targetOrg !== 'org_primary') {
      docRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, taskId, 'org_primary');
    }

    if (!docRes.data) {
      return NextResponse.json({ success: false, notifiedCount: 0, errors: ['Task not found'] }, { status: 444 });
    }

    const task = { id: taskId, ...docRes.data } as TaskAssignment;
    const errors: string[] = [];

    if (!task.supervisorPhone) {
      return NextResponse.json({ success: false, notifiedCount: 0, errors: ['Missing supervisor phone number'] }, { status: 400 });
    }

    // Build consolidated list of workers and their individual tasks
    let teamAllocationsText = '';
    const workerDetails = task.workerDetails || [];

    if (workerDetails.length > 0) {
      teamAllocationsText = workerDetails
        .map((w, idx) => {
          const formattedTasks = (w.tasks || task.description)
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./) ? `   ${line}` : `   • ${line}`))
            .join('\n');

          const compDateText = w.completionDate ? ` (Target Completion: 📅 ${w.completionDate})` : ` (Target Completion: 📅 ${task.date})`;
          return `${idx + 1}. *${w.workerName}* (${w.workerPhone || 'No phone'})${compDateText}\n${formattedTasks}`;
        })
        .join('\n\n');
    } else if (task.assignedWorkerNames && task.assignedWorkerNames.length > 0) {
      teamAllocationsText = task.assignedWorkerNames
        .map((wName, idx) => {
          const wPhone = task.assignedWorkerPhones?.[idx] ? ` (${task.assignedWorkerPhones[idx]})` : '';
          const defaultTasks = task.description
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./) ? `   ${line}` : `   • ${line}`))
            .join('\n');

          return `${idx + 1}. *${wName}*${wPhone} (Target Completion: 📅 ${task.date})\n${defaultTasks}`;
        })
        .join('\n\n');
    } else {
      teamAllocationsText = 'No specific labours listed for this deployment.';
    }

    const supervisorDirectives = task.supervisorTasks || task.description;
    const overallDeadlineStr = task.completionTime ? `\n*Overall Task Deadline Time:* ⏰ ${task.completionTime}` : '';

    const supervisorMsg =
      `📋 *Supervisor Master Team Deployment Order*\n\n` +
      `Hello *${task.supervisorName}*,\n` +
      `Aaj ki site deployment aur worker task breakdown:\n\n` +
      `*Site:* 🏗️ ${task.siteName}\n` +
      `*Assignment Date:* 📅 ${task.date}${overallDeadlineStr}\n` +
      `*Primary Work:* 📌 *${task.title}*\n\n` +
      `🎯 *Supervisor Directives:* \n${supervisorDirectives}\n\n` +
      `👥 *Team Allocations & Worker Tasks (${task.assignedWorkerNames.length || workerDetails.length} Workers):*\n\n` +
      `${teamAllocationsText}\n\n` +
      `📞 *Admin / Emergency Contact:* ${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})\n\n` +
      `Kripya har worker ke tasks check karke site supervision aur safety monitor karein! 🚀`;

    let notifiedCount = 0;
    try {
      const res = await WhatsAppService.sendMessage(task.supervisorPhone, supervisorMsg);
      if (res.success) {
        notifiedCount = 1;
      } else {
        errors.push(`Failed supervisor ${task.supervisorName} (${task.supervisorPhone}): ${res.error}`);
      }
    } catch (err: any) {
      errors.push(`Error notifying supervisor ${task.supervisorName}: ${err?.message}`);
    }

    // Update task status and supervisor notification flag in Firestore
    await updateDoc(docRes.ref, {
      status: 'notified',
      supervisorNotified: true,
      supervisorNotifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: errors.length === 0,
      notifiedCount,
      errors,
    });
  } catch (error: any) {
    console.error('[API /api/tasks/notify-supervisor] Error notifying supervisor:', error);
    return NextResponse.json({ success: false, notifiedCount: 0, errors: [error?.message || 'Internal server error'] }, { status: 500 });
  }
}
