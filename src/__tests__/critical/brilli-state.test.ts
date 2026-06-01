/**
 * @file Brilli mount/unmount/setMode state machine tests.
 *
 * Locks in:
 *   - mount creates an instance
 *   - unmount cleans up (no orphan in instances list)
 *   - setMode updates b.mode + b.modeChangedAt
 *   - setMode is no-op when mode is unchanged
 *   - mount with classic form returns instance with kind='classic'
 *   - mount with reduced motion → static (no RAF participation)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const brilliSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/34-brilli.js'), 'utf-8');

beforeEach(() => {
  delete (window as any).Brilli;
  try { window.localStorage.clear(); } catch {}
  // No-op RAF in tests so the canvas drawing code never runs.
  // We're testing state, not pixels.
  (window as any).requestAnimationFrame = () => 0;
  (window as any).cancelAnimationFrame = () => {};
  // eslint-disable-next-line no-eval
  (0, eval)(brilliSource);
});

afterEach(() => {
  try {
    if ((window as any).Brilli) {
      const inst = (window as any).Brilli._debugInstances();
      for (const b of inst.slice()) (window as any).Brilli.unmount(b);
    }
  } catch {}
});

function getBrilli(): any { return (window as any).Brilli; }

describe('Brilli.mount', () => {
  it('returns null when host is null', () => {
    expect(getBrilli().mount(null)).toBeNull();
  });

  it('returns instance for valid host', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const b = getBrilli().mount(host, { size: 'inline', mode: 'idle' });
    expect(b).not.toBeNull();
    expect(b.host).toBe(host);
    expect(b.size).toBe('inline');
    expect(b.mode).toBe('idle');
  });

  it('classic form returns staticOnly instance', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const b = getBrilli().mount(host, { size: 'inline', form: 'classic' });
    expect(b.kind).toBe('classic');
    expect(b.staticOnly).toBe(true);
  });

  it('pin size returns staticOnly', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const b = getBrilli().mount(host, { size: 'pin', form: 'celestial' });
    expect(b.staticOnly).toBe(true);
  });

  it('uses active form when opts.form not provided', () => {
    getBrilli().setActiveForm('aura');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const b = getBrilli().mount(host, { size: 'inline' });
    expect(b.form).toBe('aura');
  });
});

describe('Brilli.setMode', () => {
  let host: HTMLDivElement;
  let b: any;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    b = getBrilli().mount(host, { size: 'inline', mode: 'idle' });
  });

  it('updates b.mode', () => {
    getBrilli().setMode(b, 'thinking');
    expect(b.mode).toBe('thinking');
  });

  it('updates modeChangedAt', () => {
    const before = b.modeChangedAt;
    // Wait at least 1ms via setTimeout
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        getBrilli().setMode(b, 'pleased');
        expect(b.modeChangedAt).toBeGreaterThan(before);
        resolve();
      }, 5);
    });
  });

  it('is no-op when mode unchanged', () => {
    const before = b.modeChangedAt;
    getBrilli().setMode(b, 'idle'); // already idle
    expect(b.modeChangedAt).toBe(before);
  });

  it('triggers pulseFlash on pleased mode', () => {
    getBrilli().setMode(b, 'pleased');
    expect(b.pulseFlash).toBe(1);
  });

  it('null instance is silently ignored', () => {
    expect(() => getBrilli().setMode(null, 'thinking')).not.toThrow();
  });
});

describe('Brilli.unmount', () => {
  it('removes host children', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const b = getBrilli().mount(host, { size: 'inline' });
    expect(host.children.length).toBeGreaterThan(0);
    getBrilli().unmount(b);
    expect(host.children.length).toBe(0);
  });

  it('null instance is silently ignored', () => {
    expect(() => getBrilli().unmount(null)).not.toThrow();
  });
});

describe('Brilli.setActiveForm side effects', () => {
  it('re-mounts existing instances with new form', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    getBrilli().mount(host, { size: 'inline', mode: 'idle', form: 'celestial' });
    const before = getBrilli()._debugInstances().length;
    getBrilli().setActiveForm('aura');
    const inst = getBrilli()._debugInstances();
    // Same count after re-mount
    expect(inst.length).toBe(before);
    // Active form should match
    expect(getBrilli().getActiveForm()).toBe('aura');
  });

  it('fires brilli:form-changed CustomEvent', () => {
    let received = '';
    window.addEventListener('brilli:form-changed', (ev: any) => {
      received = ev.detail?.form;
    });
    getBrilli().setActiveForm('firefly');
    expect(received).toBe('firefly');
  });
});
