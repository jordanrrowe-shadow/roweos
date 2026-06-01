/**
 * @file Cloud-write gate integration tests for SyncV5.
 *
 * Locks in the v33.8 invariant: cloud writes happen ONLY when
 *   1. SyncV5.isEnabled() is true
 *   2. SyncV5.writesEnabled() is true
 *   3. The collection is in V5_NATIVE_COLLECTIONS allowlist
 *   4. firebase + firebaseUser.uid are both available
 *
 * V4-shadowed collections (automations, brands, conversations, scribe, reminders)
 * MUST NEVER trigger cloud writes through v5 — they stay v4-authoritative.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const v5Source = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');

interface CapturedWrite {
  path: string;
  id: string;
  envelope: any;
  merge: boolean;
}

function setupFirebaseMock(): { writes: CapturedWrite[] } {
  const writes: CapturedWrite[] = [];
  const docMock = (id: string, collectionPath: string) => ({
    set: (envelope: any, opts?: { merge?: boolean }) => {
      writes.push({ path: collectionPath, id, envelope, merge: !!opts?.merge });
      return Promise.resolve();
    },
  });
  const collectionMock = (collectionPath: string) => ({
    doc: (id: string) => docMock(id, collectionPath),
  });
  (window as any).firebase = {
    firestore: () => ({ collection: collectionMock }),
  };
  (window as any).firebaseUser = { uid: 'test-uid' };
  return { writes };
}

beforeEach(() => {
  delete (globalThis as any).SyncV5;
  delete (window as any).SyncV5;
  delete (window as any).firebase;
  delete (window as any).firebaseUser;
  try { window.localStorage.clear(); } catch {}
  // eslint-disable-next-line no-eval
  (0, eval)(v5Source);
});

function getSync(): any { return (window as any).SyncV5; }

describe('SyncV5 cloud-write gate — defaults', () => {
  it('does NOT cloud-write when isEnabled is false (default)', () => {
    const fb = setupFirebaseMock();
    const c = getSync().collection('evolve_skills', {
      firestorePath: (uid: string) => 'users/' + uid + '/evolve_skills',
      localStorageKey: 'brilliance_v5_evolve_skills',
      schemaVersion: 1,
    });
    c.write('skill1', { name: 'JavaScript' });
    expect(fb.writes.length).toBe(0);
  });

  it('does NOT cloud-write when isEnabled but writes disabled', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    const c = getSync().collection('evolve_skills', {
      firestorePath: (uid: string) => 'users/' + uid + '/evolve_skills',
      localStorageKey: 'brilliance_v5_evolve_skills',
      schemaVersion: 1,
    });
    c.write('skill1', { name: 'TypeScript' });
    expect(fb.writes.length).toBe(0);
    expect(getSync().writesEnabled()).toBe(false);
  });
});

describe('SyncV5 cloud-write gate — enabled', () => {
  it('writes evolve_skills when both flags on', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    const c = getSync().collection('evolve_skills', {
      firestorePath: (uid: string) => 'users/' + uid + '/evolve_skills',
      localStorageKey: 'brilliance_v5_evolve_skills',
      schemaVersion: 1,
    });
    c.write('s1', { name: 'React' });
    expect(fb.writes.length).toBe(1);
    expect(fb.writes[0].path).toBe('users/test-uid/evolve_skills');
    expect(fb.writes[0].id).toBe('s1');
    expect(fb.writes[0].envelope.id).toBe('s1');
    expect(fb.writes[0].envelope.data).toEqual({ name: 'React' });
    expect(fb.writes[0].merge).toBe(true);
  });

  it('writes tombstone on delete', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    const c = getSync().collection('evolve_skills', {
      firestorePath: (uid: string) => 'users/' + uid + '/evolve_skills',
      localStorageKey: 'brilliance_v5_evolve_skills',
      schemaVersion: 1,
    });
    c.write('s2', { name: 'Vue' });
    c.delete('s2');
    expect(fb.writes.length).toBe(2);
    expect(fb.writes[1].envelope._deletedAt).toBeGreaterThan(0);
    expect(fb.writes[1].envelope.id).toBe('s2');
  });

  it('does NOT cloud-write to v4-shadowed collections (automations, brands, etc.)', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    const v4shadowed = ['automations', 'brands', 'conversations', 'scribe', 'reminders'];
    for (const name of v4shadowed) {
      const c = getSync().collection(name, {
        firestorePath: (uid: string) => 'users/' + uid + '/' + name,
        localStorageKey: 'brilliance_v5_' + name,
        schemaVersion: 1,
      });
      c.write('item' + name, { v: 1 });
    }
    expect(fb.writes.length).toBe(0);
  });

  it('writes all v5-native collections', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    const native = ['evolve_skills', 'evolve_sources', 'evolve_reflections', 'evolve_sops'];
    for (const name of native) {
      const c = getSync().collection(name, {
        firestorePath: (uid: string) => 'users/' + uid + '/' + name,
        localStorageKey: 'brilliance_v5_' + name,
        schemaVersion: 1,
      });
      c.write('it_' + name, { v: 1 });
    }
    expect(fb.writes.length).toBe(4);
  });

  it('isV5NativeCollection returns true ONLY for evolve_*', () => {
    expect(getSync().isV5NativeCollection('evolve_skills')).toBe(true);
    expect(getSync().isV5NativeCollection('evolve_reflections')).toBe(true);
    expect(getSync().isV5NativeCollection('automations')).toBe(false);
    expect(getSync().isV5NativeCollection('brands')).toBe(false);
    expect(getSync().isV5NativeCollection('not_a_real_collection')).toBe(false);
  });
});

describe('SyncV5 cloud-write gate — environment guards', () => {
  it('does not throw when firebase global missing', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    const c = getSync().collection('evolve_skills', {
      firestorePath: (uid: string) => 'users/' + uid + '/evolve_skills',
      localStorageKey: 'brilliance_v5_evolve_skills',
      schemaVersion: 1,
    });
    // No firebase setup. Should not throw.
    expect(() => c.write('x', { v: 1 })).not.toThrow();
  });

  it('does not throw when firebaseUser missing', () => {
    (window as any).firebase = {
      firestore: () => ({ collection: () => ({ doc: () => ({ set: () => Promise.resolve() }) }) }),
    };
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    const c = getSync().collection('evolve_skills', {
      firestorePath: (uid: string) => 'users/' + uid + '/evolve_skills',
      localStorageKey: 'brilliance_v5_evolve_skills',
      schemaVersion: 1,
    });
    expect(() => c.write('x', { v: 1 })).not.toThrow();
  });
});
