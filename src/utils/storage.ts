import { WarungDatabase } from '../types';
import { INITIAL_DATABASE } from '../data/initialData';
import {
  saveDatabaseToCookies,
  loadDatabaseFromCookies,
  isGitHubPagesOrStaticHost,
} from './cookieStorage';

const LOCAL_STORAGE_KEY = 'warung_db_store_v1';

export function getLocalDatabase(): WarungDatabase {
  try {
    // 1. Check localStorage first
    let raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    let parsed: any = null;

    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    // 2. If localStorage is empty, check Cookies
    if (!parsed) {
      const fromCookie = loadDatabaseFromCookies();
      if (fromCookie) {
        parsed = fromCookie;
        // Mirror to localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fromCookie));
        }
      }
    }

    // 3. Fallback to INITIAL_DATABASE
    if (!parsed) {
      saveLocalDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }

    // Ensure all required fields exist
    return {
      products: parsed.products || INITIAL_DATABASE.products,
      transactions: parsed.transactions || [],
      cashEntries: parsed.cashEntries || [],
      suppliers: parsed.suppliers || INITIAL_DATABASE.suppliers,
      debts: parsed.debts || [],
      settings: parsed.settings || INITIAL_DATABASE.settings,
    };
  } catch (err) {
    console.error('Failed to load local DB:', err);
    return INITIAL_DATABASE;
  }
}

export function saveLocalDatabase(db: WarungDatabase): void {
  try {
    // 1. Save to localStorage for instant local access
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
    }
    // 2. Save directly to Browser Cookies (with multi-chunk support)
    saveDatabaseToCookies(db);
  } catch (err) {
    console.error('Failed to save database locally:', err);
  }
}

// Asynchronously try to fetch from Express server (Termux / local server)
export async function fetchServerDatabase(): Promise<WarungDatabase | null> {
  // If running on GitHub Pages or static host, skip server request
  if (isGitHubPagesOrStaticHost()) {
    return null;
  }

  try {
    const res = await fetch('/api/db', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.products) {
        saveLocalDatabase(data);
        return data;
      }
    }
  } catch {
    // Server is either offline, on GitHub Pages, or client is standalone
  }
  return null;
}

// Asynchronously sync current database to local server (if available)
export async function syncDatabaseToServer(db: WarungDatabase): Promise<boolean> {
  saveLocalDatabase(db);

  if (isGitHubPagesOrStaticHost()) {
    // On static host, local/cookie persistence is considered 100% active and healthy
    return false;
  }

  try {
    const res = await fetch('/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatRupiah(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'Rp 0';
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Math.round(val).toLocaleString('id-ID');
}

export function exportDatabaseAsJSON(db: WarungDatabase): void {
  const jsonStr = JSON.stringify(db, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup_warung_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
