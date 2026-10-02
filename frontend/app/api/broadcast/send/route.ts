import { NextRequest, NextResponse } from 'next/server';
import { OrgContextService } from '@/services/org-context.service';
import { WorkersService } from '@/services/workers.service';
import { SupervisorsService } from '@/services/supervisors.service';
import { SitesService } from '@/services/sites.service';
import { WhatsAppService } from '@/services/whatsapp.service';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { getWorkerDisplayName, getTodayDateString } from '@/lib/formatters';

const COLLECTION_NAME = 'broadcasts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, category, targetGroup, siteId, orgId } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Broadcast title is required' }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: 'Broadcast message body is required' }, { status: 400 });
    }

    const targetOrg = orgId || OrgContextService.getOrgId();

    // 1. Fetch Workers, Supervisors & Sites
    const [workersList, supervisorsList, sitesList] = await Promise.all([
      WorkersService.getWorkers(targetOrg),
      SupervisorsService.getSupervisors(targetOrg),
      SitesService.getSites(targetOrg),
    ]);

    let targetSiteName = '';
    if (siteId) {
      const s = sitesList.find((site) => site.id === siteId);
      if (s) targetSiteName = s.name;
    }

    // 2. Build Recipient List
    interface Recipient {
      name: string;
      phone: string;
      role: 'worker' | 'supervisor';
    }

    const recipientsMap = new Map<string, Recipient>();

    // Add Workers if targetGroup is 'all', 'workers', or 'site'
    if (targetGroup === 'all' || targetGroup === 'workers' || targetGroup === 'site') {
      workersList.forEach((w) => {
        if (targetGroup === 'site' && siteId && (w as any).assignedSiteId && (w as any).assignedSiteId !== siteId) {
          return;
        }
        if (w.phone && w.phone.trim()) {
          recipientsMap.set(w.phone.trim(), {
            name: getWorkerDisplayName(w),
            phone: w.phone.trim(),
            role: 'worker',
          });
        }
      });
    }

    // Add Supervisors if targetGroup is 'all', 'supervisors', or 'site'
    if (targetGroup === 'all' || targetGroup === 'supervisors' || targetGroup === 'site') {
      const selectedSiteObj = siteId ? sitesList.find((s) => s.id === siteId) : null;

      supervisorsList.forEach((sup) => {
        if (targetGroup === 'site' && selectedSiteObj && selectedSiteObj.supervisorId && sup.id !== selectedSiteObj.supervisorId) {
          return;
        }
        const phone = sup.whatsappNumber || sup.phone;
        if (phone && phone.trim()) {
          recipientsMap.set(phone.trim(), {
            name: sup.name,
            phone: phone.trim(),
            role: 'supervisor',
          });
        }
      });
    }

    const recipients = Array.from(recipientsMap.values());

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid recipient phone numbers found for the selected target group.',
          recipientCount: 0,
          successCount: 0,
          failureCount: 0,
        },
        { status: 400 }
      );
    }

    // 3. Format WhatsApp Broadcast Message Text
    const todayStr = getTodayDateString();
    const formattedMessage = [
      `📢 *OFFICIAL NOTICE / ANNOUNCEMENT*`,
      `🏢 *Averox AI Workforce OS*`,
      ``,
      `📌 *${title.trim()}*`,
      targetSiteName ? `📍 *Site*: ${targetSiteName}` : '',
      `📅 *Date*: ${todayStr}`,
      ``,
      `${message.trim()}`,
      ``,
      `-----------------------------------`,
      `ℹ️ *Notice issued by Site Management via Averox AI Workforce OS.*`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    // 4. Dispatch WhatsApp Messages
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        const res = await WhatsAppService.sendMessage(recipient.phone, formattedMessage);
        if (res.success) {
          successCount++;
        } else {
          failureCount++;
          errors.push(`${recipient.name} (${recipient.phone}): ${res.error || 'Dispatch failed'}`);
        }
      } catch (err: any) {
        failureCount++;
        errors.push(`${recipient.name} (${recipient.phone}): ${err?.message || 'Failed'}`);
      }
    }

    // 5. Save Broadcast Log in Firestore
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, targetOrg);
    const now = serverTimestamp();

    const logDoc = await addDoc(colRef, {
      organizationId: targetOrg,
      title: title.trim(),
      message: message.trim(),
      category: category || 'general',
      targetGroup: targetGroup || 'all',
      siteId: siteId || '',
      siteName: targetSiteName,
      recipientCount: recipients.length,
      successCount,
      failureCount,
      errors: errors.slice(0, 10),
      sentAt: now,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      logId: logDoc.id,
      recipientCount: recipients.length,
      successCount,
      failureCount,
      errors,
    });
  } catch (err: any) {
    console.error('[API Broadcast Send Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
