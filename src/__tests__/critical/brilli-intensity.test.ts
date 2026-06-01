/**
 * @file Brilli.getIntensity / setIntensity invariants.
 *
 * v33.13 added an intensity multiplier (0-100) that scales glow/pulseHz/sparkRate/scaleAmp.
 * Locks in:
 *   - Default 100
 *   - Persists to localStorage
 *   - Clamps to 0-100
 *   - Fires brilli:intensity-changed CustomEvent
 *   - Survives reload (rehydrates from localStorage)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const brilliSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/34-brilli.js'), 'utf-8');

beforeEach(() => {
  delete (window as any).Brilli;
  delete (window as any).openBrilliFormPicker;
  delete (window as any)._brilliPruneOrphaned;
  try { window.localStorage.clear(); } catch {}
  // jsdom missing requestAnimationFrame in some setups
  if (typeof (window as any).requestAnimationFrame !== 'function') {
    (window as any).requestAnimationFrame = (cb: any) => setTimeout(() => cb(performance.now()), 16);
    (window as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
  }
  // eslint-disable-next-line no-eval
  (0, eval)(brilliSource);
});

function getBrilli(): any { return (window as any).Brilli; }

describe('Brilli intensity', () => {
  it('default is 100', () => {
    expect(getBrilli().getIntensity()).toBe(100);
  });

  it('setIntensity persists to localStorage', () => {
    getBrilli().setIntensity(50);
    expect(window.localStorage.getItem('roweos_brilli_intensity')).toBe('50');
    expect(getBrilli().getIntensity()).toBe(50);
  });

  it('clamps below 0', () => {
    getBrilli().setIntensity(-10);
    expect(getBrilli().getIntensity()).toBe(0);
  });

  it('clamps above 100', () => {
    getBrilli().setIntensity(250);
    expect(getBrilli().getIntensity()).toBe(100);
  });

  it('coerces string', () => {
    getBrilli().setIntensity('75' as any);
    expect(getBrilli().getIntensity()).toBe(75);
  });

  it('fires brilli:intensity-changed event', () => {
    let fired = 0;
    let receivedValue: number | null = null;
    window.addEventListener('brilli:intensity-changed', (ev: any) => {
      fired++;
      receivedValue = ev.detail?.intensity;
    });
    getBrilli().setIntensity(33);
    expect(fired).toBe(1);
    expect(receivedValue).toBe(33);
  });

  it('survives module reload (localStorage persistence)', () => {
    getBrilli().setIntensity(40);
    delete (window as any).Brilli;
    // eslint-disable-next-line no-eval
    (0, eval)(brilliSource);
    expect(getBrilli().getIntensity()).toBe(40);
  });
});

describe('Brilli active form', () => {
  it('default is celestial', () => {
    expect(getBrilli().getActiveForm()).toBe('celestial');
  });

  it('valid forms accepted', () => {
    const forms = ['celestial', 'aura', 'firefly', 'signature', 'classic'];
    for (const f of forms) {
      getBrilli().setActiveForm(f);
      expect(getBrilli().getActiveForm()).toBe(f);
    }
  });

  it('invalid form ignored', () => {
    getBrilli().setActiveForm('aura');
    getBrilli().setActiveForm('invalid_xyz');
    expect(getBrilli().getActiveForm()).toBe('aura');
  });

  it('persists', () => {
    getBrilli().setActiveForm('signature');
    expect(window.localStorage.getItem('roweos_brilli_form')).toBe('signature');
  });
});
