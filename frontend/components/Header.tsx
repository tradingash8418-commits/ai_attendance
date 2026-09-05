'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  HardHat,
  LayoutDashboard,
  CalendarCheck,
  Building2,
  Users,
  UserCheck,
  Activity,
  Bell,
  LogOut,
  ChevronDown,
  IndianRupee,
  Store,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/services/auth.service';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [showProfileDropdown, setShowProfileDropdown] = useState<boolean>(false);

  // Completely isolate worker check-in and login screens from any navigation/header
  if (pathname?.startsWith('/checkin') || pathname === '/login') {
    return null;
  }

  const navLinks = [
    { href: '/dashboard', label: 'Contractor Home', icon: LayoutDashboard },
    { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { href: '/payments', label: 'Khata / Payments', icon: IndianRupee },
    { href: '/sites', label: 'Sites', icon: Building2 },
    { href: '/workers', label: 'Workers', icon: Users },
    { href: '/vendors', label: 'Vendors', icon: Store },
    { href: '/supervisors', label: 'Supervisors', icon: UserCheck },
    { href: '/test-whatsapp', label: 'AI Diagnostics', icon: Activity },
  ];

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setShowProfileDropdown(false);
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const userInitials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'CA';

  return (
    <header className="bg-[#0b0f19] text-white border-b border-slate-800/80 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block leading-none">
                  Contractor <span className="text-blue-400">AI</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block mt-0.5">
                  Workforce OS
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-inner'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Mode Pill & User Profile */}
          <div className="flex items-center gap-3">
            {/* Live System Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span>
              <span className="text-[11px] tracking-wider uppercase text-emerald-400">LIVE MODE</span>
            </div>

            {/* Notifications Bell */}
            <button className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500"></span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown((prev) => !prev)}
                className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-xs text-white shadow-md">
                  {userInitials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-800/80">
                    <p className="font-extrabold text-white truncate">
                      {user?.displayName || 'Contractor Admin'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email || 'admin@contractor.ai'}</p>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-semibold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
