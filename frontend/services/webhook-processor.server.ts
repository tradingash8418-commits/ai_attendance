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
      const documentCaption = messageObj.document?.caption || '';
      const textBody = (
        messageObj.text?.body ||
        messageObj.image?.caption ||
        documentCaption
      ).trim();

      // Extract authoritative WhatsApp message timestamp (in milliseconds)
      const rawTimestampSeconds = messageObj.timestamp ? parseInt(messageObj.timestamp, 10) : 0;
      const messageTimestampMs = rawTimestampSeconds > 0 ? rawTimestampSeconds * 1000 : Date.now();
      const today = getTodayDateString();

      console.log(
        `[WebhookProcessor] Incoming message ID: ${rawMessageId}, Sender: ${normalizedSender}, ` +
        `Type: ${messageType}, Timestamp: ${new Date(messageTimestampMs).toISOString()}`
      );

      // 1. WhatsApp Network Retry Deduplication:
      // Meta WhatsApp Cloud API retries webhook delivery up to 6 times if processing takes >3 seconds.
      // Checking rawMessageId ensures that ONE WhatsApp message is processed and recorded EXACTLY ONCE,
      // while allowing different/new payment messages to be processed freely without blocking.
      const isAlreadyProcessed = await WhatsAppService.isMessageProcessed(rawMessageId);
      if (isAlreadyProcessed) {
        console.log(`[WebhookProcessor] Meta webhook retry acknowledged for message ID: ${rawMessageId}`);
        return { status: 'completed', reason: 'Meta retry duplicate acknowledged', messageId: rawMessageId };
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

      // =====================================================================
      // PATH 1B: FOLLOW-UP CAPTION / REMARK FOR RECENT PDF / IMAGE RECEIPT
      // e.g. User sent PDF receipt first, and immediately typed 'abc, w' or 'abc, v' or 'w' as a text message
      // =====================================================================
      if (messageType === 'text') {
        const captionInfo = parsePaymentCaption(textBody);
        if (captionInfo.explicitCategory || captionInfo.workerOrPayeeRemark) {
          const todayPayments = await PaymentLedgerService.getPayments({ date: today });
          // Find latest payment from WhatsApp today
          const recentPayment = todayPayments.find((p) => {
            return p.recordedBy?.includes(normalizedSender) || p.recordedBy?.includes('WhatsApp');
          });

          if (recentPayment) {
            const allWorkers = await WorkersService.getWorkers();
            let matchedWorker = allWorkers.find((w) => {
              if (captionInfo.workerOrPayeeRemark) {
                const rLower = captionInfo.workerOrPayeeRemark.toLowerCase();
                const nLower = w.name.toLowerCase();
                if (nLower === rLower || nLower.includes(rLower) || rLower.includes(nLower)) return true;
              }
              return false;
            });

            let paymentCategory: 'vendor' | 'advance' =
              captionInfo.explicitCategory ||
              (matchedWorker ? 'advance' : (recentPayment.category === 'advance' ? 'advance' : 'vendor'));
            const isWorkerPayment = paymentCategory === 'advance';
            const ocrBeneficiary =
              recentPayment.paidTo && !recentPayment.paidTo.startsWith('Worker')
                ? recentPayment.paidTo
                : '';

            let finalPaidTo = '';
            let resolvedWorkerId = '';
            let resolvedWorkerName = '';

            if (isWorkerPayment) {
              resolvedWorkerName = matchedWorker
                ? getWorkerDisplayName(matchedWorker)
                : (captionInfo.workerOrPayeeRemark || recentPayment.workerName || 'Worker / Karigar');
              resolvedWorkerId = matchedWorker ? matchedWorker.id : '';
              finalPaidTo = ocrBeneficiary || resolvedWorkerName;
            } else {
              finalPaidTo =
                captionInfo.workerOrPayeeRemark || ocrBeneficiary || recentPayment.paidTo || 'Vendor / Payee';
              resolvedWorkerId = '';
              resolvedWorkerName = '';
            }

            let structuredNotes = captionInfo.workerOrPayeeRemark
              ? `Remark: ${captionInfo.workerOrPayeeRemark}${ocrBeneficiary ? ` | A/C: ${ocrBeneficiary}` : ''}`
              : (ocrBeneficiary ? `A/C: ${ocrBeneficiary}` : '');

            await PaymentLedgerService.updatePaymentCategory(recentPayment.id, {
              category: paymentCategory,
              workerId: resolvedWorkerId,
              workerName: resolvedWorkerName,
              workerCode: (isWorkerPayment && matchedWorker) ? matchedWorker?.workerCode : '',
              paidTo: finalPaidTo,
            });

            await WhatsAppService.updateMessageStatus(savedMsgId, 'processed');

            const typeLabel = isWorkerPayment ? 'Worker Advance / Kharcha' : 'Vendor / Material Expense';
            const displayName = isWorkerPayment ? resolvedWorkerName : finalPaidTo;

            let confirmationMsg =
              `🔄 *Recent Payment Updated in Ledger!*\n\n` +
              `👤 *${isWorkerPayment ? 'Worker / Karigar' : 'Vendor / Payee'}:* ${displayName}\n`;

            if (ocrBeneficiary && ocrBeneficiary.toLowerCase() !== displayName.toLowerCase()) {
              confirmationMsg += `🏦 *A/C Beneficiary:* ${ocrBeneficiary}\n`;
            }

            confirmationMsg +=
              `💵 *Amount:* ₹${recentPayment.amount.toFixed(2)}\n` +
              `📒 *Khata Category:* ${typeLabel}\n` +
              `📅 *Date:* ${recentPayment.paymentDate}\n\n` +
              `Ledger & Khata have been updated with your remark! 📊`;

            await WhatsAppService.sendMessage(normalizedSender, confirmationMsg);

            return {
              status: 'completed',
              reason: `Updated recent payment ${recentPayment.id} with remark: ${textBody}`,
              messageId: rawMessageId,
            };
          }
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

      // 1. Smart Caption Parsing: Extracts category ('v' / 'w') and custom worker/payee remark (e.g. 'abc, w', 'abc, v', 'abc w')
      const { explicitCategory, workerOrPayeeRemark } = parsePaymentCaption(textBody || '');

      // Check if recipient matches an EXISTING registered worker in Firestore (by OCR name, phone, or caption remark)
      const allWorkers = await WorkersService.getWorkers();
      let matchedWorker = allWorkers.find((w) => {
        if (workerOrPayeeRemark) {
          const remarkLower = workerOrPayeeRemark.toLowerCase();
          const nameLower = w.name.toLowerCase();
          if (nameLower === remarkLower || nameLower.includes(remarkLower) || remarkLower.includes(nameLower)) {
            return true;
          }
        }
        const targetName = (paymentData.receiverName || '').toLowerCase();
        if (targetName) {
          const nameLower = w.name.toLowerCase();
          if (nameLower === targetName || nameLower.includes(targetName) || targetName.includes(nameLower)) {
            return true;
          }
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
      const ocrBeneficiary = paymentData.receiverName || '';

      let finalPaidTo = '';
      let resolvedWorkerId = '';
      let resolvedWorkerName = '';

      if (isWorkerPayment) {
        resolvedWorkerName = matchedWorker
          ? getWorkerDisplayName(matchedWorker)
          : (workerOrPayeeRemark || ocrBeneficiary || 'Worker / Karigar');
        resolvedWorkerId = matchedWorker ? matchedWorker.id : '';
        finalPaidTo = ocrBeneficiary || resolvedWorkerName;
      } else {
        finalPaidTo = workerOrPayeeRemark || ocrBeneficiary || 'Vendor / Payee';
        resolvedWorkerId = '';
        resolvedWorkerName = '';
      }

      // Build structured notes for Remarks & Beneficiary account tracking
      let structuredNotes: string | undefined = undefined;
      if (workerOrPayeeRemark) {
        structuredNotes = `Remark: ${workerOrPayeeRemark}${ocrBeneficiary ? ` | A/C: ${ocrBeneficiary}` : ''}`;
      } else if (ocrBeneficiary) {
        structuredNotes = `A/C: ${ocrBeneficiary}`;
      }
      if (textBody && (!structuredNotes || !structuredNotes.includes(textBody))) {
        structuredNotes = structuredNotes ? `${structuredNotes} (Caption: ${textBody})` : `Caption: ${textBody}`;
      }

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
        notes: structuredNotes,
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
      const displayName = isWorkerPayment ? resolvedWorkerName : finalPaidTo;

      if (finalAmount > 0) {
        let confirmationMsg =
          `✅ *Payment Recorded in Ledger!*\n\n` +
          `👤 *${isWorkerPayment ? 'Worker / Karigar' : 'Vendor / Payee'}:* ${displayName}\n`;
        
        if (ocrBeneficiary && ocrBeneficiary.toLowerCase() !== displayName.toLowerCase()) {
          confirmationMsg += `🏦 *A/C Beneficiary:* ${ocrBeneficiary}\n`;
        }

        confirmationMsg +=
          `💵 *Amount:* ₹${finalAmount.toFixed(2)}\n` +
          `📒 *Khata Category:* ${typeLabel}\n` +
          `💳 *Method / App:* ${paymentData.paymentMethod.toUpperCase()}\n` +
          `📱 *UPI / Ref:* ${paymentData.upiId || 'Direct UPI'}\n` +
          `📅 *Date:* ${dateDisplay}\n\n` +
          `Ledger & Khata balance have been successfully updated! 📊`;

        await WhatsAppService.sendMessage(normalizedSender, confirmationMsg);
      } else {
        await WhatsAppService.sendMessage(
          normalizedSender,
          `📸 *Payment Screenshot Saved in Ledger!*\n\n` +
          `👤 *Paid To:* ${displayName}\n` +
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

/**
 * Smart Caption Parser: Extracts user category ('v' / 'w') and custom worker/payee remark (e.g. 'abc, w', 'abc, v', 'abc w')
 */
export function parsePaymentCaption(rawText: string): {
  explicitCategory: 'vendor' | 'advance' | null;
  workerOrPayeeRemark: string | null;
} {
  if (!rawText || !rawText.trim()) {
    return { explicitCategory: null, workerOrPayeeRemark: null };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

  const vendorKeywords = ['v', 'vendor', 'm', 'material', 'supplier', 'thekedar', 'dukaan', 'shop', 'expense'];
  const workerKeywords = ['w', 'worker', 'a', 'advance', 'l', 'labour', 'k', 'karigar', 'kharcha', 'wage', 'majdoor'];

  // 1. Standalone single keyword
  if (vendorKeywords.includes(lower)) {
    return { explicitCategory: 'vendor', workerOrPayeeRemark: null };
  }
  if (workerKeywords.includes(lower)) {
    return { explicitCategory: 'advance', workerOrPayeeRemark: null };
  }

  // 2. Delimiter separated: e.g. "abc, w", "abc - v", "amit: w", "abc / worker"
  const delimiterMatch = text.match(/^(.+?)\s*[,:\-\/|]\s*([a-zA-Z]+)$/);
  if (delimiterMatch) {
    const remarkPart = delimiterMatch[1].trim();
    const tagPart = delimiterMatch[2].toLowerCase().trim();

    if (vendorKeywords.includes(tagPart)) {
      return { explicitCategory: 'vendor', workerOrPayeeRemark: remarkPart };
    }
    if (workerKeywords.includes(tagPart)) {
      return { explicitCategory: 'advance', workerOrPayeeRemark: remarkPart };
    }
  }

  // 3. Trailing space separated: e.g. "abc w", "abc v", "amit advance"
  const trailingMatch = text.match(/^(.+?)\s+([a-zA-Z]+)$/);
  if (trailingMatch) {
    const remarkPart = trailingMatch[1].trim();
    const tagPart = trailingMatch[2].toLowerCase().trim();

    if (vendorKeywords.includes(tagPart)) {
      return { explicitCategory: 'vendor', workerOrPayeeRemark: remarkPart };
    }
    if (workerKeywords.includes(tagPart)) {
      return { explicitCategory: 'advance', workerOrPayeeRemark: remarkPart };
    }
  }

  // 4. Leading tag separated: e.g. "w abc", "v abc", "vendor sri cements"
  const leadingMatch = text.match(/^([a-zA-Z]+)\s+[,:\-\/|]?\s*(.+)$/);
  if (leadingMatch) {
    const tagPart = leadingMatch[1].toLowerCase().trim();
    const remarkPart = leadingMatch[2].trim();

    if (vendorKeywords.includes(tagPart)) {
      return { explicitCategory: 'vendor', workerOrPayeeRemark: remarkPart };
    }
    if (workerKeywords.includes(tagPart)) {
      return { explicitCategory: 'advance', workerOrPayeeRemark: remarkPart };
    }
  }

  // 5. Custom name without explicit tag
  return { explicitCategory: null, workerOrPayeeRemark: text };
}
