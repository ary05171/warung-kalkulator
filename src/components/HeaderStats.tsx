import { useState, useEffect } from 'react';
import { Store, RefreshCw, Cookie } from 'lucide-react';
import { WarungDatabase } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderStatsProps {
  db: WarungDatabase;
  onOpenTermuxGuide: () => void;
  serverConnected: boolean;
  onRefreshSync: () => void;
  isSyncing: boolean;
}

export function HeaderStats({
  db,
  onOpenTermuxGuide,
  serverConnected,
  onRefreshSync,
  isSyncing,
}: HeaderStatsProps) {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header id="warung-header" className="bg-emerald-800 text-white shadow-md sticky top-0 z-30">
      {/* Top Brand Bar */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-emerald-700/60 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shadow-inner shrink-0">
            <Store className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight tracking-tight text-white truncate flex items-center gap-1.5">
              <span>{db.settings.storeName || 'Warung Kasir'}</span>
            </h1>
            <p className="text-[11px] text-emerald-200 font-medium truncate">{currentDate}</p>
          </div>
        </div>

        {/* Actions: Install PWA + Refresh + Cookie & Storage Center */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* PWA Install Button */}
          <PWAInstallButton variant="compact" />

          {/* Sync / Refresh */}
          <button
            id="btn-sync-refresh"
            onClick={onRefreshSync}
            disabled={isSyncing}
            title="Sinkronkan Cookie & Server"
            className="p-1.5 rounded-xl bg-emerald-700/70 hover:bg-emerald-600 active:scale-95 transition-all text-emerald-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Cookie & Server Modal Trigger */}
          <button
            id="btn-open-storage-modal"
            onClick={onOpenTermuxGuide}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-950 border border-emerald-600/60 text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95"
            title="Pengaturan Cookie, Offline, GitHub Pages & Termux"
          >
            <Cookie className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Cookie / DB</span>
            <span
              className={`w-2 h-2 rounded-full ${
                serverConnected ? 'bg-lime-400 animate-pulse' : 'bg-emerald-400'
              }`}
              title={serverConnected ? 'Server Termux Aktif' : 'Penyimpanan Cookie & Offline Aktif'}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
