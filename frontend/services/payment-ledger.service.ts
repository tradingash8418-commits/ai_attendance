import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WorkersService } from './workers.service';
import { AttendanceService } from './attendance.service';
import type { PaymentLedgerEntry, PaymentCategory, PaymentMethod } from '@/types/payment';

const COLLECTION_NAME = 'paymentLedger';

export interface WorkerKhataSummary {
  workerId: string;
  workerName: string;
  workerCode?: string;
  phone?: string;
  dailyRate: number;
  totalHajriEarned: number;
  totalEarnedAmount: number;
  totalAdvancesPaid: number;
  totalWagesPaid: number;
  netPayableBalance: number;
  recentPayments: PaymentLedgerEntry[];
}

export class PaymentLedgerService {
  /**
   * Records a new payment / advance entry into the Khata Ledger.
   */
  public static async recordPayment(data: {
    workerId: string;
    workerName: string;
    workerCode?: string;
    workerPhone?: string;
    siteId?: string;
    siteName?: string;
    amount: number;
    category?: PaymentCategory;
    paymentMethod?: PaymentMethod;
    upiId?: string;
    transactionRef?: string;
    paymentDate: string; // YYYY-MM-DD
    paymentTime?: string;
    receiptPhotoUrl?: string;
    notes?: string;
    recordedBy: string;
    rawOcrText?: string;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();

    const docRef = await addDoc(colRef, {
      workerId: data.workerId,
      workerName: data.workerName,
      workerCode: data.workerCode || '',
      workerPhone: data.workerPhone || '',
      siteId: data.siteId || '',
      siteName: data.siteName || '',
      amount: data.amount,
      category: data.category || 'advance',
      paymentMethod: data.paymentMethod || 'gpay',
      upiId: data.upiId || '',
      transactionRef: data.transactionRef || '',
      paymentDate: data.paymentDate,
      paymentTime: data.paymentTime || '',
      receiptPhotoUrl: data.receiptPhotoUrl || '',
      notes: data.notes || '',
      recordedBy: data.recordedBy,
      rawOcrText: data.rawOcrText || '',
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    });

    return docRef.id;
  }

  /**
   * Retrieves payments matching optional filters.
   */
  public static async getPayments(filters?: {
    workerId?: string;
    siteId?: string;
    date?: string;
  }): Promise<PaymentLedgerEntry[]> {
    const colRef = collection(db, COLLECTION_NAME);
    let q = query(colRef, orderBy('paymentDate', 'desc'));

    if (filters?.workerId) {
      q = query(colRef, where('workerId', '==', filters.workerId), orderBy('paymentDate', 'desc'));
    }

    const snapshot = await getDocs(q);
    let entries = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as PaymentLedgerEntry[];

    if (filters?.siteId) {
      entries = entries.filter((e) => e.siteId === filters.siteId);
    }
    if (filters?.date) {
      entries = entries.filter((e) => e.paymentDate === filters.date);
    }

    return entries;
  }

  /**
   * Calculates real-time Khata balance (Hajri Wages vs Total Advances Paid) across all workers.
   */
  public static async getAllWorkersKhataSummary(
    defaultDailyRate = 500
  ): Promise<{
    summaries: WorkerKhataSummary[];
    totalAdvancesPaidAll: number;
    totalHajriAll: number;
  }> {
    const [workers, attendanceRecords, payments] = await Promise.all([
      WorkersService.getWorkers(),
      AttendanceService.getAttendanceRecords(),
      this.getPayments(),
    ]);

    let totalAdvancesPaidAll = 0;
    let totalHajriAll = 0;

    const summaries: WorkerKhataSummary[] = workers.map((worker) => {
      // 1. Calculate total Hajri days earned
      const workerRecords = attendanceRecords.filter(
        (r) => r.workerId === worker.id || r.workerId === worker.workerCode
      );
      const totalHajriEarned = workerRecords.reduce((sum, r) => {
        const h = typeof r.hajri === 'number' ? r.hajri : 1.0;
        return sum + h;
      }, 0);

      // 2. Calculate total advances and payments from ledger
      const workerPayments = payments.filter(
        (p) => p.workerId === worker.id || (worker.workerCode && p.workerCode === worker.workerCode)
      );

      const totalAdvancesPaid = workerPayments
        .filter((p) => p.category === 'advance' || p.category === 'kharcha')
        .reduce((sum, p) => sum + p.amount, 0);

      const totalWagesPaid = workerPayments
        .filter((p) => p.category === 'wage')
        .reduce((sum, p) => sum + p.amount, 0);

      const workerDailyRate = typeof worker.dailyRate === 'number' && worker.dailyRate > 0 ? worker.dailyRate : defaultDailyRate;
      const totalEarnedAmount = totalHajriEarned * workerDailyRate;
      const netPayableBalance = totalEarnedAmount - totalAdvancesPaid - totalWagesPaid;

      totalAdvancesPaidAll += totalAdvancesPaid;
      totalHajriAll += totalHajriEarned;

      return {
        workerId: worker.id,
        workerName: worker.name,
        workerCode: worker.workerCode,
        phone: worker.phone,
        dailyRate: workerDailyRate,
        totalHajriEarned: Number(totalHajriEarned.toFixed(1)),
        totalEarnedAmount: Math.round(totalEarnedAmount),
        totalAdvancesPaid,
        totalWagesPaid,
        netPayableBalance: Math.round(netPayableBalance),
        recentPayments: workerPayments.slice(0, 5),
      };
    });

    return {
      summaries,
      totalAdvancesPaidAll,
      totalHajriAll: Number(totalHajriAll.toFixed(1)),
    };
  }

  /**
   * Deletes a payment record.
   */
  public static async deletePayment(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
}
