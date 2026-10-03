import { HAJRI_DURATION_RULES, HAJRI_BUFFER_MINUTES, UNMATCHED_HAJRI_STATE } from '@/config/hajri-rules.config';

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
   * Calculates Hajri value STRICTLY based on the total worked hours (duration) between Check-In and Check-Out,
   * applying a flexible 20-minute (±20 mins) grace buffer to shift thresholds.
   *
   * Thresholds with 20-Min Grace Buffer (HAJRI_BUFFER_MINUTES = 20):
   *  - < 7h 40m (< 460 mins): 0.0 Hajri (Short Shift)
   *  - 7h 40m to < 9h 40m (460 to < 580 mins): 1.0 Hajri (Normal)
   *  - 9h 40m to < 11h 40m (580 to < 700 mins): 1.5 Hajri (Dedhi) -> e.g. 9h 55m gives 1.5 Hajri!
   *  - 11h 40m to < 14h 40m (700 to < 880 mins): 2.0 Hajri (Double)
   *  - 14h 40m to < 17h 10m (880 to < 1030 mins): 2.5 Hajri (Dhai)
   *  - >= 17h 10m (>= 1030 mins): 3.0 Hajri (Three)
   */
  public static calculateHajriFromCheckoutTimestamp(
    checkInDate: Date,
    checkoutDate: Date
  ): HajriCalculationResult {
    const checkInMs = checkInDate.getTime();
    const checkoutMs = checkoutDate.getTime();

    // Check for invalid timestamps or checkout prior to check-in
    if (isNaN(checkInMs) || isNaN(checkoutMs) || checkoutMs < checkInMs) {
      console.warn(
        `[HajriCalculatorService] Invalid checkout timestamp or checkout before checkin: ` +
        `CheckIn=${checkInDate}, CheckOut=${checkoutDate}`
      );
      return {
        status: UNMATCHED_HAJRI_STATE.status,
        hajri: UNMATCHED_HAJRI_STATE.hajri,
        label: UNMATCHED_HAJRI_STATE.label,
        ruleName: UNMATCHED_HAJRI_STATE.ruleName,
        workedMinutes: 0,
        workedHours: '0h 00m',
      };
    }

    const durationMs = checkoutMs - checkInMs;
    const workedMinutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(workedMinutes / 60);
    const mins = workedMinutes % 60;
    const workedHours = `${hours}h ${mins.toString().padStart(2, '0')}m`;

    // Match against HAJRI_DURATION_RULES sorted in descending order of minHours
    const sortedRules = HAJRI_DURATION_RULES.slice().sort((a, b) => b.minHours - a.minHours);

    for (const rule of sortedRules) {
      const nominalMinMinutes = rule.minHours * 60;
      const effectiveMinMinutes = Math.max(0, nominalMinMinutes - HAJRI_BUFFER_MINUTES);

      if (workedMinutes >= effectiveMinMinutes) {
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

    // Default fallback for < 8 hrs (Short Shift)
    return {
      status: 'matched',
      hajri: 0.0,
      label: '0.0 Hajri (Short Shift - Min 8 hrs Required)',
      ruleName: 'Short Shift',
      workedMinutes,
      workedHours,
    };
  }
}
