import fs from 'fs';
import path from 'path';
import { WhatsAppService } from './whatsapp.service';
import { MetaWhatsAppServer } from './meta-whatsapp.server';
import { SupervisorsService } from './supervisors.service';
import { SitesService } from './sites.service';
import { AttendanceSessionsService } from './attendanceSessions.service';
import { ImageStorageServer } from './image-storage.server';
import { FaceRecognitionService } from './face-recognition.service';
import { AttendanceService } from './attendance.service';
import { WhatsAppFeedbackServer } from './whatsapp-feedback.server';
import { getTodayDateString, normalizeWhatsAppNumber } from '@/lib/formatters';

export class WebhookProcessorServer {
  /**
   * Main entry point for processing incoming WhatsApp webhooks (Real Meta Webhooks & Simulations).
   */
  public static async processPayload(payload: any) {
    try {
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messageObj = value?.messages?.[0];

      if (!messageObj) {
        console.log('[WebhookProcessor] Ignored payload: No message object present.');
        return { status: 'ignored', reason: 'No message object' };
      }

      const rawMessageId = messageObj.id || `msg_${Date.now()}`;
      const rawSenderNumber = messageObj.from || value?.contacts?.[0]?.wa_id || '';
      const normalizedSender = normalizeWhatsAppNumber(rawSenderNumber);
      const messageType = messageObj.type || 'unknown';
      const isSimulation = rawMessageId.startsWith('sim_msg_');
      const mediaId = messageObj.image?.id;

      // Extract authoritative WhatsApp message timestamp (in milliseconds)
      const rawTimestampSeconds = messageObj.timestamp ? parseInt(messageObj.timestamp, 10) : 0;
      const messageTimestampMs = rawTimestampSeconds > 0 ? rawTimestampSeconds * 1000 : Date.now();

      console.log(
        `[WebhookProcessor] Incoming message ID: ${rawMessageId}, Sender: ${normalizedSender}, ` +
        `Type: ${messageType}, Timestamp: ${new Date(messageTimestampMs).toISOString()}`
      );

      // 1. Duplicate Protection Check
      const isDuplicate = await WhatsAppService.isWhatsAppMessageAlreadyProcessed(rawMessageId);
      if (isDuplicate) {
        console.log(`[WebhookProcessor] Ignored duplicate message ID: ${rawMessageId}`);
        return { status: 'ignored', reason: 'Duplicate message ID' };
      }

      // 2. Identify or Auto-Create Supervisor
      let supervisor = await WhatsAppService.identifySender(normalizedSender);
      if (!supervisor) {
        const allSupervisors = await SupervisorsService.getSupervisors();
        if (allSupervisors.length > 0 && allSupervisors[0]) {
          supervisor = allSupervisors[0];
          console.log(`[WebhookProcessor] Linked incoming sender ${normalizedSender} to default supervisor ${supervisor.name}`);
        } else {
          console.log(`[WebhookProcessor] Creating new supervisor for phone ${normalizedSender}...`);
          const newSupId = await SupervisorsService.createSupervisor({
            name: 'Supervisor A',
            whatsappNumber: normalizedSender,
            phone: normalizedSender,
          });
          supervisor = (await SupervisorsService.getSupervisorById(newSupId))!;
        }
      }

      // 3. Site Resolution
      const sites = await SitesService.getSites();
      let supervisorSite = sites.find((s) => s.supervisorId === supervisor.id && s.active);

      if (!supervisorSite) {
        const activeSites = sites.filter((s) => s.active);
        if (activeSites.length > 0 && activeSites[0]) {
          supervisorSite = activeSites[0];
          console.log(`[WebhookProcessor] Linked supervisor ${supervisor.name} to site ${supervisorSite.name}`);
        } else {
          const newSiteId = await SitesService.createSite({
            name: 'Site A (Andheri Commercial)',
            address: 'Andheri West, Mumbai',
            supervisorId: supervisor.id,
          });
          supervisorSite = (await SitesService.getSiteById(newSiteId))!;
        }
      }

      // 4. Save incoming message record
      const savedMsgId = await WhatsAppService.saveIncomingMessage({
        messageId: rawMessageId,
        senderNumber: normalizedSender,
        messageType,
        mediaId,
      });
      await WhatsAppService.updateMessageStatus(savedMsgId, 'processing');

      // 5. Non-Image Messages Handling
      if (messageType !== 'image') {
        await WhatsAppService.updateMessageStatus(savedMsgId, 'processed');
        return {
          status: 'completed',
          reason: 'Non-image message logged.',
          messageId: rawMessageId,
        };
      }

      // 6. Create Attendance Session
      const today = getTodayDateString();
      const sessionId = await AttendanceSessionsService.createAttendanceSession({
        date: today,
        siteId: supervisorSite.id,
        supervisorId: supervisor.id,
        whatsappSenderNumber: normalizedSender,
        whatsappMessageId: rawMessageId,
      });

      let imageBuffer: Buffer | null = null;
      let contentType = 'image/jpeg';
      let photoUrl = '';

      // 7. Binary Image Retrieval (Live Meta Webhooks & Simulations)
      if (isSimulation) {
        const rootDir = process.cwd();
        const fallbackPath = path.resolve(rootDir, '..', 'face-service', 'test-data', 'test_4_workers_collage.jpg');
        if (fs.existsSync(fallbackPath)) {
          imageBuffer = fs.readFileSync(fallbackPath);
          console.log(`[WebhookProcessor] Loaded simulation 4-worker collage image (${imageBuffer.length} bytes)`);
        }
      } else if (mediaId) {
        try {
          console.log(`[WebhookProcessor] Fetching media metadata for media ID ${mediaId}...`);
          const metadata = await MetaWhatsAppServer.getMediaMetadata(mediaId);
          console.log(`[WebhookProcessor] Downloading binary media buffer from Meta URL...`);
          const downloaded = await MetaWhatsAppServer.downloadMediaBuffer(metadata.url);
          imageBuffer = downloaded.buffer;
          contentType = downloaded.contentType;
        } catch (mediaErr: any) {
          console.error('[WebhookProcessor] Failed to download binary media from Meta API:', mediaErr);
          
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);

          // Dispatch exact WhatsApp error message to phone
          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ Attendance Photo Download Error: Could not download media from Meta API (${mediaErr?.message || 'Access Token Expired'}). Please check Meta Token.`
          );

          return {
            status: 'failed',
            reason: `Meta Media Download Error: ${mediaErr?.message || 'Access token expired or unauthorized'}`,
            messageId: rawMessageId,
            sessionId,
          };
        }
      }

      if (!imageBuffer) {
        await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
        return { status: 'failed', reason: 'No image buffer available to process', messageId: rawMessageId, sessionId };
      }

      // 8. Save Attendance Photo to Local Disk & Get Serving URL
      try {
        photoUrl = await ImageStorageServer.saveAttendancePhoto({
          date: today,
          siteId: supervisorSite.id,
          sessionId,
          buffer: imageBuffer,
          mimeType: contentType,
        });
        console.log(`[WebhookProcessor] Attendance photo saved cleanly. Local URL: ${photoUrl}`);
      } catch (storageErr) {
        console.error('[WebhookProcessor] Error saving image to storage:', storageErr);
        await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
        return { status: 'failed', reason: 'Image storage error', messageId: rawMessageId, sessionId };
      }

      // 9. AI Face Recognition Pipeline ON THE EXACT DOWNLOADED IMAGE
      console.log(`[WebhookProcessor] Dispatching photo ${photoUrl} to FaceRecognitionService...`);
      const recognitionResult = await FaceRecognitionService.recognizeGroupSelfie(photoUrl);
      console.log(`[WebhookProcessor] Recognition Result:`, recognitionResult);

      // 10. Automatic Attendance Record Creation/Update (1 Record Per Worker Lifecycle)
      for (const matchedWorkerId of recognitionResult.matchedWorkerIds) {
        await AttendanceService.recordWorkerAttendance({
          attendanceSessionId: sessionId,
          workerId: matchedWorkerId,
          siteId: supervisorSite.id,
          date: today,
          messageTimestamp: messageTimestampMs,
          attendancePhotoUrl: photoUrl,
          submittedBy: `Supervisor WhatsApp (${normalizedSender})`,
        });
      }

      // 11. Complete Session
      await AttendanceSessionsService.updateSessionStatus(sessionId, 'completed');
      await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', sessionId);

      // 12. Send Clean WhatsApp Feedback Report Back to Supervisor Phone
      console.log(`[WebhookProcessor] Dispatching WhatsApp feedback report back to ${normalizedSender}...`);
      const feedbackRes = await WhatsAppFeedbackServer.sendAttendanceFeedbackReport({
        supervisorWhatsAppNumber: normalizedSender,
        siteName: supervisorSite.name,
        date: today,
        recognizedWorkerIds: recognitionResult.matchedWorkerIds,
        unknownFaceCount: recognitionResult.unknownFaceCount,
      });

      console.log(`[WebhookProcessor] WhatsApp feedback report status:`, feedbackRes);

      return {
        status: 'completed',
        reason: 'WhatsApp group selfie processed, workers recognized, attendance recorded, and feedback sent successfully.',
        messageId: rawMessageId,
        sessionId,
        recognizedCount: recognitionResult.recognizedCount,
      };
    } catch (err: any) {
      console.error('[WebhookProcessor] Fatal error processing WhatsApp webhook payload:', err);
      return { status: 'failed', reason: err?.message || 'Internal server error' };
    }
  }
}
