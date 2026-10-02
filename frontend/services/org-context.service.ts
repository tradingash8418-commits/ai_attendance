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
   * Scoped document read helper:
   * Checks organizations/{orgId}/{collectionName}/{docId}
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

    return { data: null, isLegacy: false, ref: orgDocRef };
  }

  /**
   * Scoped collection query helper:
   * Executes constraints directly on organizations/{orgId}/{collectionName}.
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

    if (orgSnap.empty) {
      return [];
    }

    return orgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}
