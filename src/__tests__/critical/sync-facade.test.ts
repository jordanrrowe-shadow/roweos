/**
 * @file Tests for the services/sync TypeScript facade.
 *
 * The facade wraps existing v4 sync globals. Tests check:
 *   - Throwing when the underlying global isn't available (defensive against premature import)
 *   - Round-trip when globals ARE available
 *   - mergeByTimestamp delegation + fallback (cloud preferred when no global)
 *   - Type compatibility for `SyncedItem<T>` (compile-time only — TS would fail)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as sync from '../../../services/sync/index';

beforeEach(() => {
  // Reset globals between tests.
  delete (window as any).writeDB;
  delete (window as any).readDB;
  delete (window as any).writeDBDoc;
  delete (window as any).deleteDBDoc;
  delete (window as any).loadFromFirebaseV2;
  delete (window as any).manualSyncNow;
  delete (window as any).mergeByTimestamp;
  delete (window as any).firebaseUser;
});

describe('services/sync facade — defensive', () => {
  it('writeDB throws when v4 global missing', async () => {
    await expect(sync.writeDB('a/b', { x: 1 })).rejects.toThrow(/v4 not loaded/);
  });
  it('readDB throws when v4 global missing', async () => {
    await expect(sync.readDB('a/b')).rejects.toThrow(/v4 not loaded/);
  });
  it('writeDBDoc throws when v4 global missing', async () => {
    await expect(sync.writeDBDoc('coll', 'id', { x: 1 })).rejects.toThrow(/v4 not loaded/);
  });
  it('deleteDBDoc throws when v4 global missing', async () => {
    await expect(sync.deleteDBDoc('coll', 'id')).rejects.toThrow(/v4 not loaded/);
  });
  it('loadFromFirebase throws when v4 global missing', async () => {
    await expect(sync.loadFromFirebase()).rejects.toThrow(/v4 not loaded/);
  });
  it('manualSyncNow throws when v4 global missing', async () => {
    await expect(sync.manualSyncNow()).rejects.toThrow(/v4 not loaded/);
  });

  it('currentUser returns null when global missing', () => {
    expect(sync.currentUser()).toBeNull();
  });
  it('currentUser returns the user object when set', () => {
    (window as any).firebaseUser = { uid: 'abc', email: 'a@b.c' };
    expect(sync.currentUser()).toEqual({ uid: 'abc', email: 'a@b.c' });
  });
});

describe('services/sync facade — delegation', () => {
  it('writeDB calls window.writeDB with same args', async () => {
    let called: any = null;
    (window as any).writeDB = (path: string, data: any) => {
      called = { path, data };
      return Promise.resolve();
    };
    await sync.writeDB('test/path', { v: 42 });
    expect(called).toEqual({ path: 'test/path', data: { v: 42 } });
  });

  it('readDB returns whatever the global returns', async () => {
    (window as any).readDB = () => Promise.resolve({ hello: 'world' });
    const r = await sync.readDB('any');
    expect(r).toEqual({ hello: 'world' });
  });

  it('mergeByTimestamp delegates when global available', () => {
    (window as any).mergeByTimestamp = (local: any[], cloud: any[]) => cloud;
    expect(
      sync.mergeByTimestamp([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])
    ).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('mergeByTimestamp falls back to cloud when global missing', () => {
    expect(sync.mergeByTimestamp([{ id: 'a' }], [{ id: 'b' }])).toEqual([{ id: 'b' }]);
  });

  it('mergeByTimestamp falls back to local when cloud is empty AND global missing', () => {
    expect(sync.mergeByTimestamp([{ id: 'a' }], [])).toEqual([{ id: 'a' }]);
  });
});

describe('services/sync facade — types', () => {
  it('SyncedItem<T> envelope compiles correctly', () => {
    // Pure compile-time check; if this file builds, types pass.
    const item: sync.SyncedItem<{ name: string }> = {
      id: 'x',
      data: { name: 'thing' },
      _modifiedAt: 100,
      _createdAt: 100,
    };
    expect(item.id).toBe('x');
    expect(item.data.name).toBe('thing');
  });
});
