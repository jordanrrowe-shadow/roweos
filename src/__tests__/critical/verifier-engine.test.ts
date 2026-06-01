/**
 * @file VerifierEngine schema + extractor + pipeline tests (Sprint E scaffold).
 *
 * Locks in:
 *   - validateResult enforces verdict, reasoning length, confidence range
 *   - VERIFIED requires >= 3 citations; CORRECTED requires >= 1
 *   - extractCitations parses markdown links
 *   - isEnabled gating
 *   - runPeerReview returns skipped when flag off / no claim
 *   - synthesize-stub returns insufficient when no citations
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const brilliSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/34-brilli.js'), 'utf-8');
const syncSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/35-sync-v5.js'), 'utf-8');
const evolveSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/36-evolve.js'), 'utf-8');
const verifierSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/39-verifier-engine.js'), 'utf-8');

beforeEach(() => {
  delete (window as any).Brilli;
  delete (window as any).SyncV5;
  delete (window as any).Evolve;
  delete (window as any).VerifierEngine;
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
  (0, eval)(verifierSource);
});

function getVE(): any { return (window as any).VerifierEngine; }

function validResult(over: any = {}) {
  return {
    claim: 'Test claim about a fact',
    verdict: 'verified',
    reasoning: 'Sources confirm the claim with consistent reasoning.',
    confidence: 4,
    citations: [
      { source: 'Source A', url: 'https://a.example' },
      { source: 'Source B', url: 'https://b.example' },
      { source: 'Source C' }
    ],
    checkedAt: Date.now(),
    models: ['gemini-deep-research', 'gpt-5.5-pro'],
    ...over
  };
}

describe('VerifierEngine.validateResult', () => {
  it('accepts well-formed verified result', () => {
    expect(getVE().validateResult(validResult()).valid).toBe(true);
  });

  it('rejects non-object', () => {
    expect(getVE().validateResult(null).valid).toBe(false);
  });

  it('rejects unknown verdict', () => {
    expect(getVE().validateResult(validResult({ verdict: 'maybe' })).valid).toBe(false);
  });

  it('rejects too-short reasoning', () => {
    expect(getVE().validateResult(validResult({ reasoning: 'no' })).valid).toBe(false);
  });

  it('rejects confidence out of 1-5', () => {
    expect(getVE().validateResult(validResult({ confidence: 0 })).valid).toBe(false);
    expect(getVE().validateResult(validResult({ confidence: 6 })).valid).toBe(false);
  });

  it('rejects VERIFIED with < 3 citations', () => {
    const r = validResult({ verdict: 'verified', citations: [{ source: 'only one' }] });
    const v = getVE().validateResult(r);
    expect(v.valid).toBe(false);
    expect(v.error).toMatch(/3 citations/);
  });

  it('accepts CORRECTED with 1 citation', () => {
    expect(
      getVE().validateResult(validResult({ verdict: 'corrected', citations: [{ source: 'one' }] })).valid
    ).toBe(true);
  });

  it('rejects CORRECTED with 0 citations', () => {
    expect(
      getVE().validateResult(validResult({ verdict: 'corrected', citations: [] })).valid
    ).toBe(false);
  });

  it('accepts INSUFFICIENT with 0 citations', () => {
    expect(
      getVE().validateResult(validResult({ verdict: 'insufficient', citations: [] })).valid
    ).toBe(true);
  });

  it('rejects missing models array', () => {
    const r = validResult();
    delete r.models;
    expect(getVE().validateResult(r).valid).toBe(false);
  });
});

describe('VerifierEngine.extractCitations', () => {
  it('extracts markdown-link citations', () => {
    const text = 'See [Source A](https://a.example) and [Source B](https://b.example).';
    const c = getVE().extractCitations(text);
    expect(c.length).toBe(2);
    expect(c[0].source).toBe('Source A');
    expect(c[0].url).toBe('https://a.example');
  });

  it('returns empty array on null/empty input', () => {
    expect(getVE().extractCitations(null)).toEqual([]);
    expect(getVE().extractCitations('')).toEqual([]);
  });

  it('returns empty when no links present', () => {
    expect(getVE().extractCitations('plain text without links')).toEqual([]);
  });
});

describe('VerifierEngine.isEnabled', () => {
  it('false when Evolve disabled', () => {
    expect(getVE().isEnabled()).toBe(false);
  });

  it('true when Evolve enabled (auto-activates)', () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    expect(getVE().isEnabled()).toBe(true);
  });

  it('false when off-flag is set', () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    window.localStorage.setItem('roweos_evolve_verifier_engine_off', 'true');
    expect(getVE().isEnabled()).toBe(false);
  });
});

describe('VerifierEngine.runPeerReview', () => {
  it('skipped when disabled', async () => {
    const r = await getVE().runPeerReview('Some claim');
    expect(r.skipped).toBe(true);
  });

  it('skipped when claim missing', async () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    const r = await getVE().runPeerReview('');
    expect(r.skipped).toBe(true);
  });

  it('synthesizes insufficient verdict when no API keys configured', async () => {
    window.localStorage.setItem('roweos_evolve_enabled', 'true');
    const r = await getVE().runPeerReview('Test claim');
    // No keys → both stages return their "unavailable" branch → insufficient verdict.
    expect(r.verdict).toBe('insufficient');
    expect(r.claim).toBe('Test claim');
    expect(Array.isArray(r.models)).toBe(true);
  });
});
