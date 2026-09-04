import fs from 'fs';
import path from 'path';
import { WhatsAppService } from './whatsapp.service';
import { MetaWhatsAppServer } from './meta-whatsapp.server';
import { SitesService } from './sites.service';
import { AttendanceSessionsService } from './attendanceSessions.service';
import { ImageStorageServer } from './image-storage.server';
import { FaceRecognitionService } from './face-recognition.service';
import { AttendanceService } from './attendance.service';
import { WorkersService } from './workers.service';
import { WhatsAppFeedbackServer } from './whatsapp-feedback.server';
import { PendingCheckinService } from './pending-checkin.service';
import { PaymentOcrService } from './payment-ocr.service';
import { PaymentLedgerService } from './payment-ledger.service';
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
      // PATH 1: 1-TAP ZERO-SELFIE WORKER QR ATTENDANCE (e.g. CHECKIN_CK_...)
      // =====================================================================
      if (messageType === 'text' && textBody.toUpperCase().includes('CHECKIN_')) {
        const tokenMatch = textBody.match(/CHECKIN_([A-Za-z0-9_]+)/i);
        const rawToken = tokenMatch ? tokenMatch[1] : '';

        console.log(`[WebhookProcessor] Worker 1-Tap QR check-in token received: "${rawToken}" from ${normalizedSender}`);

        const session = await PendingCheckinService.linkPhoneToPendingCheckin(
          rawToken,
          normalizedSender,
          rawMessageId
        );

        if (session) {
          const site = await SitesService.getSiteById(session.siteId);
          const siteName = site ? site.name : 'Construction Site';

          // 1. Resolve or auto-register worker by phone number
          const targetWorker = await WorkersService.getOrCreateWorkerByPhone(normalizedSender);

          // 2. Create Attendance Session
          const sessionId = await AttendanceSessionsService.createAttendanceSession({
            date: today,
            siteId: session.siteId,
            supervisorId: 'worker_qr_whatsapp',
            whatsappSenderNumber: normalizedSender,
            whatsappMessageId: rawMessageId,
          });

          // 3. Record attendance immediately (Zero selfie required!)
          await AttendanceService.recordWorkerAttendance({
            attendanceSessionId: sessionId,
            workerId: targetWorker.id,
            siteId: session.siteId,
            date: today,
            messageTimestamp: messageTimestampMs,
            attendancePhotoUrl: '',
            submittedBy: `Worker QR WhatsApp (${normalizedSender})`,
            method: 'worker_qr_whatsapp',
          });

          // 4. Mark pending checkin as used
          await PendingCheckinService.markPendingCheckinUsed(session.id);
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'completed');
          await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', sessionId);

          // 5. Send instant, complete attendance report back to the worker
          await WhatsAppFeedbackServer.sendAttendanceFeedbackReport({
            supervisorWhatsAppNumber: normalizedSender,
            siteId: session.siteId,
            siteName: siteName,
            date: today,
            recognizedWorkerIds: [targetWorker.id],
            unknownFaceCount: 0,
          });

          return {
            status: 'completed',
            reason: `1-Tap QR attendance recorded for ${targetWorker.name} at ${siteName}`,
            messageId: rawMessageId,
            sessionId,
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
      // PATH 2: IMAGE PROCESSING (PAYMENT SCREENSHOT OCR vs SELFIE ATTENDANCE)
      // =====================================================================

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
          console.error('[WebhookProcessor] Failed to download media:', mediaErr);
          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');
          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ Could not download your photo from WhatsApp. Please try sending it again.`
          );
          return { status: 'failed', reason: 'Media download error', messageId: rawMessageId };
        }
      }

      if (!imageBuffer) {
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');
        return { status: 'failed', reason: 'No image buffer', messageId: rawMessageId };
      }

      // ---------------------------------------------------------------------
      // FEATURE: AI PAYMENT SCREENSHOT OCR & KHATA LEDGER
      // Check if uploaded image is a payment receipt (GPay / PhonePe / Paytm)
      // ---------------------------------------------------------------------
      const paymentData = await PaymentOcrService.extractPaymentFromImage('', imageBuffer);

      if (paymentData.isPaymentScreenshot && paymentData.amount && paymentData.amount > 0) {
        console.log(`[WebhookProcessor] Payment Screenshot Detected! Amount: ₹${paymentData.amount}, Receiver: ${paymentData.receiverName}`);

        // Save receipt image to Supabase storage
        try {
          photoUrl = await ImageStorageServer.saveAttendancePhoto({
            date: today,
            siteId: 'payment_receipts',
            sessionId: `pay_${Date.now()}`,
            buffer: imageBuffer,
            mimeType: contentType,
          });
        } catch (storageErr) {
          console.warn('[WebhookProcessor] Error saving payment receipt photo:', storageErr);
        }

        // Match or resolve worker
        const allWorkers = await WorkersService.getWorkers();
        let matchedWorker = allWorkers.find((w) => {
          const nameLower = w.name.toLowerCase();
          const targetName = (paymentData.receiverName || '').toLowerCase();
          if (targetName && (nameLower.includes(targetName) || targetName.includes(nameLower))) {
            return true;
          }
          if (paymentData.upiId && w.phone) {
            const cleanPhone = w.phone.replace(/\D/g, '');
            if (cleanPhone.length >= 10 && paymentData.upiId.includes(cleanPhone.slice(-10))) {
              return true;
            }
          }
          return false;
        });

        if (!matchedWorker && paymentData.receiverName) {
          const newCode = `WRK-00${allWorkers.length + 1}`;
          const newId = await WorkersService.createWorker({
            name: paymentData.receiverName,
            workerCode: newCode,
            role: 'General Worker',
          });
          matchedWorker = {
            id: newId,
            name: paymentData.receiverName,
            workerCode: newCode,
            active: true,
            createdAt: null as any,
            updatedAt: null as any,
          };
        }

        const resolvedWorkerId = matchedWorker?.id || 'unassigned_worker';
        const resolvedWorkerName = matchedWorker ? getWorkerDisplayName(matchedWorker) : paymentData.receiverName || 'Worker';

        // Record entry in Khata Ledger
        await PaymentLedgerService.recordPayment({
          workerId: resolvedWorkerId,
          workerName: resolvedWorkerName,
          workerCode: matchedWorker?.workerCode,
          workerPhone: matchedWorker?.phone,
          amount: paymentData.amount,
          category: 'advance',
          paymentMethod: paymentData.paymentMethod,
          upiId: paymentData.upiId || '',
          paymentDate: today,
          paymentTime: paymentData.timestampStr || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          receiptPhotoUrl: photoUrl,
          recordedBy: `WhatsApp AI OCR (${normalizedSender})`,
          rawOcrText: paymentData.rawText,
        });

        await WhatsAppService.updateMessageStatus(savedMsgId, 'processed');

        // Send WhatsApp confirmation back to contractor
        await WhatsAppService.sendMessage(
          normalizedSender,
          `Payment Recorded in Khata 💳\n\n` +
          `Paid To: *${resolvedWorkerName}*\n` +
          `Amount: *₹${paymentData.amount.toFixed(2)}*\n` +
          `Date: ${today}\n` +
          `Payment App: ${paymentData.paymentMethod.toUpperCase()}\n` +
          `UPI / Ref: ${paymentData.upiId || 'Direct UPI'}\n` +
          `Category: *Advance Payment*\n\n` +
          `Worker Khata Balance Updated! ✅`
        );

        return {
          status: 'completed',
          reason: `Payment receipt recorded for ${resolvedWorkerName}: ₹${paymentData.amount}`,
          messageId: rawMessageId,
        };
      }

      // ---------------------------------------------------------------------
      // ATTENDANCE SELFIE / GROUP PHOTO PATH
      // ---------------------------------------------------------------------
      let activeWorkerPendingSession = await PendingCheckinService.getActivePendingCheckinByPhone(normalizedSender);

      if (!activeWorkerPendingSession) {
        console.log(`[WebhookProcessor] Photo rejected: No active QR checkin token for ${normalizedSender}`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'ignored');

        await WhatsAppService.sendMessage(
          normalizedSender,
          `⚠️ *Attendance Record Nahi Hua!*\n\n` +
          `❌ *Aapne Site Gate ka QR Code scan nahi kiya hai.*\n\n` +
          `📌 *Attendance Lagane Ka Sahi Tareeqa:*\n` +
          `1️⃣ Apne construction site gate par laga QR Code scan karein.\n` +
          `2️⃣ Mobile browser mein *Allow Location* par tap karein.\n` +
          `3️⃣ WhatsApp open hone par *SEND* button dabayein!\n\n` +
          `_Kripya pehle QR code scan kijiye, direct photo bhejne par attendance nahi lagega._`
        );

        return {
          status: 'failed',
          reason: 'Direct photo rejected without active QR check-in session',
          messageId: rawMessageId,
        };
      }

      // ---------------------------------------------------------------------
      // WORKER QR SELFIE WORKFLOW (Strictly uses scanned site ID)
      // ---------------------------------------------------------------------
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

      // Ensure image buffer is downloaded
      if (!imageBuffer) {
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
      }

      if (!imageBuffer) {
        await AttendanceSessionsService.updateSessionStatus(sessionId, 'failed');
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', sessionId);
        return { status: 'failed', reason: 'No image buffer', messageId: rawMessageId };
      }

      // Save photo to storage under the verified siteId
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

      const matchedWorkerId = recognitionResult.matchedWorkerIds[0];
      if (matchedWorkerId) {
        const targetWorker = allWorkers.find(
          (w) => w.id === matchedWorkerId || w.workerCode === matchedWorkerId
        );
        const resolvedId = targetWorker?.id || matchedWorkerId;
        const displayName = targetWorker ? getWorkerDisplayName(targetWorker) : 'Worker';

        // Record attendance strictly under the QR-scanned siteId
        await AttendanceService.recordWorkerAttendance({
          attendanceSessionId: sessionId,
          workerId: resolvedId,
          siteId: activeWorkerPendingSession.siteId,
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

        // Send full, formatted attendance feedback report strictly for this Site
        await WhatsAppFeedbackServer.sendAttendanceFeedbackReport({
          supervisorWhatsAppNumber: normalizedSender,
          siteId: activeWorkerPendingSession.siteId,
          siteName: siteName,
          date: today,
          recognizedWorkerIds: [resolvedId],
          unknownFaceCount: 0,
        });

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
          `We could not match your photo with our registered workers database for ${siteName}.\n` +
          `Please ensure your face is well-lit and clearly visible, then send your selfie again.`
        );

        return {
          status: 'completed',
          reason: 'Face not recognized in worker selfie',
          messageId: rawMessageId,
          sessionId,
        };
      }
    } catch (err: any) {
      console.error('[WebhookProcessor] Critical processing error:', err);
      return { status: 'failed', reason: err?.message || 'Internal processing error' };
    }
  }
}
