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
import { SupervisorsService } from './supervisors.service';
import { OrgContextService } from './org-context.service';
import { getTodayDateString, normalizeWhatsAppNumber, getWorkerDisplayName } from '@/lib/formatters';
import type { PaymentCategory, PaymentMethod } from '@/types/payment';

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

      // Resolve multi-tenant Organization context by supervisor's WhatsApp number (fallback to org_primary)
      const supervisor = await SupervisorsService.getSupervisorByWhatsAppNumber(normalizedSender);
      const resolvedOrgId = (supervisor as any)?.organizationId || (supervisor as any)?.orgId || OrgContextService.getOrgId();

      console.log(
        `[WebhookProcessor] Incoming message ID: ${rawMessageId}, Sender: ${normalizedSender}, ` +
        `Type: ${messageType}, OrgId: ${resolvedOrgId}, Timestamp: ${new Date(messageTimestampMs).toISOString()}`
      );

      // 1. WhatsApp Network Retry Deduplication:
      // Meta WhatsApp Cloud API retries webhook delivery up to 6 times if processing takes >3 seconds.
      // Checking rawMessageId ensures that ONE WhatsApp message is processed and recorded EXACTLY ONCE,
      // while allowing different/new payment messages to be processed freely without blocking.
      const isAlreadyProcessed = await WhatsAppService.isMessageProcessed(rawMessageId, resolvedOrgId);
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
      }, resolvedOrgId);

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
          rawMessageId,
          resolvedOrgId
        );

        if (session) {
          // Resolve the true contractor organizationId from the pending checkin session
          const trueOrgId = session.organizationId || resolvedOrgId;

          const site = await SitesService.getSiteById(session.siteId, trueOrgId);
          const siteName = site ? site.name : 'Construction Site';

          // 1. Resolve or auto-register worker by phone number under trueOrgId
          const targetWorker = await WorkersService.getOrCreateWorkerByPhone(normalizedSender, trueOrgId);

          // 2. Create Attendance Session under trueOrgId
          const sessionId = await AttendanceSessionsService.createAttendanceSession({
            date: today,
            siteId: session.siteId,
            supervisorId: 'worker_qr_whatsapp',
            whatsappSenderNumber: normalizedSender,
            whatsappMessageId: rawMessageId,
          }, trueOrgId);

          // 3. Record attendance immediately (Zero selfie required!) under trueOrgId
          await AttendanceService.recordWorkerAttendance({
            attendanceSessionId: sessionId,
            workerId: targetWorker.id,
            siteId: session.siteId,
            date: today,
            messageTimestamp: messageTimestampMs,
            attendancePhotoUrl: '',
            submittedBy: `Worker QR WhatsApp (${normalizedSender})`,
            method: 'worker_qr_whatsapp',
          }, trueOrgId);

          // 4. Mark pending checkin as used
          await PendingCheckinService.markPendingCheckinUsed(session.id, trueOrgId);
          await AttendanceSessionsService.updateSessionStatus(sessionId, 'completed', trueOrgId);
          await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', sessionId, resolvedOrgId);

          // 5. Send instant, complete attendance report back to the worker under trueOrgId
          await WhatsAppFeedbackServer.sendAttendanceFeedbackReport({
            supervisorWhatsAppNumber: normalizedSender,
            siteId: session.siteId,
            siteName: siteName,
            date: today,
            orgId: trueOrgId,
            recognizedWorkerIds: [targetWorker.id],
            unknownFaceCount: 0,
          });

          return {
            status: 'completed',
            reason: `1-Tap QR attendance recorded for ${targetWorker.name} at ${siteName} (${trueOrgId})`,
            messageId: rawMessageId,
            sessionId,
          };
        } else {
          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ *Check-in Expired or Invalid*\n\n` +
            `Your site QR check-in session has expired or is invalid. Please scan the QR code at the site gate again.`
          );

          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', undefined, resolvedOrgId);
          return { status: 'failed', reason: 'Invalid or expired checkin token', messageId: rawMessageId };
        }
      }

      // =====================================================================
      // SECURITY & AUTHORIZATION GUARD FOR PAYMENTS / LEDGER EXPENDITURES
      // Registered Contractor / Supervisor Verification:
      // Worker 1-Tap QR Attendance scan is open for all workers/phones.
      // Payment receipts (OCR), payment captions/splits, and direct text cash/expense
      // entries MUST strictly come from a registered Contractor / Supervisor phone number.
      // =====================================================================
      if (!supervisor) {
        console.warn(`[WebhookProcessor] Unauthorized payment attempt from non-registered sender: ${normalizedSender}`);

        await WhatsAppService.sendMessage(
          normalizedSender,
          `🚫 *Unauthorized User / Access Denied*\n\n` +
          `Aapka mobile number (*${normalizedSender}*) system mein registered contractor ya supervisor account se linked nahi hai.\n\n` +
          `⚠️ *Payment receipts, direct cash entries, and Khata updates require a registered account.* Kripya signed-up contractor mobile number se message bhejein.\n\n` +
          `*(Note: QR Attendance scan sabhi users ke liye open hai)*`
        );

        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', undefined, resolvedOrgId);

        return {
          status: 'unauthorized',
          reason: `Sender ${normalizedSender} is not a registered contractor/supervisor`,
          messageId: rawMessageId,
        };
      }

      // =====================================================================
      // PATH 1B: FOLLOW-UP CAPTION / REMARK FOR RECENT PDF / IMAGE RECEIPT
      // e.g. User sent PDF receipt first, and immediately typed 'abc, w' or multi-worker split like 'pintu: 2000 durgesh: 3000'
      // =====================================================================
      if (messageType === 'text') {
        const textLower = textBody.toLowerCase();
        const hasExplicitCash = textLower.includes('cash');

        // Helper: Find a payment receipt uploaded via WhatsApp within the LAST 3 MINUTES ONLY
        const getRecentReceiptPayment = async () => {
          if (hasExplicitCash) return undefined; // Explicit 'cash' keyword ALWAYS overrides and skips previous screenshots!

          const THREE_MINUTES_MS = 3 * 60 * 1000;
          const todayPayments = await PaymentLedgerService.getPayments({ date: today }, resolvedOrgId);

          return todayPayments.find((p) => {
            const isFromSender = p.recordedBy?.includes(normalizedSender) || p.recordedBy?.includes('WhatsApp');
            if (!isFromSender) return false;

            let recordTimeMs = 0;
            if (p.createdAt && typeof (p.createdAt as any).toMillis === 'function') {
              recordTimeMs = (p.createdAt as any).toMillis();
            } else if (p.createdAt && typeof (p.createdAt as any).seconds === 'number') {
              recordTimeMs = (p.createdAt as any).seconds * 1000;
            }

            // Only attach if receipt screenshot was uploaded within 3 minutes of this message
            return recordTimeMs > 0 ? (messageTimestampMs - recordTimeMs) <= THREE_MINUTES_MS : false;
          });
        };

        const splitItems = parseBatchWorkerSplitCaption(textBody);

        // Subcase 1B-1: Multi-Worker Batch Advance Split on Recent Receipt (within 3 mins)
        if (splitItems.length > 0) {
          const recentPayment = await getRecentReceiptPayment();

          if (recentPayment) {
            const allWorkers = await WorkersService.getWorkers(resolvedOrgId);
            const ocrBeneficiary =
              recentPayment.paidTo && !recentPayment.paidTo.startsWith('Worker')
                ? recentPayment.paidTo
                : '';
            const receiptPhotoUrl = recentPayment.receiptPhotoUrl || '';
            const origAmount = recentPayment.amount;

            // 1. Update the original payment record with the 1st worker's advance
            const firstItem = splitItems[0]!;
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
            }, resolvedOrgId);

            // 2. Insert new payment records for remaining workers (2nd, 3rd, etc.)
            for (let i = 1; i < splitItems.length; i++) {
              const item = splitItems[i]!;
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
              }, resolvedOrgId);
            }

            await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', undefined, resolvedOrgId);

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

        // Subcase 1B-2: Single Caption / Remark on Recent Receipt (within 3 mins)
        const captionInfo = parsePaymentCaption(textBody);
        if (captionInfo.explicitCategory || captionInfo.workerOrPayeeRemark) {
          const recentPayment = await getRecentReceiptPayment();

          if (recentPayment) {
            const allWorkers = await WorkersService.getWorkers(resolvedOrgId);
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
              notes: structuredNotes,
            }, resolvedOrgId);

            await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', undefined, resolvedOrgId);

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

        // Subcase 1B-3: Direct Text Cash / Expense Payment Registration (No Screenshot or > 3 mins or explicit cash)
        // e.g. "pintu prajapati: 500 cash", "rohit yadav: 300 cash w", "suresh hardware: 6000 cash m"
        const directPayment = parseDirectTextPayment(textBody);
        if (directPayment) {
          console.log(`[WebhookProcessor] Direct text payment entry detected:`, directPayment);

          const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

          if (directPayment.isWorkerTarget) {
            const allWorkers = await WorkersService.getWorkers(resolvedOrgId);
            const matchedWorker = findBestWorkerMatch(allWorkers, directPayment.payeeOrWorkerName);

            const workerName = matchedWorker ? getWorkerDisplayName(matchedWorker) : directPayment.payeeOrWorkerName;
            const workerId = matchedWorker ? matchedWorker.id : '';
            const workerCode = matchedWorker?.workerCode || '';

            const paymentRecordId = await PaymentLedgerService.recordPayment({
              paidTo: workerName,
              workerId: workerId,
              workerName: workerName,
              workerCode: workerCode || undefined,
              workerPhone: matchedWorker?.phone || undefined,
              amount: directPayment.amount,
              category: directPayment.ledgerCategory,
              paymentMethod: directPayment.paymentMethod, // 'cash' or specified
              paymentDate: today,
              paymentTime: currentTime,
              receiptPhotoUrl: '',
              notes: `Direct Cash Entry | ${textBody}`,
              recordedBy: `WhatsApp Direct Cash (${normalizedSender})`,
            }, resolvedOrgId);

            await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', undefined, resolvedOrgId);

            const confirmationMsg =
              `💵 *Direct Cash Advance Registered!* 👷‍♂️\n\n` +
              `👤 *Worker Name:* ${workerName}\n` +
              `💰 *Advance Amount:* ₹${directPayment.amount.toLocaleString('en-IN')}\n` +
              `💳 *Payment Mode:* 💵 CASH (Direct Entry)\n` +
              `📒 *Khata Category:* Worker Advance / Kharcha\n` +
              `📅 *Date:* ${today}\n\n` +
              `Worker balance updated in Khata! 📊`;

            await WhatsAppService.sendMessage(normalizedSender, confirmationMsg);

            return {
              status: 'completed',
              reason: `Direct cash advance of ₹${directPayment.amount} recorded for worker ${workerName}`,
              messageId: rawMessageId,
              paymentId: paymentRecordId,
            };
          } else {
            // Vendor / Material / Transport / Contractor Ledger
            const categoryLabels: Record<string, string> = {
              vendor_payment: 'Vendor Ledger Payment',
              material: 'Material & Hardware Expense',
              transport: 'Transport & Vehicle Expense',
              thekedar: 'Subcontractor / Thekedar Payment',
            };
            const label = categoryLabels[directPayment.tagType] || 'Vendor Expense';

            const paymentRecordId = await PaymentLedgerService.recordPayment({
              paidTo: directPayment.payeeOrWorkerName,
              amount: directPayment.amount,
              category: directPayment.ledgerCategory,
              paymentMethod: directPayment.paymentMethod, // 'cash' or specified
              paymentDate: today,
              paymentTime: currentTime,
              receiptPhotoUrl: '',
              notes: `Direct Cash Expense Entry (${label}) | ${textBody}`,
              recordedBy: `WhatsApp Direct Cash (${normalizedSender})`,
            }, resolvedOrgId);

            await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', undefined, resolvedOrgId);

            const confirmationMsg =
              `🧾 *Direct Cash Expense Registered!* 📑\n\n` +
              `👤 *Payee / Vendor:* ${directPayment.payeeOrWorkerName}\n` +
              `💰 *Expense Amount:* ₹${directPayment.amount.toLocaleString('en-IN')}\n` +
              `💳 *Payment Mode:* 💵 CASH (Direct Entry)\n` +
              `📒 *Ledger Category:* ${label}\n` +
              `📅 *Date:* ${today}\n\n` +
              `Expense registered in accounting ledger! 📊`;

            await WhatsAppService.sendMessage(normalizedSender, confirmationMsg);

            return {
              status: 'completed',
              reason: `Direct expense of ₹${directPayment.amount} (${label}) recorded for ${directPayment.payeeOrWorkerName}`,
              messageId: rawMessageId,
              paymentId: paymentRecordId,
            };
          }
        }
      }

      // Ignore any message that is not an image or a document (PDF)
      if (messageType !== 'image' && messageType !== 'document') {
        console.log(`[WebhookProcessor] Non-image/document message type received: ${messageType}`);
        await WhatsAppService.updateMessageStatus(savedMsgId, 'ignored', undefined, resolvedOrgId);
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
          await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', undefined, resolvedOrgId);
          await WhatsAppService.sendMessage(
            normalizedSender,
            `⚠️ Could not download your payment receipt from WhatsApp. Please try sending it again.`
          );
          return { status: 'failed', reason: 'Media download error', messageId: rawMessageId };
        }
      }

      if (!imageBuffer) {
        await WhatsAppService.updateMessageStatus(savedMsgId, 'failed', undefined, resolvedOrgId);
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

      const allWorkers = await WorkersService.getWorkers(resolvedOrgId);
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
          }, resolvedOrgId);
        }

        await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', undefined, resolvedOrgId);

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
        matchedWorker = findBestWorkerMatch(allWorkers, paymentData.receiverName, paymentData.upiId || undefined);
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
        // STRICT VENDOR PAYEE NAME LOGIC:
        // Priority 1: If specific custom vendor remark was provided AND is not a category word (e.g. 'UltraTech', 'Raju Dumper', 'Sri Cements')
        // Priority 2: Payment screenshot AI OCR Beneficiary Name (e.g. 'RAJKUMAR')
        // Category keywords like 'Transport', 'Material', 'Contractor' are NEVER set as the vendor name.
        const isRemarkCategory = workerOrPayeeRemark && VENDOR_CATEGORY_KEYWORDS.includes(workerOrPayeeRemark.toLowerCase());
        const validRemark = (!isRemarkCategory && workerOrPayeeRemark) ? workerOrPayeeRemark : null;
        finalPaidTo = validRemark || ocrBeneficiary || 'Vendor / Payee';
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
      }, resolvedOrgId);

      await WhatsAppService.updateMessageStatus(savedMsgId, 'processed', undefined, resolvedOrgId);

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

export const VENDOR_CATEGORY_KEYWORDS = [
  'v',
  'vendor',
  'm',
  'material',
  'supplier',
  'thekedar',
  'contractor',
  'subcontractor',
  'fabricator',
  'plumber',
  'carpenter',
  'mason',
  'mistri',
  'pop',
  'civil',
  't',
  'transport',
  'tempo',
  'truck',
  'dumper',
  'driver',
  'gaadi',
  'bhada',
  'diesel',
  'petrol',
  'freight',
  'tractor',
  'trolley',
  'auto',
  'cement',
  'steel',
  'sand',
  'ret',
  'bajri',
  'sariya',
  'rodi',
  'hardware',
  'paint',
  'electric',
  'dukaan',
  'shop',
  'store',
  'brick',
  'tiles',
  'sanitary',
  'wood',
  'glass',
  'expense',
  'service',
  'rent',
  'repair',
  'maintenance',
  'chai',
  'khana',
  'food',
];

export const WORKER_CATEGORY_KEYWORDS = [
  'w',
  'worker',
  'a',
  'advance',
  'l',
  'labour',
  'k',
  'karigar',
  'kharcha',
  'wage',
  'majdoor',
];

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

  // 1. Standalone single keyword / category word (e.g. "Transport", "Contractor", "Material", "v", "w")
  if (VENDOR_CATEGORY_KEYWORDS.includes(lower)) {
    return { explicitCategory: 'vendor', workerOrPayeeRemark: null };
  }
  if (WORKER_CATEGORY_KEYWORDS.includes(lower)) {
    return { explicitCategory: 'advance', workerOrPayeeRemark: null };
  }

  // 2. Delimiter separated: e.g. "UltraTech, m", "Manoj, thekedar", "Raju Dumper, transport", "pintu, w"
  const delimiterMatch = text.match(/^(.+?)\s*[,:\-\/|]\s*([a-zA-Z]+)$/);
  if (delimiterMatch && delimiterMatch[1] && delimiterMatch[2]) {
    const remarkPart = delimiterMatch[1].trim();
    const tagPart = delimiterMatch[2].toLowerCase().trim();

    if (VENDOR_CATEGORY_KEYWORDS.includes(tagPart)) {
      const isRemarkCategoryWord = VENDOR_CATEGORY_KEYWORDS.includes(remarkPart.toLowerCase());
      return { explicitCategory: 'vendor', workerOrPayeeRemark: isRemarkCategoryWord ? null : remarkPart };
    }
    if (WORKER_CATEGORY_KEYWORDS.includes(tagPart)) {
      const isRemarkCategoryWord = WORKER_CATEGORY_KEYWORDS.includes(remarkPart.toLowerCase());
      return { explicitCategory: 'advance', workerOrPayeeRemark: isRemarkCategoryWord ? null : remarkPart };
    }
  }

  // 3. Trailing space separated: e.g. "UltraTech m", "Manoj thekedar", "pintu w"
  const trailingMatch = text.match(/^(.+?)\s+([a-zA-Z]+)$/);
  if (trailingMatch && trailingMatch[1] && trailingMatch[2]) {
    const remarkPart = trailingMatch[1].trim();
    const tagPart = trailingMatch[2].toLowerCase().trim();

    if (VENDOR_CATEGORY_KEYWORDS.includes(tagPart)) {
      const isRemarkCategoryWord = VENDOR_CATEGORY_KEYWORDS.includes(remarkPart.toLowerCase());
      return { explicitCategory: 'vendor', workerOrPayeeRemark: isRemarkCategoryWord ? null : remarkPart };
    }
    if (WORKER_CATEGORY_KEYWORDS.includes(tagPart)) {
      const isRemarkCategoryWord = WORKER_CATEGORY_KEYWORDS.includes(remarkPart.toLowerCase());
      return { explicitCategory: 'advance', workerOrPayeeRemark: isRemarkCategoryWord ? null : remarkPart };
    }
  }

  // 4. Leading tag separated: e.g. "w pintu", "m UltraTech", "thekedar Manoj", "transport Raju Dumper"
  const leadingMatch = text.match(/^([a-zA-Z]+)\s+[,:\-\/|]?\s*(.+)$/);
  if (leadingMatch && leadingMatch[1] && leadingMatch[2]) {
    const tagPart = leadingMatch[1].toLowerCase().trim();
    const remarkPart = leadingMatch[2].trim();

    if (VENDOR_CATEGORY_KEYWORDS.includes(tagPart)) {
      const isRemarkCategoryWord = VENDOR_CATEGORY_KEYWORDS.includes(remarkPart.toLowerCase());
      return { explicitCategory: 'vendor', workerOrPayeeRemark: isRemarkCategoryWord ? null : remarkPart };
    }
    if (WORKER_CATEGORY_KEYWORDS.includes(tagPart)) {
      const isRemarkCategoryWord = WORKER_CATEGORY_KEYWORDS.includes(remarkPart.toLowerCase());
      return { explicitCategory: 'advance', workerOrPayeeRemark: isRemarkCategoryWord ? null : remarkPart };
    }
  }

  // 5. Custom name without explicit tag
  if (VENDOR_CATEGORY_KEYWORDS.includes(lower)) {
    return { explicitCategory: 'vendor', workerOrPayeeRemark: null };
  }
  if (WORKER_CATEGORY_KEYWORDS.includes(lower)) {
    return { explicitCategory: 'advance', workerOrPayeeRemark: null };
  }

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
    if (match[1] && match[2]) {
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
  }

  // Fallback: If no colon/equal/dash was used, test space-separated name + number
  // e.g. "'pintu 2000' 'durgesh 3000'" or "pintu 2000, durgesh 3000"
  if (results.length === 0) {
    const spaceRegex = /(?:['"‘“])?([a-zA-Z\s._]+?)\s+(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)(?:\/-)?(?:['"’”])?(?:,|$|\n)/gi;
    while ((match = spaceRegex.exec(text)) !== null) {
      if (match[1] && match[2]) {
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
  }

  return results;
}

export interface DirectTextPaymentResult {
  payeeOrWorkerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  isWorkerTarget: boolean;
  ledgerCategory: PaymentCategory;
  tagType: 'advance' | 'material' | 'transport' | 'thekedar' | 'vendor_payment';
}

/**
 * Parses direct text cash/expense messages like:
 * - pintu prajapati: 500 cash -> Vendor Ledger (Default)
 * - rohit yadav: 300 cash w -> Worker Khata (Advance)
 * - ganesh pathak: 7000 cash v -> Vendor Ledger
 * - suresh hardware: 6000 cash m -> Material & Hardware Expense
 * - deepak: 500 cash t -> Transport Expense
 * - sanju singh yadav: 4000 cash c -> Contractor Expense
 */
export function parseDirectTextPayment(rawText: string): DirectTextPaymentResult | null {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  // Ignore check-in codes
  if (text.toUpperCase().includes('CHECKIN_')) return null;

  // Primary pattern matching: Name [:=- or space] [₹/Rs] Amount [Trailing Method/Tag]
  const mainRegex = /^(?:['"‘“])?([a-zA-Z0-9\s._&]+?)(?:['"’”])?\s*[:=-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(.*)$/i;

  const match = text.match(mainRegex);
  if (!match || !match[1] || !match[2]) return null;

  const rawName = match[1].trim().replace(/^['"‘“]+|['"’”]+$/g, '').trim();
  const rawAmt = match[2].replace(/,/g, '').trim();
  const amount = parseFloat(rawAmt);
  const trailingStr = (match[3] || '').trim().toLowerCase();

  const reservedWords = ['checkin', 'help', 'status', 'start', 'stop', 'hi', 'hello'];
  if (!rawName || isNaN(amount) || amount <= 0 || reservedWords.includes(rawName.toLowerCase())) {
    return null;
  }

  const tokens = trailingStr.split(/[\s,._\-\/]+/).filter(Boolean);

  let paymentMethod: PaymentMethod = 'cash';
  const methodKeywords: Record<string, PaymentMethod> = {
    cash: 'cash',
    gpay: 'gpay',
    googlepay: 'gpay',
    phonepe: 'phonepe',
    paytm: 'paytm',
    upi: 'upi',
    online: 'bank_transfer',
    bank: 'bank_transfer',
    transfer: 'bank_transfer',
    cheque: 'bank_transfer',
  };

  for (const token of tokens) {
    if (methodKeywords[token]) {
      paymentMethod = methodKeywords[token];
      break;
    }
  }

  let tagType: 'advance' | 'material' | 'transport' | 'thekedar' | 'vendor_payment' = 'vendor_payment';
  let ledgerCategory: PaymentCategory = 'vendor';
  let isWorkerTarget = false;

  const workerTags = ['w', 'worker', 'karigar', 'advance', 'kharcha'];
  const materialTags = ['m', 'material', 'hardware', 'supplier', 'goods'];
  const transportTags = ['t', 'transport', 'vehicle', 'truck', 'dumper', 'freight', 'bhada'];
  const contractorTags = ['c', 'contractor', 'thekedar', 'subcontractor'];
  const vendorTags = ['v', 'vendor', 'payee', 'seller'];

  for (const token of tokens) {
    if (workerTags.includes(token)) {
      tagType = 'advance';
      ledgerCategory = 'advance';
      isWorkerTarget = true;
      break;
    } else if (materialTags.includes(token)) {
      tagType = 'material';
      ledgerCategory = 'material';
      isWorkerTarget = false;
      break;
    } else if (transportTags.includes(token)) {
      tagType = 'transport';
      ledgerCategory = 'vendor';
      isWorkerTarget = false;
      break;
    } else if (contractorTags.includes(token)) {
      tagType = 'thekedar';
      ledgerCategory = 'vendor';
      isWorkerTarget = false;
      break;
    } else if (vendorTags.includes(token)) {
      tagType = 'vendor_payment';
      ledgerCategory = 'vendor';
      isWorkerTarget = false;
      break;
    }
  }

  return {
    payeeOrWorkerName: rawName,
    amount,
    paymentMethod,
    isWorkerTarget,
    ledgerCategory,
    tagType,
  };
}


