'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  IndianRupee,
  Building2,
  Users,
  Store,
  UserCheck,
  User,
  Activity,
  MoreHorizontal,
  X,
  ChevronRight,
  HardHat,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  desc?: string;
}

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Completely isolate worker check-in and login screens
  if (pathname?.startsWith('/checkin') || pathname === '/login') {
    return null;
  }

  const primaryItems: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { href: '/payments', label: 'Khata', icon: IndianRupee },
    { href: '/sites', label: 'Sites', icon: Building2 },
    { href: '/workers', label: 'Workers', icon: Users },
  ];

  const secondaryItems: NavItem[] = [
    { href: '/vendors', label: 'Vendors', icon: Store, desc: 'Material suppliers & payment ledger' },
    { href: '/supervisors', label: 'Supervisors', icon: UserCheck, desc: 'Manage site supervisors & WhatsApp' },
    { href: '/profile', label: 'My Profile', icon: User, desc: 'Registered contractor profile & settings' },
    { href: '/test-whatsapp', label: 'AI Diagnostics', icon: Activity, desc: 'WhatsApp API & webhook tester' },
  ];

  const allItems = [...primaryItems, ...secondaryItems];

  const isSecondaryActive = secondaryItems.some(
    (item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  );

  return (
    <>
      {/* Slide-Up "More Menu" Drawer for Mobile */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <HardHat className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm text-white">All Navigation Tabs</span>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 py-1">
              {allItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMoreMenu(false)}
                    className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                        : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-white/20' : 'bg-slate-700/60 text-blue-400'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">{item.label}</p>
                        {item.desc && <p className="text-[10px] text-slate-400 font-normal">{item.desc}</p>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar with Horizontal Scroll & Quick More Button */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 shadow-2xl">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-1">
          {/* Scrollable Main Items */}
          <div
            ref={scrollRef}
            className="flex-1 flex items-center gap-1 overflow-x-auto py-0.5 px-1 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {allItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 min-w-[62px] px-2 py-1.5 rounded-xl transition-all flex-shrink-0 ${
                    isActive
                      ? 'text-blue-400 bg-blue-500/15 font-extrabold border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] tracking-tight whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Quick "More" Trigger Button */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[54px] px-2 py-1.5 rounded-xl transition-all flex-shrink-0 border border-slate-800 ${
              isSecondaryActive || showMoreMenu
                ? 'text-blue-400 bg-blue-500/15 font-bold border-blue-500/30'
                : 'text-slate-400 bg-slate-800/60 hover:text-white'
            }`}
            title="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
            <span className="text-[10px] tracking-tight font-bold">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};
