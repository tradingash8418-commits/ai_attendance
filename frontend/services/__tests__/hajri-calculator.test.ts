import { HajriCalculatorService } from '../hajri-calculator.service';

/**
 * Automated Test Suite for Duration-Based Worked Hours Hajri Calculation System
 * Option B Rule Set:
 *  - < 8 hrs: 0.0 Hajri (Short Shift)
 *  - 8 hrs to < 10 hrs: 1.0 Hajri (Normal)
 *  - 10 hrs to < 12 hrs: 1.5 Hajri (Dedhi)
 *  - 12 hrs to < 15 hrs: 2.0 Hajri (Double)
 *  - 15 hrs to < 17.5 hrs: 2.5 Hajri (Dhai)
 *  - >= 17.5 hrs: 3.0 Hajri (Three)
 */

describe('HajriCalculatorService Duration Tests with 20-Min Grace Buffer', () => {
  const checkIn10AM = new Date('2026-09-03T10:00:00+05:30');

  const testCases = [
    { name: '2 hrs worked (< 7h 40m)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T12:00:00+05:30', expectedHajri: 0.0, ruleName: 'Short Shift' },
    { name: '7.5 hrs worked (7h 30m - under 7h 40m threshold)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T17:30:00+05:30', expectedHajri: 0.0, ruleName: 'Short Shift' },
    { name: '7.75 hrs worked (7h 45m - qualifies for 1.0 Hajri with 20m buffer)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T17:45:00+05:30', expectedHajri: 1.0, ruleName: 'Normal' },
    { name: '8 hrs worked (10 AM to 6 PM)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T18:00:00+05:30', expectedHajri: 1.0, ruleName: 'Normal' },
    { name: '9.92 hrs worked (9h 55m - qualifies for 1.5 Dedhi with 20m buffer)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T19:55:00+05:30', expectedHajri: 1.5, ruleName: 'Dedhi' },
    { name: '10 hrs worked (10 AM to 8 PM)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T20:00:00+05:30', expectedHajri: 1.5, ruleName: 'Dedhi' },
    { name: '11.75 hrs worked (11h 45m - qualifies for 2.0 Double with 20m buffer)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T21:45:00+05:30', expectedHajri: 2.0, ruleName: 'Double' },
    { name: '12 hrs worked (10 AM to 10 PM)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-03T22:00:00+05:30', expectedHajri: 2.0, ruleName: 'Double' },
    { name: '14.83 hrs worked (14h 50m - qualifies for 2.5 Dhai with 20m buffer)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-04T00:50:00+05:30', expectedHajri: 2.5, ruleName: 'Dhai' },
    { name: '17.25 hrs worked (17h 15m - qualifies for 3.0 Three with 20m buffer)', checkIn: checkIn10AM, checkoutTimeStr: '2026-09-04T03:15:00+05:30', expectedHajri: 3.0, ruleName: 'Three' },
    { name: 'Late Check-in (6 PM Checkin, 7 PM Checkout = 1 hr)', checkIn: new Date('2026-09-03T18:00:00+05:30'), checkoutTimeStr: '2026-09-03T19:00:00+05:30', expectedHajri: 0.0, ruleName: 'Short Shift' },
  ];

  testCases.forEach(({ name, checkIn, checkoutTimeStr, expectedHajri, ruleName }) => {
    it(`should correctly calculate Hajri for ${name}`, () => {
      const checkoutDate = new Date(checkoutTimeStr);
      const result = HajriCalculatorService.calculateHajriFromCheckoutTimestamp(checkIn, checkoutDate);

      expect(result.hajri).toBe(expectedHajri);
      expect(result.ruleName).toBe(ruleName);
    });
  });
});
