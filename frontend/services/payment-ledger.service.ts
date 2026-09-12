import {
  addDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { WorkersService } from './workers.service';
import { AttendanceService } from './attendance.service';
import { OrgContextService } from './org-context.service';
import { RecycleBinService } from './recycle-bin.service';
import { compareWorkerCodes } from '@/lib/formatters';
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
  public static async recordPayment(
    data: {
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
    },
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();

    const recipientName = (data.paidTo || data.workerName || 'Unknown').trim();

    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
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
  public static async getPayments(
    filters?: {
      workerId?: string;
      siteId?: string;
      date?: string;
    },
    orgId?: string
  ): Promise<PaymentLedgerEntry[]> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [orderBy('paymentDate', 'desc')],
      targetOrg
    );

    let entries = docs.map((d) => ({
      id: d.id,
      ...d,
      paidTo: d.paidTo || d.workerName || 'Recipient',
    })) as PaymentLedgerEntry[];

    if (targetOrg !== 'org_primary') {
      try {
        const primaryDocs = await OrgContextService.getDocsWithFallback(
          COLLECTION_NAME,
          [orderBy('paymentDate', 'desc')],
          'org_primary'
        );
        const existingIds = new Set(entries.map((e) => e.id));
        for (const pd of primaryDocs) {
          if (!existingIds.has(pd.id)) {
            entries.push({
              id: pd.id,
              ...pd,
              paidTo: pd.paidTo || pd.workerName || 'Recipient',
            } as PaymentLedgerEntry);
          }
        }
      } catch (e) {}
    }

    if (filters?.workerId) {
      entries = entries.filter((e) => e.workerId === filters.workerId);
    }
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
   * Supports optional date range filtering for Month-End / Week-End consolidated charts.
   */
  public static async getAllWorkersKhataSummary(
    defaultDailyRate = 0,
    dateRange?: { startDate?: string; endDate?: string },
    orgId?: string
  ): Promise<{
    summaries: WorkerKhataSummary[];
    totalAdvancesPaidAll: number;
    totalHajriAll: number;
  }> {
    const [workers, allAttendanceRecords, allPayments] = await Promise.all([
      WorkersService.getWorkers(orgId),
      AttendanceService.getAttendanceRecords(undefined, orgId),
      this.getPayments(undefined, orgId),
    ]);

    const attendanceRecords = allAttendanceRecords.filter((r) => {
      if (!dateRange?.startDate && !dateRange?.endDate) return true;
      if (dateRange.startDate && r.date < dateRange.startDate) return false;
      if (dateRange.endDate && r.date > dateRange.endDate) return false;
      return true;
    });

    const payments = allPayments.filter((p) => {
      if (!dateRange?.startDate && !dateRange?.endDate) return true;
      if (dateRange.startDate && p.paymentDate < dateRange.startDate) return false;
      if (dateRange.endDate && p.paymentDate > dateRange.endDate) return false;
      return true;
    });

    let totalAdvancesPaidAll = 0;
    let totalHajriAll = 0;

    const summaries: WorkerKhataSummary[] = workers.map((worker) => {
      const workerRecords = attendanceRecords.filter(
        (r) => r.workerId === worker.id || r.workerId === worker.workerCode
      );
      const totalHajriEarned = workerRecords.reduce((sum, r) => {
        const h = typeof r.hajri === 'number' ? r.hajri : 0;
        return sum + h;
      }, 0);


      const workerPayments = payments.filter(
        (p) => p.workerId === worker.id || (worker.workerCode && p.workerCode === worker.workerCode)
      );

      const totalAdvancesPaid = workerPayments
        .filter((p) => p.category === 'advance' || p.category === 'kharcha')
        .reduce((sum, p) => sum + p.amount, 0);

      const totalWagesPaid = workerPayments
        .filter((p) => p.category === 'wage')
        .reduce((sum, p) => sum + p.amount, 0);

      const workerDailyRate = typeof worker.dailyRate === 'number' && worker.dailyRate >= 0 ? worker.dailyRate : defaultDailyRate;
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

    summaries.sort((a, b) => {
      const aTemp = a.workerId.startsWith('temp_');
      const bTemp = b.workerId.startsWith('temp_');
      if (aTemp && !bTemp) return 1;
      if (!aTemp && bTemp) return -1;
      return compareWorkerCodes(a, b);
    });

    return {
      summaries,
      totalAdvancesPaidAll,
      totalHajriAll: Number(totalHajriAll.toFixed(1)),
    };
  }

  /**
   * Updates any details of a payment (amount, category, payee name, method, notes, date, upiId, etc.).
   */
  public static async updatePayment(
    id: string,
    data: {
      amount?: number;
      category?: PaymentCategory;
      workerId?: string;
      workerName?: string;
      workerCode?: string;
      paidTo?: string;
      paymentMethod?: PaymentMethod;
      paymentDate?: string;
      paymentTime?: string;
      notes?: string;
      upiId?: string;
      isEditedByContractor?: boolean;
    },
    orgId?: string
  ): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    const updatePayload: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(res.ref, updatePayload);
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
      amount?: number;
      notes?: string;
    },
    orgId?: string
  ): Promise<void> {
    await this.updatePayment(id, data, orgId);
  }

  /**
   * Soft-deletes a payment record by moving it to the Recycle Bin.
   */
  public static async deletePayment(id: string, orgId?: string): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    const data = res.data;
    if (!data) return;

    const amountFormatted = typeof data.amount === 'number' ? `₹${data.amount.toLocaleString('en-IN')}` : '';
    const recipient = data.paidTo || data.workerName || 'Payment Record';
    const title = `Payment Entry: ${recipient} - ${amountFormatted} (${(data.category || 'advance').toUpperCase()})`;

    await RecycleBinService.moveToRecycleBin(
      COLLECTION_NAME,
      id,
      data,
      title,
      'payment',
      'Contractor Admin',
      orgId
    );
  }
}


