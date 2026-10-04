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

    let supervisorPhone = task.supervisorPhone?.trim() || '';

    // Fallback: If supervisorPhone is missing on task, lookup from supervisors or workers collection
    if (!supervisorPhone && task.supervisorId) {
      try {
        let supDoc = await OrgContextService.getDocWithFallback('supervisors', task.supervisorId, targetOrg);
        if (!supDoc.data && targetOrg !== 'org_primary') {
          supDoc = await OrgContextService.getDocWithFallback('supervisors', task.supervisorId, 'org_primary');
        }

        if (supDoc.data?.whatsappNumber || supDoc.data?.phone) {
          supervisorPhone = (supDoc.data.whatsappNumber || supDoc.data.phone).trim();
        } else {
          let wrkDoc = await OrgContextService.getDocWithFallback('workers', task.supervisorId, targetOrg);
          if (!wrkDoc.data && targetOrg !== 'org_primary') {
            wrkDoc = await OrgContextService.getDocWithFallback('workers', task.supervisorId, 'org_primary');
          }
          if (wrkDoc.data?.phone) {
            supervisorPhone = wrkDoc.data.phone.trim();
          }
        }
      } catch (e) {
        console.warn(`[notify-supervisor] Error looking up supervisor phone for ID ${task.supervisorId}:`, e);
      }
    }

    if (!supervisorPhone) {
      return NextResponse.json(
        { success: false, notifiedCount: 0, errors: [`Missing phone number for supervisor "${task.supervisorName || 'Duty Lead'}"`] },
        { status: 400 }
      );
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
    const overallCompDate = task.completionDate || (task.completionTime && !task.completionTime.includes(':') ? task.completionTime : '');
    const overallCompDateStr = overallCompDate ? `\n*Overall Task Completion Date:* 📅 ${overallCompDate}` : '';

    const locationBlock =
      (task.locationLandmark ? `🏢 *Landmark / Address:* ${task.locationLandmark}\n` : '') +
      (task.mapLink ? `📍 *GPS Navigation Link:* ${task.mapLink}\n` : '');

    const supervisorMsg =
      `📋 *Supervisor Master Team Deployment Order*\n\n` +
      `Hello *${task.supervisorName}*,\n` +
      `Aaj ki site deployment aur worker task breakdown:\n\n` +
      `*Site:* 🏗️ ${task.siteName}\n` +
      `${locationBlock}` +
      `*Assignment Date:* 📅 ${task.date}${overallCompDateStr}\n` +
      `*Primary Work:* 📌 *${task.title}*\n\n` +
      `🎯 *Supervisor Directives:* \n${supervisorDirectives}\n\n` +
      `👥 *Team Allocations & Worker Tasks (${task.assignedWorkerNames.length || workerDetails.length} Workers):*\n\n` +
      `${teamAllocationsText}\n\n` +
      `📞 *Admin / Emergency Contact:* ${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})\n\n` +
      `Kripya har worker ke tasks check karke site supervision aur safety monitor karein! 🚀`;

    const siteWithLocation =
      task.siteName +
      (task.locationLandmark ? ` | Landmark: ${task.locationLandmark}` : '') +
      (task.mapLink ? ` | Map: ${task.mapLink}` : '');

    const tplParams = [
      task.supervisorName,
      siteWithLocation,
      task.date,
      overallCompDate || task.date,
      task.title,
      supervisorDirectives,
      teamAllocationsText,
      `${task.contactPersonName} (${task.contactPersonPhone || 'Admin'})`,
    ];

    let notifiedCount = 0;
    try {
      let res = await WhatsAppService.sendTemplateMessage(supervisorPhone, 'supervisor_deployment', tplParams);
      if (!res.success) {
        // Fallback to custom text message if template fails
        res = await WhatsAppService.sendMessage(supervisorPhone, supervisorMsg);
      }
      if (res.success) {
        notifiedCount = 1;
      } else {
        errors.push(`Failed supervisor ${task.supervisorName} (${supervisorPhone}): ${res.error}`);
      }
    } catch (err: any) {
      errors.push(`Error notifying supervisor ${task.supervisorName}: ${err?.message}`);
    }

    // Update task status and supervisor notification flag in Firestore ONLY if message sending succeeded!
    if (notifiedCount > 0) {
      await updateDoc(docRes.ref, {
        status: 'notified',
        supervisorNotified: true,
        supervisorPhone: supervisorPhone,
        supervisorNotifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

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
