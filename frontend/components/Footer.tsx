'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export const Footer: React.FC = () => {
  const pathname = usePathname();

  // Completely isolate worker check-in and login screens
  if (pathname?.startsWith('/checkin') || pathname === '/login') {
    return null;
  }
  return (
    <footer className="border-t border-slate-200 bg-white py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs font-medium text-slate-500">
          © {new Date().getFullYear()} Averox AI. Construction Workforce OS.
        </p>

      </div>
    </footer>
  );
};
