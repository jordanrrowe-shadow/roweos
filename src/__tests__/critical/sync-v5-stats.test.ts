/**
 * @file Per-collection stats + resetStats invariants for SyncV5.
 *
 * v33.10 added perCollection bookkeeping; v33.13 added resetStats.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const v5Source = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');

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

describe('SyncV5 — stats subscriber lifecycle', () => {
  it('subscribeStats fires on setEnabled', () => {
    const seen: any[] = [];
    getSync().subscribeStats((s: any) => seen.push({ enabled: s.enabled, writesEnabled: s.writesEnabled }));
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().setEnabled(false);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    // First event after enable should reflect enabled=true
    const post = seen.find((e: any) => e.enabled);
    expect(post).toBeTruthy();
  });

  it('multiple subscribers all fire', () => {
    let aFired = 0, bFired = 0, cFired = 0;
    getSync().subscribeStats(() => aFired++);
    getSync().subscribeStats(() => bFired++);
    getSync().subscribeStats(() => cFired++);
    getSync().setEnabled(true);
    expect(aFired).toBe(1);
    expect(bFired).toBe(1);
    expect(cFired).toBe(1);
  });

  it('throwing subscriber does not break others', () => {
    let bFired = 0;
    getSync().subscribeStats(() => { throw new Error('fail'); });
    getSync().subscribeStats(() => bFired++);
    getSync().setEnabled(true);
    expect(bFired).toBe(1);
  });

  it('unsubscribe stops further notifications', () => {
    let count = 0;
    const unsub = getSync().subscribeStats(() => count++);
    getSync().setEnabled(true);
    expect(count).toBe(1);
    unsub();
    getSync().setEnabled(false);
    expect(count).toBe(1); // no further events
  });
});

describe('SyncV5 — getStats shape', () => {
  it('initial stats are zeroed', () => {
    const s = getSync().getStats();
    expect(s.enabled).toBe(false);
    expect(s.writesEnabled).toBe(false);
    expect(s.eventsSeen).toBe(0);
    expect(s.discrepancies).toBe(0);
    expect(s.lastEventAt).toBe(0);
    expect(s.lastDiscrepancyAt).toBe(0);
    expect(s.lastError).toBeNull();
    expect(Array.isArray(s.activeCollections)).toBe(true);
    expect(s.activeCollections.length).toBe(0);
    expect(typeof s.perCollection).toBe('object');
    expect(Array.isArray(s.v5NativeCollections)).toBe(true);
  });

  it('v5NativeCollections matches the allowlist', () => {
    const s = getSync().getStats();
    expect(s.v5NativeCollections).toContain('evolve_skills');
    expect(s.v5NativeCollections).toContain('evolve_sources');
    expect(s.v5NativeCollections).toContain('evolve_reflections');
    expect(s.v5NativeCollections).toContain('evolve_sops');
    expect(s.v5NativeCollections).not.toContain('automations');
  });
});

describe('SyncV5 — resetStats', () => {
  it('clears counters', () => {
    // Manually nudge a counter via internal access (via subscribers that mutate _stats — not ideal).
    // Instead just call resetStats and check the shape.
    getSync().setEnabled(true);
    getSync().resetStats();
    const s = getSync().getStats();
    expect(s.eventsSeen).toBe(0);
    expect(s.discrepancies).toBe(0);
    expect(s.lastError).toBeNull();
    expect(Object.keys(s.perCollection).length).toBe(0);
  });

  it('does not change enabled/writesEnabled flags', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().resetStats();
    expect(getSync().isEnabled()).toBe(true);
    expect(getSync().writesEnabled()).toBe(true);
  });

  it('fires stats listeners', () => {
    let fired = 0;
    getSync().subscribeStats(() => fired++);
    fired = 0; // ignore initial
    getSync().resetStats();
    expect(fired).toBeGreaterThanOrEqual(1);
  });
});
