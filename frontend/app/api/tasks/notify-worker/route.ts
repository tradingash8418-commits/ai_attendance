import { NextRequest, NextResponse } from 'next/server';
import { OrgContextService } from '@/services/org-context.service';
import { WhatsAppService } from '@/services/whatsapp.service';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import type { TaskAssignment } from '@/types/task';

const COLLECTION_NAME = 'tasks';

/**
 * POST /api/tasks/notify-worker
 * Dispatches WhatsApp notification message to a specific worker (or all workers if workerId is 'all')
 * WITHOUT notifying the supervisor.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, workerId, orgId } = body;

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
    const workerDetails = task.workerDetails || [];
    let notifiedCount = 0;
    const errors: string[] = [];

    // Target specific worker or all workers
    const targets = workerId && workerId !== 'all'
      ? workerDetails.filter((w) => w.workerId === workerId)
      : workerDetails;

    if (targets.length === 0) {
      // Fallback: if workerDetails is not populated yet, build target from assignedWorkerIds
      if (task.assignedWorkerPhones && task.assignedWorkerPhones.length > 0) {
        for (let i = 0; i < task.assignedWorkerPhones.length; i++) {
          const wPhone = task.assignedWorkerPhones[i];
          const wName = task.assignedWorkerNames[i] || 'Worker';
          const wId = task.assignedWorkerIds[i] || `w_${i}`;

          if (workerId && workerId !== 'all' && wId !== workerId) continue;
          if (!wPhone) continue;

          const bulletedDescription = task.description
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./) ? line : `• ${line}`))
            .join('\n');

          const workerCompletionDateStr = `\n*Target Task Completion Date:* 📅 ${task.date}`;

          const locationBlock =
            (task.locationLandmark ? `🏢 *Landmark / Address:* ${task.locationLandmark}\n` : '') +
            (task.mapLink ? `📍 *GPS Navigation Link:* ${task.mapLink}\n` : '');

          const workerMsg =
            `📋 *Daily Work Task Assigned!*\n\n` +
            `Hello *${wName}*,\n` +
            `Aapko aaj ke kaam ki list neeche di gayi hai:\n\n` +
            `*Site:* 🏗️ ${task.siteName}\n` +
            `${locationBlock}` +
            `*Assignment Date:* 📅 ${task.date}${workerCompletionDateStr}\n` +
            `*Work:* 📌 *${task.title}*\n\n` +
            `📝 *Your Assigned Tasks:* \n${bulletedDescription}\n\n` +
            `👷 *Supervisor on Duty:* ${task.supervisorName} (${task.supervisorPhone || 'Site Supervisor'})\n` +
            `📞 *Help / Query Contact:* ${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})\n\n` +
            `*Safety Note:* Kripya site par samay se pahunchein aur safety helmets pehnein! ⛑️`;

          const siteWithLocation =
            task.siteName +
            (task.locationLandmark ? `\n🏢 Landmark: ${task.locationLandmark}` : '') +
            (task.mapLink ? `\n📍 Map Link: ${task.mapLink}` : '');

          const tplParams = [
            wName,
            siteWithLocation,
            task.date,
            task.date,
            task.title,
            bulletedDescription,
            `${task.supervisorName} (${task.supervisorPhone || 'Site Supervisor'})`,
            `${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})`,
          ];

          try {
            let res = await WhatsAppService.sendTemplateMessage(wPhone, 'task_assignment', tplParams);
            if (!res.success) {
              // Fallback to custom text message if template fails
              res = await WhatsAppService.sendMessage(wPhone, workerMsg);
            }
            if (res.success) notifiedCount++;
            else errors.push(`Failed worker ${wName} (${wPhone}): ${res.error}`);
          } catch (err: any) {
            errors.push(`Error notifying worker ${wName}: ${err?.message}`);
          }
        }
      }
    } else {
      // Dispatch tailored task for each target worker
      for (const target of targets) {
        if (!target.workerPhone) continue;

        const workerTasksText = target.tasks || task.description;
        const bulletedTasks = workerTasksText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./) ? line : `• ${line}`))
          .join('\n');

        const workerCompletionDateStr = `\n*Target Task Completion Date:* 📅 ${target.completionDate || task.date}`;

        const locationBlock =
          (task.locationLandmark ? `🏢 *Landmark / Address:* ${task.locationLandmark}\n` : '') +
          (task.mapLink ? `📍 *GPS Navigation Link:* ${task.mapLink}\n` : '');

        const workerMsg =
          `📋 *Daily Work Task Assigned!*\n\n` +
          `Hello *${target.workerName}*,\n` +
          `Aapko aaj ke kaam ki list neeche di gayi hai:\n\n` +
          `*Site:* 🏗️ ${task.siteName}\n` +
          `${locationBlock}` +
          `*Assignment Date:* 📅 ${task.date}${workerCompletionDateStr}\n` +
          `*Work:* 📌 *${task.title}*\n\n` +
          `📝 *Your Specific Tasks:* \n${bulletedTasks}\n\n` +
          `👷 *Supervisor on Duty:* ${task.supervisorName} (${task.supervisorPhone || 'Site Supervisor'})\n` +
          `📞 *Help / Query Contact:* ${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})\n\n` +
          `*Safety Note:* Kripya site par samay se pahunchein aur safety helmets pehnein! ⛑️`;

        const siteWithLocation =
          task.siteName +
          (task.locationLandmark ? `\n🏢 Landmark: ${task.locationLandmark}` : '') +
          (task.mapLink ? `\n📍 Map Link: ${task.mapLink}` : '');

        const tplParams = [
          target.workerName,
          siteWithLocation,
          task.date,
          target.completionDate || task.date,
          task.title,
          bulletedTasks,
          `${task.supervisorName} (${task.supervisorPhone || 'Site Supervisor'})`,
          `${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})`,
        ];

        try {
          let res = await WhatsAppService.sendTemplateMessage(target.workerPhone, 'task_assignment', tplParams);
          if (!res.success) {
            // Fallback to custom text message if template fails
            res = await WhatsAppService.sendMessage(target.workerPhone, workerMsg);
          }
          if (res.success) {
            notifiedCount++;
            target.notified = true;
            target.notifiedAt = new Date().toISOString();
          } else {
            errors.push(`Failed worker ${target.workerName} (${target.workerPhone}): ${res.error}`);
          }
        } catch (err: any) {
          errors.push(`Error notifying worker ${target.workerName}: ${err?.message}`);
        }
      }
    }

    // Update worker details notification status in Firestore
    await updateDoc(docRes.ref, {
      workerDetails,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: errors.length === 0,
      notifiedCount,
      errors,
    });
  } catch (error: any) {
    console.error('[API /api/tasks/notify-worker] Error notifying worker:', error);
    return NextResponse.json({ success: false, notifiedCount: 0, errors: [error?.message || 'Internal server error'] }, { status: 500 });
  }
}
