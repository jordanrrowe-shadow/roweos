/**
 * @file services/sync/index.ts
 * @feature Sync facade (v33.3 first cut)
 * @status in-progress
 *
 * WHAT IT IS
 * Typed wrapper over the existing v4 sync implementation in
 * `src/js/core/22-firebase-sync.js`. Lets v34+ callers import from
 * `services/sync` instead of touching globals (`writeDB`, `readDB`, etc.).
 *
 * WHAT IT DOES
 * - Re-exports the existing v4 functions with TypeScript signatures
 * - Adds JSDoc-derived types so future TS callers get strict checking
 * - Provides a stable public API the implementation can swap behind
 *
 * WHAT IT DOES NOT DO (yet)
 * - Replace the v4 implementation. The real `.js` files still ship via build.sh
 * - Activate sync v5. SyncV5 lives in 35-sync-v5.js, separate.
 *
 * MIGRATION ORDER (per docs/brilliance/15-architecture-playbook.md §3.2)
 * 1. v33.3 — facade + types committed (this file)
 * 2. v33.5 Sprint 1 — `// @ts-check` added to 22-firebase-sync.js + JSDoc types
 * 3. v34 — sync v5 dual-write replaces v4 calls behind this same facade
 */

declare global {
  interface Window {
    writeDB?: (path: string, data: unknown) => Promise<void>;
    readDB?: (path: string) => Promise<unknown>;
    writeDBDoc?: (collection: string, id: string, data: unknown) => Promise<void>;
    deleteDBDoc?: (collection: string, id: string) => Promise<void>;
    loadFromFirebaseV2?: () => Promise<void>;
    manualSyncNow?: () => Promise<void>;
    safeSyncWrite?: (key: string, value: unknown) => Promise<void>;
    mergeByTimestamp?: <T>(local: T[], cloud: T[], idField?: string) => T[];
    scheduleAutoSync?: (delayMs?: number) => void;
    firebaseUser?: { uid: string; email?: string; metadata?: { creationTime?: string } } | null;
    SyncV5?: unknown;
  }
}

/** Universal item envelope. v5 uses this shape; v4 callers gradually adopt it. */
export interface SyncedItem<T> {
  id: string;
  data: T;
  _modifiedAt: number;
  _createdAt: number;
  _deletedAt?: number | null;
  _clientId?: string;
  _schemaVersion?: number;
}

/** Path-style write (v4: writes to a single Firestore doc, also mirrors to localStorage). */
export async function writeDB(path: string, data: unknown): Promise<void> {
  if (typeof window === 'undefined' || !window.writeDB) {
    throw new Error('[services/sync] writeDB unavailable — v4 not loaded');
  }
  return window.writeDB(path, data);
}

/** Path-style read. */
export async function readDB(path: string): Promise<unknown> {
  if (typeof window === 'undefined' || !window.readDB) {
    throw new Error('[services/sync] readDB unavailable — v4 not loaded');
  }
  return window.readDB(path);
}

/** Subcollection doc write. */
export async function writeDBDoc(collection: string, id: string, data: unknown): Promise<void> {
  if (typeof window === 'undefined' || !window.writeDBDoc) {
    throw new Error('[services/sync] writeDBDoc unavailable — v4 not loaded');
  }
  return window.writeDBDoc(collection, id, data);
}

/** Subcollection doc delete (does NOT tombstone — caller's responsibility). */
export async function deleteDBDoc(collection: string, id: string): Promise<void> {
  if (typeof window === 'undefined' || !window.deleteDBDoc) {
    throw new Error('[services/sync] deleteDBDoc unavailable — v4 not loaded');
  }
  return window.deleteDBDoc(collection, id);
}

/** Cloud-authoritative full pull. v4 spec: cloud always wins on pull. */
export async function loadFromFirebase(): Promise<void> {
  if (typeof window === 'undefined' || !window.loadFromFirebaseV2) {
    throw new Error('[services/sync] loadFromFirebaseV2 unavailable — v4 not loaded');
  }
  return window.loadFromFirebaseV2();
}

/** Push brands first (3s wait for ghost cleanup), then pulls. v28.3 contract. */
export async function manualSyncNow(): Promise<void> {
  if (typeof window === 'undefined' || !window.manualSyncNow) {
    throw new Error('[services/sync] manualSyncNow unavailable — v4 not loaded');
  }
  return window.manualSyncNow();
}

/**
 * Per-item conflict resolution. v4 implementation handles ISO and ms timestamps.
 * v5 replaces this with last-write-wins by `_modifiedAt`, ties → `_clientId`.
 */
export function mergeByTimestamp<T>(local: T[], cloud: T[], idField: string = 'id'): T[] {
  if (typeof window === 'undefined' || !window.mergeByTimestamp) {
    // No-op fallback: prefer cloud (matches v4 cloud-authoritative stance).
    return cloud && cloud.length ? cloud : local;
  }
  return window.mergeByTimestamp<T>(local, cloud, idField);
}

/** Best-effort current Firebase user. */
export function currentUser(): { uid: string; email?: string } | null {
  if (typeof window === 'undefined' || !window.firebaseUser) return null;
  return window.firebaseUser;
}

/** Legacy global access if a caller really needs it. Avoid for new code. */
export const _legacy = {
  scheduleAutoSync: () => {
    if (typeof window !== 'undefined' && window.scheduleAutoSync) window.scheduleAutoSync();
  },
};
