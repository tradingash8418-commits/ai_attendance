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
      // e.g. User sent PDF receipt first, and immediately typed 'abc, w' or multi-worker split like 'pintu: 2000 durgesh: 3000'
      // =====================================================================
      if (messageType === 'text') {
        const splitItems = parseBatchWorkerSplitCaption(textBody);

        // Subcase 1B-1: Multi-Worker Batch Advance Split on Recent Receipt
        if (splitItems.length > 0) {
          const todayPayments = await PaymentLedgerService.getPayments({ date: today });
          const recentPayment = todayPayments.find((p) => {
            return p.recordedBy?.includes(normalizedSender) || p.recordedBy?.includes('WhatsApp');
          });

          if (recentPayment) {
            const allWorkers = await WorkersService.getWorkers();
            const ocrBeneficiary =
              recentPayment.paidTo && !recentPayment.paidTo.startsWith('Worker')
                ? recentPayment.paidTo
                : '';
            const receiptPhotoUrl = recentPayment.receiptPhotoUrl || '';
            const origAmount = recentPayment.amount;

            // 1. Update the original payment record with the 1st worker's advance
            const firstItem = splitItems[0];
            const firstMatch = findBestWorkerMatch(allWorkers, firstItem.workerName);
            const firstWorkerName = firstMatch ? getWorkerDisplayName(firstMatch) : firstItem.workerName;
            const firstWorkerId = firstMatch ? firstMatch.id : '';
            const firstPaidTo = ocrBeneficiary || firstWorkerName;

            await PaymentLedgerService.updatePaymentCategory(recentPayment.id, {
              category: 'advance',
              workerId: firstWorkerId,
              workerName: firstWorkerName,
              workerCode: firstMatch?.workerCode || '',
              paidTo: firstPaidTo,
              amount: firstItem.amount,
              notes: `Split Advance (Receipt Total: ₹${origAmount}) | ${textBody}${ocrBeneficiary ? ` | A/C: ${ocrBeneficiary}` : ''}`,
            });

            // 2. Insert new payment records for remaining workers (2nd, 3rd, etc.)
            for (let i = 1; i < splitItems.length; i++) {
              const item = splitItems[i];
              const match = findBestWorkerMatch(allWorkers, item.workerName);
              const wName = match ? getWorkerDisplayName(match) : item.workerName;
              const wId = match ? match.id : '';
              const paidTo = ocrBeneficiary || wName;

              await PaymentLedgerService.recordPayment({
                paidTo: paidTo,
                workerId: wId,
                workerName: wName,
                workerCode: match?.workerCode || undefined,
                workerPhone: match?.phone || undefined,
                amount: item.amount,
                category: 'advance',
                paymentMethod: recentPayment.paymentMethod || 'gpay',
                upiId: recentPayment.upiId || '',
                paymentDate: recentPayment.paymentDate || today,
                paymentTime: recentPayment.paymentTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                receiptPhotoUrl: receiptPhotoUrl,
                notes: `Split Advance (Receipt Total: ₹${origAmount}) | ${textBody}${ocrBeneficiary ? ` | A/C: ${ocrBeneficiary}` : ''}`,
                recordedBy: `WhatsApp AI OCR (${normalizedSender})`,
                rawOcrText: recentPayment.rawOcrText || '',
              });
            }

            await WhatsAppService.updateMessageStatus(savedMsgId, 'processed');

            let confirmationMsg =
              `🔄 *Recent Payment Split & Recorded in Worker Khata!* 👥\n\n`;

            if (ocrBeneficiary) {
              confirmationMsg += `🏦 *A/C Beneficiary:* ${ocrBeneficiary}\n`;
            }

            confirmationMsg +=
              `🧾 *Original Receipt Total:* ₹${origAmount.toFixed(2)}\n` +
              `📒 *Khata Category:* Worker Advance / Kharcha (Strictly Worker)\n\n` +
              `*Distributed Advances:*\n`;

            let splitTotal = 0;
            for (const item of splitItems) {
              const wMatch = findBestWorkerMatch(allWorkers, item.workerName);
              const wName = wMatch ? getWorkerDisplayName(wMatch) : item.workerName;
              confirmationMsg += `▫️ *${wName}:* ₹${item.amount.toLocaleString('en-IN')}\n`;
              splitTotal += item.amount;
            }

            confirmationMsg +=
              `\n💰 *Total Distributed:* ₹${splitTotal.toLocaleString('en-IN')}\n` +
              `📅 *Date:* ${recentPayment.paymentDate}\n\n` +
              `Sabhi workers ke individual khate mein advance update ho gaya hai! 📊`;

            await WhatsAppService.sendMessage(normalizedSender, confirmationMsg);

            return {
              status: 'completed',
              reason: `Split recent payment ${recentPayment.id} into ${splitItems.length} worker advances`,
              messageId: rawMessageId,
            };
          }
        }

        // Subcase 1B-2: Single Caption / Remark on Recent Receipt
        const captionInfo = parsePaymentCaption(textBody);
        if (captionInfo.explicitCategory || captionInfo.workerOrPayeeRemark) {
          const todayPayments = await PaymentLedgerService.getPayments({ date: today });
          // Find latest payment from WhatsApp today
          const recentPayment = todayPayments.find((p) => {
            return p.recordedBy?.includes(normalizedSender) || p.recordedBy?.includes('WhatsApp');
          });

          if (recentPayment) {
            const allWorkers = await WorkersService.getWorkers();
            const matchedWorker = captionInfo.workerOrPayeeRemark
              ? findBestWorkerMatch(allWorkers, captionInfo.workerOrPayeeRemark)
              : undefined;

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

      const allWorkers = await WorkersService.getWorkers();
      const finalAmount = paymentData.amount || 0;
      const ocrBeneficiary = paymentData.receiverName || '';

      // Check if caption contains multi-worker split instructions (e.g. 'pintu: 2000' 'durgesh: 3000' 'mubarak: 6000')
      const batchSplitItems = parseBatchWorkerSplitCaption(textBody || '');

      if (batchSplitItems.length > 0) {
        console.log(`[WebhookProcessor] Multi-worker batch split detected in caption:`, batchSplitItems);

        // Record each worker's split advance individually in Firestore
        for (const item of batchSplitItems) {
          const matchedWorker = findBestWorkerMatch(allWorkers, item.workerName);
          const resolvedWorkerName = matchedWorker ? getWorkerDisplayName(matchedWorker) : item.workerName;
          const resolvedWorkerId = matchedWorker ? matchedWorker.id : '';
          const finalPaidTo = ocrBeneficiary || resolvedWorkerName;

          const splitNotes = `Split Advance (Receipt Total: ₹${finalAmount})${ocrBeneficiary ? ` | A/C: ${ocrBeneficiary}` : ''}${textBody ? ` | Caption: ${textBody}` : ''}`;

          await PaymentLedgerService.recordPayment({
            paidTo: finalPaidTo,
            workerId: resolvedWorkerId,
            workerName: resolvedWorkerName,
            workerCode: matchedWorker?.workerCode || undefined,
            workerPhone: matchedWorker?.phone || undefined,
            amount: item.amount,
            category: 'advance',
            paymentMethod: paymentData.paymentMethod || 'gpay',
            upiId: paymentData.upiId || '',
            paymentDate: today,
            paymentTime: paymentData.timestampStr || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            receiptPhotoUrl: photoUrl,
            notes: splitNotes,
            recordedBy: `WhatsApp AI OCR (${normalizedSender})`,
            rawOcrText: paymentData.rawText,
          });
        }

        await WhatsAppService.updateMessageStatus(savedMsgId, 'processed');

        // Send itemized WhatsApp confirmation for multi-worker split
        let dateDisplay = today;
        if (paymentData.timestampStr) {
          if (paymentData.timestampStr.match(/202[4-9]/)) {
            dateDisplay = paymentData.timestampStr;
          } else {
            dateDisplay = `${today} (${paymentData.timestampStr})`;
          }
        }

        let confirmationMsg =
          `✅ *Multi-Worker Split Payment Recorded!* 👥\n\n`;

        if (ocrBeneficiary) {
          confirmationMsg += `🏦 *A/C Beneficiary:* ${ocrBeneficiary}\n`;
        }

        if (finalAmount > 0) {
          confirmationMsg += `🧾 *Receipt Total:* ₹${finalAmount.toFixed(2)}\n`;
        }

        confirmationMsg +=
          `📒 *Khata Category:* Worker Advance / Kharcha (Strictly Worker)\n\n` +
          `*Distributed Advances:*\n`;

        let splitTotal = 0;
        for (const item of batchSplitItems) {
          const wMatch = findBestWorkerMatch(allWorkers, item.workerName);
          const wName = wMatch ? getWorkerDisplayName(wMatch) : item.workerName;
          confirmationMsg += `▫️ *${wName}:* ₹${item.amount.toLocaleString('en-IN')}\n`;
          splitTotal += item.amount;
        }

        confirmationMsg +=
          `\n💰 *Total Distributed:* ₹${splitTotal.toLocaleString('en-IN')}\n` +
          `💳 *Method / App:* ${paymentData.paymentMethod.toUpperCase()}\n` +
          `📱 *UPI / Ref:* ${paymentData.upiId || 'Direct UPI'}\n` +
          `📅 *Date:* ${dateDisplay}\n\n` +
          `Sabhi workers ke individual khate mein advance credit/record ho chuka hai! 📊`;

        await WhatsAppService.sendMessage(normalizedSender, confirmationMsg);

        return {
          status: 'completed',
          reason: `Split receipt into ${batchSplitItems.length} worker advances totaling ₹${splitTotal}`,
          messageId: rawMessageId,
        };
      }

      // 1. Standard Single Caption Parsing: Extracts category ('v' / 'w') and custom worker/payee remark (e.g. 'abc, w', 'abc, v', 'abc w')
      const { explicitCategory, workerOrPayeeRemark } = parsePaymentCaption(textBody || '');

      // Check if recipient matches an EXISTING registered worker in Firestore using Strict Tiered Matching
      let matchedWorker: any = undefined;

      // Priority A: Match by explicit caption remark (e.g. 'mubarak, w' -> exactly matches 'mubarak')
      if (workerOrPayeeRemark) {
        matchedWorker = findBestWorkerMatch(allWorkers, workerOrPayeeRemark);
      }
      // Priority B: Match by AI OCR Beneficiary Name / UPI
      if (!matchedWorker && paymentData.receiverName) {
        matchedWorker = findBestWorkerMatch(allWorkers, paymentData.receiverName, paymentData.upiId);
      }

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

/**
 * Strict Tiered Worker Matcher:
 * Ensures exact names (e.g. 'mubarak') ALWAYS match 'mubarak' and NEVER 'mubarakaaa'.
 * Tier 1: Exact Name Match ('mubarak' === 'mubarak')
 * Tier 2: Exact Worker Code Match ('WRK-001' === 'WRK-001')
 * Tier 3: Word Boundary Token Match ('mubarak' in 'mubarak khan')
 * Tier 4: UPI ID Phone Number Match (phone ending matches UPI handle)
 */
export function findBestWorkerMatch(
  allWorkers: any[],
  targetName: string,
  targetUpiId?: string
): any | undefined {
  if (!targetName && !targetUpiId) return undefined;

  const rawClean = (targetName || '').trim().toLowerCase();

  // Tier 1: EXACT Full Name Match (Case-Insensitive)
  // E.g. "mubarak" === "mubarak". Prevents collision with "mubarakaaa".
  if (rawClean) {
    const exactMatch = allWorkers.find(
      (w) => (w.name || '').trim().toLowerCase() === rawClean
    );
    if (exactMatch) return exactMatch;
  }

  // Tier 2: EXACT Worker Code Match (e.g. "WRK-001" or "0692")
  if (rawClean) {
    const codeMatch = allWorkers.find(
      (w) => w.workerCode && w.workerCode.trim().toLowerCase() === rawClean
    );
    if (codeMatch) return codeMatch;
  }

  // Tier 3: EXACT Word Boundary Token Match (e.g. "mubarak" in "mubarak khan" or "md mubarak")
  // "mubarak" matches "mubarak khan", but DOES NOT match "mubarakaaa" because "mubarakaaa" has no word break.
  if (rawClean) {
    const wordMatch = allWorkers.find((w) => {
      const words = (w.name || '').trim().toLowerCase().split(/[\s,._-]+/);
      return words.includes(rawClean);
    });
    if (wordMatch) return wordMatch;
  }

  // Tier 4: UPI ID Phone Number Match (e.g. UPI is 9876543210@upi and worker phone is +919876543210)
  if (targetUpiId) {
    const cleanUpi = targetUpiId.toLowerCase();
    const phoneMatch = allWorkers.find((w) => {
      if (!w.phone) return false;
      const cleanPhone = w.phone.replace(/\D/g, '');
      return cleanPhone.length >= 10 && cleanUpi.includes(cleanPhone.slice(-10));
    });
    if (phoneMatch) return phoneMatch;
  }

  return undefined;
}

export interface WorkerSplitItem {
  workerName: string;
  amount: number;
}

/**
 * Parses multi-worker advance split captions like:
 * - 'pintu: 2000' 'durgesh: 3000' 'mubarak: 6000'
 * - pintu: 2000, durgesh: 3000, mubarak: 6000
 * - pintu: 2000 durgesh: 3000 mubarak: 6000
 * - pintu = 2000, durgesh = 3000
 * - pintu - ₹2000, durgesh - ₹3000
 * Strictly assigns each amount to the respective worker's Advance Khata.
 */
export function parseBatchWorkerSplitCaption(rawText: string): WorkerSplitItem[] {
  if (!rawText || !rawText.trim()) return [];
  const text = rawText.trim();

  // Primary Regex: matches name followed by : or = or - and a numeric amount
  // Allows optional surrounding quotes e.g. 'pintu: 2000' or "pintu": 2000 or pintu: 2000
  const splitRegex = /(?:['"‘“])?([a-zA-Z\s._]+?)(?:['"’”])?\s*[:=-]\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)(?:\/-)?(?:['"’”])?/gi;

  const results: WorkerSplitItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = splitRegex.exec(text)) !== null) {
    const rawName = match[1].trim().replace(/^['"‘“]+|['"’”]+$/g, '').trim();
    const rawAmt = match[2].replace(/,/g, '').trim();
    const amount = parseFloat(rawAmt);

    // Ensure valid name (not empty, not pure numbers) and positive amount
    if (rawName.length > 0 && !isNaN(amount) && amount > 0) {
      results.push({
        workerName: rawName,
        amount: amount,
      });
    }
  }

  // Fallback: If no colon/equal/dash was used, test space-separated name + number
  // e.g. "'pintu 2000' 'durgesh 3000'" or "pintu 2000, durgesh 3000"
  if (results.length === 0) {
    const spaceRegex = /(?:['"‘“])?([a-zA-Z\s._]+?)\s+(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)(?:\/-)?(?:['"’”])?(?:,|$|\n)/gi;
    while ((match = spaceRegex.exec(text)) !== null) {
      const rawName = match[1].trim().replace(/^['"‘“]+|['"’”]+$/g, '').trim();
      const rawAmt = match[2].replace(/,/g, '').trim();
      const amount = parseFloat(rawAmt);

      const reservedKeywords = ['checkin', 'vendor', 'advance', 'worker', 'total'];
      if (rawName.length > 0 && !isNaN(amount) && amount > 0 && !reservedKeywords.includes(rawName.toLowerCase())) {
        results.push({
          workerName: rawName,
          amount: amount,
        });
      }
    }
  }

  return results;
}

