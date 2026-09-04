'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  MapPin,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  MessageCircle,
  Building2,
  Navigation,
} from 'lucide-react';

type StepState =
  | 'idle'
  | 'requesting_location'
  | 'verifying'
  | 'verified'
  | 'error';

interface VerificationResult {
  siteName?: string;
  siteAddress?: string;
  distanceMeters?: number;
  radiusMeters?: number;
  checkInToken?: string;
  whatsappUrl?: string;
  error?: string;
  message?: string;
}

export default function WorkerCheckInPage() {
  const params = useParams();
  const siteToken = params?.siteToken as string;

  const [step, setStep] = useState<StepState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [result, setResult] = useState<VerificationResult | null>(null);

  const startVerification = useCallback(() => {
    if (!siteToken) {
      setStep('error');
      setErrorMessage('Invalid QR Code. No site token detected.');
      return;
    }

    if (!navigator.geolocation) {
      setStep('error');
      setErrorMessage('Your browser or phone does not support GPS Geolocation.');
      return;
    }

    setStep('requesting_location');
    setErrorMessage('');
    setErrorDetails('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setStep('verifying');

        try {
          const res = await fetch('/api/checkin/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteToken, latitude, longitude }),
          });

          const data: VerificationResult & { verified: boolean } = await res.json();

          if (data.verified && data.whatsappUrl) {
            setResult(data);
            setStep('verified');

            // Auto-redirect to WhatsApp after 1 second
            setTimeout(() => {
              window.location.href = data.whatsappUrl!;
            }, 1200);
          } else {
            setStep('error');
            if (data.error === 'OUTSIDE_GEOFENCE') {
              setErrorMessage("You're outside the allowed site area.");
              setErrorDetails(
                `Distance from site: ${Math.round(data.distanceMeters || 0)}m (Allowed: ${data.radiusMeters || 150}m)`
              );
            } else if (data.error === 'LOCATION_NOT_CONFIGURED') {
              setErrorMessage('Site location is not configured. Please contact the supervisor.');
            } else if (data.error === 'SITE_INACTIVE') {
              setErrorMessage('Check-in is currently unavailable for this site.');
            } else {
              setErrorMessage(data.message || 'Unable to verify your location. Please try again.');
            }
          }
        } catch (err: any) {
          setStep('error');
          setErrorMessage('Network or server error. Please check your connection and retry.');
        }
      },
      (geoErr) => {
        setStep('error');
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setErrorMessage('Location permission is required for site check-in.');
          setErrorDetails('Please enable location access in your browser / phone settings and tap Retry.');
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          setErrorMessage('GPS signal is currently unavailable.');
          setErrorDetails('Please ensure your phone GPS / Location is turned ON.');
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setErrorMessage('GPS request timed out. Please try again.');
        } else {
          setErrorMessage('Unable to obtain your GPS location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [siteToken]);

  useEffect(() => {
    startVerification();
  }, [startVerification]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-6 text-center">
        {/* Branding Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-extrabold uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>Site Check-In</span>
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Contractor AI</h1>
          <p className="text-xs text-slate-400">Worker Attendance via Site QR</p>
        </div>

        {/* Dynamic State Panels */}

        {/* 1. Requesting / Verifying State */}
        {(step === 'idle' || step === 'requesting_location' || step === 'verifying') && (
          <div className="py-8 space-y-4">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <Navigation className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">
                {step === 'requesting_location'
                  ? 'Requesting GPS Location...'
                  : 'Verifying Site Geofence...'}
              </h2>
              <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
                {step === 'requesting_location'
                  ? 'Please allow location permission when prompted by your phone browser.'
                  : 'Matching your physical location with the site boundary.'}
              </p>
            </div>
          </div>
        )}

        {/* 2. Verified State */}
        {step === 'verified' && result && (
          <div className="py-6 space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <ShieldCheck className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Location Verified ✅
              </span>
              <h2 className="text-lg font-extrabold text-white">{result.siteName}</h2>
              {result.siteAddress && (
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{result.siteAddress}</span>
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-3.5 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-emerald-300">Opening WhatsApp automatically...</p>
              <p className="text-[11px] text-slate-400">Send your selfie on WhatsApp to finish check-in</p>
            </div>

            <a
              href={result.whatsappUrl}
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Tap to Open WhatsApp</span>
            </a>
          </div>
        )}

        {/* 3. Error State */}
        {step === 'error' && (
          <div className="py-6 space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-rose-400">{errorMessage}</h2>
              {errorDetails && <p className="text-xs text-slate-400">{errorDetails}</p>}
            </div>

            <button
              onClick={startVerification}
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white font-bold text-xs border border-slate-700 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
          Target UX: Scan QR → Allow Location → Send Selfie → Done
        </div>
      </div>
    </div>
  );
}
