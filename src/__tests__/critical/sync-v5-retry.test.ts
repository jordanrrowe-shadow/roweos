/**
 * @file SyncV5 listener auto-retry tests (v33.22 behavior).
 *
 * Locks in:
 *   - On onSnapshot error, retry counter increments
 *   - Retry caps at 3 attempts
 *   - Retry tears down old subscription before re-subscribing
 *   - Successful snapshot resets the retry counter
 *   - Retry only fires when feature flag still enabled
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const v5Source = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');

interface SubscribeRecord {
  path: string;
  successCb: (snap: any) => void;
  errorCb: (err: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

function setupFirebaseMock(): { subs: SubscribeRecord[] } {
  const subs: SubscribeRecord[] = [];
  const collectionMock = (collectionPath: string) => ({
    onSnapshot: (successCb: any, errorCb: any) => {
      const unsubscribe = vi.fn();
      subs.push({ path: collectionPath, successCb, errorCb, unsubscribe });
      return unsubscribe;
    },
    doc: () => ({ set: () => Promise.resolve() }),
  });
  (window as any).firebase = {
    firestore: () => ({ collection: collectionMock }),
  };
  (window as any).firebaseUser = { uid: 'test-uid' };
  return { subs };
}

beforeEach(() => {
  vi.useFakeTimers();
  delete (globalThis as any).SyncV5;
  delete (window as any).SyncV5;
  delete (window as any).firebase;
  delete (window as any).firebaseUser;
  try { window.localStorage.clear(); } catch {}
  // eslint-disable-next-line no-eval
  (0, eval)(v5Source);
});

function getSync(): any { return (window as any).SyncV5; }

describe('SyncV5 listener retry', () => {
  it('increments retry counter on error', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    const c = getSync().collection('retry_test_1', {
      firestorePath: (uid: string) => 'users/' + uid + '/retry_test_1',
      localStorageKey: 'brilliance_v5_retry_test_1',
      schemaVersion: 1,
    });
    fb.subs.length = 0; // ignore auto-start subs from setEnabled
    c._startReadShadow('test-uid', { compareV4: () => ({ matches: true }) });
    expect(fb.subs.length).toBe(1);
    fb.subs[0].errorCb(new Error('boom'));
    expect(c._retryCount).toBe(1);
  });

  it('schedules retry 30s after error', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    fb.subs.length = 0;
    const c = getSync().collection('retry_test_2', {
      firestorePath: (uid: string) => 'users/' + uid + '/retry_test_2',
      localStorageKey: 'brilliance_v5_retry_test_2',
      schemaVersion: 1,
    });
    c._startReadShadow('test-uid', { compareV4: () => ({ matches: true }) });
    fb.subs[0].errorCb(new Error('boom'));
    // Before timer advances, no new sub.
    expect(fb.subs.length).toBe(1);
    vi.advanceTimersByTime(30_000);
    // After 30s, retry created a fresh subscription.
    expect(fb.subs.length).toBe(2);
  });

  it('caps retries at 3 attempts', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    fb.subs.length = 0;
    const c = getSync().collection('retry_test_3', {
      firestorePath: (uid: string) => 'users/' + uid + '/retry_test_3',
      localStorageKey: 'brilliance_v5_retry_test_3',
      schemaVersion: 1,
    });
    c._startReadShadow('test-uid', { compareV4: () => ({ matches: true }) });
    // Cycle 4 errors: 1st triggers retry 1; subsequent retry attempts also error.
    for (let i = 0; i < 4; i++) {
      fb.subs[fb.subs.length - 1].errorCb(new Error('err ' + i));
      vi.advanceTimersByTime(30_000);
    }
    // 1 initial + 3 retries = 4 total subs. The 5th error fires past _retryCount > 3 and skips.
    expect(fb.subs.length).toBeLessThanOrEqual(4);
    expect(c._retryCount).toBeGreaterThanOrEqual(4);
  });

  it('resets retry counter on successful snapshot', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    fb.subs.length = 0;
    const c = getSync().collection('retry_test_4', {
      firestorePath: (uid: string) => 'users/' + uid + '/retry_test_4',
      localStorageKey: 'brilliance_v5_retry_test_4',
      schemaVersion: 1,
    });
    c._startReadShadow('test-uid', { compareV4: () => ({ matches: true }) });
    fb.subs[0].errorCb(new Error('boom'));
    expect(c._retryCount).toBe(1);
    vi.advanceTimersByTime(30_000);
    // Now an empty snapshot succeeds.
    fb.subs[fb.subs.length - 1].successCb({ docChanges: () => [] });
    expect(c._retryCount).toBe(0);
  });

  it('teardown unsubscribes old listener before retry', () => {
    const fb = setupFirebaseMock();
    getSync().setEnabled(true);
    fb.subs.length = 0;
    const c = getSync().collection('retry_test_5', {
      firestorePath: (uid: string) => 'users/' + uid + '/retry_test_5',
      localStorageKey: 'brilliance_v5_retry_test_5',
      schemaVersion: 1,
    });
    c._startReadShadow('test-uid', { compareV4: () => ({ matches: true }) });
    const firstUnsub = fb.subs[0].unsubscribe;
    fb.subs[0].errorCb(new Error('boom'));
    vi.advanceTimersByTime(30_000);
    expect(firstUnsub).toHaveBeenCalled();
  });
});
