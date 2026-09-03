import { HajriCalculatorService } from '../hajri-calculator.service';

/**
 * Automated Test Suite for Continuous Time-Slab Hajri Calculation System
 * Timezone: Asia/Kolkata (IST)
 * 
 * Verifies all 16 boundary cases specified in system requirements.
 */

describe('HajriCalculatorService Boundary Tests', () => {
  // Base check-in: Sep 3, 2026, 10:00:00 AM IST (1756873800000 ms UTC / 10:00:00 AM IST)
  // Note: 2026-09-03T10:00:00+05:30
  const checkInIST = new Date('2026-09-03T10:00:00+05:30');

  const testCases = [
    { timeStr: '2026-09-03T10:00:00+05:30', expectedHajri: 1.0, expectedLabel: 'Normal', ruleName: 'Normal' },
    { timeStr: '2026-09-03T17:00:00+05:30', expectedHajri: 1.0, expectedLabel: 'Normal', ruleName: 'Normal' },
    { timeStr: '2026-09-03T19:29:59+05:30', expectedHajri: 1.0, expectedLabel: 'Normal', ruleName: 'Normal' },
    { timeStr: '2026-09-03T19:30:00+05:30', expectedHajri: 1.5, expectedLabel: 'Dedhi', ruleName: 'Dedhi' },
    { timeStr: '2026-09-03T20:15:00+05:30', expectedHajri: 1.5, expectedLabel: 'Dedhi', ruleName: 'Dedhi' },
    { timeStr: '2026-09-03T21:29:59+05:30', expectedHajri: 1.5, expectedLabel: 'Dedhi', ruleName: 'Dedhi' },
    { timeStr: '2026-09-03T21:30:00+05:30', expectedHajri: 2.0, expectedLabel: 'Double', ruleName: 'Double' },
    { timeStr: '2026-09-03T22:30:00+05:30', expectedHajri: 2.0, expectedLabel: 'Double', ruleName: 'Double' },
    { timeStr: '2026-09-03T23:30:00+05:30', expectedHajri: 2.0, expectedLabel: 'Double', ruleName: 'Double' },
    { timeStr: '2026-09-04T00:59:59+05:30', expectedHajri: 2.0, expectedLabel: 'Double', ruleName: 'Double' },
    { timeStr: '2026-09-04T01:00:00+05:30', expectedHajri: 2.5, expectedLabel: 'Dhai', ruleName: 'Dhai' },
    { timeStr: '2026-09-04T01:30:00+05:30', expectedHajri: 2.5, expectedLabel: 'Dhai', ruleName: 'Dhai' },
    { timeStr: '2026-09-04T02:29:59+05:30', expectedHajri: 2.5, expectedLabel: 'Dhai', ruleName: 'Dhai' },
    { timeStr: '2026-09-04T02:30:00+05:30', expectedHajri: 3.0, expectedLabel: 'Three Hajri', ruleName: 'Three' },
    { timeStr: '2026-09-04T03:30:59+05:30', expectedHajri: 3.0, expectedLabel: 'Three Hajri', ruleName: 'Three' },
    { timeStr: '2026-09-04T03:31:00+05:30', expectedHajri: null, expectedLabel: 'Unmatched Checkout Time', ruleName: 'Unmatched' },
  ];

  testCases.forEach(({ timeStr, expectedHajri, expectedLabel, ruleName }) => {
    it(`should correctly calculate Hajri for checkout at ${timeStr}`, () => {
      const checkoutDate = new Date(timeStr);
      const result = HajriCalculatorService.calculateHajriFromCheckoutTimestamp(checkInIST, checkoutDate);

      expect(result.hajri).toBe(expectedHajri);
      expect(result.label).toBe(expectedLabel);
      expect(result.ruleName).toBe(ruleName);
    });
  });
});
