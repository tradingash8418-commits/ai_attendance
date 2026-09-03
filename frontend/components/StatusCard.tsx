import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusCardProps {
  title: string;
  statusText: string;
  isOk: boolean;
  description: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  statusText,
  isOk,
  description,
}) => {
  return (
    <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between gap-4 transition-all hover:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
          <p className="text-xl font-bold text-slate-100 mt-1">{statusText}</p>
        </div>
        <div>
          {isOk ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : (
            <AlertCircle className="w-6 h-6 text-amber-400" />
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 border-t border-slate-800/80 pt-3">{description}</p>
    </div>
  );
};
