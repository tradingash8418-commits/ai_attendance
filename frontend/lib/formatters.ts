import type { Worker } from '@/types/worker';

/**
 * Normalizes any raw phone/WhatsApp input string into strict E.164 format.
 * Example: "98765 43210" -> "+919876543210"
 * Example: "+91 98765-43210" -> "+919876543210"
 */
export const normalizeWhatsAppNumber = (input: string): string => {
  if (!input) return '';
  
  // Strip all non-numeric characters except leading '+'
  const cleaned = input.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If 10-digit Indian number without country code
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // If starts with country code numbers without '+'
  return `+${cleaned}`;
};

/**
 * Generates a unambiguous display name for a worker to handle duplicate/same names.
 * Example: "Ramesh Kumar (#WRK-002)" or "Ramesh Kumar (+919876543210)"
 */
export const getWorkerDisplayName = (worker: Worker): string => {
  let name = worker.name || 'Worker';
  if (name.startsWith('org_')) {
    const phone = worker.phone ? normalizeWhatsAppNumber(worker.phone) : '';
    const last4 = phone ? phone.slice(-4) : worker.id.slice(-4);
    name = `Worker (${last4})`;
  }
  if (worker.workerCode) {
    return `${name} (#${worker.workerCode})`;
  }
  if (worker.phone) {
    return `${name} (${worker.phone})`;
  }
  const shortId = worker.id.slice(-4).toUpperCase();
  return `${name} (#${shortId})`;
};

/**
 * Formats a Date object, ISO string, timestamp number, Firestore Timestamp,
 * or 12h/24h time string to clean 12-hour HH:MM AM/PM format.
 */
export const formatTime = (val: any, fallback = '-'): string => {
  if (!val || val === '-') return fallback;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '-' || !trimmed) return fallback;

    // Direct match for 12-hour AM/PM format e.g. "10:00 AM" or "6:30 pm"
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12 && match12[1] && match12[2] && match12[3]) {
      const hh = match12[1].padStart(2, '0');
      const mm = match12[2];
      const ampm = match12[3].toUpperCase();
      return `${hh}:${mm} ${ampm}`;
    }

    // Direct match for 24-hour time format e.g. "18:30" or "09:00"
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match24 && match24[1] && match24[2]) {
      let h = parseInt(match24[1], 10);
      const mm = match24[2];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      const hh = String(h).padStart(2, '0');
      return `${hh}:${mm} ${ampm}`;
    }
  }

  try {
    let d: Date;
    if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (typeof val === 'object' && 'seconds' in val) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return fallback;
  }
};

/**
 * Converts a user time string (e.g. "06:30 PM", "18:30", "10:00 AM") and base date ("YYYY-MM-DD")
 * into a valid ISO 8601 string. Returns null if empty/invalid.
 */
export const convertTimeToIsoString = (timeStr: string | null | undefined, baseDateStr: string): string | null => {
  if (!timeStr || !timeStr.trim() || timeStr.trim() === '-') return null;
  const str = timeStr.trim();

  let hours = -1;
  let minutes = -1;

  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12 && match12[1] && match12[2] && match12[3]) {
    let h = parseInt(match12[1], 10);
    minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    hours = h;
  } else {
    const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
    if (match24 && match24[1] && match24[2]) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
    } else {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
      return null;
    }
  }

  if (hours < 0 || minutes < 0 || hours > 23 || minutes > 59) return null;

  const dateParts = baseDateStr.split('-').map((v) => parseInt(v, 10));
  const yyyy = dateParts[0] || new Date().getFullYear();
  const mm = dateParts[1] || (new Date().getMonth() + 1);
  const dd = dateParts[2] || new Date().getDate();

  const resultDate = new Date(yyyy, mm - 1, dd, hours, minutes, 0, 0);
  return resultDate.toISOString();
};

/**
 * Formats a Date object or current date to YYYY-MM-DD string.
 */
export const getTodayDateString = (date?: Date): string => {
  const d = date ? new Date(date) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
