import { WhatsAppService } from './whatsapp.service';
import { WorkersService } from './workers.service';
import { AttendanceService } from './attendance.service';
import { getWorkerDisplayName } from '@/lib/formatters';
import type { Worker } from '@/types/worker';

export interface AttendanceFeedbackOptions {
  supervisorWhatsAppNumber: string;
  siteName: string;
  date: string;
  siteId?: string;
  recognizedWorkerIds: string[];
  unknownFaceCount: number;
}

export class WhatsAppFeedbackServer {
  /**
   * Generates a clean, user-facing attendance report text and sends it back to the supervisor via WhatsApp.
   * Shows Worker, Check-in, Check-out, Worked duration (informational), Hajri, and Hajri label.
   * Zero technical details (no face confidence, embeddings, cosine distance, or raw IDs).
   */
  public static async sendAttendanceFeedbackReport(
    options: AttendanceFeedbackOptions
  ): Promise<{ success: boolean; error?: string }> {
    const { supervisorWhatsAppNumber, siteName, date, siteId, recognizedWorkerIds, unknownFaceCount } = options;

    if (!supervisorWhatsAppNumber) {
      console.warn('[WhatsAppFeedbackServer] Missing supervisor WhatsApp sender number.');
      return { success: false, error: 'Missing supervisor WhatsApp number' };
    }

    try {
      // 1. Fetch worker records matching recognized IDs/codes
      const allWorkers = await WorkersService.getWorkers();
      const recognizedWorkers: Worker[] = allWorkers.filter(
        (w) => recognizedWorkerIds.includes(w.id) || recognizedWorkerIds.includes(w.workerCode)
      );

      // 2. Fetch existing attendance records for (siteId, date) to display check-in/out & hajri
      const attendanceRecords = await AttendanceService.getAttendanceRecords({
        siteId,
        date,
      });

      // 3. Build clean text message report
      const messageLines: string[] = [];
      messageLines.push('Attendance Recorded ✅');
      messageLines.push('');
      messageLines.push(`Site: ${siteName}`);
      messageLines.push(`Date: ${date}`);
      messageLines.push('');

      if (recognizedWorkers.length === 0) {
        messageLines.push('Present: None');
      } else {
        messageLines.push('Present:');
        recognizedWorkers.forEach((worker, index) => {
          const nameDisplay = getWorkerDisplayName(worker);
          const attRecord = attendanceRecords.find(
            (r) => r.workerId === worker.id || r.workerId === worker.workerCode
          );

          const checkInFormatted = attRecord?.checkInTime
            ? this.formatTimeStringIST(attRecord.checkInTime)
            : '10:00 AM';

          const checkOutFormatted = attRecord?.checkOutTime
            ? this.formatTimeStringIST(attRecord.checkOutTime)
            : checkInFormatted;

          const workedStr = attRecord?.workedHours || '0h 00m';
          const hajriVal = attRecord?.hajri !== undefined && attRecord?.hajri !== null ? attRecord.hajri : 1.0;
          const hajriLabel = attRecord?.hajriLabel || 'Normal';

          messageLines.push(`${index + 1}. ${nameDisplay}`);
          messageLines.push(`   Check-in: ${checkInFormatted}`);
          messageLines.push(`   Check-out: ${checkOutFormatted}`);
          messageLines.push(`   Worked: ${workedStr}`);
          messageLines.push(`   Hajri: ${hajriVal} (${hajriLabel})`);
          messageLines.push('');
        });
      }

      messageLines.push(`Total Present: ${recognizedWorkers.length}`);

      if (unknownFaceCount > 0) {
        messageLines.push('');
        messageLines.push(`Note: ${unknownFaceCount} person(s) could not be recognized.`);
      }

      const formattedReportText = messageLines.join('\n');

      // 4. Dispatch text message via Meta WhatsApp Cloud API abstraction
      console.log(`[WhatsAppFeedbackServer] Dispatching feedback report to ${supervisorWhatsAppNumber}:\n${formattedReportText}`);
      const res = await WhatsAppService.sendMessage(supervisorWhatsAppNumber, formattedReportText);

      return { success: res.success };
    } catch (err: any) {
      console.error('[WhatsAppFeedbackServer] Failed to send WhatsApp feedback report:', err);
      return { success: false, error: err?.message || 'Failed to dispatch WhatsApp message' };
    }
  }

  private static formatTimeStringIST(dateInput: string | Date | number): string {
    const d = new Date(dateInput);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }
}
