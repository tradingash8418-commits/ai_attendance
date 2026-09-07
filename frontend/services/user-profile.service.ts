import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrgContextService } from './org-context.service';
import { SupervisorsService } from './supervisors.service';
import { normalizeWhatsAppNumber } from '@/lib/formatters';
import type { User } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName?: string;
  whatsappNumber?: string;
  phone?: string;
  role: 'admin' | 'supervisor' | 'viewer';
  createdAt?: any;
  updatedAt?: any;
}

export class UserProfileService {
  /**
   * Retrieves user profile from root users collection by Auth UID.
   */
  public static async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!uid) return null;
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (data.organizationId) {
          OrgContextService.setOrgId(data.organizationId);
        }
        return data;
      }
      return null;
    } catch (err) {
      console.error('[UserProfileService] Error fetching user profile:', err);
      return null;
    }
  }

  /**
   * Gets or provisions a new isolated tenant profile for a signed-up user.
   */
  public static async getOrCreateUserProfile(
    user: User,
    extraData?: { whatsappNumber?: string; phone?: string }
  ): Promise<UserProfile> {
    const existing = await this.getUserProfile(user.uid);
    const normalizedWa = extraData?.whatsappNumber ? normalizeWhatsAppNumber(extraData.whatsappNumber) : '';

    if (existing) {
      // If extraData provides a whatsappNumber and existing profile is missing it or different, update Firestore!
      if (normalizedWa && (!existing.whatsappNumber || existing.whatsappNumber !== normalizedWa)) {
        existing.whatsappNumber = normalizedWa;
        existing.phone = extraData?.phone?.trim() || normalizedWa;

        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { whatsappNumber: normalizedWa, phone: existing.phone }, { merge: true });

        const orgDocRef = doc(db, 'organizations', existing.organizationId);
        await setDoc(orgDocRef, { ownerWhatsApp: normalizedWa }, { merge: true });

        // Auto-register primary supervisor
        try {
          await SupervisorsService.createSupervisor(
            {
              name: existing.displayName || 'Contractor Admin',
              whatsappNumber: normalizedWa,
              email: existing.email,
              phone: existing.phone,
            },
            existing.organizationId
          );
          console.log(`[UserProfileService] Updated existing profile & auto-registered supervisor for ${normalizedWa}`);
        } catch (supErr) {
          console.warn('[UserProfileService] Error creating supervisor on existing profile:', supErr);
        }
      }

      // Also fetch organization name
      try {
        const orgRef = doc(db, 'organizations', existing.organizationId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          existing.organizationName = orgSnap.data().name || 'Construction Company';
        }
      } catch (orgErr) {
        console.warn('[UserProfileService] Error fetching org details:', orgErr);
      }
      OrgContextService.setOrgId(existing.organizationId);
      return existing;
    }

    // Standardized tenant Organization ID for every contractor: org_${user.uid}
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const orgId = `org_${user.uid}`;
    const companyName = user.displayName
      ? `${user.displayName.trim()}'s Infra`
      : `${cleanEmail.split('@')[0] || 'Contractor'}'s Infra`;

    // 1. Provision Organization document
    const orgDocRef = doc(db, 'organizations', orgId);
    await setDoc(
      orgDocRef,
      {
        id: orgId,
        name: companyName,
        ownerUid: user.uid,
        ownerEmail: cleanEmail,
        ownerWhatsApp: normalizedWa || '',
        plan: 'free_trial',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 2. Provision User Profile document
    const newProfile: UserProfile = {
      uid: user.uid,
      email: cleanEmail,
      displayName: user.displayName || cleanEmail.split('@')[0] || 'Contractor',
      organizationId: orgId,
      organizationName: companyName,
      whatsappNumber: normalizedWa || '',
      phone: extraData?.phone?.trim() || normalizedWa || '',
      role: 'admin',
      createdAt: new Date().toISOString(),
    };

    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, newProfile, { merge: true });

    // 3. Inject new Org ID into OrgContextService
    OrgContextService.setOrgId(orgId);

    // 4. Auto-register Contractor as primary supervisor so WhatsApp messages/screenshots map to this orgId
    if (normalizedWa) {
      try {
        await SupervisorsService.createSupervisor(
          {
            name: newProfile.displayName,
            whatsappNumber: normalizedWa,
            email: cleanEmail,
            phone: newProfile.phone,
          },
          orgId
        );
        console.log(`[UserProfileService] Auto-registered primary supervisor for contractor WhatsApp ${normalizedWa}`);
      } catch (supErr) {
        console.warn('[UserProfileService] Could not auto-create supervisor record:', supErr);
      }
    }

    console.log(`[UserProfileService] Provisioned standardized tenant org "${orgId}" for ${cleanEmail}`);
    return newProfile;
  }

  /**
   * Updates organization name in Firestore.
   */
  public static async updateOrganizationName(orgId: string, newName: string): Promise<void> {
    if (!orgId || !newName.trim()) return;
    const orgDocRef = doc(db, 'organizations', orgId);
    await setDoc(
      orgDocRef,
      {
        name: newName.trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  /**
   * Updates user profile fields in Firestore and auto-syncs supervisor record if WhatsApp number is updated.
   */
  public static async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>
  ): Promise<void> {
    if (!uid) return;
    const userRef = doc(db, 'users', uid);
    const updateData: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };

    if (updates.whatsappNumber) {
      const normalizedWa = normalizeWhatsAppNumber(updates.whatsappNumber);
      updateData.whatsappNumber = normalizedWa;
      updateData.phone = updates.phone?.trim() || normalizedWa;
    }

    await setDoc(userRef, updateData, { merge: true });

    // Sync supervisor record
    const updatedProfile = await this.getUserProfile(uid);
    if (updatedProfile?.whatsappNumber && updatedProfile?.organizationId) {
      try {
        await SupervisorsService.createSupervisor(
          {
            name: updatedProfile.displayName || 'Contractor Admin',
            whatsappNumber: updatedProfile.whatsappNumber,
            email: updatedProfile.email,
            phone: updatedProfile.phone,
          },
          updatedProfile.organizationId
        );
      } catch (err) {
        console.warn('[UserProfileService] Error syncing supervisor record:', err);
      }
    }
  }
}
