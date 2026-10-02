export const TIMEZONE = 'Asia/Kolkata';

export interface HajriDurationRule {
  id: string;
  ruleName: string;
  label: string;
  hajriValue: number;
  minHours: number; // Minimum worked hours required for this slab (inclusive)
  maxHours: number | null; // Upper bound worked hours (exclusive, null if no upper limit)
}

export const HAJRI_DURATION_RULES: HajriDurationRule[] = [
  {
    id: 'rule_short_shift',
    ruleName: 'Short Shift',
    label: '0.0 Hajri (Short Shift - Min 8 hrs Required)',
    hajriValue: 0.0,
    minHours: 0.0,
    maxHours: 8.0,
  },
  {
    id: 'rule_normal',
    ruleName: 'Normal',
    label: 'Normal (1.0 Hajri)',
    hajriValue: 1.0,
    minHours: 8.0,
    maxHours: 10.0,
  },
  {
    id: 'rule_dedhi',
    ruleName: 'Dedhi',
    label: 'Dedhi (1.5 Hajri)',
    hajriValue: 1.5,
    minHours: 10.0,
    maxHours: 12.0,
  },
  {
    id: 'rule_double',
    ruleName: 'Double',
    label: 'Double (2.0 Hajri)',
    hajriValue: 2.0,
    minHours: 12.0,
    maxHours: 15.0,
  },
  {
    id: 'rule_dhai',
    ruleName: 'Dhai',
    label: 'Dhai (2.5 Hajri)',
    hajriValue: 2.5,
    minHours: 15.0,
    maxHours: 17.5,
  },
  {
    id: 'rule_three',
    ruleName: 'Three',
    label: 'Three (3.0 Hajri)',
    hajriValue: 3.0,
    minHours: 17.5,
    maxHours: null,
  },
];

export const UNMATCHED_HAJRI_STATE = {
  status: 'unmatched' as const,
  hajri: null as number | null,
  label: 'Invalid Checkout Time',
  ruleName: 'Unmatched',
};
