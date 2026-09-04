import type { Timestamp } from 'firebase/firestore';

export type PaymentCategory = 'advance' | 'wage' | 'kharcha' | 'bonus' | 'deduction';
export type PaymentMethod = 'gpay' | 'phonepe' | 'paytm' | 'upi' | 'cash' | 'bank_transfer';

export interface PaymentLedgerEntry {
  id: string;
  workerId: string;
  workerName: string;
  workerCode?: string;
  workerPhone?: string;
  siteId?: string;
  siteName?: string;
  amount: number;
  category: PaymentCategory;
  paymentMethod: PaymentMethod;
  upiId?: string;
  transactionRef?: string;
  paymentDate: string; // YYYY-MM-DD
  paymentTime?: string; // HH:MM AM/PM
  receiptPhotoUrl?: string;
  notes?: string;
  recordedBy: string; // e.g. 'WhatsApp AI OCR (+919876543210)' or 'Admin Dashboard'
  rawOcrText?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExtractedPaymentData {
  isPaymentScreenshot: boolean;
  amount: number | null;
  receiverName: string | null;
  upiId: string | null;
  timestampStr: string | null;
  paymentMethod: PaymentMethod;
  confidence: number;
  rawText: string;
}
