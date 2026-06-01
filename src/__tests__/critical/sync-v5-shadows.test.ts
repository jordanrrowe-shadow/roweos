/**
 * @file Tests for the v33.27 journal + folio read-shadow compare callbacks.
 *
 * Locks in the comparison logic by directly invoking the compareV4 callback
 * captured from the mock onSnapshot subscription.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const v5Source = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');

interface SubscribeRecord {
  path: string;
  successCb: (snap: any) => void;
  errorCb: (err: Error) => void;
}

function setupFirebaseMock(): { subs: SubscribeRecord[]; unsubscribeMocks: any[] } {
  const subs: SubscribeRecord[] = [];
  const unsubscribeMocks: any[] = [];
  const collectionMock = (collectionPath: string) => ({
    onSnapshot: (successCb: any, errorCb: any) => {
      subs.push({ path: collectionPath, successCb, errorCb });
      const u = () => {};
      unsubscribeMocks.push(u);
      return u;
    },
    doc: () => ({ set: () => Promise.resolve() }),
  });
  (window as any).firebase = {
    firestore: () => ({ collection: collectionMock }),
  };
  (window as any).firebaseUser = { uid: 'test-uid' };
  return { subs, unsubscribeMocks };
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

/**
 * Helper: capture stats snapshot before and after a simulated cloud event,
 * to detect whether discrepancy was bumped (compareV4 returned matches:false).
 */
function discrepancyAfter(fb: ReturnType<typeof setupFirebaseMock>, doc: any): boolean {
  const before = getSync().getStats().discrepancies;
  // Simulate a docChange with the document.
  fb.subs[0].successCb({
    docChanges: () => [{ type: 'added', doc: { id: doc.id, data: () => doc } }]
  });
  const after = getSync().getStats().discrepancies;
  return after > before;
}

describe('SyncV5 — journal shadow', () => {
  it('flags cloud-only journal entries as discrepancy', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForJournal('test-uid');
    expect(fb.subs.length).toBe(1);
    // Local has nothing.
    expect(discrepancyAfter(fb, { id: 'cloud-only-1', text: 'a' })).toBe(true);
  });

  it('matches when id present in local roweos_journal', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_journal', JSON.stringify([
      { id: 'shared-1', text: 'matched' }
    ]));
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForJournal('test-uid');
    expect(discrepancyAfter(fb, { id: 'shared-1', text: 'matched' })).toBe(false);
  });

  it('matches when id present in legacy roweos_pulse_journal', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_pulse_journal', JSON.stringify([
      { id: 'pulse-1', body: 'old format' }
    ]));
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForJournal('test-uid');
    expect(discrepancyAfter(fb, { id: 'pulse-1' })).toBe(false);
  });

  it('does not crash on malformed local journal JSON', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_journal', '{not valid json');
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForJournal('test-uid');
    expect(() => discrepancyAfter(fb, { id: 'x' })).not.toThrow();
  });

  it('returns matches:true when cloud doc has no id', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForJournal('test-uid');
    expect(discrepancyAfter(fb, { text: 'no id' })).toBe(false);
  });
});

describe('SyncV5 — folio shadow', () => {
  it('flags cloud-only folio artifact', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForFolio('test-uid');
    expect(discrepancyAfter(fb, { id: 'orphan' })).toBe(true);
  });

  it('matches when id present locally', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_folio_artifacts', JSON.stringify([
      { id: 'art-1', title: 'Local artifact' }
    ]));
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForFolio('test-uid');
    expect(discrepancyAfter(fb, { id: 'art-1' })).toBe(false);
  });

  it('handles non-array local data gracefully', () => {
    const fb = setupFirebaseMock();
    window.localStorage.setItem('roweos_folio_artifacts', JSON.stringify({ not: 'an array' }));
    window.localStorage.setItem('roweos_sync_v5_enabled', 'true');
    getSync().startReadShadowForFolio('test-uid');
    expect(() => discrepancyAfter(fb, { id: 'x' })).not.toThrow();
  });
});

describe('SyncV5 — shadow registration completeness', () => {
  it('exposes all 10 read-shadow starters', () => {
    const sv5 = getSync();
    expect(typeof sv5.startReadShadowForAutomations).toBe('function');
    expect(typeof sv5.startReadShadowForBrands).toBe('function');
    expect(typeof sv5.startReadShadowForConversations).toBe('function');
    expect(typeof sv5.startReadShadowForScribe).toBe('function');
    expect(typeof sv5.startReadShadowForReminders).toBe('function');
    expect(typeof sv5.startReadShadowForPulse).toBe('function');
    expect(typeof sv5.startReadShadowForLibrary).toBe('function');
    expect(typeof sv5.startReadShadowForMail).toBe('function');
    expect(typeof sv5.startReadShadowForJournal).toBe('function');
    expect(typeof sv5.startReadShadowForFolio).toBe('function');
  });
});
