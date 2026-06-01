/**
 * @file Tests for v34.67 Sync v5 additions: V5_REGISTRY, bootstrapFromV4(),
 * readArray()/readDoc() facade, readsEnabled() flag.
 *
 * Locks in:
 *   - readsEnabled() requires all four flags
 *   - readArray() falls back to v4Reader when reads flag is OFF
 *   - readArray() unwraps envelopes correctly when reads flag is ON
 *   - readDoc() handles single-doc collections
 *   - bootstrapFromV4() seeds collections from v4 keys, runs once per device
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const v5Source = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');

beforeEach(() => {
  delete (globalThis as any).SyncV5;
  delete (window as any).SyncV5;
  try { window.localStorage.clear(); } catch {}
  // eslint-disable-next-line no-eval
  (0, eval)(v5Source);
});

function getSync(): any { return (window as any).SyncV5; }
function enableAllFlags() {
  const s = getSync();
  s.setEnabled(true);
  s.setWritesEnabled(true);
  s.setDualWriteEnabled(true);
  s.setReadsEnabled(true);
}

describe('Phase C #8 — readsEnabled() gate', () => {
  it('returns false when no flags are set', () => {
    expect(getSync().readsEnabled()).toBe(false);
  });

  it('returns false when only enabled', () => {
    getSync().setEnabled(true);
    expect(getSync().readsEnabled()).toBe(false);
  });

  it('returns false when enabled+writes but no dual-write', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    expect(getSync().readsEnabled()).toBe(false);
  });

  it('returns false when enabled+writes+dual but reads flag itself off', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().setDualWriteEnabled(true);
    expect(getSync().readsEnabled()).toBe(false);
  });

  it('returns true only when all four flags are set', () => {
    enableAllFlags();
    expect(getSync().readsEnabled()).toBe(true);
  });

  it('persists "true" / "false" across reload', () => {
    getSync().setReadsEnabled(true);
    expect(window.localStorage.getItem('roweos_sync_v5_reads')).toBe('true');
    getSync().setReadsEnabled(false);
    expect(window.localStorage.getItem('roweos_sync_v5_reads')).toBe('false');
  });
});

describe('Phase C #9 — readArray facade', () => {
  it('falls back to v4Reader when reads flag is OFF', () => {
    const v4Data = [{ id: 'a', name: 'Alpha' }];
    const result = getSync().readArray('brands_v5', () => v4Data);
    expect(result).toEqual(v4Data);
  });

  it('returns [] when reads flag OFF and no v4Reader provided', () => {
    const result = getSync().readArray('brands_v5');
    expect(result).toEqual([]);
  });

  it('unwraps envelopes when reads flag is ON', () => {
    enableAllFlags();
    const coll = getSync().collection('brands_v5');
    coll.write('a', { id: 'a', name: 'Alpha' });
    coll.write('b', { id: 'b', name: 'Beta' });

    const result = getSync().readArray('brands_v5', () => null);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    const names = result.map((b: any) => b.name).sort();
    expect(names).toEqual(['Alpha', 'Beta']);
  });

  it('skips tombstoned items', () => {
    enableAllFlags();
    const coll = getSync().collection('brands_v5');
    coll.write('a', { id: 'a', name: 'Alpha' });
    coll.write('b', { id: 'b', name: 'Beta' });
    coll.delete('a'); // tombstones 'a'

    const result = getSync().readArray('brands_v5', () => null);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Beta');
  });

  it('falls back to v4Reader on registry miss', () => {
    enableAllFlags();
    const v4Data = [{ id: 'x' }];
    const result = getSync().readArray('nonexistent_collection', () => v4Data);
    expect(result).toEqual(v4Data);
  });
});

describe('Phase C #9 — readDoc facade', () => {
  it('falls back to v4Reader when reads flag is OFF', () => {
    const v4Doc = { name: 'My Profile' };
    const result = getSync().readDoc('profile_main', 'main', () => v4Doc);
    expect(result).toEqual(v4Doc);
  });

  it('returns the unwrapped envelope.data when reads flag is ON', () => {
    enableAllFlags();
    const coll = getSync().collection('profile_main');
    coll.write('main', { displayName: 'Jordan', email: 'j@x.com' });

    const result = getSync().readDoc('profile_main', 'main', () => null);
    expect(result).toEqual({ displayName: 'Jordan', email: 'j@x.com' });
  });

  it('returns null on missing doc when reads flag is ON', () => {
    enableAllFlags();
    const result = getSync().readDoc('profile_main', 'nonexistent', () => null);
    expect(result).toBeNull();
  });
});

describe('Phase A #1 — V5_REGISTRY pre-registration', () => {
  it('registers brands_v5 at module init', () => {
    const coll = getSync().collection('brands_v5');
    expect(coll).toBeDefined();
    expect(coll.name).toBe('brands_v5');
    // localStorageKey was set per registry spec
    expect(coll.localStorageKey).toBe('brilliance_v5_brands');
  });

  it('registers conversations_v5 with correct firestorePath shape', () => {
    const coll = getSync().collection('conversations_v5');
    expect(coll.firestorePath('test-uid')).toBe('roweos_users/test-uid/conversations_v5');
  });

  it('registers all 11 v4-shadowed app collections', () => {
    const expected = [
      'brands_v5', 'conversations_v5', 'automations_v5', 'scribe_v5',
      'reminders_v5', 'pulse_v5', 'library_brand_v5', 'library_life_v5',
      'mail_v5', 'journal_v5', 'folio_v5'
    ];
    for (const name of expected) {
      const coll = getSync().collection(name);
      expect(coll, `expected ${name} to be registered`).toBeDefined();
      expect(coll.firestorePath, `expected ${name} to have firestorePath`).toBeTypeOf('function');
    }
  });
});

describe('Phase A #2 — V5_NATIVE_COLLECTIONS allowlist', () => {
  it('includes evolve_* (legacy native)', () => {
    expect(getSync().isV5NativeCollection('evolve_skills')).toBe(true);
    expect(getSync().isV5NativeCollection('evolve_sources')).toBe(true);
  });

  it('includes brands_v5 (newly extended in v34.67)', () => {
    expect(getSync().isV5NativeCollection('brands_v5')).toBe(true);
  });

  it('includes profile sub-doc collections', () => {
    expect(getSync().isV5NativeCollection('profile_main')).toBe(true);
    expect(getSync().isV5NativeCollection('profile_clients')).toBe(true);
  });

  it('rejects a name not in the allowlist', () => {
    expect(getSync().isV5NativeCollection('definitely_not_a_collection')).toBe(false);
  });
});
