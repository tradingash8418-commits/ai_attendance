import {
  addDoc,
  updateDoc,
  where,
  QueryConstraint,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { HajriCalculatorService } from './hajri-calculator.service';
import { OrgContextService } from './org-context.service';
import type { AttendanceRecord } from '@/types/attendance';
import { SitesService } from './sites.service';
import { WorkersService } from './workers.service';

const COLLECTION_NAME = 'attendanceRecords';

export interface TodayDashboardSummary {
  presentCount: number;
  expectedCount: number;
  percentage: number;
  totalHajriToday: number;
  aiRecognitionAccuracy: number;
  siteSummaries: Array<{
    siteId: string;
    siteName: string;
    presentCount: number;
    expectedCount: number;
    totalHajri: number;
  }>;
}

export class AttendanceService {
  /**
   * Generates aggregated attendance metrics for the contractor dashboard.
   */
  public static async getTodayDashboardSummary(date: string, orgId?: string): Promise<TodayDashboardSummary> {
    const [records, sites, workers] = await Promise.all([
      this.getAttendanceRecords({ date }, orgId),
      SitesService.getSites(orgId),
      WorkersService.getWorkers(orgId),
    ]);

    const presentWorkers = new Set(records.map((r) => r.workerId));
    const presentCount = presentWorkers.size;
    const expectedCount = workers.length;
    const percentage = expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 0;

    // Real sum of all Hajri recorded across all workers today (Only checked out workers or manual overwrites have non-zero Hajri)
    const totalHajriToday = records.reduce((sum, r) => {
      const val = typeof r.hajri === 'number' ? r.hajri : 0;
      return sum + val;
    }, 0);

    const verifiedRecordsCount = records.filter((r) => r.verificationStatus === 'verified').length;
    const aiRecognitionAccuracy = records.length > 0
      ? Math.round((verifiedRecordsCount / records.length) * 100)
      : 100;

    const siteSummaries = sites.map((site) => {
      const siteRecords = records.filter((r) => r.siteId === site.id);
      const sitePresentWorkers = new Set(siteRecords.map((r) => r.workerId));
      const sitePresentCount = sitePresentWorkers.size;
      const siteHajri = siteRecords.reduce((sum, r) => sum + (typeof r.hajri === 'number' ? r.hajri : 0), 0);

      return {
        siteId: site.id,
        siteName: site.name,
        presentCount: sitePresentCount,
        expectedCount: workers.length,
        totalHajri: Number(siteHajri.toFixed(1)),
      };
    });

    return {
      presentCount,
      expectedCount,
      percentage,
      totalHajriToday: Number(totalHajriToday.toFixed(1)),
      aiRecognitionAccuracy,
      siteSummaries,
    };
  }

  /**
   * Retrieves all attendance records matching date and site filters.
   */
  public static async getAttendanceRecords(
    filters?: {
      siteId?: string;
      date?: string;
      workerId?: string;
    },
    orgId?: string
  ): Promise<AttendanceRecord[]> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const constraints: QueryConstraint[] = [];

    if (filters?.date) {
      constraints.push(where('date', '==', filters.date));
    }
    if (filters?.workerId) {
      constraints.push(where('workerId', '==', filters.workerId));
    }
    if (filters?.siteId) {
      constraints.push(where('siteId', '==', filters.siteId));
    }

    const docs = await OrgContextService.getDocsWithFallback(COLLECTION_NAME, constraints, targetOrg);
    let records = docs.map((d) => ({
      id: d.id,
      ...d,
    })) as AttendanceRecord[];

    return records;
  }

  /**
   * 1-Record Per Worker Business Logic:
   * - Initial Photo (Check-In): Establishes checkInTime, sets Hajri = 0 ("In Progress").
   * - Subsequent Photo (Check-Out): Sets checkOutTime & evaluates time-slab rules strictly on checkout timestamp.
   */
  public static async recordWorkerAttendance(
    data: {
      attendanceSessionId: string;
      workerId: string;
      siteId: string;
      date: string;
      messageTimestamp?: number;
      attendancePhotoUrl: string;
      submittedBy: string;
      method?: string;
    },
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();
    const eventDate = data.messageTimestamp ? new Date(data.messageTimestamp) : new Date();

    const existingRecords = await this.getAttendanceRecords(
      { workerId: data.workerId, date: data.date },
      orgId
    );

    if (existingRecords.length > 0 && existingRecords[0]) {
      const existingData = existingRecords[0];
      const existingId = existingData.id;

      let checkInDate = eventDate;
      if (existingData.checkInTime) {
        if (existingData.checkInTime instanceof Timestamp) {
          checkInDate = existingData.checkInTime.toDate();
        } else if (typeof existingData.checkInTime === 'string') {
          checkInDate = new Date(existingData.checkInTime);
        } else if (typeof existingData.checkInTime === 'number') {
          checkInDate = new Date(existingData.checkInTime);
        }
      }

      const checkOutDate = eventDate;
      const hajriResult = HajriCalculatorService.calculateHajriFromCheckoutTimestamp(
        checkInDate,
        checkOutDate
      );

      console.log(
        `[AttendanceService] Check-out recorded for worker ${data.workerId}: ` +
        `Check-out=${checkOutDate.toISOString()}, Hajri=${hajriResult.hajri} (${hajriResult.label})`
      );

      const docRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, existingId, orgId);
      await updateDoc(docRes.ref, {
        checkOutTime: checkOutDate.toISOString(),
        checkOutSiteId: data.siteId,
        attendancePhotoUrl: data.attendancePhotoUrl,
        hajri: hajriResult.hajri,
        hajriLabel: hajriResult.label,
        ruleName: hajriResult.ruleName,
        workedMinutes: hajriResult.workedMinutes,
        workedHours: hajriResult.workedHours,
        status: hajriResult.status === 'matched' ? 'present' : 'unmatched',
        updatedAt: now,
      });

      return existingId;
    } else {
      const checkInDate = eventDate;

      console.log(
        `[AttendanceService] Initial Check-In recorded for worker ${data.workerId}: ` +
        `Check-in=${checkInDate.toISOString()}, Hajri=0 (In Progress - Pending Check-Out)`
      );

      const newDoc = await addDoc(colRef, {
        organizationId: orgId || OrgContextService.getOrgId(),
        attendanceSessionId: data.attendanceSessionId,
        workerId: data.workerId,
        siteId: data.siteId,
        date: data.date,
        checkInTime: checkInDate.toISOString(),
        checkOutTime: null,
        status: 'present',
        method: data.method || 'face_recognition',
        confidence: 0.95,
        verificationStatus: 'verified',
        attendancePhotoUrl: data.attendancePhotoUrl,
        submittedBy: data.submittedBy,
        hajri: 0,
        hajriLabel: 'In Progress',
        ruleName: 'Initial Check-In (Pending Check-Out)',
        workedMinutes: 0,
        workedHours: 'In Progress',
        createdAt: now,
        updatedAt: now,
      });

      return newDoc.id;
    }
  }


  /**
   * Overwrites or updates an attendance record manually by contractor.
   */
  public static async updateAttendanceRecord(
    attendanceId: string,
    data: {
      checkInTime?: string | null;
      checkOutTime?: string | null;
      hajri?: number;
      hajriLabel?: string;
      status?: 'present' | 'unmatched' | 'absent';
      workedHours?: string;
      verificationStatus?: string;
      isOverwrittenByContractor?: boolean;
      overwriteReason?: string;
    },
    orgId?: string
  ): Promise<void> {
    const docRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, attendanceId, orgId);
    const now = serverTimestamp();
    await updateDoc(docRes.ref, {
      ...data,
      updatedAt: now,
    });
  }

  /**
   * Overwrites or creates a manual attendance record for a specific worker and date from calendar/admin interface.
   */
  public static async saveManualAttendanceRecord(
    data: {
      workerId: string;
      siteId: string;
      date: string; // YYYY-MM-DD
      hajri: number;
      hajriLabel?: string;
      checkInTime?: string;
      checkOutTime?: string;
      notes?: string;
      submittedBy?: string;
    },
    orgId?: string
  ): Promise<string> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const existing = await this.getAttendanceRecords({ workerId: data.workerId, date: data.date }, targetOrg);
    const now = serverTimestamp();
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, targetOrg);

    const checkInIso = data.checkInTime || `${data.date}T09:00:00.000Z`;
    const checkOutIso = data.checkOutTime || `${data.date}T18:00:00.000Z`;

    let label = data.hajriLabel;
    if (!label) {
      if (data.hajri === 0) label = '0.0 Hajri (Absent / Short)';
      else if (data.hajri === 0.5) label = '0.5 Hajri (Half Day)';
      else if (data.hajri === 1.0) label = '1.0 Hajri (Full Day)';
      else if (data.hajri === 1.5) label = '1.5 Hajri (Dedhi)';
      else if (data.hajri === 2.0) label = '2.0 Hajri (Double)';
      else if (data.hajri === 2.5) label = '2.5 Hajri (Dhai)';
      else if (data.hajri === 3.0) label = '3.0 Hajri (Three)';
      else label = `${data.hajri} Hajri`;
    }

    if (existing.length > 0 && existing[0]) {
      const existingId = existing[0].id;
      const docRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, existingId, targetOrg);
      await updateDoc(docRes.ref, {
        siteId: data.siteId,
        hajri: data.hajri,
        hajriLabel: label,
        status: data.hajri > 0 ? 'present' : 'absent',
        checkInTime: checkInIso,
        checkOutTime: data.hajri > 0 ? checkOutIso : null,
        verificationStatus: 'verified',
        method: 'manual_admin_calendar',
        isOverwrittenByContractor: true,
        overwriteReason: data.notes || 'Manual Admin Calendar Update',
        updatedAt: now,
      });
      return existingId;
    } else {
      const newDoc = await addDoc(colRef, {
        organizationId: targetOrg,
        workerId: data.workerId,
        siteId: data.siteId,
        date: data.date,
        checkInTime: checkInIso,
        checkOutTime: data.hajri > 0 ? checkOutIso : null,
        status: data.hajri > 0 ? 'present' : 'absent',
        method: 'manual_admin_calendar',
        confidence: 1.0,
        verificationStatus: 'verified',
        submittedBy: data.submittedBy || 'Contractor Admin',
        hajri: data.hajri,
        hajriLabel: label,
        ruleName: 'Manual Admin Calendar Entry',
        isOverwrittenByContractor: true,
        overwriteReason: data.notes || 'Manual Admin Calendar Entry',
        createdAt: now,
        updatedAt: now,
      });
      return newDoc.id;
    }
  }
}

