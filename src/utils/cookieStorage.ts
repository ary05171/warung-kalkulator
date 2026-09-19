import { WarungDatabase } from '../types';

const CHUNK_SIZE = 3500; // Safe chunk size under 4KB per cookie
const COOKIE_PREFIX = 'warung_ck_';
const META_COOKIE = 'warung_ck_meta';
const SETTINGS_COOKIE = 'warung_store_profile';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + encodeURIComponent(name) + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  // SameSite=Lax for compatibility and offline navigation
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

/**
 * Save Warung Database into browser Cookies
 * Supports chunking across multiple cookies if data exceeds standard 4KB cookie limit.
 */
export function saveDatabaseToCookies(db: WarungDatabase): { success: boolean; chunksCount: number; bytes: number; error?: string } {
  if (typeof document === 'undefined') return { success: false, chunksCount: 0, bytes: 0 };
  try {
    // 1. Save store settings in dedicated readable cookie
    setCookie(SETTINGS_COOKIE, JSON.stringify(db.settings), 365);

    // 2. Serialize full database
    const jsonStr = JSON.stringify(db);
    const totalBytes = jsonStr.length;
    const numChunks = Math.ceil(totalBytes / CHUNK_SIZE);

    // Some browsers cap total cookies per domain at ~30-50 cookies (~120KB)
    if (numChunks > 30) {
      console.warn(`Database size (${totalBytes} bytes) exceeds standard browser cookie quota. Data will be safely preserved in LocalStorage/IndexedDB.`);
    }

    // Save previous meta to cleanup orphaned chunks if size shrank
    const prevMetaRaw = getCookie(META_COOKIE);
    let prevChunksCount = 0;
    if (prevMetaRaw) {
      try {
        const parsed = JSON.parse(prevMetaRaw);
        prevChunksCount = parsed.chunks || 0;
      } catch {
        // ignore
      }
    }

    // Write chunks
    for (let i = 0; i < numChunks; i++) {
      const chunk = jsonStr.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      setCookie(`${COOKIE_PREFIX}${i}`, chunk, 365);
    }

    // Remove any leftover chunks
    for (let i = numChunks; i < prevChunksCount; i++) {
      deleteCookie(`${COOKIE_PREFIX}${i}`);
    }

    // Save meta cookie
    const meta = {
      chunks: numChunks,
      totalBytes,
      updatedAt: Date.now(),
    };
    setCookie(META_COOKIE, JSON.stringify(meta), 365);

    return { success: true, chunksCount: numChunks, bytes: totalBytes };
  } catch (err) {
    console.error('Failed to write to cookies:', err);
    return { success: false, chunksCount: 0, bytes: 0, error: String(err) };
  }
}

/**
 * Load Warung Database from browser Cookies
 */
export function loadDatabaseFromCookies(): WarungDatabase | null {
  if (typeof document === 'undefined') return null;
  try {
    const metaRaw = getCookie(META_COOKIE);
    if (!metaRaw) return null;

    const meta = JSON.parse(metaRaw);
    if (!meta || !meta.chunks || meta.chunks <= 0) return null;

    let reconstructed = '';
    for (let i = 0; i < meta.chunks; i++) {
      const chunk = getCookie(`${COOKIE_PREFIX}${i}`);
      if (chunk === null) {
        console.warn(`Missing cookie chunk ${i} during restore.`);
        return null;
      }
      reconstructed += chunk;
    }

    const parsed = JSON.parse(reconstructed);
    if (parsed && parsed.products) {
      return parsed as WarungDatabase;
    }
  } catch (err) {
    console.error('Failed to read database from cookies:', err);
  }
  return null;
}

export interface CookieStorageInfo {
  totalBytes: number;
  cookieCount: number;
  warungCookieCount: number;
  items: { name: string; size: number }[];
}

/**
 * Inspect all currently active cookies in document.cookie
 */
export function getCookieStorageInfo(): CookieStorageInfo {
  if (typeof document === 'undefined' || !document.cookie) {
    return { totalBytes: 0, cookieCount: 0, warungCookieCount: 0, items: [] };
  }

  const rawCookies = document.cookie.split(';');
  let totalBytes = 0;
  let warungCookieCount = 0;
  const items: { name: string; size: number }[] = [];

  for (const c of rawCookies) {
    const trimmed = c.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    const name = eqIdx > -1 ? decodeURIComponent(trimmed.slice(0, eqIdx)) : trimmed;
    const value = eqIdx > -1 ? trimmed.slice(eqIdx + 1) : '';
    const size = name.length + value.length;
    totalBytes += size;

    if (name.startsWith('warung_')) {
      warungCookieCount++;
    }

    items.push({ name, size });
  }

  return {
    totalBytes,
    cookieCount: items.length,
    warungCookieCount,
    items,
  };
}

/**
 * Clear all warung-related cookies
 */
export function clearWarungCookies(): void {
  const metaRaw = getCookie(META_COOKIE);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      for (let i = 0; i < (meta.chunks || 10); i++) {
        deleteCookie(`${COOKIE_PREFIX}${i}`);
      }
    } catch {
      // ignore
    }
  }
  deleteCookie(META_COOKIE);
  deleteCookie(SETTINGS_COOKIE);
}

/**
 * Helper to test if running on static host (e.g. GitHub Pages or file:// or Vercel static)
 */
export function isGitHubPagesOrStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('github.io') || window.location.protocol === 'file:';
}
