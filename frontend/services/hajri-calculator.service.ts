import { HAJRI_TIME_RANGES, UNMATCHED_HAJRI_STATE, TIMEZONE, HajriTimeRangeRule } from '@/config/hajri-rules.config';

export interface HajriCalculationResult {
  status: 'matched' | 'unmatched';
  hajri: number | null;
  label: string;
  ruleName: string;
  workedMinutes: number;
  workedHours: string;
}

export class HajriCalculatorService {
  /**
   * Calculates Hajri value STRICTLY based on the authoritative checkout timestamp in Asia/Kolkata timezone.
   * Worked minutes/hours are calculated purely for informational display and DO NOT determine Hajri.
   */
  public static calculateHajriFromCheckoutTimestamp(
    checkInDate: Date,
    checkoutDate: Date
  ): HajriCalculationResult {
    // 1. Calculate informational duration
    const checkInMs = checkInDate.getTime();
    const checkoutMs = checkoutDate.getTime();
    const durationMs = Math.max(0, checkoutMs - checkInMs);
    const workedMinutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(workedMinutes / 60);
    const mins = workedMinutes % 60;
    const workedHours = `${hours}h ${mins.toString().padStart(2, '0')}m`;

    // 2. Extract Asia/Kolkata local date & time components
    const checkoutISTInfo = this.getISTDateTimeInfo(checkoutDate);
    const checkInISTInfo = this.getISTDateTimeInfo(checkInDate);

    // Calculate relative calendar day offset in IST
    const daysDiff = Math.round(
      (checkoutISTInfo.midnightMs - checkInISTInfo.midnightMs) / (1000 * 60 * 60 * 24)
    );

    const relativeDay: 'same_day' | 'next_day' = daysDiff >= 1 ? 'next_day' : 'same_day';
    const checkoutTimeSeconds = checkoutISTInfo.timeSeconds;

    // 3. Match against HAJRI_TIME_RANGES
    for (const rule of HAJRI_TIME_RANGES) {
      if (rule.relativeDay === relativeDay) {
        const startSec = this.timeStringToSeconds(rule.startTime);
        const endSec = this.timeStringToSeconds(rule.endTime);

        if (checkoutTimeSeconds >= startSec && checkoutTimeSeconds <= endSec) {
          return {
            status: 'matched',
            hajri: rule.hajriValue,
            label: rule.label,
            ruleName: rule.ruleName,
            workedMinutes,
            workedHours,
          };
        }
      }
    }

    // 4. Return strict UNMATCHED state if no slab matched
    console.warn(
      `[HajriCalculatorService] Checkout timestamp ${checkoutISTInfo.timeString} IST (Day offset: ${daysDiff}) ` +
      `does not match any configured time slab. Assigned state: UNMATCHED.`
    );

    return {
      status: UNMATCHED_HAJRI_STATE.status,
      hajri: UNMATCHED_HAJRI_STATE.hajri,
      label: UNMATCHED_HAJRI_STATE.label,
      ruleName: UNMATCHED_HAJRI_STATE.ruleName,
      workedMinutes,
      workedHours,
    };
  }

  private static getISTDateTimeInfo(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = parseInt(getPart('hour'), 10) % 24;
    const minute = parseInt(getPart('minute'), 10);
    const second = parseInt(getPart('second'), 10);

    const timeSeconds = hour * 3600 + minute * 60 + second;
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;

    const midnightMs = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))).getTime();

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      timeSeconds,
      timeString,
      midnightMs,
    };
  }

  private static timeStringToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return h * 3600 + m * 60 + s;
  }
}
