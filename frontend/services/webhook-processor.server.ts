import { WhatsAppService } from './whatsapp.service';
import { MetaWhatsAppServer } from './meta-whatsapp.server';
import { SitesService } from './sites.service';
import { AttendanceSessionsService } from './attendanceSessions.service';
import { ImageStorageServer } from './image-storage.server';
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
   * Supports:
   * 1. Worker 1-Tap QR Check-in (Zero-selfie required, 100% verified by Gate QR + GPS)
   * 2. AI Payment Screenshot OCR & Khata Ledger (GPay, PhonePe, Paytm receipts directly recorded to Khata)
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
      const mediaId = messageObj.document?.id || messageObj.image?.id;
      const textBody = (
        messageObj.text?.body ||
        messageObj.image?.caption ||
        messageObj.document?.caption ||
        messageObj.document?.filename ||
        ''
      ).trim();

      // Extract authoritative WhatsApp message timestamp (in milliseconds)
      const rawTimestampSeconds = messageObj.timestamp ? parseInt(messageObj.timestamp, 10) : 0;
      const messageTimestampMs = rawTimestampSeconds > 0 ? rawTimestampSeconds * 1000 : Date.now();
      const today = getTodayDateString();

      console.log(
        `[WebhookProcessor] Incoming message ID: ${rawMessageId}, Sender: ${normalizedSender}, ` +
        `Type: ${messageType}, Timestamp: ${new Date(messageTimestampMs).toISOString()}`
      );

      // Deduplication check removed per user request:
      // Allow all incoming payment screenshots to be processed and registered in the ledger without being discarded as duplicates.
      // (Even same person, same amount, or retried webhooks must be registered).

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

      // Ignore any message that is not an image or a document (PDF)
      if (messageType !== 'image' && messageType !== 'document') {
        console.log(`[WebhookProcessor] Non-image/document message type received: ${messageType}`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'ignored');
        return { status: 'ignored', reason: 'Non-image/document message type', messageId: rawMessageId };
      }

      // =====================================================================
      // PATH 2: AI PAYMENT SCREENSHOT & PDF RECEIPT OCR / KHATA LEDGER
      // All images and PDF payment receipts sent to WhatsApp are processed as payment receipts / bills
      // =====================================================================

      // Download image/document buffer from Meta Cloud API
      let imageBuffer: Buffer | null = null;
      let contentType = messageObj.document?.mime_type || (messageType === 'document' ? 'application/pdf' : 'image/jpeg');
      let photoUrl = '';

      if (mediaId) {
        try {
          const metadata = await MetaWhatsAppServer.getMediaMetadata(mediaId);
          const downloaded = await MetaWhatsAppServer.downloadMediaBuffer(metadata.url);
          imageBuffer = downloaded.buffer;
          contentType = downloaded.contentType || contentType;
        } catch (mediaErr: any) {
          console.error('[WebhookProcessor] Failed to download payment receipt media:', mediaErr);
          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');
          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ Could not download your payment receipt from WhatsApp. Please try sending it again.`
          );
          return { status: 'failed', reason: 'Media download error', messageId: rawMessageId };
        }
      }

      if (!imageBuffer) {
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed');
        return { status: 'failed', reason: 'No image/document buffer', messageId: rawMessageId };
      }

      // Save receipt image or PDF to Supabase storage
      try {
        photoUrl = await ImageStorageServer.saveAttendancePhoto({
          date: today,
          siteId: 'payment_receipts',
          sessionId: `pay_${Date.now()}`,
          buffer: imageBuffer,
          mimeType: contentType,
        });
      } catch (storageErr) {
        console.warn('[WebhookProcessor] Error saving payment receipt to Supabase:', storageErr);
      }

      // Extract Payment Information using multimodal AI / OCR pipeline (Supports Images & PDFs)
      const paymentData = await PaymentOcrService.extractPaymentFromImage('', imageBuffer, contentType);

      console.log(
        `[WebhookProcessor] Payment OCR Result: Amount=${paymentData.amount}, Receiver=${paymentData.receiverName}, ` +
        `Method=${paymentData.paymentMethod}, UPI=${paymentData.upiId}`
      );

      // 1. Check Caption Priority (User defined intent via WhatsApp caption)
      // Supports full words: 'vendor', 'material', 'supplier', 'thekedar' vs 'worker', 'labour', 'advance', 'karigar', 'kharcha', 'wage'
      // Supports single letters / short codes: 'v', 'm' (vendor) vs 'w', 'l', 'a', 'k' (worker advance)
      const cleanCaption = textBody.toLowerCase().trim();
      let explicitCategory: 'vendor' | 'advance' | null = null;

      if (
        cleanCaption === 'v' ||
        cleanCaption === 'vendor' ||
        cleanCaption === 'm' ||
        cleanCaption === 'material' ||
        cleanCaption.startsWith('vendor') ||
        cleanCaption.startsWith('material') ||
        cleanCaption.includes('supplier') ||
        cleanCaption.includes('thekedar') ||
        cleanCaption.includes('dukaan') ||
        cleanCaption.includes('shop')
      ) {
        explicitCategory = 'vendor';
      } else if (
        cleanCaption === 'w' ||
        cleanCaption === 'worker' ||
        cleanCaption === 'a' ||
        cleanCaption === 'advance' ||
        cleanCaption === 'l' ||
        cleanCaption === 'labour' ||
        cleanCaption === 'k' ||
        cleanCaption === 'karigar' ||
        cleanCaption.startsWith('worker') ||
        cleanCaption.startsWith('advance') ||
        cleanCaption.startsWith('labour') ||
        cleanCaption.startsWith('karigar') ||
        cleanCaption.includes('kharcha') ||
        cleanCaption.includes('wage') ||
        cleanCaption.includes('majdoor')
      ) {
        explicitCategory = 'advance';
      }

      // Check if recipient matches an EXISTING registered worker in Firestore
      const allWorkers = await WorkersService.getWorkers();
      const matchedWorker = allWorkers.find((w) => {
        const nameLower = w.name.toLowerCase();
        const targetName = (paymentData.receiverName || '').toLowerCase();
        if (targetName && (nameLower === targetName || nameLower.includes(targetName) || targetName.includes(nameLower))) {
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

      // CATEGORY DETERMINATION RULES:
      // Priority 1: Explicit WhatsApp Caption ('vendor'/'v' -> Vendor Ledger, 'worker'/'w' -> Worker Advance)
      // Priority 2: Auto-match registered workers if no explicit caption provided
      let paymentCategory: 'vendor' | 'advance' = 'vendor';
      if (explicitCategory) {
        paymentCategory = explicitCategory;
      } else if (matchedWorker) {
        paymentCategory = 'advance';
      } else {
        paymentCategory = 'vendor';
      }

      const isWorkerPayment = paymentCategory === 'advance';
      const finalAmount = paymentData.amount || 0;
      const finalPaidTo = paymentData.receiverName || (matchedWorker ? getWorkerDisplayName(matchedWorker) : (isWorkerPayment ? 'Worker / Karigar' : 'Vendor / Payee'));
      const resolvedWorkerId = (isWorkerPayment && matchedWorker) ? matchedWorker.id : '';
      const resolvedWorkerName = (isWorkerPayment && matchedWorker) ? getWorkerDisplayName(matchedWorker) : (isWorkerPayment ? finalPaidTo : '');

      // Record entry in Khata Ledger (DO NOT auto-create workers for vendors!)
      await PaymentLedgerService.recordPayment({
        paidTo: finalPaidTo,
        workerId: resolvedWorkerId,
        workerName: resolvedWorkerName,
        workerCode: (isWorkerPayment && matchedWorker) ? matchedWorker?.workerCode : undefined,
        workerPhone: (isWorkerPayment && matchedWorker) ? matchedWorker?.phone : undefined,
        amount: finalAmount,
        category: paymentCategory,
        paymentMethod: paymentData.paymentMethod || 'gpay',
        upiId: paymentData.upiId || '',
        paymentDate: today,
        paymentTime: paymentData.timestampStr || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        receiptPhotoUrl: photoUrl,
        notes: textBody ? `Caption: ${textBody}` : undefined,
        recordedBy: `WhatsApp AI OCR (${normalizedSender})`,
        rawOcrText: paymentData.rawText,
      });

      await WhatsAppService.updateMessageStatus(savedMsgId, 'processed');

      // Send clear WhatsApp confirmation back to contractor / sender
      let dateDisplay = today;
      if (paymentData.timestampStr) {
        if (paymentData.timestampStr.match(/202[4-9]/)) {
          dateDisplay = paymentData.timestampStr;
        } else {
          dateDisplay = `${today} (${paymentData.timestampStr})`;
        }
      }

      const typeLabel = isWorkerPayment ? 'Worker Advance / Kharcha' : 'Vendor / Material Expense';

      if (finalAmount > 0) {
        await WhatsAppService.sendMessage(
          normalizedSender,
          `✅ *Payment Recorded in Ledger!*\n\n` +
          `👤 *Paid To:* ${finalPaidTo}\n` +
          `💵 *Amount:* ₹${finalAmount.toFixed(2)}\n` +
          `📒 *Khata Category:* ${typeLabel}\n` +
          `💳 *Method / App:* ${paymentData.paymentMethod.toUpperCase()}\n` +
          `📱 *UPI / Ref:* ${paymentData.upiId || 'Direct UPI'}\n` +
          `📅 *Date:* ${dateDisplay}\n\n` +
          `Ledger & Khata balance have been successfully updated! 📊`
        );
      } else {
        await WhatsAppService.sendMessage(
          normalizedSender,
          `📸 *Payment Screenshot Saved in Ledger!*\n\n` +
          `👤 *Paid To:* ${finalPaidTo}\n` +
          `📅 *Date:* ${today}\n\n` +
          `Aapka receipt save ho gaya hai aur Khata / Payments page par live dikh raha hai! 📊`
        );
      }

      return {
        status: 'completed',
        reason: `Payment receipt recorded for ${finalPaidTo}: ₹${finalAmount}`,
        messageId: rawMessageId,
      };
    } catch (err: any) {
      console.error('[WebhookProcessor] Critical processing error:', err);
      return { status: 'failed', reason: err?.message || 'Internal processing error' };
    }
  }
}
