/**
 * @file SyncV5.clearLocalCache() invariants.
 *
 * v33.16 added clearLocalCache that strips all brilliance_v5_* localStorage keys
 * and resets in-memory Collection caches + zeros stats.
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

describe('SyncV5.clearLocalCache', () => {
  it('removes all brilliance_v5_* localStorage keys', () => {
    window.localStorage.setItem('brilliance_v5_a', 'x');
    window.localStorage.setItem('brilliance_v5_b', 'y');
    window.localStorage.setItem('something_else', 'keep');
    expect(getSync().clearLocalCache()).toBe(2);
    expect(window.localStorage.getItem('brilliance_v5_a')).toBeNull();
    expect(window.localStorage.getItem('brilliance_v5_b')).toBeNull();
    expect(window.localStorage.getItem('something_else')).toBe('keep');
  });

  it('returns 0 when no v5 keys present', () => {
    window.localStorage.setItem('roweos_other', 'x');
    expect(getSync().clearLocalCache()).toBe(0);
  });

  it('clears in-memory Collection state', () => {
    const c = getSync().collection('test_clear', {
      firestorePath: (uid: string) => 'users/' + uid + '/test_clear',
      localStorageKey: 'brilliance_v5_test_clear',
      schemaVersion: 1,
    });
    c.write('item1', { v: 1 });
    expect(c.read('item1')).not.toBeNull();
    getSync().clearLocalCache();
    // Collection cache reset; read returns null even though id existed before.
    expect(c.read('item1')).toBeNull();
  });

  it('zeros stats counters', () => {
    getSync().clearLocalCache();
    const s = getSync().getStats();
    expect(s.eventsSeen).toBe(0);
    expect(s.discrepancies).toBe(0);
    expect(s.lastError).toBeNull();
    expect(Object.keys(s.perCollection).length).toBe(0);
    expect(s.recentEvents.length).toBe(0);
  });

  it('does not change enabled/writesEnabled flags', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().clearLocalCache();
    expect(getSync().isEnabled()).toBe(true);
    expect(getSync().writesEnabled()).toBe(true);
  });
});
