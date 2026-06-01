/**
 * @file Tests for SyncV5 feature flag persistence + reload survival.
 *
 * v33.8 added setEnabled, v33.13 added setWritesEnabled. Both persist to
 * localStorage. This file locks in:
 *   - setEnabled persists 'true' / removes for false
 *   - setWritesEnabled persists 'true' / 'false'
 *   - Reload (re-eval module) re-reads localStorage state correctly
 *   - Stats reflect the current flag values
 *   - Disabling read-shadow does NOT auto-disable writes (user keeps the writes flag)
 *     [actually setEnabled(false) DOES tear down listeners but flag stays — which is fine
 *     because writesEnabled() also checks isEnabled() so writes effectively pause]
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

describe('SyncV5 — setEnabled persistence', () => {
  it('persists "true" when enabled', () => {
    getSync().setEnabled(true);
    expect(window.localStorage.getItem('roweos_sync_v5_enabled')).toBe('true');
  });

  it('persists "false" when disabled', () => {
    getSync().setEnabled(false);
    // setEnabled writes 'false' (it doesn't remove the key).
    expect(window.localStorage.getItem('roweos_sync_v5_enabled')).toBe('false');
  });

  it('survives module reload', () => {
    getSync().setEnabled(true);
    delete (window as any).SyncV5;
    // eslint-disable-next-line no-eval
    (0, eval)(v5Source);
    expect(getSync().isEnabled()).toBe(true);
  });
});

describe('SyncV5 — setWritesEnabled persistence', () => {
  it('persists "true"', () => {
    getSync().setWritesEnabled(true);
    expect(window.localStorage.getItem('roweos_sync_v5_writes')).toBe('true');
  });

  it('persists "false"', () => {
    getSync().setWritesEnabled(false);
    expect(window.localStorage.getItem('roweos_sync_v5_writes')).toBe('false');
  });

  it('writesEnabled() requires both flags on', () => {
    // Just writes flag without read-shadow flag → writes off.
    getSync().setWritesEnabled(true);
    expect(getSync().writesEnabled()).toBe(false);
    // Both on → writes on.
    getSync().setEnabled(true);
    expect(getSync().writesEnabled()).toBe(true);
  });

  it('disabling read-shadow effectively disables writes', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    expect(getSync().writesEnabled()).toBe(true);
    getSync().setEnabled(false);
    // writesEnabled() returns false because isEnabled is false now.
    expect(getSync().writesEnabled()).toBe(false);
    // But the writes flag itself stays — re-enabling read-shadow restores writes.
    getSync().setEnabled(true);
    expect(getSync().writesEnabled()).toBe(true);
  });
});

describe('SyncV5 — getStats reflects flags', () => {
  it('initial state: both off', () => {
    const s = getSync().getStats();
    expect(s.enabled).toBe(false);
    expect(s.writesEnabled).toBe(false);
  });

  it('after setEnabled(true): enabled true, writesEnabled false', () => {
    getSync().setEnabled(true);
    const s = getSync().getStats();
    expect(s.enabled).toBe(true);
    expect(s.writesEnabled).toBe(false);
  });

  it('after both flags on: enabled true, writesEnabled true', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    const s = getSync().getStats();
    expect(s.enabled).toBe(true);
    expect(s.writesEnabled).toBe(true);
  });
});
