import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as standalone PWA, don't show prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        onClick={install}
        className={`flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs transition-all shadow-xs ${
          variant === 'compact' ? 'px-2.5 py-1 text-[11px]' : 'w-full py-2.5 px-3 justify-center'
        } ${className}`}
        title="Pasang aplikasi ke layar utama HP"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 active:scale-95 text-white font-semibold text-xs transition-all ${
            variant === 'compact' ? 'px-2 py-1 text-[11px]' : 'w-full py-2.5 px-3 justify-center'
          } ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Pasang di HP</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 p-5 shadow-2xl text-stone-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Pasang di iPhone / iPad</span>
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-stone-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-stone-300">
                <div className="flex items-start gap-2 bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                  <Share className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    1. Ketuk tombol <strong>Bagikan (Share)</strong> di bilah navigasi bawah Safari.
                  </span>
                </div>
                <div className="flex items-start gap-2 bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                  <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    2. Geser ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold text-white shadow-md"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
