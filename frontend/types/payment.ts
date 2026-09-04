import type { Timestamp } from 'firebase/firestore';

export type PaymentCategory = 'advance' | 'wage' | 'kharcha' | 'bonus' | 'deduction';
export type PaymentMethod = 'gpay' | 'phonepe' | 'paytm' | 'upi' | 'cash' | 'bank_transfer';

export interface PaymentLedgerEntry {
  id: string;
  paidTo: string; // Name of person / worker / vendor to whom payment was made (e.g. MUBARAK)
  workerId?: string; // Optional worker document link
  workerName?: string; // Optional worker name link
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
  recordedBy: string; // e.g. 'ai_screenshot_ocr', 'whatsapp_bot', 'admin_dashboard'
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
