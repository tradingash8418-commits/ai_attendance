import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  QueryConstraint,
  CollectionReference,
  DocumentReference,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const DEFAULT_ORG_ID = 'org_primary';

export class OrgContextService {
  private static currentOrgId: string = DEFAULT_ORG_ID;

  /**
   * Gets current Organization ID context.
   */
  public static getOrgId(): string {
    return this.currentOrgId;
  }

  /**
   * Sets current Organization ID context.
   */
  public static setOrgId(orgId: string): void {
    if (orgId && orgId.trim()) {
      this.currentOrgId = orgId.trim();
    }
  }

  /**
   * Returns a sub-collection reference under organizations/{orgId}/{collectionName}
   */
  public static getCollection(
    collectionName: string,
    orgId: string = this.getOrgId(),
    customDb: Firestore = db
  ): CollectionReference<DocumentData> {
    return collection(customDb, 'organizations', orgId, collectionName);
  }

  /**
   * Returns a document reference under organizations/{orgId}/{collectionName}/{docId}
   */
  public static getDocRef(
    collectionName: string,
    docId: string,
    orgId: string = this.getOrgId(),
    customDb: Firestore = db
  ): DocumentReference<DocumentData> {
    return doc(customDb, 'organizations', orgId, collectionName, docId);
  }

  /**
   * Dual-read fallback helper:
   * 1. Checks organizations/{orgId}/{collectionName}/{docId}
   * 2. If not found, falls back to legacy root collection/{docId} (ONLY for org_primary)
   */
  public static async getDocWithFallback(
    collectionName: string,
    docId: string,
    orgId: string = this.getOrgId(),
    customDb: Firestore = db
  ): Promise<{ data: DocumentData | null; isLegacy: boolean; ref: DocumentReference<DocumentData> }> {
    const orgDocRef = this.getDocRef(collectionName, docId, orgId, customDb);
    const orgSnap = await getDoc(orgDocRef);

    if (orgSnap.exists()) {
      return { data: orgSnap.data(), isLegacy: false, ref: orgDocRef };
    }

    // Fallback to legacy root collection ONLY for default org_primary
    if (orgId === DEFAULT_ORG_ID) {
      const legacyDocRef = doc(customDb, collectionName, docId);
      const legacySnap = await getDoc(legacyDocRef);

      if (legacySnap.exists()) {
        return { data: legacySnap.data(), isLegacy: true, ref: legacyDocRef };
      }
    }

    return { data: null, isLegacy: false, ref: orgDocRef };
  }

  /**
   * Dual-read fallback collection query helper:
   * Fetches docs from organizations/{orgId}/{collectionName}, and if empty, checks legacy root (ONLY for org_primary).
   */
  public static async getDocsWithFallback(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    orgId: string = this.getOrgId(),
    customDb: Firestore = db
  ): Promise<DocumentData[]> {
    const orgColRef = this.getCollection(collectionName, orgId, customDb);
    const orgQuery = query(orgColRef, ...constraints);
    const orgSnap = await getDocs(orgQuery);

    if (!orgSnap.empty) {
      return orgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    // Fallback to legacy root collection ONLY for default org_primary
    if (orgId === DEFAULT_ORG_ID) {
      const legacyColRef = collection(customDb, collectionName);
      const legacyQuery = query(legacyColRef, ...constraints);
      const legacySnap = await getDocs(legacyQuery);

      return legacySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    return [];
  }
}
