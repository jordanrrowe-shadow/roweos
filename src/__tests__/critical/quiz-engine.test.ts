/**
 * @file QuizEngine schema + pool tests (Sprint C scaffold).
 *
 * Locks in:
 *   - validateQuiz returns { valid, error } for every field
 *   - Pool persistence (write → read round trip)
 *   - gc() prunes expired entries
 *   - addQuiz throws on invalid input
 *   - isEnabled requires the flag + Evolve + targetGoal
 *   - generateNightlyQuiz skipped when flag off
 *   - nextQuiz returns the first non-expired quiz
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const brilliSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/34-brilli.js'), 'utf-8');
const syncSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');
const evolveSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/36-evolve.js'), 'utf-8');
const quizSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/38-quiz-engine.js'), 'utf-8');

beforeEach(() => {
  delete (window as any).Brilli;
  delete (window as any).SyncV5;
  delete (window as any).Evolve;
  delete (window as any).QuizEngine;
  try { window.localStorage.clear(); } catch {}
  if (typeof (window as any).requestAnimationFrame !== 'function') {
    (window as any).requestAnimationFrame = () => 0;
    (window as any).cancelAnimationFrame = () => {};
  }
  // eslint-disable-next-line no-eval
  (0, eval)(brilliSource);
  // eslint-disable-next-line no-eval
  (0, eval)(syncSource);
  // eslint-disable-next-line no-eval
  (0, eval)(evolveSource);
  // eslint-disable-next-line no-eval
  (0, eval)(quizSource);
});

function getQE(): any { return (window as any).QuizEngine; }

function validQuiz() {
  return {
    id: 'q1',
    topic: 'Test',
    difficulty: 3,
    question: 'A long enough question for the validator',
    options: [
      { letter: 'A', body: 'Answer A' },
      { letter: 'B', body: 'Answer B', correct: true },
      { letter: 'C', body: 'Answer C' },
      { letter: 'D', body: 'Answer D' }
    ],
    whyMatrix: { A: 'Why A wrong', B: 'Why B right', C: 'Why C wrong', D: 'Why D wrong' },
    citation: 'Source ref'
  };
}

describe('QuizEngine.validateQuiz', () => {
  it('accepts a well-formed quiz', () => {
    expect(getQE().validateQuiz(validQuiz()).valid).toBe(true);
  });

  it('rejects non-object', () => {
    expect(getQE().validateQuiz(null).valid).toBe(false);
    expect(getQE().validateQuiz('a').valid).toBe(false);
  });

  it('rejects missing id', () => {
    const q = validQuiz(); delete (q as any).id;
    const r = getQE().validateQuiz(q);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/id/);
  });

  it('rejects difficulty out of range', () => {
    const q = validQuiz(); q.difficulty = 99;
    expect(getQE().validateQuiz(q).valid).toBe(false);
    q.difficulty = 0;
    expect(getQE().validateQuiz(q).valid).toBe(false);
  });

  it('rejects fewer than 4 options', () => {
    const q = validQuiz(); q.options = q.options.slice(0, 3);
    expect(getQE().validateQuiz(q).valid).toBe(false);
  });

  it('rejects wrong option letter', () => {
    const q = validQuiz(); q.options[1].letter = 'X';
    expect(getQE().validateQuiz(q).valid).toBe(false);
  });

  it('rejects zero correct options', () => {
    const q = validQuiz(); q.options.forEach((o: any) => { delete o.correct; });
    expect(getQE().validateQuiz(q).valid).toBe(false);
  });

  it('rejects multiple correct options', () => {
    const q = validQuiz();
    q.options[0].correct = true; q.options[1].correct = true;
    expect(getQE().validateQuiz(q).valid).toBe(false);
  });

  it('rejects missing whyMatrix entry', () => {
    const q = validQuiz(); delete (q.whyMatrix as any).C;
    expect(getQE().validateQuiz(q).valid).toBe(false);
  });

  it('rejects missing citation', () => {
    const q = validQuiz(); delete (q as any).citation;
    expect(getQE().validateQuiz(q).valid).toBe(false);
  });
});

describe('QuizEngine pool', () => {
  it('starts empty', () => {
    expect(getQE().getPool()).toEqual([]);
  });

  it('addQuiz appends valid quiz to pool', () => {
    getQE().addQuiz(validQuiz());
    const pool = getQE().getPool();
    expect(pool.length).toBe(1);
    expect(pool[0].quiz.id).toBe('q1');
    expect(typeof pool[0].addedAt).toBe('number');
    expect(pool[0].expiresAt).toBeGreaterThan(pool[0].addedAt);
  });

  it('addQuiz throws on invalid quiz', () => {
    expect(() => getQE().addQuiz({} as any)).toThrow(/Invalid quiz/);
  });

  it('nextQuiz returns first unexpired', () => {
    getQE().addQuiz(validQuiz());
    expect(getQE().nextQuiz().id).toBe('q1');
  });

  it('nextQuiz returns null when pool empty', () => {
    expect(getQE().nextQuiz()).toBeNull();
  });

  it('gc removes expired entries', () => {
    getQE().addQuiz(validQuiz());
    // Manually expire the entry
    const pool = getQE().getPool();
    pool[0].expiresAt = Date.now() - 1;
    window.localStorage.setItem('roweos_evolve_quiz_pool', JSON.stringify(pool));
    const expiredCount = getQE().gc();
    expect(expiredCount).toBe(1);
    expect(getQE().getPool().length).toBe(0);
  });
});

describe('QuizEngine.isEnabled', () => {
  it('false when Evolve disabled', () => {
    expect(getQE().isEnabled()).toBe(false);
  });

  it('false when Evolve enabled but no target goal', () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    expect(getQE().isEnabled()).toBe(false);
  });

  it('true when Evolve enabled + target goal set (auto-activates)', () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    (window as any).Evolve.setProfile({ targetGoal: 'Test goal' });
    expect(getQE().isEnabled()).toBe(true);
  });

  it('false when off-flag is set', () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    (window as any).Evolve.setProfile({ targetGoal: 'Test goal' });
    window.localStorage.setItem('roweos_evolve_quiz_engine_off', 'true');
    expect(getQE().isEnabled()).toBe(false);
  });
});

describe('QuizEngine.generateNightlyQuiz', () => {
  it('skipped when disabled', async () => {
    const r = await getQE().generateNightlyQuiz();
    expect(r.skipped).toBe(true);
  });

  it('skipped when no API key configured', async () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    (window as any).Evolve.setProfile({ targetGoal: 'Pass exam' });
    const r = await getQE().generateNightlyQuiz();
    expect(r.skipped).toBe(true);
    expect(r.reason).toMatch(/no api key/);
  });

  it('skipped when off-flag is set', async () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    (window as any).Evolve.setProfile({ targetGoal: 'Pass exam' });
    window.localStorage.setItem('roweos_evolve_quiz_engine_off', 'true');
    const r = await getQE().generateNightlyQuiz();
    expect(r.skipped).toBe(true);
  });
});
