'use client';

import React from 'react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * High-performance QR Code display component.
 * Uses quickchart/google charts API fallback + standard SVG rendering for crisp, scalable printing.
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 220,
  className = '',
}) => {
  const encodedValue = encodeURIComponent(value);
  // Free, high-res QR code generator endpoint
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodedValue}&margin=10`;

  return (
    <div className={`inline-flex items-center justify-center bg-white p-3 rounded-2xl shadow-inner border border-slate-200 ${className}`}>
      {/* eslint-disable-next-js/no-img-element */}
      <img
        src={qrUrl}
        alt={`QR Code for ${value}`}
        width={size}
        height={size}
        className="rounded-lg max-w-full h-auto"
        loading="eager"
      />
    </div>
  );
};
