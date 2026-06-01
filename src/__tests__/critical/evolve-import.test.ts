/**
 * @file Evolve.importData / exportData round-trip tests.
 *
 * Locks in the v33.19 export + v33.20 import contract:
 *   - exportData includes profile + 4 collections + version + timestamp
 *   - importData rejects non-objects + unknown versions
 *   - importData refuses to overwrite existing profile without explicit consent
 *   - importData with merge=true preserves existing fields, overwrites overlapping
 *   - importData with confirmedReplace=true overwrites
 *   - Round-trip preserves IDs (cross-references stay valid)
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
  // No-op RAF so Brilli doesn't fire on jsdom canvas.
  (window as any).requestAnimationFrame = () => 0;
  (window as any).cancelAnimationFrame = () => {};
  // eslint-disable-next-line no-eval
  (0, eval)(brilliSource);
  // eslint-disable-next-line no-eval
  (0, eval)(syncSource);
  // eslint-disable-next-line no-eval
  (0, eval)(evolveSource);
});

function getEvolve(): any { return (window as any).Evolve; }

describe('Evolve.exportData', () => {
  it('returns version + exportedAt + profile + collections', () => {
    getEvolve().setProfile({ targetGoal: 'Test goal' });
    const snap = getEvolve().exportData();
    expect(snap.version).toBe('evolve-v1');
    expect(typeof snap.exportedAt).toBe('string');
    expect(snap.profile.targetGoal).toBe('Test goal');
    expect(snap.collections).toHaveProperty('skills');
    expect(snap.collections).toHaveProperty('sources');
    expect(snap.collections).toHaveProperty('reflections');
    expect(snap.collections).toHaveProperty('sops');
  });

  it('includes added skills', () => {
    getEvolve().setProfile({ targetGoal: 'X' });
    getEvolve().addSkill({ id: 'sk1', name: 'JS', xp: 100, target: 1000 });
    const snap = getEvolve().exportData();
    const found = snap.collections.skills.find((it: any) => it.id === 'sk1');
    expect(found).toBeTruthy();
    expect(found.data.name).toBe('JS');
  });
});

describe('Evolve.importData — validation', () => {
  it('rejects non-object', () => {
    expect(() => getEvolve().importData(null)).toThrow(/not an object/);
    expect(() => getEvolve().importData('a string')).toThrow(/not an object/);
    expect(() => getEvolve().importData(42)).toThrow(/not an object/);
  });

  it('rejects unknown version', () => {
    expect(() => getEvolve().importData({ version: 'evolve-v999', profile: {} })).toThrow(/Unsupported snapshot version/);
  });

  it('accepts snapshot with no version field (legacy)', () => {
    expect(() => getEvolve().importData({ profile: { targetGoal: 'Imported' } })).not.toThrow();
    expect(getEvolve().getProfile().targetGoal).toBe('Imported');
  });
});

describe('Evolve.importData — overwrite protection', () => {
  beforeEach(() => {
    getEvolve().setProfile({ targetGoal: 'EXISTING' });
  });

  it('refuses to overwrite without confirmedReplace or merge', () => {
    expect(() =>
      getEvolve().importData({
        version: 'evolve-v1',
        profile: { targetGoal: 'NEW' },
        collections: {}
      })
    ).toThrow(/Existing profile/);
    expect(getEvolve().getProfile().targetGoal).toBe('EXISTING');
  });

  it('confirmedReplace=true overwrites profile', () => {
    getEvolve().importData(
      {
        version: 'evolve-v1',
        profile: { targetGoal: 'NEW', currentXP: 500 },
        collections: {}
      },
      { confirmedReplace: true }
    );
    const p = getEvolve().getProfile();
    expect(p.targetGoal).toBe('NEW');
    expect(p.currentXP).toBe(500);
  });

  it('merge=true patches profile', () => {
    getEvolve().setProfile({ targetGoal: 'EXISTING', knownContext: ['orig'] });
    getEvolve().importData(
      {
        version: 'evolve-v1',
        profile: { currentXP: 250 }, // only XP
        collections: {}
      },
      { merge: true }
    );
    const p = getEvolve().getProfile();
    expect(p.targetGoal).toBe('EXISTING'); // preserved
    expect(p.currentXP).toBe(250);          // patched
  });
});

describe('Evolve.importData — collections', () => {
  it('imports skills with original ids', () => {
    const counts = getEvolve().importData(
      {
        version: 'evolve-v1',
        profile: { targetGoal: 'X' },
        collections: {
          skills: [
            { id: 'imported-1', data: { name: 'React' }, _modifiedAt: 100, _createdAt: 100 },
            { id: 'imported-2', data: { name: 'Vue' },   _modifiedAt: 200, _createdAt: 200 },
          ],
          sources: [],
          reflections: [],
          sops: []
        }
      },
      { confirmedReplace: true }
    );
    expect(counts.skills).toBe(2);
    const skills = getEvolve().listSkills();
    const ids = skills.map((s: any) => s.id).sort();
    expect(ids).toEqual(['imported-1', 'imported-2']);
  });

  it('skips tombstoned items by default', () => {
    const counts = getEvolve().importData(
      {
        version: 'evolve-v1',
        profile: { targetGoal: 'X' },
        collections: {
          skills: [
            { id: 's-live', data: { name: 'a' }, _modifiedAt: 100, _createdAt: 100 },
            { id: 's-dead', data: { name: 'b' }, _modifiedAt: 200, _createdAt: 100, _deletedAt: 150 },
          ],
          sources: [],
          reflections: [],
          sops: []
        }
      },
      { confirmedReplace: true }
    );
    expect(counts.skills).toBe(1);
  });

  it('includeDeleted=true imports tombstones too', () => {
    const counts = getEvolve().importData(
      {
        version: 'evolve-v1',
        profile: { targetGoal: 'X' },
        collections: {
          skills: [
            { id: 's-live', data: { name: 'a' }, _modifiedAt: 100, _createdAt: 100 },
            { id: 's-dead', data: { name: 'b' }, _modifiedAt: 200, _createdAt: 100, _deletedAt: 150 },
          ],
          sources: [],
          reflections: [],
          sops: []
        }
      },
      { confirmedReplace: true, includeDeleted: true }
    );
    expect(counts.skills).toBe(2);
  });
});

describe('Evolve — round-trip', () => {
  it('export → import preserves profile and skills', () => {
    getEvolve().setProfile({ targetGoal: 'Round trip', currentXP: 42, knownContext: ['x', 'y'] });
    getEvolve().addSkill({ id: 'rt1', name: 'Round trip skill', xp: 10, target: 100 });

    const snap = getEvolve().exportData();

    // Wipe everything via fresh load.
    delete (window as any).Evolve;
    delete (window as any).SyncV5;
    window.localStorage.clear();
    // eslint-disable-next-line no-eval
    (0, eval)(syncSource);
    // eslint-disable-next-line no-eval
    (0, eval)(evolveSource);

    getEvolve().importData(snap);
    const p = getEvolve().getProfile();
    expect(p.targetGoal).toBe('Round trip');
    expect(p.currentXP).toBe(42);
    expect(p.knownContext).toEqual(['x', 'y']);
    const skills = getEvolve().listSkills();
    const found = skills.find((s: any) => s.id === 'rt1');
    expect(found).toBeTruthy();
  });
});
