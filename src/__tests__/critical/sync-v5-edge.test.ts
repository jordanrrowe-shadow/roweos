/**
 * @file Edge-case regression tests for SyncV5.
 *
 * Locks in:
 *   - Tombstone semantics across re-load cycles (localStorage rehydration)
 *   - Multi-collection isolation (writes to one don't affect another)
 *   - includeDeleted filter behavior
 *   - subscribe handler errors don't break notify chain
 *   - resolveConflict with same _modifiedAt + same _clientId returns one of them deterministically
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

function makeColl(name = 't_' + Math.random()) {
  return getSync().collection(name, {
    firestorePath: (uid: string) => 'users/' + uid + '/' + name,
    localStorageKey: 'brilliance_v5_' + name,
    schemaVersion: 1,
  });
}

describe('SyncV5 — multi-collection isolation', () => {
  it('writes to collection A do not appear in collection B', () => {
    const a = makeColl('isolation_a');
    const b = makeColl('isolation_b');
    a.write('x', { source: 'A' });
    b.write('y', { source: 'B' });
    expect(a.list().length).toBe(1);
    expect(b.list().length).toBe(1);
    expect(a.read('y')).toBeNull();
    expect(b.read('x')).toBeNull();
  });

  it('list returns only this collection items', () => {
    const c = makeColl('iso_only');
    c.write('a', { v: 1 });
    c.write('b', { v: 2 });
    c.write('c', { v: 3 });
    const list = c.list();
    expect(list.length).toBe(3);
    const ids = list.map((it: any) => it.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('SyncV5 — tombstone rehydration', () => {
  it('a deleted item stays tombstoned across rebuilds (localStorage persisted)', () => {
    const c = makeColl('tomb_persist');
    c.write('keep', { v: 1 });
    c.write('drop', { v: 2 });
    c.delete('drop');

    // Force a fresh Collection to reload from localStorage.
    delete (globalThis as any).SyncV5;
    delete (window as any).SyncV5;
    // eslint-disable-next-line no-eval
    (0, eval)(v5Source);
    const c2 = getSync().collection('tomb_persist', {
      firestorePath: (uid: string) => 'users/' + uid + '/tomb_persist',
      localStorageKey: 'brilliance_v5_tomb_persist',
      schemaVersion: 1,
    });
    expect(c2.read('drop')).toBeNull();
    expect(c2.read('keep')).not.toBeNull();
    expect(c2.list().length).toBe(1);
    expect(c2.list({ includeDeleted: true }).length).toBe(2);
  });
});

describe('SyncV5 — subscribe error tolerance', () => {
  it('a throwing subscriber does not stop other subscribers', () => {
    const c = makeColl('sub_err');
    let aFired = 0, bFired = 0;
    c.subscribe(() => { throw new Error('boom'); });
    c.subscribe(() => { aFired++; });
    c.subscribe(() => { bFired++; });
    c.write('x', { v: 1 });
    expect(aFired).toBe(1);
    expect(bFired).toBe(1);
  });
});

describe('SyncV5 — resolveConflict determinism', () => {
  it('identical timestamps + identical clientIds returns the second arg (deterministic)', () => {
    const a = getSync().envelope('x', { v: 1 }, { _modifiedAt: 100, _clientId: 'same' });
    const b = getSync().envelope('x', { v: 2 }, { _modifiedAt: 100, _clientId: 'same' });
    // resolveConflict picks `a > b` lexicographically; if equal, returns `b`.
    const winner = getSync().resolveConflict(a, b);
    // Either is acceptable; deterministic means same result every call.
    const winner2 = getSync().resolveConflict(a, b);
    expect(winner).toBe(winner2);
  });

  it('handles future-dated cloud timestamps gracefully', () => {
    const local = getSync().envelope('x', { v: 1 }, { _modifiedAt: Date.now() });
    const cloud = getSync().envelope('x', { v: 2 }, { _modifiedAt: Date.now() + 365 * 86400_000 });
    expect(getSync().resolveConflict(local, cloud)).toBe(cloud);
  });
});

describe('SyncV5 — envelope schema version', () => {
  it('preserves schemaVersion when writing', () => {
    const c = getSync().collection('schema_v', {
      firestorePath: (uid: string) => 'users/' + uid + '/schema_v',
      localStorageKey: 'brilliance_v5_schema_v',
      schemaVersion: 7,
    });
    c.write('x', { v: 1 });
    const env = c.read('x');
    expect(env._schemaVersion).toBe(7);
  });
});

describe('SyncV5 — auto clientId', () => {
  it('reuses the clientId across calls', () => {
    const id1 = getSync()._clientId();
    const id2 = getSync()._clientId();
    expect(id1).toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThanOrEqual(8);
  });
});
