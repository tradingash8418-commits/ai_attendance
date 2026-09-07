'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { AuthService } from '@/services/auth.service';
import { UserProfileService } from '@/services/user-profile.service';
import { OrgContextService, DEFAULT_ORG_ID } from '@/services/org-context.service';
import type { AuthState } from '@/types';

export const useAuth = (): AuthState => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userProfile: null,
    organizationId: DEFAULT_ORG_ID,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange(async (user: User | null) => {
      if (user) {
        try {
          const profile = await UserProfileService.getOrCreateUserProfile(user);
          setAuthState({
            user,
            userProfile: profile,
            organizationId: profile.organizationId,
            loading: false,
            error: null,
          });
        } catch (err: any) {
          console.error('[useAuth] Error fetching tenant profile:', err);
          OrgContextService.setOrgId(DEFAULT_ORG_ID);
          setAuthState({
            user,
            userProfile: null,
            organizationId: DEFAULT_ORG_ID,
            loading: false,
            error: err?.message || 'Profile resolution error',
          });
        }
      } else {
        OrgContextService.setOrgId(DEFAULT_ORG_ID);
        setAuthState({
          user: null,
          userProfile: null,
          organizationId: DEFAULT_ORG_ID,
          loading: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return authState;
};
