'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  X,
  Search,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

import { RecycleBinService, type RecycleBinItem } from '@/services/recycle-bin.service';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemRestored?: () => void;
}

export default function RecycleBinModal({
  isOpen,
  onClose,
  onItemRestored,
}: RecycleBinModalProps) {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [emptying, setEmptying] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadRecycleBin = useCallback(async () => {
    setLoading(true);
    try {
      const data = await RecycleBinService.getRecycleBinItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load recycle bin items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRecycleBin();
      setActionSuccess(null);
    }
  }, [isOpen, loadRecycleBin]);

  if (!isOpen) return null;

  const handleRestore = async (item: RecycleBinItem) => {
    setRestoringId(item.id);
    setActionSuccess(null);
    try {
      await RecycleBinService.restoreItem(item.id);
      setActionSuccess(`Restored "${item.title}" successfully!`);
      await loadRecycleBin();
      if (onItemRestored) onItemRestored();
    } catch (err) {
      console.error('Error restoring item:', err);
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete "${item.title}"? This action cannot be undone.`)) return;
    setPurgingId(item.id);
    setActionSuccess(null);
    try {
      await RecycleBinService.permanentlyDeleteItem(item.id);
      setActionSuccess(`Permanently deleted "${item.title}".`);
      await loadRecycleBin();
      if (onItemRestored) onItemRestored();
    } catch (err) {
      console.error('Error deleting item permanently:', err);
    } finally {
      setPurgingId(null);
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (!confirm('Are you sure you want to EMPTY the entire Recycle Bin? All deleted records will be permanently removed!')) return;
    setEmptying(true);
    setActionSuccess(null);
    try {
      await RecycleBinService.emptyRecycleBin();
      setActionSuccess('Recycle Bin emptied successfully!');
      await loadRecycleBin();
      if (onItemRestored) onItemRestored();
    } catch (err) {
      console.error('Error emptying recycle bin:', err);
    } finally {
      setEmptying(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.originalCollection && item.originalCollection.toLowerCase().includes(q))
    );
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'payment':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'worker':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'site':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'attendance':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Contractor Recycle Bin</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {items.length} Items
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Accidentally deleted payments, workers or records can be restored here anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadRecycleBin}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Bar & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search deleted items..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {items.length > 0 && (
            <button
              onClick={handleEmptyRecycleBin}
              disabled={emptying}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{emptying ? 'Emptying...' : 'Empty Recycle Bin'}</span>
            </button>
          )}
        </div>

        {/* Success Alert Banner */}
        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Items List Container */}
        <div className="flex-1 overflow-y-auto min-h-[250px] space-y-2 pr-1">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading Recycle Bin...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Trash2 className="w-10 h-10 text-slate-200 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Recycle Bin is empty</p>
              <p className="text-xs text-slate-400">Any deleted payments or records will appear here for recovery.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase border ${getCategoryBadge(
                        item.category
                      )}`}
                    >
                      {item.category || item.originalCollection}
                    </span>
                    <h3 className="font-extrabold text-xs text-slate-900">{item.title}</h3>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Deleted by: <span className="text-slate-600 font-semibold">{item.deletedBy || 'Contractor'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restoringId === item.id ? 'animate-spin' : ''}`} />
                    <span>{restoringId === item.id ? 'Restoring...' : 'Restore'}</span>
                  </button>

                  <button
                    onClick={() => handlePermanentDelete(item)}
                    disabled={purgingId === item.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
