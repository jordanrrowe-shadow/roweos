/**
 * @file SyncV5 dual-write scaffold tests (v33.43).
 *
 * Locks the gating in: dual-write only fires when ALL THREE flags are on
 * (read-shadow + writes + dual-write). Default state is fully off.
 * mirrorV4Write returns null when gated off; returns an envelope when on.
 * Stats track dual-writes + errors separately from discrepancies.
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

describe('SyncV5 dual-write — gating', () => {
  it('default: dualWriteEnabled is false', () => {
    expect(getSync().dualWriteEnabled()).toBe(false);
  });

  it('false when only read-shadow on', () => {
    getSync().setEnabled(true);
    expect(getSync().dualWriteEnabled()).toBe(false);
  });

  it('false when only read-shadow + writes on', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    expect(getSync().dualWriteEnabled()).toBe(false);
  });

  it('true ONLY when all three flags on', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().setDualWriteEnabled(true);
    expect(getSync().dualWriteEnabled()).toBe(true);
  });

  it('disabling read-shadow effectively disables dual-write', () => {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().setDualWriteEnabled(true);
    expect(getSync().dualWriteEnabled()).toBe(true);
    getSync().setEnabled(false);
    expect(getSync().dualWriteEnabled()).toBe(false);
  });

  it('persists dualWrite flag to localStorage', () => {
    getSync().setDualWriteEnabled(true);
    expect(window.localStorage.getItem('roweos_sync_v5_dual_write')).toBe('true');
    getSync().setDualWriteEnabled(false);
    expect(window.localStorage.getItem('roweos_sync_v5_dual_write')).toBe('false');
  });
});

describe('SyncV5 dual-write — mirrorV4Write', () => {
  function fullEnable() {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().setDualWriteEnabled(true);
  }

  it('returns null when gated off', () => {
    expect(getSync().mirrorV4Write('automations', 'a1', { foo: 'bar' })).toBeNull();
  });

  it('returns null when collectionName missing', () => {
    fullEnable();
    expect(getSync().mirrorV4Write('', 'id', {})).toBeNull();
    expect(getSync().mirrorV4Write(null, 'id', {})).toBeNull();
  });

  it('returns null when id missing', () => {
    fullEnable();
    expect(getSync().mirrorV4Write('automations', '', {})).toBeNull();
    expect(getSync().mirrorV4Write('automations', null, {})).toBeNull();
  });

  it('returns envelope when fully enabled', () => {
    fullEnable();
    const env = getSync().mirrorV4Write('automations', 'auto1', { name: 'Test automation' });
    expect(env).not.toBeNull();
    expect(env.id).toBe('auto1');
    expect(env.data).toEqual({ name: 'Test automation' });
    expect(typeof env._modifiedAt).toBe('number');
    expect(typeof env._createdAt).toBe('number');
    expect(env._schemaVersion).toBe(1);
  });

  it('persists envelope to v5 local cache', () => {
    fullEnable();
    getSync().mirrorV4Write('automations', 'auto1', { v: 1 });
    const stored = window.localStorage.getItem('brilliance_v5_automations');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.auto1).toBeTruthy();
    expect(parsed.auto1.data.v).toBe(1);
  });

  it('preserves _createdAt across dual-writes (treats as edit)', () => {
    fullEnable();
    const first = getSync().mirrorV4Write('automations', 'auto1', { v: 1 });
    const created = first._createdAt;
    const second = getSync().mirrorV4Write('automations', 'auto1', { v: 2 });
    expect(second._createdAt).toBe(created);
    expect(second.data.v).toBe(2);
  });
});

describe('SyncV5 dual-write — stats', () => {
  function fullEnable() {
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().setDualWriteEnabled(true);
  }

  it('initial dualWrites is 0', () => {
    expect(getSync().getStats().dualWrites).toBe(0);
    expect(getSync().getStats().lastDualWriteAt).toBe(0);
  });

  it('increments on each successful dual-write', () => {
    fullEnable();
    expect(getSync().getStats().dualWrites).toBe(0);
    getSync().mirrorV4Write('automations', 'a1', { v: 1 });
    expect(getSync().getStats().dualWrites).toBe(1);
    getSync().mirrorV4Write('automations', 'a2', { v: 2 });
    expect(getSync().getStats().dualWrites).toBe(2);
  });

  it('lastDualWriteAt updates on each write', () => {
    fullEnable();
    expect(getSync().getStats().lastDualWriteAt).toBe(0);
    getSync().mirrorV4Write('brands', 'b1', { name: 'Test brand' });
    expect(getSync().getStats().lastDualWriteAt).toBeGreaterThan(0);
  });

  it('does not increment when gated off', () => {
    getSync().mirrorV4Write('automations', 'a1', { v: 1 });
    expect(getSync().getStats().dualWrites).toBe(0);
  });

  it('resetStats clears dual-write counters', () => {
    fullEnable();
    getSync().mirrorV4Write('automations', 'a1', { v: 1 });
    expect(getSync().getStats().dualWrites).toBe(1);
    getSync().resetStats();
    expect(getSync().getStats().dualWrites).toBe(0);
    expect(getSync().getStats().lastDualWriteAt).toBe(0);
  });
});

describe('SyncV5 dual-write — getStats reflects flag', () => {
  it('exposes dualWriteEnabled', () => {
    expect(getSync().getStats().dualWriteEnabled).toBe(false);
    getSync().setEnabled(true);
    getSync().setWritesEnabled(true);
    getSync().setDualWriteEnabled(true);
    expect(getSync().getStats().dualWriteEnabled).toBe(true);
  });
});
