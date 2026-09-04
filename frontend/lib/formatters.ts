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
  if (worker.workerCode) {
    return `${worker.name} (#${worker.workerCode})`;
  }
  if (worker.phone) {
    return `${worker.name} (${worker.phone})`;
  }
  // Fallback to truncated ID suffix for duplicate resolution
  const shortId = worker.id.slice(-4).toUpperCase();
  return `${worker.name} (#${shortId})`;
};

/**
 * Formats a Date object, ISO string, timestamp number, or Firestore Timestamp to HH:MM AM/PM.
 */
export const formatTime = (val: any, fallback = '-'): string => {
  if (!val) return fallback;
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
 * Formats a Date object or current date to YYYY-MM-DD string.
 */
export const getTodayDateString = (date?: Date): string => {
  const d = date ? new Date(date) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
