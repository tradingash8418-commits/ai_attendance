export const TIMEZONE = 'Asia/Kolkata';

export interface HajriTimeRangeRule {
  id: string;
  ruleName: string;
  label: string;
  hajriValue: number;
  startTime: string; // 'HH:mm:ss' 24h format in Asia/Kolkata
  endTime: string;   // 'HH:mm:ss' 24h format in Asia/Kolkata
  relativeDay: 'same_day' | 'next_day';
}

export const HAJRI_TIME_RANGES: HajriTimeRangeRule[] = [
  {
    id: 'rule_normal',
    ruleName: 'Normal',
    label: 'Normal',
    hajriValue: 1.0,
    startTime: '10:00:00',
    endTime: '19:29:59',
    relativeDay: 'same_day',
  },
  {
    id: 'rule_dedhi',
    ruleName: 'Dedhi',
    label: 'Dedhi',
    hajriValue: 1.5,
    startTime: '19:30:00',
    endTime: '21:29:59',
    relativeDay: 'same_day',
  },
  {
    id: 'rule_double',
    ruleName: 'Double',
    label: 'Double',
    hajriValue: 2.0,
    startTime: '21:30:00',
    endTime: '23:59:59', // Extends through 12:59:59 AM Next Day
    relativeDay: 'same_day',
  },
  {
    id: 'rule_double_overnight',
    ruleName: 'Double',
    label: 'Double',
    hajriValue: 2.0,
    startTime: '00:00:00',
    endTime: '00:59:59',
    relativeDay: 'next_day',
  },
  {
    id: 'rule_dhai',
    ruleName: 'Dhai',
    label: 'Dhai',
    hajriValue: 2.5,
    startTime: '01:00:00',
    endTime: '02:29:59',
    relativeDay: 'next_day',
  },
  {
    id: 'rule_three',
    ruleName: 'Three',
    label: 'Three Hajri',
    hajriValue: 3.0,
    startTime: '02:30:00',
    endTime: '03:30:59',
    relativeDay: 'next_day',
  },
];

export const UNMATCHED_HAJRI_STATE = {
  status: 'unmatched' as const,
  hajri: null as number | null,
  label: 'Unmatched Checkout Time',
  ruleName: 'Unmatched',
};
