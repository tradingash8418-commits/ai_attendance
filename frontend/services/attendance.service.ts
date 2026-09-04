import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HajriCalculatorService } from './hajri-calculator.service';
import type { AttendanceRecord } from '@/types/attendance';

const COLLECTION_NAME = 'attendanceRecords';

export class AttendanceService {
  /**
   * Retrieves all attendance records matching date and site filters.
   */
  public static async getAttendanceRecords(filters?: {
    siteId?: string;
    date?: string;
    workerId?: string;
  }): Promise<AttendanceRecord[]> {
    const colRef = collection(db, COLLECTION_NAME);

    const snapshot = await getDocs(colRef);
    let records = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as AttendanceRecord[];

    if (filters?.siteId) {
      records = records.filter((r) => r.siteId === filters.siteId);
    }
    if (filters?.date) {
      records = records.filter((r) => r.date === filters.date);
    }
    if (filters?.workerId) {
      records = records.filter((r) => r.workerId === filters.workerId);
    }

    return records;
  }

  /**
   * 1-Record Per Worker Business Logic (Latest recognized valid checkout timestamp wins!).
   * - First photo: Establishes checkInTime.
   * - Subsequent photos: Updates existing record with latest checkOutTime & time-slab matched Hajri.
   */
  public static async recordWorkerAttendance(data: {
    attendanceSessionId: string;
    workerId: string;
    siteId: string;
    date: string;
    messageTimestamp?: number; // Authoritative WhatsApp message timestamp (ms)
    attendancePhotoUrl: string;
    submittedBy: string;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const eventDate = data.messageTimestamp ? new Date(data.messageTimestamp) : new Date();

    // Query existing record for (workerId, siteId, date)
    const q = query(
      colRef,
      where('workerId', '==', data.workerId),
      where('siteId', '==', data.siteId),
      where('date', '==', data.date)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty && snapshot.docs[0]) {
      // -------------------------------------------------------------
      // SUBSEQUENT PHOTO: Update existing single worker record
      // -------------------------------------------------------------
      const existingDoc = snapshot.docs[0];
      const existingData = existingDoc.data();
      const existingId = existingDoc.id;

      // Extract check-in date
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

      // Latest timestamp wins!
      const checkOutDate = eventDate;

      // Calculate Hajri based strictly on checkout time-slab
      const hajriResult = HajriCalculatorService.calculateHajriFromCheckoutTimestamp(
        checkInDate,
        checkOutDate
      );

      console.log(
        `[AttendanceService] Updating attendance record for worker ${data.workerId}: ` +
        `Check-out=${checkOutDate.toISOString()}, Hajri=${hajriResult.hajri} (${hajriResult.label})`
      );

      const docRef = doc(db, COLLECTION_NAME, existingId);
      await updateDoc(docRef, {
        checkOutTime: checkOutDate.toISOString(),
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
      // -------------------------------------------------------------
      // FIRST RECOGNIZED PHOTO: Create new worker record (Check-In)
      // -------------------------------------------------------------
      const checkInDate = eventDate;
      
      // Calculate initial Hajri for check-in photo
      const hajriResult = HajriCalculatorService.calculateHajriFromCheckoutTimestamp(
        checkInDate,
        checkInDate
      );

      console.log(
        `[AttendanceService] Creating initial check-in record for worker ${data.workerId}: ` +
        `Check-in=${checkInDate.toISOString()}, Initial Hajri=${hajriResult.hajri} (${hajriResult.label})`
      );

      const newDoc = await addDoc(colRef, {
        attendanceSessionId: data.attendanceSessionId,
        workerId: data.workerId,
        siteId: data.siteId,
        date: data.date,
        checkInTime: checkInDate.toISOString(),
        checkOutTime: null,
        status: hajriResult.status === 'matched' ? 'present' : 'unmatched',
        method: 'face_recognition',
        confidence: 0.95,
        verificationStatus: 'verified',
        attendancePhotoUrl: data.attendancePhotoUrl,
        submittedBy: data.submittedBy,
        hajri: hajriResult.hajri,
        hajriLabel: hajriResult.label,
        ruleName: hajriResult.ruleName,
        workedMinutes: 0,
        workedHours: 'In Progress',
        createdAt: now,
        updatedAt: now,
      });

      return newDoc.id;
    }
  }
}
