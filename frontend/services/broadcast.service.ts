import { OrgContextService } from './org-context.service';
import { getDocs, query, orderBy } from 'firebase/firestore';
import type { BroadcastLog, BroadcastTargetGroup } from '@/types/broadcast';

const COLLECTION_NAME = 'broadcasts';

export class BroadcastService {
  /**
   * Dispatches WhatsApp broadcast message via Next.js Server Route Handler
   */
  public static async sendBroadcast(payload: {
    title: string;
    message: string;
    category: 'holiday' | 'safety' | 'event' | 'payment' | 'general';
    targetGroup: BroadcastTargetGroup;
    siteId?: string;
    orgId?: string;
  }): Promise<{
    success: boolean;
    recipientCount: number;
    successCount: number;
    failureCount: number;
    logId?: string;
    error?: string;
    errors?: string[];
  }> {
    const orgId = payload.orgId || OrgContextService.getOrgId();
    const res = await fetch('/api/broadcast/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        orgId,
      }),
    });

    return await res.json();
  }

  /**
   * Fetches past broadcast logs from Firestore
   */
  public static async getBroadcastLogs(orgId?: string): Promise<BroadcastLog[]> {
    try {
      const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
      const q = query(colRef, orderBy('sentAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          organizationId: data.organizationId || '',
          title: data.title || '',
          message: data.message || '',
          category: data.category || 'general',
          targetGroup: data.targetGroup || 'all',
          siteId: data.siteId || '',
          siteName: data.siteName || '',
          recipientCount: data.recipientCount || 0,
          successCount: data.successCount || 0,
          failureCount: data.failureCount || 0,
          sentAt: data.sentAt,
          sentBy: data.sentBy || 'Admin',
        } as BroadcastLog;
      });
    } catch (err) {
      console.error('[BroadcastService] Error fetching broadcast logs:', err);
      return [];
    }
  }
}
