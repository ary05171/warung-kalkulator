import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-status-banner"
      className="fixed top-2 left-3 right-3 z-50 max-w-sm mx-auto flex items-center justify-between gap-2 rounded-2xl bg-amber-600/95 text-white px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur-xs border border-amber-400/40 animate-in slide-in-from-top duration-200"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-amber-100 shrink-0" />
        <span className="text-[11px] leading-tight">
          Mode Offline Aktif — Transaksi & data tersimpan di Cookie / Memori HP
        </span>
      </div>
      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
        Lokal
      </span>
    </div>
  );
};
