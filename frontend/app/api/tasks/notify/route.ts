import { NextRequest, NextResponse } from 'next/server';
import { OrgContextService } from '@/services/org-context.service';
import { WhatsAppService } from '@/services/whatsapp.service';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import type { TaskAssignment } from '@/types/task';

const COLLECTION_NAME = 'tasks';

/**
 * POST /api/tasks/notify
 * Server-side route handler to dispatch automated WhatsApp notifications to assigned supervisor and workers.
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
    let notifiedCount = 0;
    const errors: string[] = [];

    // Format task description into clean bullet points
    const bulletedDescription = task.description
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./) ? line : `• ${line}`))
      .join('\n');

    // 1. Dispatch WhatsApp message to assigned Workers
    if (task.assignedWorkerPhones && task.assignedWorkerPhones.length > 0) {
      for (let i = 0; i < task.assignedWorkerPhones.length; i++) {
        const workerPhone = task.assignedWorkerPhones[i];
        const workerName = task.assignedWorkerNames[i] || 'Worker';

        if (!workerPhone) continue;

        const workerMsg =
          `📋 *Daily Work Task Assigned!*\n\n` +
          `Hello *${workerName}*,\n` +
          `Aapko aaj ke kaam ki list neeche di gayi hai:\n\n` +
          `*Site:* 🏗️ ${task.siteName}\n` +
          `*Date:* 📅 ${task.date}\n` +
          `*Task Title:* 📌 *${task.title}*\n\n` +
          `📝 *Task Details:* \n${bulletedDescription}\n\n` +
          `👷 *Supervisor on Duty:* ${task.supervisorName} (${task.supervisorPhone || 'Site Supervisor'})\n` +
          `📞 *Query / Help Contact:* ${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})\n\n` +
          `*Safety Note:* Kripya site par samay se pahunchein aur safety helmets pehnein! ⛑️`;

        try {
          const res = await WhatsAppService.sendMessage(workerPhone, workerMsg);
          if (res.success) notifiedCount++;
          else errors.push(`Failed worker ${workerName} (${workerPhone}): ${res.error}`);
        } catch (err: any) {
          errors.push(`Error notifying worker ${workerName}: ${err?.message}`);
        }
      }
    }

    // 2. Dispatch WhatsApp message to assigned Supervisor
    if (task.supervisorPhone) {
      const workerListText = task.assignedWorkerNames.length > 0
        ? task.assignedWorkerNames
            .map((wName, idx) => {
              const wPhone = task.assignedWorkerPhones?.[idx] ? ` (${task.assignedWorkerPhones[idx]})` : '';
              return `${idx + 1}. ${wName}${wPhone}`;
            })
            .join('\n')
        : 'No specific labours listed';

      const supervisorDirectives = task.supervisorTasks || bulletedDescription;

      const supervisorMsg =
        `📋 *Supervisor Work & Labour Allocation Order*\n\n` +
        `Hello *${task.supervisorName}*,\n` +
        `Aaj ki site deployment aur work directives:\n\n` +
        `*Site:* 🏗️ ${task.siteName}\n` +
        `*Date:* 📅 ${task.date}\n` +
        `*Primary Work:* 📌 *${task.title}*\n\n` +
        `🎯 *Supervisor Directives:* \n${supervisorDirectives}\n\n` +
        `👥 *Labour / Workers Allocated Under You (${task.assignedWorkerNames.length}):*\n` +
        `${workerListText}\n\n` +
        `📞 *Admin / Help Contact:* ${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})\n\n` +
        `Kripya labours ki attendance aur work safety monitor karein! 🚀`;

      try {
        const res = await WhatsAppService.sendMessage(task.supervisorPhone, supervisorMsg);
        if (res.success) notifiedCount++;
        else errors.push(`Failed supervisor ${task.supervisorName} (${task.supervisorPhone}): ${res.error}`);
      } catch (err: any) {
        errors.push(`Error notifying supervisor ${task.supervisorName}: ${err?.message}`);
      }
    }

    // Update task status to 'notified'
    await updateDoc(docRes.ref, {
      status: 'notified',
      notifiedAt: serverTimestamp(),
      notifiedCount,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: errors.length === 0,
      notifiedCount,
      errors,
    });
  } catch (error: any) {
    console.error('[API /api/tasks/notify] Error notifying task:', error);
    return NextResponse.json({ success: false, notifiedCount: 0, errors: [error?.message || 'Internal server error'] }, { status: 500 });
  }
}
