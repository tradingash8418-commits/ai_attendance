'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { HardHat } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute =
    pathname === '/login' ||
    pathname?.startsWith('/checkin') ||
    pathname?.startsWith('/api/');

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace('/login');
    }
  }, [user, loading, isPublicRoute, router]);

  // Public routes (login and worker QR check-in) are always accessible immediately
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Loading state while verifying Firebase Auth session
  if (loading) {
    return (
      <div className="flex-1 min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 animate-pulse">
          <HardHat className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-extrabold text-slate-800 tracking-tight">Contractor AI</p>
          <p className="text-xs text-slate-500">Verifying secure session...</p>
        </div>
      </div>
    );
  }

  // If unauthenticated on protected route, show nothing while redirecting
  if (!user) {
    return null;
  }

  return <>{children}</>;
};
