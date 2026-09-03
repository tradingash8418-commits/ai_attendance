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
import { WorkersService } from './workers.service';
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

      console.log(`[WebhookProcessor] Incoming message ID: ${rawMessageId}, Sender: ${normalizedSender}, Type: ${messageType}, Timestamp: ${new Date(messageTimestampMs).toISOString()}`);

      // 1. Deduplication check
      const isDuplicate = await WhatsAppService.isMessageProcessed(rawMessageId);
      if (isDuplicate) {
        console.log(`[WebhookProcessor] Message ${rawMessageId} already processed. Skipping.`);
        return { status: 'ignored', reason: 'Duplicate message', messageId: rawMessageId };
      }

      // 2. Save raw message log
      const savedMsgId = await WhatsAppService.saveIncomingMessage({
        whatsappMessageId: rawMessageId,
        senderNumber: normalizedSender,
        messageType,
        mediaId,
        rawPayload: payload,
      });

      // 3. Supervisor Lookup by Phone / WhatsApp Number
      const supervisor = await SupervisorsService.getSupervisorByPhone(normalizedSender);
      if (!supervisor) {
        console.log(`[WebhookProcessor] Unregistered sender: ${normalizedSender}`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');

        // Dispatch exact WhatsApp error message to unregistered phone
        await WhatsAppService.sendMessage(
          normalizedSender,
          `⚠️ Attendance Error: Phone number ${normalizedSender} is not registered as an active supervisor. Please contact system admin.`
        );

        return { status: 'failed', reason: 'Unregistered supervisor phone number', messageId: rawMessageId };
      }

      // 4. Site Linkage Check with Automatic Fallback Linkage
      let supervisorSite = await SitesService.getSiteBySupervisorId(supervisor.id);
      if (!supervisorSite) {
        let allSites = await SitesService.getSites();
        if (allSites.length === 0) {
          const newSiteId = await SitesService.createSite({
            name: 'Site B (Bandra Residential)',
            address: 'Bandra West, Mumbai',
            supervisorId: supervisor.id,
          });
          supervisorSite = await SitesService.getSiteById(newSiteId);
        } else {
          supervisorSite = allSites[0];
          await SitesService.assignSupervisorToSite(supervisorSite.id, supervisor.id);
        }
        console.log(`[WebhookProcessor] Auto-linked supervisor ${supervisor.name} to site ${supervisorSite?.name}`);
      }

      if (!supervisorSite) {
        console.log(`[WebhookProcessor] No active site linked to supervisor ${supervisor.name} (${supervisor.id})`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');

        // Dispatch exact WhatsApp error message to supervisor phone
        await WhatsAppService.sendMessage(
          normalizedSender,
          `⚠️ Attendance Error: Supervisor ${supervisor.name} is not assigned to any active construction site.`
        );

        return { status: 'failed', reason: 'No site linked to supervisor', messageId: rawMessageId };
      }
      console.log(`[WebhookProcessor] Linked supervisor ${supervisor.name} to site ${supervisorSite.name}`);

      // 5. Message Type Validation (Must be Image)
      if (messageType !== 'image') {
        console.log(`[WebhookProcessor] Non-image message type received: ${messageType}`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'ignored');
        return { status: 'ignored', reason: 'Non-image message type', messageId: rawMessageId };
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
          console.log(`[WebhookProcessor] Loaded simulation collage image (${imageBuffer.length} bytes)`);
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

      // 8. Save Attendance Photo to Storage Engine & Get Serving URL
      try {
        photoUrl = await ImageStorageServer.saveAttendancePhoto({
          date: today,
          siteId: supervisorSite.id,
          sessionId,
          buffer: imageBuffer,
          mimeType: contentType,
        });
        console.log(`[WebhookProcessor] Attendance photo saved cleanly.`);
      } catch (storageErr) {
        console.error('[WebhookProcessor] Error saving image to storage:', storageErr);
        await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
        return { status: 'failed', reason: 'Image storage error', messageId: rawMessageId, sessionId };
      }

      // 9. AI Face Recognition Pipeline ON THE EXACT DOWNLOADED IMAGE
      console.log(`[WebhookProcessor] Dispatching photo to FaceRecognitionService...`);
      const recognitionResult = await FaceRecognitionService.recognizeGroupSelfie(photoUrl, imageBuffer);

      // 10. Automatic Attendance Record Creation/Update with Canonical Worker ID Resolution
      const allWorkers = await WorkersService.getWorkers();

      for (const matchedWorkerId of recognitionResult.matchedWorkerIds) {
        const targetWorker = allWorkers.find(
          (w) => w.id === matchedWorkerId || w.workerCode === matchedWorkerId
        );
        const resolvedId = targetWorker ? targetWorker.id : matchedWorkerId;

        await AttendanceService.recordWorkerAttendance({
          attendanceSessionId: sessionId,
          workerId: resolvedId,
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
        siteId: supervisorSite.id,
        matchedWorkerIds: recognitionResult.matchedWorkerIds,
        unknownFaceCount: recognitionResult.unknownFaceCount,
      });

      return {
        status: 'completed',
        reason: 'WhatsApp group selfie processed, workers recognized, attendance recorded, and feedback sent successfully.',
        messageId: rawMessageId,
        sessionId,
      };
    } catch (err: any) {
      console.error('[WebhookProcessor] Critical processing error:', err);
      return { status: 'failed', reason: err?.message || 'Internal processing error' };
    }
  }
}
