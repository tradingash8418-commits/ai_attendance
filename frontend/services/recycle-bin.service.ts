import {
  addDoc,
  deleteDoc,
  setDoc,
  doc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { OrgContextService } from './org-context.service';

const COLLECTION_NAME = 'recycleBin';

export interface RecycleBinItem {
  id: string;
  organizationId: string;
  originalCollection: string;
  originalId: string;
  itemData: any;
  title: string;
  category: 'payment' | 'worker' | 'site' | 'attendance' | 'vendor' | 'other';
  deletedAt: any;
  deletedBy?: string;
}

export class RecycleBinService {
  /**
   * Soft-deletes an item by moving a copy to recycleBin collection, then removing from original collection.
   */
  public static async moveToRecycleBin(
    originalCollection: string,
    originalId: string,
    itemData: any,
    title: string,
    category: 'payment' | 'worker' | 'site' | 'attendance' | 'vendor' | 'other' = 'other',
    deletedBy = 'Contractor Admin',
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();

    // Clean itemData if needed to ensure pure plain object
    const cleanItemData = JSON.parse(JSON.stringify(itemData || {}));

    // 1. Save snapshot into recycleBin collection
    const recycleDoc = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
      originalCollection,
      originalId,
      itemData: cleanItemData,
      title,
      category,
      deletedAt: now,
      deletedBy,
    });

    // 2. Delete from original collection
    const origDoc = await OrgContextService.getDocWithFallback(originalCollection, originalId, orgId);
    await deleteDoc(origDoc.ref);

    return recycleDoc.id;
  }

  /**
   * Gets all deleted items in Recycle Bin for the contractor.
   */
  public static async getRecycleBinItems(orgId?: string): Promise<RecycleBinItem[]> {
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [orderBy('deletedAt', 'desc')],
      orgId
    );
    return docs.map((d) => ({
      id: d.id,
      ...d,
    })) as RecycleBinItem[];
  }

  /**
   * Restores a deleted item back to its original collection.
   */
  public static async restoreItem(recycleItemId: string, orgId?: string): Promise<void> {
    const recycleDoc = await OrgContextService.getDocWithFallback(COLLECTION_NAME, recycleItemId, orgId);
    const data = recycleDoc.data as RecycleBinItem;
    if (!data || !data.originalCollection || !data.originalId || !data.itemData) return;


    // 1. Re-create doc in original collection with original ID
    const origColRef = OrgContextService.getCollection(data.originalCollection, orgId);
    const origDocRef = doc(origColRef, data.originalId);

    const restorePayload = {
      ...data.itemData,
      updatedAt: serverTimestamp(),
      restoredAt: serverTimestamp(),
    };
    await setDoc(origDocRef, restorePayload);

    // 2. Delete from recycleBin
    await deleteDoc(recycleDoc.ref);
  }

  /**
   * Permanently deletes an item from Recycle Bin.
   */
  public static async permanentlyDeleteItem(recycleItemId: string, orgId?: string): Promise<void> {
    const recycleDoc = await OrgContextService.getDocWithFallback(COLLECTION_NAME, recycleItemId, orgId);
    await deleteDoc(recycleDoc.ref);
  }

  /**
   * Empties all items in the Recycle Bin.
   */
  public static async emptyRecycleBin(orgId?: string): Promise<void> {
    const items = await this.getRecycleBinItems(orgId);
    for (const item of items) {
      await this.permanentlyDeleteItem(item.id, orgId);
    }
  }
}
