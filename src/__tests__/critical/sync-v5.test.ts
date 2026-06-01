/**
 * @file Critical-path regression tests for sync v5 conflict resolution + envelopes.
 *
 * v5 is the CRDT replacement for the dual-write hardened v4 system. These tests
 * lock in:
 *   - Last-write-wins by `_modifiedAt`
 *   - Tie-break by lexicographic `_clientId`
 *   - Universal envelope shape
 *   - Tombstone semantics (deleted items have `_deletedAt`, hidden by default)
 *   - Read-shadow doesn't mutate v4 (regression check via inspection)
 *
 * Past production bugs that informed the v5 design (re-checked in services/sync
 * facade tests once v34 dual-write is live):
 *   - `_normalizeTs` ISO vs ms (v22.32)
 *   - `mergeByTimestamp` empty cloud array as deletion (v31.13)
 *   - `safeSyncWrite` overwriting reader's expected fields (Feb 9 chat resurrection)
 *   - `_all` doc subset preventing data loss (v28.3)
 *   - Tombstone scrub on startup (v22.32)
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Load v5 module via global eval. The module is an IIFE that assigns to
// `window.SyncV5`. We replay it inside jsdom so tests run without bundling
// the entire app.
import * as fs from 'node:fs';
import * as path from 'node:path';

const v5Source = fs.readFileSync(
  path.resolve(__dirname, '../../js/core/35-sync-v5.js'),
  'utf-8'
);

beforeEach(() => {
  // Fresh global state per test. jsdom gives us window already.
  delete (globalThis as any).SyncV5;
  delete (window as any).SyncV5;
  // Clear localStorage between tests (jsdom localStorage is shared per file).
  try { window.localStorage.clear(); } catch {}
  // Eval the v5 module into the current jsdom global context.
  // eslint-disable-next-line no-eval
  (0, eval)(v5Source);
});

function getSync(): any {
  return (window as any).SyncV5;
}

describe('SyncV5 — envelope shape', () => {
  it('wraps data with required fields', () => {
    const env = getSync().envelope('abc', { foo: 'bar' });
    expect(env.id).toBe('abc');
    expect(env.data).toEqual({ foo: 'bar' });
    expect(typeof env._modifiedAt).toBe('number');
    expect(typeof env._createdAt).toBe('number');
    expect(env._deletedAt).toBeNull();
    expect(typeof env._clientId).toBe('string');
    expect(env._clientId.length).toBeGreaterThanOrEqual(8);
    expect(env._schemaVersion).toBe(1);
  });

  it('preserves _createdAt across writes', () => {
    const initial = getSync().envelope('x', { v: 1 });
    const created = initial._createdAt;
    // simulate an edit by passing prev._createdAt
    const next = getSync().envelope('x', { v: 2 }, { _createdAt: created });
    expect(next._createdAt).toBe(created);
    expect(next._modifiedAt).toBeGreaterThanOrEqual(created);
  });
});

describe('SyncV5 — conflict resolution', () => {
  it('higher _modifiedAt wins', () => {
    const a = getSync().envelope('x', { v: 1 }, { _modifiedAt: 100 });
    const b = getSync().envelope('x', { v: 2 }, { _modifiedAt: 200 });
    expect(getSync().resolveConflict(a, b)).toBe(b);
    expect(getSync().resolveConflict(b, a)).toBe(b);
  });

  it('on tie, lexicographically higher _clientId wins (deterministic, no ping-pong)', () => {
    const a = getSync().envelope('x', { v: 1 }, { _modifiedAt: 100, _clientId: 'aaaa' });
    const b = getSync().envelope('x', { v: 2 }, { _modifiedAt: 100, _clientId: 'bbbb' });
    expect(getSync().resolveConflict(a, b)).toBe(b);
    expect(getSync().resolveConflict(b, a)).toBe(b);
  });

  it('null inputs degrade gracefully', () => {
    const a = getSync().envelope('x', { v: 1 });
    expect(getSync().resolveConflict(null, a)).toBe(a);
    expect(getSync().resolveConflict(a, null)).toBe(a);
    expect(getSync().resolveConflict(null, null)).toBeNull();
  });
});

describe('SyncV5 — Collection CRUD', () => {
  function makeColl() {
    return getSync().collection('test_items_' + Math.random(), {
      firestorePath: (uid: string) => 'users/' + uid + '/test_items',
      localStorageKey: 'brilliance_v5_test_' + Math.random(),
      schemaVersion: 1,
    });
  }

  it('write + read round-trip', () => {
    const c = makeColl();
    c.write('item1', { label: 'one' });
    const read = c.read('item1');
    expect(read).not.toBeNull();
    expect(read.id).toBe('item1');
    expect(read.data.label).toBe('one');
  });

  it('list excludes tombstones by default, includes when requested', () => {
    const c = makeColl();
    c.write('a', { v: 1 });
    c.write('b', { v: 2 });
    c.delete('a');

    const liveList = c.list();
    expect(liveList.length).toBe(1);
    expect(liveList[0].id).toBe('b');

    const fullList = c.list({ includeDeleted: true });
    expect(fullList.length).toBe(2);
    const tomb = fullList.find((it: any) => it.id === 'a');
    expect(tomb._deletedAt).toBeGreaterThan(0);
  });

  it('read returns null for tombstoned items', () => {
    const c = makeColl();
    c.write('x', { v: 1 });
    c.delete('x');
    expect(c.read('x')).toBeNull();
  });

  it('subscribe fires on write + delete', () => {
    const c = makeColl();
    const events: any[] = [];
    const unsub = c.subscribe((ev: any) => events.push(ev));
    c.write('a', { v: 1 });
    c.delete('a');
    expect(events.length).toBe(2);
    expect(events[0].kind).toBe('write');
    expect(events[1].kind).toBe('delete');
    unsub();
    c.write('b', { v: 1 });
    expect(events.length).toBe(2); // no new event after unsubscribe
  });
});

describe('SyncV5 — feature flag gating', () => {
  it('isEnabled() returns false by default', () => {
    expect(getSync().isEnabled()).toBe(false);
  });

  it('setEnabled(true) flips the flag', () => {
    getSync().setEnabled(true);
    expect(getSync().isEnabled()).toBe(true);
    getSync().setEnabled(false);
    expect(getSync().isEnabled()).toBe(false);
  });

  it('getStats reflects flag state', () => {
    getSync().setEnabled(false);
    let s = getSync().getStats();
    expect(s.enabled).toBe(false);
    getSync().setEnabled(true);
    s = getSync().getStats();
    expect(s.enabled).toBe(true);
    getSync().setEnabled(false);
  });
});
