import { HAJRI_DURATION_RULES, UNMATCHED_HAJRI_STATE } from '@/config/hajri-rules.config';

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
   * Calculates Hajri value STRICTLY based on the total worked hours (duration) between Check-In and Check-Out.
   * Option B:
   *  - < 8.0 hrs: 0.0 Hajri (Short Shift - Min 8 hrs Required)
   *  - 8.0 hrs to < 10.0 hrs: 1.0 Hajri (Normal)
   *  - 10.0 hrs to < 12.0 hrs: 1.5 Hajri (Dedhi)
   *  - 12.0 hrs to < 15.0 hrs: 2.0 Hajri (Double)
   *  - 15.0 hrs to < 17.5 hrs: 2.5 Hajri (Dhai)
   *  - >= 17.5 hrs: 3.0 Hajri (Three)
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
    const workedHoursDecimal = workedMinutes / 60;
    const hours = Math.floor(workedMinutes / 60);
    const mins = workedMinutes % 60;
    const workedHours = `${hours}h ${mins.toString().padStart(2, '0')}m`;

    // Match against HAJRI_DURATION_RULES sorted in descending order of minHours
    const sortedRules = HAJRI_DURATION_RULES.slice().sort((a, b) => b.minHours - a.minHours);

    for (const rule of sortedRules) {
      if (workedHoursDecimal >= rule.minHours) {
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
