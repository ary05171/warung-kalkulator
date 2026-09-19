import { useState, useRef, useEffect } from 'react';
import { WarungDatabase, Product } from '../types';
import { exportDatabaseAsJSON, saveLocalDatabase } from '../utils/storage';
import { exportProductsAsZip, importProductsFromZip } from '../utils/zipExportImport';
import {
  saveDatabaseToCookies,
  loadDatabaseFromCookies,
  getCookieStorageInfo,
  clearWarungCookies,
  CookieStorageInfo,
} from '../utils/cookieStorage';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Terminal,
  Database,
  Download,
  Upload,
  Copy,
  Check,
  X,
  Server,
  Settings,
  HardDrive,
  Cookie,
  Globe,
  Wifi,
  Smartphone,
  RefreshCw,
  Trash2,
  FileArchive,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from 'lucide-react';

interface TermuxLocalModalProps {
  db: WarungDatabase;
  onUpdateSettings: (settings: WarungDatabase['settings']) => void;
  onRestoreDatabase: (restoredDb: WarungDatabase) => void;
  onClose: () => void;
  serverConnected: boolean;
  onClearAllProducts: () => void;
  onResetAllHistory: () => void;
  onFactoryResetAll: () => void;
  onImportProducts: (products: Product[], replaceMode?: boolean) => void;
}

type TabType = 'cookie' | 'github' | 'termux' | 'database' | 'settings';

export function TermuxLocalModal({
  db,
  onUpdateSettings,
  onRestoreDatabase,
  onClose,
  serverConnected,
  onClearAllProducts,
  onResetAllHistory,
  onFactoryResetAll,
  onImportProducts,
}: TermuxLocalModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('cookie');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // ZIP state
  const [isZipExporting, setIsZipExporting] = useState(false);
  const [isZipImporting, setIsZipImporting] = useState(false);
  const [zipStatusMessage, setZipStatusMessage] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Cookie storage info state
  const [cookieInfo, setCookieInfo] = useState<CookieStorageInfo>({
    totalBytes: 0,
    cookieCount: 0,
    warungCookieCount: 0,
    items: [],
  });
  const [cookieActionStatus, setCookieActionStatus] = useState<string | null>(null);

  // Settings form
  const [storeName, setStoreName] = useState(db.settings.storeName);
  const [storeAddress, setStoreAddress] = useState(db.settings.storeAddress);
  const [storePhone, setStorePhone] = useState(db.settings.storePhone);
  const [receiptFooter, setReceiptFooter] = useState(db.settings.receiptFooter);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshCookieStats = () => {
    setCookieInfo(getCookieStorageInfo());
  };

  useEffect(() => {
    refreshCookieStats();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleSaveToCookie = () => {
    const res = saveDatabaseToCookies(db);
    saveLocalDatabase(db);
    refreshCookieStats();
    if (res.success) {
      setCookieActionStatus(`Berhasil disimpan ke Cookie! (${res.chunksCount} chunk, ${res.bytes} byte)`);
    } else {
      setCookieActionStatus(`Gagal menyimpan: ${res.error || 'Quota terlampaui'}`);
    }
    setTimeout(() => setCookieActionStatus(null), 3500);
  };

  const handleRestoreFromCookie = () => {
    const restored = loadDatabaseFromCookies();
    if (restored && restored.products) {
      if (confirm('Pulihkan database dari Cookie peramban ini?')) {
        onRestoreDatabase(restored);
        setCookieActionStatus('Database berhasil dipulihkan dari Cookie!');
        setTimeout(() => setCookieActionStatus(null), 3000);
      }
    } else {
      alert('Tidak ditemukan data warung lengkap di Cookie peramban.');
    }
  };

  const handleClearCookies = () => {
    if (confirm('Hapus cookie penyimpanan warung di peramban ini? (Data cadangan di memori lokal tetap ada)')) {
      clearWarungCookies();
      refreshCookieStats();
      setCookieActionStatus('Cookie warung dibersihkan.');
      setTimeout(() => setCookieActionStatus(null), 3000);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      storeName: storeName.trim(),
      storeAddress: storeAddress.trim(),
      storePhone: storePhone.trim(),
      receiptFooter: receiptFooter.trim(),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.products) {
          if (confirm('Pulihkan database dari file backup ini? Data saat ini akan diperbarui.')) {
            onRestoreDatabase(parsed);
            alert('Database berhasil dipulihkan!');
          }
        } else {
          alert('Format file backup JSON tidak sesuai.');
        }
      } catch {
        alert('Gagal membaca file JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="storage-modal-card"
        className="w-full max-w-lg bg-stone-900 text-stone-100 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-stone-800"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-lime-400 shrink-0">
              <Cookie className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Penyimpanan, Cookie & Hosting</h3>
              <p className="text-[10px] text-stone-400">Offline-first • Cookie Browser • GitHub Pages • Termux</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher - Scrollable horizontally on small phones */}
        <div className="px-3 pt-2 pb-2 bg-stone-950/90 border-b border-stone-800 flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('cookie')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'cookie'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-800/80 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Cookie & Offline</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'github'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-800/80 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>GitHub Pages</span>
          </button>

          <button
            onClick={() => setActiveTab('termux')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'termux'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-800/80 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Termux</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'database'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-800/80 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup File</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-800/80 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Profil Toko</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: COOKIE & OFFLINE */}
          {activeTab === 'cookie' && (
            <div className="space-y-3.5">
              {/* Status Banner */}
              <div className="p-3.5 bg-stone-950 rounded-2xl border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-bold text-white text-xs">
                      Penyimpanan Cookie & Offline Aktif
                    </span>
                  </div>
                  <button
                    onClick={refreshCookieStats}
                    className="p-1 text-stone-400 hover:text-stone-200 rounded-lg bg-stone-800"
                    title="Segarkan info cookie"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Data warung otomatis disinkronkan ke <strong>Cookie peramban</strong> dan{' '}
                  <strong>Penyimpanan Lokal (Offline Cache)</strong> di perangkat Anda. Aplikasi dapat
                  dibuka dan dipakai <strong>100% tanpa internet</strong> (kuota mati).
                </p>
              </div>

              {/* Install PWA Prompt Box */}
              <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-800/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700/40 border border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">Pasang ke Layar Utama HP</div>
                    <div className="text-[11px] text-emerald-300/80">
                      Buka langsung seperti aplikasi HP tanpa buka peramban
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <PWAInstallButton variant="compact" />
                </div>
              </div>

              {/* Cookie Live Stats */}
              <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-2">
                <div className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                  <Cookie className="w-3.5 h-3.5 text-amber-400" />
                  <span>Statistik Cookie Peramban (document.cookie)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-stone-900 p-2.5 rounded-xl">
                    <span className="text-stone-400 block text-[10px]">Total Ukuran Cookie:</span>
                    <span className="font-bold text-emerald-300 text-sm">
                      {(cookieInfo.totalBytes / 1024).toFixed(2)} KB
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      ({cookieInfo.totalBytes} karakter)
                    </span>
                  </div>

                  <div className="bg-stone-900 p-2.5 rounded-xl">
                    <span className="text-stone-400 block text-[10px]">Jumlah Cookie Warung:</span>
                    <span className="font-bold text-emerald-300 text-sm">
                      {cookieInfo.warungCookieCount} cookie
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      (Chunking otomatis &lt;4KB)
                    </span>
                  </div>
                </div>

                {cookieActionStatus && (
                  <div className="p-2 bg-emerald-900/60 border border-emerald-500 text-emerald-200 rounded-xl text-[11px] font-semibold text-center animate-in fade-in">
                    {cookieActionStatus}
                  </div>
                )}

                {/* Cookie Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSaveToCookie}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan ke Cookie</span>
                  </button>

                  <button
                    onClick={handleRestoreFromCookie}
                    className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Pulihkan dari Cookie</span>
                  </button>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={handleClearCookies}
                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Cookie Warung</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GITHUB PAGES HOSTING */}
          {activeTab === 'github' && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-stone-950 rounded-2xl border border-stone-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Host Gratis di GitHub Pages (Tanpa Sewa Server)</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Karena aplikasi ini didesain <strong>100% Client-Side & Offline-First</strong> (data
                  disimpan di Cookie/LocalStorage), Anda dapat meng-hosting aplikasi ini secara{' '}
                  <strong>GRATIS selamanya</strong> di GitHub Pages tanpa butuh server Node.js!
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Panduan Lengkap: Setelah Anda Commit di Git</span>
                </div>

                {/* Step 1: Push ke GitHub */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1">
                  <div className="font-semibold text-stone-200 flex items-center justify-between">
                    <span>1. Push perubahan setelah commit ke GitHub:</span>
                    <button
                      onClick={() => copyToClipboard('git push origin main', 'gh_push')}
                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-[10px] flex items-center gap-1"
                    >
                      {copiedCmd === 'gh_push' ? <Check className="w-3 h-3 text-lime-400" /> : <Copy className="w-3 h-3" />}
                      <span>Salin</span>
                    </button>
                  </div>
                  <pre className="p-2 bg-black/60 rounded-lg text-lime-300 font-mono text-[11px] overflow-x-auto">
                    git push origin main
                  </pre>
                  <p className="text-[10px] text-stone-400">
                    Atau jika branch Anda bernama <code className="text-emerald-300">master</code>, gunakan <code className="text-emerald-300">git push origin master</code>.
                  </p>
                </div>

                {/* Step 2: Aktifkan GitHub Pages Otomatis */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1.5">
                  <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Aktifkan GitHub Pages (1x Setup saja):</span>
                  </div>
                  <ol className="text-[11px] text-stone-300 space-y-1 pl-4 list-decimal">
                    <li>Buka halaman repository GitHub Anda di browser.</li>
                    <li>Klik tab <strong>Settings</strong> di menu atas repository.</li>
                    <li>Di bilah sisi kiri, klik menu <strong>Pages</strong>.</li>
                    <li>
                      Di bagian <strong>Build and deployment &gt; Source</strong>, ganti pilihan menjadi{' '}
                      <span className="text-emerald-300 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700">GitHub Actions</span>.
                    </li>
                  </ol>
                  <p className="text-[10px] text-stone-400 bg-stone-900/90 p-2 rounded-lg border border-stone-800">
                    File otomatisasi <code className="text-emerald-300">.github/workflows/deploy.yml</code> sudah tersedia di dalam proyek ini. Setiap kali Anda commit & push, GitHub akan otomatis membangun dan menerbitkan aplikasi ke web tanpa perlu server berbayar!
                  </p>
                </div>

                {/* Step 3: Lihat Hasil Deployment */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1.5">
                  <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>Alamat Web Aplikasi Anda:</span>
                  </div>
                  <div className="p-2.5 bg-black/60 rounded-lg text-emerald-300 font-mono text-[11px] flex items-center justify-between">
                    <span>https://&lt;username&gt;.github.io/&lt;nama-repository&gt;/</span>
                  </div>
                  <p className="text-[10px] text-stone-400">
                    Dalam 1-2 menit setelah push, web warung Anda langsung online dan bisa diakses dari HP kasir manapun.
                  </p>
                </div>

                {/* Step 4: Jika Mau Jalankan Sebagai Node.js Server Lokal / Termux dari GitHub */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1.5">
                  <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span>Opsi: Menjalankan Server Node.js Lokal (Termux/VPS):</span>
                  </div>
                  <p className="text-[10px] text-stone-400">
                    Jika Anda ingin menjalankan server backend Express di HP (Termux) atau VPS:
                  </p>
                  <pre className="p-2 bg-black/60 rounded-lg text-amber-300 font-mono text-[10.5px] overflow-x-auto space-y-0.5">
                    git clone https://github.com/&lt;user&gt;/&lt;repo&gt;.git{'\n'}
                    cd &lt;repo&gt;{'\n'}
                    npm install{'\n'}
                    npm run build{'\n'}
                    npm start
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SERVER TERMUX */}
          {activeTab === 'termux' && (
            <div className="space-y-3.5">
              {/* Status Banner */}
              <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      serverConnected ? 'bg-lime-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <div>
                    <div className="font-bold text-white text-xs">
                      {serverConnected
                        ? 'Tersambung ke Server Termux (Port 3000)'
                        : 'Mode Mandiri (Cookie & Offline Browser)'}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {serverConnected
                        ? 'Sinkronisasi aktif ke data/warung_db.json di HP Termux'
                        : 'Menyimpan di Cookie & Memori HP tanpa memerlukan server terpisah'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Termux Steps */}
              <div className="space-y-2.5">
                <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                  <Server className="w-4 h-4" />
                  <span>Cara Menjalankan Server Termux di HP Android:</span>
                </div>

                {/* Step 1 */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1">
                  <div className="font-semibold text-stone-200 flex items-center justify-between">
                    <span>1. Install Node.js di Termux:</span>
                    <button
                      onClick={() => copyToClipboard('pkg update && pkg install nodejs git -y', 'step1')}
                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-[10px] flex items-center gap-1"
                    >
                      {copiedCmd === 'step1' ? <Check className="w-3 h-3 text-lime-400" /> : <Copy className="w-3 h-3" />}
                      <span>Salin</span>
                    </button>
                  </div>
                  <pre className="p-2 bg-black/60 rounded-lg text-lime-300 font-mono text-[11px] overflow-x-auto">
                    pkg update && pkg install nodejs git -y
                  </pre>
                </div>

                {/* Step 2 */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1">
                  <div className="font-semibold text-stone-200 flex items-center justify-between">
                    <span>2. Pasang dependensi aplikasi:</span>
                    <button
                      onClick={() => copyToClipboard('npm install', 'step2')}
                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-[10px] flex items-center gap-1"
                    >
                      {copiedCmd === 'step2' ? <Check className="w-3 h-3 text-lime-400" /> : <Copy className="w-3 h-3" />}
                      <span>Salin</span>
                    </button>
                  </div>
                  <pre className="p-2 bg-black/60 rounded-lg text-lime-300 font-mono text-[11px] overflow-x-auto">
                    npm install
                  </pre>
                </div>

                {/* Step 3 */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1">
                  <div className="font-semibold text-stone-200 flex items-center justify-between">
                    <span>3. Jalankan server kasir:</span>
                    <button
                      onClick={() => copyToClipboard('node server.ts', 'step3')}
                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-[10px] flex items-center gap-1"
                    >
                      {copiedCmd === 'step3' ? <Check className="w-3 h-3 text-lime-400" /> : <Copy className="w-3 h-3" />}
                      <span>Salin</span>
                    </button>
                  </div>
                  <pre className="p-2 bg-black/60 rounded-lg text-lime-300 font-mono text-[11px] overflow-x-auto">
                    node server.ts
                  </pre>
                </div>

                {/* Step 4 */}
                <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-1">
                  <div className="font-semibold text-stone-200">
                    <span>4. Buka di Chrome / Browser HP:</span>
                  </div>
                  <div className="p-2 bg-black/60 rounded-lg text-emerald-300 font-mono text-[11px]">
                    http://localhost:3000
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    *Bisa diakses dari HP atau tablet lain yang terhubung ke hotspot WiFi/tethering HP Termux Anda (misal: http://192.168.43.1:3000).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE BACKUP / RESTORE */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-white">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span>Ringkasan Data Tersimpan</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="bg-stone-900 p-2 rounded-lg">
                    <span className="text-stone-400 block">Jumlah Produk:</span>
                    <span className="font-bold text-emerald-300 text-sm">{db.products.length}</span>
                  </div>
                  <div className="bg-stone-900 p-2 rounded-lg">
                    <span className="text-stone-400 block">Riwayat Transaksi:</span>
                    <span className="font-bold text-emerald-300 text-sm">{db.transactions.length}</span>
                  </div>
                  <div className="bg-stone-900 p-2 rounded-lg">
                    <span className="text-stone-400 block">Catatan Arus Kas:</span>
                    <span className="font-bold text-emerald-300 text-sm">{db.cashEntries.length}</span>
                  </div>
                  <div className="bg-stone-900 p-2 rounded-lg">
                    <span className="text-stone-400 block">Catatan Hutang:</span>
                    <span className="font-bold text-amber-300 text-sm">{db.debts.length}</span>
                  </div>
                </div>
              </div>

              {/* Section 1: Paket ZIP Produk (Config JSON + Gambar) */}
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <FileArchive className="w-4 h-4 text-emerald-400" />
                    <span>Paket ZIP List Produk (Config + Folder Gambar)</span>
                  </div>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Ekspor/impor katalog produk dalam format <strong>.ZIP</strong> yang berisi file konfigurasi{' '}
                  <code className="text-emerald-300">products.json</code> dan folder{' '}
                  <code className="text-emerald-300">images/</code> berisi foto asli produk.
                </p>

                {/* Hidden input for zip */}
                <input
                  type="file"
                  ref={zipInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsZipImporting(true);
                    try {
                      const res = await importProductsFromZip(file);
                      if (res.products.length === 0) {
                        alert('Tidak ada data produk di dalam file ZIP.');
                        return;
                      }
                      const replace = confirm(
                        `Ditemukan ${res.products.length} produk dan ${res.imageCount} file foto dari ZIP.\n\n` +
                        `• Klik "OK" untuk MENGGANTIKAN seluruh produk saat ini.\n` +
                        `• Klik "Batal" untuk MENGGABUNGKAN dengan produk yang sudah ada.`
                      );
                      onImportProducts(res.products, replace);
                      setZipStatusMessage(`Sukses! ${res.products.length} produk & ${res.imageCount} foto dimuat dari ZIP.`);
                      setTimeout(() => setZipStatusMessage(null), 4000);
                    } catch (err) {
                      alert('Gagal impor ZIP: ' + (err as Error).message);
                    } finally {
                      setIsZipImporting(false);
                      if (zipInputRef.current) zipInputRef.current.value = '';
                    }
                  }}
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className="hidden"
                />

                {zipStatusMessage && (
                  <div className="p-2 bg-emerald-900/60 border border-emerald-500 text-emerald-200 rounded-xl text-[11px] font-semibold text-center animate-in fade-in">
                    {zipStatusMessage}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    id="btn-zip-export-modal"
                    onClick={async () => {
                      if (db.products.length === 0) {
                        alert('Katalog produk masih kosong.');
                        return;
                      }
                      setIsZipExporting(true);
                      try {
                        await exportProductsAsZip(db.products);
                        setZipStatusMessage(`File ZIP berhasil didownload (${db.products.length} produk + foto)!`);
                        setTimeout(() => setZipStatusMessage(null), 4000);
                      } catch (err) {
                        alert('Gagal mengekspor ZIP: ' + (err as Error).message);
                      } finally {
                        setIsZipExporting(false);
                      }
                    }}
                    disabled={isZipExporting}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    {isZipExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Ekspor ZIP Produk</span>
                  </button>

                  <button
                    id="btn-zip-import-modal"
                    onClick={() => zipInputRef.current?.click()}
                    disabled={isZipImporting}
                    className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    {isZipImporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Impor ZIP Produk</span>
                  </button>
                </div>
              </div>

              {/* Section 2: Backup Database Lengkap (.json) */}
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Backup & Pulihkan Database Lengkap (.json)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    id="btn-backup-download"
                    onClick={() => exportDatabaseAsJSON(db)}
                    className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download .JSON</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    accept=".json,application/json"
                    className="hidden"
                  />
                  <button
                    id="btn-backup-restore"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pulihkan .JSON</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Reset & Bersihkan Data */}
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-rose-900/50 space-y-3">
                <div className="flex items-center gap-2 font-bold text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Zona Pembersihan & Reset Data</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Pilih fitur pembersihan sesuai kebutuhan. Tindakan ini tidak dapat dibatalkan:
                </p>

                <div className="space-y-2 pt-1">
                  {/* Option A: Bersihkan Semua Barang */}
                  <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-xs">Bersihkan Semua Barang</div>
                      <div className="text-[10px] text-stone-400">
                        Hapus seluruh katalog produk ({db.products.length} produk). Riwayat transaksi tetap aman.
                      </div>
                    </div>
                    <button
                      onClick={onClearAllProducts}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 text-xs font-bold shrink-0 active:scale-95 transition-all"
                    >
                      Hapus Barang
                    </button>
                  </div>

                  {/* Option B: Reset Riwayat Keseluruhan */}
                  <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-xs">Reset Riwayat Keseluruhan</div>
                      <div className="text-[10px] text-stone-400">
                        Kosongkan riwayat transaksi ({db.transactions.length}), buku kas ({db.cashEntries.length}), & bon hutang. Produk tetap aman.
                      </div>
                    </div>
                    <button
                      onClick={onResetAllHistory}
                      className="px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-200 text-xs font-bold shrink-0 active:scale-95 transition-all"
                    >
                      Reset Riwayat
                    </button>
                  </div>

                  {/* Option C: Reset Total Pabrik */}
                  <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-rose-300 text-xs">Reset Total Pabrik</div>
                      <div className="text-[10px] text-stone-400">
                        Kosongkan seluruh data aplikasi (katalog produk, riwayat, kas, dan hutang).
                      </div>
                    </div>
                    <button
                      onClick={onFactoryResetAll}
                      className="px-3 py-1.5 rounded-xl bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold shrink-0 active:scale-95 transition-all shadow-xs"
                    >
                      Reset Total
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Nama Warung / Toko:
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Alamat Warung:
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Nomor WhatsApp Toko:
                </label>
                <input
                  type="text"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Pesan Catatan Kaki di Struk:
                </label>
                <input
                  type="text"
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  {settingsSaved ? (
                    <>
                      <Check className="w-4 h-4 text-lime-300" />
                      <span>Tersimpan!</span>
                    </>
                  ) : (
                    <span>Simpan Pengaturan Toko</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-stone-950 border-t border-stone-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
