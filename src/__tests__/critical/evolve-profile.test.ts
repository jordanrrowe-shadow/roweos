/**
 * @file Pure-function tests for Evolve profile + Liquid Rhythm + system prompt.
 *
 * v33.x Evolve scaffold. Tests the public API that doesn't require DOM rendering:
 *   - getProfile / setProfile round-trip
 *   - daysToDeadline arithmetic
 *   - generateEvolveSystemPrompt structure (Translator pattern)
 *   - recalibrateMomentum: ADHD micro-tasks vs default Pomodoro, recalibration
 *     when sessions missed, daily target re-flow.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const brilliSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/34-brilli.js'), 'utf-8');
const syncSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');
const evolveSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/36-evolve.js'), 'utf-8');

beforeEach(() => {
  delete (window as any).Brilli;
  delete (window as any).SyncV5;
  delete (window as any).Evolve;
  try { window.localStorage.clear(); } catch {}
  if (typeof (window as any).requestAnimationFrame !== 'function') {
    (window as any).requestAnimationFrame = (cb: any) => setTimeout(() => cb(performance.now()), 16);
    (window as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
  }
  // Order matters: Brilli first (Evolve sets pleased on Brilli), SyncV5 (Evolve uses collections), Evolve last.
  // eslint-disable-next-line no-eval
  (0, eval)(brilliSource);
  // eslint-disable-next-line no-eval
  (0, eval)(syncSource);
  // eslint-disable-next-line no-eval
  (0, eval)(evolveSource);
});

function getEvolve(): any { return (window as any).Evolve; }

describe('Evolve.isEnabled', () => {
  it('default false', () => {
    expect(getEvolve().isEnabled()).toBe(false);
  });
  it('true when flag set', () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    expect(getEvolve().isEnabled()).toBe(true);
  });
});

describe('Evolve.getProfile / setProfile', () => {
  it('returns default profile when none saved', () => {
    const p = getEvolve().getProfile();
    expect(p.targetGoal).toBe('');
    expect(p.deadlineDate).toBe('');
    expect(Array.isArray(p.knownContext)).toBe(true);
    expect(p.cognitiveProfile).toBe('');
    expect(p.currentXP).toBe(0);
    expect(p.dailyStreak).toBe(0);
  });

  it('setProfile patches without losing other fields', () => {
    getEvolve().setProfile({ targetGoal: 'Pass a test', deadlineDate: '2026-12-01' });
    let p = getEvolve().getProfile();
    expect(p.targetGoal).toBe('Pass a test');
    expect(p.deadlineDate).toBe('2026-12-01');
    expect(p.currentXP).toBe(0);
    getEvolve().setProfile({ currentXP: 50 });
    p = getEvolve().getProfile();
    expect(p.targetGoal).toBe('Pass a test'); // preserved
    expect(p.currentXP).toBe(50);
  });

  it('persists to localStorage', () => {
    getEvolve().setProfile({ targetGoal: 'Persist test' });
    const raw = window.localStorage.getItem('roweos_evolve_profile');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).targetGoal).toBe('Persist test');
  });
});

describe('Evolve.daysToDeadline', () => {
  it('returns null when no deadline set', () => {
    expect(getEvolve().daysToDeadline({ deadlineDate: '' })).toBeNull();
  });
  it('returns null on invalid date', () => {
    expect(getEvolve().daysToDeadline({ deadlineDate: 'not-a-date' })).toBeNull();
  });
  it('returns positive for future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const iso = future.toISOString().slice(0, 10);
    const days = getEvolve().daysToDeadline({ deadlineDate: iso });
    expect(days).toBeGreaterThan(28); // accounting for clock variance
    expect(days).toBeLessThanOrEqual(31);
  });
  it('returns negative for past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    const iso = past.toISOString().slice(0, 10);
    const days = getEvolve().daysToDeadline({ deadlineDate: iso });
    expect(days).toBeLessThan(-8);
    expect(days).toBeGreaterThanOrEqual(-11);
  });
});

describe('Evolve.generateEvolveSystemPrompt', () => {
  it('mentions target goal when set', () => {
    const prompt = getEvolve().generateEvolveSystemPrompt({
      targetGoal: 'Master React hooks',
      deadlineDate: '2026-08-01',
      knownContext: ['10 years of jQuery'],
      cognitiveProfile: 'visual learner'
    });
    expect(prompt).toContain('Master React hooks');
    expect(prompt).toContain('2026-08-01');
    expect(prompt).toContain('10 years of jQuery');
    expect(prompt).toContain('visual learner');
  });

  it('does not require context to function', () => {
    const prompt = getEvolve().generateEvolveSystemPrompt({
      targetGoal: '',
      knownContext: [],
      cognitiveProfile: ''
    });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

describe('Evolve.recalibrateMomentum (Liquid Rhythm)', () => {
  it('default profile gets Pomodoro-style 25-min tasks', () => {
    const r = getEvolve().recalibrateMomentum({ targetGoal: 'X', cognitiveProfile: '' });
    expect(r.tasks.length).toBeGreaterThanOrEqual(2);
    expect(r.tasks[0].minutes).toBeGreaterThanOrEqual(25);
  });

  it('ADHD profile gets 10-min micro-tasks', () => {
    const r = getEvolve().recalibrateMomentum({ targetGoal: 'X', cognitiveProfile: 'severe ADHD, visual learner' });
    expect(r.tasks[0].minutes).toBe(10);
  });

  it('does not recalibrate on a fresh session', () => {
    const r = getEvolve().recalibrateMomentum({ targetGoal: 'X', deadlineDate: '2026-12-31', cognitiveProfile: '' });
    expect(r.recalibrated).toBe(false);
  });

  it('recalibrates when last session > 1 day ago', () => {
    const threeDaysAgo = Date.now() - 3 * 86400_000;
    const future = new Date(); future.setDate(future.getDate() + 30);
    const iso = future.toISOString().slice(0, 10);
    const r = getEvolve().recalibrateMomentum({
      targetGoal: 'X',
      deadlineDate: iso,
      cognitiveProfile: '',
      lastSessionAt: threeDaysAgo
    });
    expect(r.recalibrated).toBe(true);
    expect(r.dailyMinutesTarget).toBeGreaterThan(100); // base 100, scaled up
  });

  it('does not recalibrate without deadline', () => {
    const threeDaysAgo = Date.now() - 3 * 86400_000;
    const r = getEvolve().recalibrateMomentum({
      targetGoal: 'X',
      deadlineDate: '',
      cognitiveProfile: '',
      lastSessionAt: threeDaysAgo
    });
    expect(r.recalibrated).toBe(false);
  });
});
