import fs from 'fs';
import path from 'path';
import {
  addDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { SupervisorsService } from './supervisors.service';
import { OrgContextService } from './org-context.service';
import { normalizeWhatsAppNumber } from '@/lib/formatters';
import type { WhatsAppMessageRecord, WhatsAppMessageType } from '@/types/whatsapp';
import type { Supervisor } from '@/types/supervisor';

const COLLECTION_NAME = 'whatsappMessages';

const DEFAULT_ORG_ID = 'org_primary';

export class WhatsAppService {
  /**
   * Duplicate Protection Check:
   * Returns true if a WhatsApp message with the given unique Meta messageId has already been recorded.
   */
  public static async isWhatsAppMessageAlreadyProcessed(messageId: string, orgId?: string): Promise<boolean> {
    if (!messageId) return false;
    try {
      const docs = await OrgContextService.getDocsWithFallback(
        COLLECTION_NAME,
        [where('messageId', '==', messageId)],
        orgId
      );
      if (docs.length > 0) return true;
      if (orgId && orgId !== DEFAULT_ORG_ID) {
        const fallbackDocs = await OrgContextService.getDocsWithFallback(
          COLLECTION_NAME,
          [where('messageId', '==', messageId)],
          DEFAULT_ORG_ID
        );
        return fallbackDocs.length > 0;
      }
    } catch (e) {
      console.warn(`[WhatsAppService] Error checking duplicate message ${messageId}:`, e);
    }
    return false;
  }

  /**
   * Alias for duplicate protection check.
   */
  public static async isMessageProcessed(messageId: string, orgId?: string): Promise<boolean> {
    return this.isWhatsAppMessageAlreadyProcessed(messageId, orgId);
  }

  /**
   * Records an incoming WhatsApp message payload into Firestore.
   */
  public static async saveIncomingMessage(
    data: {
      messageId?: string;
      whatsappMessageId?: string;
      senderNumber: string;
      messageType: WhatsAppMessageType;
      mediaId?: string;
      rawPayload?: any;
    },
    orgId?: string
  ): Promise<string> {
    const msgId = data.messageId || data.whatsappMessageId || `msg_${Date.now()}`;
    const normalizedSender = normalizeWhatsAppNumber(data.senderNumber);
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();

    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
      messageId: msgId,
      senderNumber: normalizedSender,
      messageType: data.messageType,
      mediaId: data.mediaId || '',
      receivedAt: now,
      processed: false,
      processingStatus: 'received',
      createdAt: now,
    });

    return docRef.id;
  }

  /**
   * Identifies the Supervisor associated with an incoming WhatsApp sender number.
   */
  public static async identifySender(rawNumber: string, orgId?: string): Promise<Supervisor | null> {
    return SupervisorsService.getSupervisorByWhatsAppNumber(rawNumber, orgId);
  }

  /**
   * Update message processing status safely without throwing 5 NOT_FOUND errors.
   */
  public static async updateMessageStatus(
    id: string,
    processingStatus: WhatsAppMessageRecord['processingStatus'],
    attendanceSessionId?: string,
    orgId?: string
  ): Promise<void> {
    if (!id) return;
    try {
      let res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
      if (!res.data && orgId && orgId !== DEFAULT_ORG_ID) {
        const fallbackRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, DEFAULT_ORG_ID);
        if (fallbackRes.data) {
          res = fallbackRes;
        }
      }

      if (res.data && res.ref) {
        await updateDoc(res.ref, {
          processed: processingStatus === 'processed',
          processingStatus,
          ...(attendanceSessionId ? { attendanceSessionId } : {}),
        });
      }
    } catch (e) {
      console.warn(`[WhatsAppService] Non-critical warning updating message status for ${id}:`, e);
    }
  }

  /**
   * Dispatches an HTTP POST request to Meta Graph API to send a WhatsApp text message.
   * Dynamically reads WHATSAPP_ACCESS_TOKEN from .env.local to support instant token updates.
   */
  public static async sendMessage(
    toWhatsAppNumber: string,
    bodyText: string
  ): Promise<{ success: boolean; messageId: string; error?: string }> {
    const normalized = normalizeWhatsAppNumber(toWhatsAppNumber);
    const cleanNumber = normalized.replace(/\+/g, '');

    let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    try {
      const pathsToTry = [
        path.resolve(process.cwd(), '.env.local'),
        path.resolve(process.cwd(), 'frontend', '.env.local'),
      ];
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          const envContent = fs.readFileSync(p, 'utf-8');
          const match = envContent.match(/WHATSAPP_ACCESS_TOKEN=(.+)/);
          if (match && match[1]) {
            accessToken = match[1].trim().replace(/^["']|["']$/g, '');
            if (accessToken) break;
          }
        }
      }
    } catch (e) {
      // fallback to process.env
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1330066433517275';
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    if (!accessToken || accessToken.startsWith('EAAG_dummy')) {
      console.warn(`[WhatsAppService] Missing valid WHATSAPP_ACCESS_TOKEN. Cannot dispatch message to ${cleanNumber}`);
      return { success: false, messageId: '', error: 'Unconfigured Meta Access Token' };
    }

    const graphApiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    console.log(`[WhatsAppService] Dispatching Meta WhatsApp message to ${cleanNumber}...`);

    try {
      const res = await fetch(graphApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: 'text',
          text: {
            preview_url: false,
            body: bodyText,
          },
        }),
      });

      const data = await res.json();
      console.log(`[WhatsAppService Outbound Meta Response] Status: ${res.status}`, JSON.stringify(data, null, 2));

      if (!res.ok) {
        console.error('[WhatsAppService] Meta API Error Response:', data);
        return {
          success: false,
          messageId: '',
          error: data?.error?.message || `Meta API HTTP ${res.status}`,
        };
      }

      const outMessageId = data?.messages?.[0]?.id || `meta_${Date.now()}`;
      console.log(`[WhatsAppService] Message sent successfully! Meta Message ID: ${outMessageId}`);

      return {
        success: true,
        messageId: outMessageId,
      };
    } catch (err: any) {
      console.error('[WhatsAppService] Error dispatching Meta WhatsApp message:', err);
      return {
        success: false,
        messageId: '',
        error: err?.message || 'Network request failed',
      };
    }
  }

  /**
   * Sends attendance submission confirmation to supervisor.
   */
  public static async sendAttendanceConfirmation(
    toWhatsAppNumber: string,
    siteName: string,
    presentCount: number
  ): Promise<void> {
    const message = `Attendance received for ${siteName}. ${presentCount} worker(s) recorded successfully.`;
    await this.sendMessage(toWhatsAppNumber, message);
  }

  /**
   * Sends manual review request notification to supervisor/owner.
   */
  public static async sendReviewRequest(
    toWhatsAppNumber: string,
    siteName: string,
    unrecognizedCount: number
  ): Promise<void> {
    const message = `Attendance session for ${siteName} contains ${unrecognizedCount} unverified worker(s). Please review on the Owner Dashboard.`;
    await this.sendMessage(toWhatsAppNumber, message);
  }
}
