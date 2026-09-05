import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
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
    paidTo: string;
    workerId?: string;
    workerName?: string;
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

    const recipientName = (data.paidTo || data.workerName || 'Unknown').trim();

    const docRef = await addDoc(colRef, {
      paidTo: recipientName,
      workerId: data.workerId || '',
      workerName: data.workerName || recipientName,
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
    let entries = snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        paidTo: d.paidTo || d.workerName || 'Recipient',
      };
    }) as PaymentLedgerEntry[];

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

    // 3. Find temporary / un-enrolled worker advances (e.g. 2-3 day workers with category 'advance')
    const registeredWorkerIds = new Set(workers.map((w) => w.id));
    const registeredWorkerCodes = new Set(workers.map((w) => w.workerCode).filter(Boolean));

    const unlinkedWorkerPayments = payments.filter((p) => {
      if (p.category !== 'advance' && p.category !== 'kharcha' && p.category !== 'wage') return false;
      const isLinkedToRegistered =
        (p.workerId && registeredWorkerIds.has(p.workerId)) ||
        (p.workerCode && registeredWorkerCodes.has(p.workerCode));
      return !isLinkedToRegistered;
    });

    const unlinkedGrouped: Record<string, PaymentLedgerEntry[]> = {};
    for (const p of unlinkedWorkerPayments) {
      const nameKey = (p.workerName || p.paidTo || 'Temporary Worker').trim();
      if (!unlinkedGrouped[nameKey]) unlinkedGrouped[nameKey] = [];
      unlinkedGrouped[nameKey].push(p);
    }

    for (const [tempName, tempPayments] of Object.entries(unlinkedGrouped)) {
      const totalAdvancesPaid = tempPayments
        .filter((p) => p.category === 'advance' || p.category === 'kharcha')
        .reduce((sum, p) => sum + p.amount, 0);

      const totalWagesPaid = tempPayments
        .filter((p) => p.category === 'wage')
        .reduce((sum, p) => sum + p.amount, 0);

      totalAdvancesPaidAll += totalAdvancesPaid;

      summaries.push({
        workerId: `temp_${tempName.toLowerCase().replace(/\s+/g, '_')}`,
        workerName: `${tempName} (Daily/Temp)`,
        workerCode: 'DAILY',
        phone: tempPayments[0]?.workerPhone || '',
        dailyRate: defaultDailyRate,
        totalHajriEarned: 0,
        totalEarnedAmount: 0,
        totalAdvancesPaid,
        totalWagesPaid,
        netPayableBalance: -(totalAdvancesPaid + totalWagesPaid),
        recentPayments: tempPayments.slice(0, 5),
      });
    }

    return {
      summaries,
      totalAdvancesPaidAll,
      totalHajriAll: Number(totalHajriAll.toFixed(1)),
    };
  }

  /**
   * Migrates/Updates the category of a payment between Vendor and Worker Advance.
   */
  public static async updatePaymentCategory(
    id: string,
    data: {
      category: PaymentCategory;
      workerId?: string;
      workerName?: string;
      workerCode?: string;
      paidTo?: string;
    }
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updatePayload: any = {
      category: data.category,
      updatedAt: serverTimestamp(),
    };
    if (data.workerId !== undefined) updatePayload.workerId = data.workerId;
    if (data.workerName !== undefined) updatePayload.workerName = data.workerName;
    if (data.workerCode !== undefined) updatePayload.workerCode = data.workerCode;
    if (data.paidTo !== undefined) updatePayload.paidTo = data.paidTo;

    await updateDoc(docRef, updatePayload);
  }

  /**
   * Deletes a payment record.
   */
  public static async deletePayment(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
}
