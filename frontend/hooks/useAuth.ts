'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { AuthService } from '@/services/auth.service';
import type { AuthState } from '@/types';

export const useAuth = (): AuthState => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((user: User | null) => {
      setAuthState({
        user,
        loading: false,
        error: null,
      });
    });

    return () => unsubscribe();
  }, []);

  return authState;
};
