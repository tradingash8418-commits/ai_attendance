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
import { PendingCheckinService } from './pending-checkin.service';
import { getTodayDateString, normalizeWhatsAppNumber, getWorkerDisplayName } from '@/lib/formatters';

export class WebhookProcessorServer {
  /**
   * Main entry point for processing incoming WhatsApp webhooks (Real Meta Webhooks & Simulations).
   * Supports both:
   * 1. Existing Supervisor Group Photo Flow (No GPS/QR required)
   * 2. Worker Self Check-in Flow (Site QR + Browser GPS + WhatsApp Selfie)
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
      const textBody = (messageObj.text?.body || messageObj.image?.caption || '').trim();

      // Extract authoritative WhatsApp message timestamp (in milliseconds)
      const rawTimestampSeconds = messageObj.timestamp ? parseInt(messageObj.timestamp, 10) : 0;
      const messageTimestampMs = rawTimestampSeconds > 0 ? rawTimestampSeconds * 1000 : Date.now();
      const today = getTodayDateString();

      console.log(
        `[WebhookProcessor] Incoming message ID: ${rawMessageId}, Sender: ${normalizedSender}, ` +
        `Type: ${messageType}, Timestamp: ${new Date(messageTimestampMs).toISOString()}`
      );

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

      // =====================================================================
      // PATH 1: WORKER QR TEXT TOKEN REGISTRATION (e.g. CHECKIN_CK_123_ABC)
      // =====================================================================
      if (messageType === 'text' && textBody.toUpperCase().includes('CHECKIN_')) {
        const tokenMatch = textBody.match(/CHECKIN_([A-Za-z0-9_]+)/i);
        const rawToken = tokenMatch ? tokenMatch[1] : '';

        console.log(`[WebhookProcessor] Worker QR check-in token received: "${rawToken}" from ${normalizedSender}`);

        const session = await PendingCheckinService.linkPhoneToPendingCheckin(
          rawToken,
          normalizedSender,
          rawMessageId
        );

        if (session) {
          const site = await SitesService.getSiteById(session.siteId);
          const siteName = site ? site.name : 'Construction Site';

          await WhatsAppService.sendMessage(
            normalizedSender,
            `👋 *Namaste! Welcome to ${siteName}.*\n\n` +
            `📍 Location verified within site boundary.\n` +
            `📸 *Please click and send your LIVE SELFIE photo now to record your attendance.*`
          );

          await WhatsAppService.updateMessageStatus(savedMsgId, 'processed');
          return {
            status: 'completed',
            reason: 'Worker checkin token linked to phone. Awaiting selfie.',
            messageId: rawMessageId,
            siteId: session.siteId,
          };
        } else {
          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ *Check-in Expired or Invalid*\n\n` +
            `Your site QR check-in session has expired or is invalid. Please scan the QR code at the site gate again.`
          );

          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');
          return { status: 'failed', reason: 'Invalid or expired checkin token', messageId: rawMessageId };
        }
      }

      // Ignore any other non-image text messages
      if (messageType !== 'image') {
        console.log(`[WebhookProcessor] Non-image message type received: ${messageType}`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'ignored');
        return { status: 'ignored', reason: 'Non-image message type', messageId: rawMessageId };
      }

      // =====================================================================
      // PATH 2: IMAGE PROCESSING (SUPERVISOR GROUP PHOTO vs WORKER QR SELFIE)
      // =====================================================================

      // 3. Check if sender is a Registered Supervisor
      const supervisor = await SupervisorsService.getSupervisorByPhone(normalizedSender);

      // Check if sender has an active GPS-verified worker QR session
      let activeWorkerPendingSession = await PendingCheckinService.getActivePendingCheckinByPhone(normalizedSender);

      // Also check if image caption contains a fresh checkin token
      if (!activeWorkerPendingSession && textBody.toUpperCase().includes('CHECKIN_')) {
        const tokenMatch = textBody.match(/CHECKIN_([A-Za-z0-9_]+)/i);
        if (tokenMatch) {
          activeWorkerPendingSession = await PendingCheckinService.linkPhoneToPendingCheckin(
            tokenMatch[1],
            normalizedSender,
            rawMessageId
          );
        }
      }

      // ---------------------------------------------------------------------
      // WORKER QR SELFIE WORKFLOW
      // ---------------------------------------------------------------------
      if (!supervisor && activeWorkerPendingSession) {
        console.log(`[WebhookProcessor] Processing WORKER QR Selfie for site ID ${activeWorkerPendingSession.siteId}`);

        const site = await SitesService.getSiteById(activeWorkerPendingSession.siteId);
        const siteName = site ? site.name : 'Construction Site';

        // Create Attendance Session for worker self check-in
        const sessionId = await AttendanceSessionsService.createAttendanceSession({
          date: today,
          siteId: activeWorkerPendingSession.siteId,
          supervisorId: 'worker_qr_self',
          whatsappSenderNumber: normalizedSender,
          whatsappMessageId: rawMessageId,
        });

        // Download image buffer
        let imageBuffer: Buffer | null = null;
        let contentType = 'image/jpeg';
        let photoUrl = '';

        if (isSimulation) {
          const rootDir = process.cwd();
          const fallbackPath = path.resolve(rootDir, '..', 'face-service', 'test-data', 'test_4_workers_collage.jpg');
          if (fs.existsSync(fallbackPath)) {
            imageBuffer = fs.readFileSync(fallbackPath);
          }
        } else if (mediaId) {
          try {
            const metadata = await MetaWhatsAppServer.getMediaMetadata(mediaId);
            const downloaded = await MetaWhatsAppServer.downloadMediaBuffer(metadata.url);
            imageBuffer = downloaded.buffer;
            contentType = downloaded.contentType;
          } catch (mediaErr: any) {
            console.error('[WebhookProcessor] Failed to download worker selfie:', mediaErr);
            await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
            await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
            await WhatsAppService.sendMessage(
              normalizedSender,
              `⚠️ Could not download your selfie from WhatsApp. Please try sending your photo again.`
            );
            return { status: 'failed', reason: 'Media download error', messageId: rawMessageId };
          }
        }

        if (!imageBuffer) {
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
          return { status: 'failed', reason: 'No image buffer', messageId: rawMessageId };
        }

        // Save photo to storage
        try {
          photoUrl = await ImageStorageServer.saveAttendancePhoto({
            date: today,
            siteId: activeWorkerPendingSession.siteId,
            sessionId,
            buffer: imageBuffer,
            mimeType: contentType,
          });
        } catch (storageErr) {
          console.error('[WebhookProcessor] Error saving worker photo:', storageErr);
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
          return { status: 'failed', reason: 'Storage error', messageId: rawMessageId };
        }

        // Run SFace / YuNet Face Recognition
        const recognitionResult = await FaceRecognitionService.recognizeGroupSelfie(photoUrl, imageBuffer);
        const allWorkers = await WorkersService.getWorkers();

        if (recognitionResult.matchedWorkerIds.length > 0) {
          const matchedWorkerId = recognitionResult.matchedWorkerIds[0];
          const targetWorker = allWorkers.find(
            (w) => w.id === matchedWorkerId || w.workerCode === matchedWorkerId
          );
          const resolvedId = targetWorker ? targetWorker.id : matchedWorkerId;
          const displayName = targetWorker ? getWorkerDisplayName(targetWorker) : 'Worker';

          // Record attendance with method: 'worker_qr_whatsapp'
          await AttendanceService.recordWorkerAttendance({
            attendanceSessionId: sessionId,
            workerId: resolvedId,
            siteId: activeWorkerPendingSession.siteId || '',
            date: today,
            messageTimestamp: messageTimestampMs,
            attendancePhotoUrl: photoUrl,
            submittedBy: `Worker QR WhatsApp (${normalizedSender})`,
            method: 'worker_qr_whatsapp',
          });

          // Mark pending checkin session as used
          await PendingCheckinService.markPendingCheckinUsed(activeWorkerPendingSession.id);
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'completed');
          await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', sessionId);

          // Send clean WhatsApp confirmation to worker
          await WhatsAppService.sendMessage(
            normalizedSender,
            `Attendance Recorded ✅\n\n` +
            `Name: ${displayName}\n` +
            `Site: ${siteName}\n` +
            `Date: ${today}\n` +
            `Status: Present (Shift Active)\n` +
            `Hajri: 1.0 (Normal)\n\n` +
            `Thank you!`
          );

          return {
            status: 'completed',
            reason: `Worker QR check-in successful for ${displayName} at ${siteName}`,
            messageId: rawMessageId,
            sessionId,
          };
        } else {
          // Unknown face
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'completed');
          await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', sessionId);

          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ *Face Not Recognized*\n\n` +
            `We could not match your photo with our registered workers database.\n` +
            `Please ensure your face is well-lit and clearly visible, then send your selfie again.`
          );

          return {
            status: 'completed',
            reason: 'Face not recognized in worker selfie',
            messageId: rawMessageId,
            sessionId,
          };
        }
      }

      // ---------------------------------------------------------------------
      // SUPERVISOR WORKFLOW (EXISTING FLOW - 100% PRESERVED)
      // ---------------------------------------------------------------------
      if (!supervisor) {
        console.log(`[WebhookProcessor] Unregistered sender with no active QR session: ${normalizedSender}`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');

        await WhatsAppService.sendMessage(
          normalizedSender,
          `⚠️ *Attendance Error*\n\n` +
          `Phone number ${normalizedSender} is not registered as a supervisor.\n` +
          `If you are a worker marking attendance, please scan the Site QR code at the gate first, allow location, and then send your selfie.`
        );

        return { status: 'failed', reason: 'Unregistered sender without QR session', messageId: rawMessageId };
      }

      // 4. Supervisor Site Linkage Check with Auto-linking Fallback
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
        } else if (allSites[0]) {
          supervisorSite = allSites[0];
          await SitesService.assignSupervisorToSite(supervisorSite.id, supervisor.id);
        }
      }

      if (!supervisorSite) {
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');
        await WhatsAppService.sendMessage(
          normalizedSender,
          `⚠️ Attendance Error: Supervisor ${supervisor.name} is not assigned to any active construction site.`
        );
        return { status: 'failed', reason: 'No site linked to supervisor', messageId: rawMessageId };
      }

      // 6. Create Supervisor Attendance Session
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

      // 7. Binary Image Retrieval
      if (isSimulation) {
        const rootDir = process.cwd();
        const fallbackPath = path.resolve(rootDir, '..', 'face-service', 'test-data', 'test_4_workers_collage.jpg');
        if (fs.existsSync(fallbackPath)) {
          imageBuffer = fs.readFileSync(fallbackPath);
        }
      } else if (mediaId) {
        try {
          const metadata = await MetaWhatsAppServer.getMediaMetadata(mediaId);
          const downloaded = await MetaWhatsAppServer.downloadMediaBuffer(metadata.url);
          imageBuffer = downloaded.buffer;
          contentType = downloaded.contentType;
        } catch (mediaErr: any) {
          console.error('[WebhookProcessor] Failed to download supervisor media:', mediaErr);
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ Attendance Photo Download Error: Could not download media from Meta API (${mediaErr?.message || 'Access Token Expired'}).`
          );
          return { status: 'failed', reason: 'Meta Media Download Error', messageId: rawMessageId, sessionId };
        }
      }

      if (!imageBuffer) {
        await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
        return { status: 'failed', reason: 'No image buffer available', messageId: rawMessageId, sessionId };
      }

      // 8. Save Attendance Photo
      try {
        photoUrl = await ImageStorageServer.saveAttendancePhoto({
          date: today,
          siteId: supervisorSite.id,
          sessionId,
          buffer: imageBuffer,
          mimeType: contentType,
        });
      } catch (storageErr) {
        console.error('[WebhookProcessor] Error saving image to storage:', storageErr);
        await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
        return { status: 'failed', reason: 'Image storage error', messageId: rawMessageId, sessionId };
      }

      // 9. AI Face Recognition Pipeline
      const recognitionResult = await FaceRecognitionService.recognizeGroupSelfie(photoUrl, imageBuffer);
      const allWorkers = await WorkersService.getWorkers();

      // 10. Record Attendance for all matched workers (method: 'supervisor_whatsapp')
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
          method: 'supervisor_whatsapp',
        });
      }

      // 11. Complete Session
      await AttendanceSessionsService.updateSessionStatus(sessionId, 'completed');
      await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', sessionId);

      // 12. Send Clean WhatsApp Feedback Report Back to Supervisor Phone
      await WhatsAppFeedbackServer.sendAttendanceFeedbackReport({
        supervisorWhatsAppNumber: normalizedSender,
        siteName: supervisorSite.name,
        date: today,
        siteId: supervisorSite.id,
        matchedWorkerIds: recognitionResult.matchedWorkerIds,
        unknownFaceCount: recognitionResult.unknownFaceCount,
      });

      return {
        status: 'completed',
        reason: 'Supervisor group selfie processed successfully.',
        messageId: rawMessageId,
        sessionId,
      };
    } catch (err: any) {
      console.error('[WebhookProcessor] Critical processing error:', err);
      return { status: 'failed', reason: err?.message || 'Internal processing error' };
    }
  }
}
