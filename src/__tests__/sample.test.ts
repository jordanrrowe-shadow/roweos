import { describe, it, expect } from 'vitest';

// Sprint 0 sample test — proves the runner works end-to-end.
// Real critical-path tests (sync, agents, stripe) land in v33.5 Sprint 1+.
describe('vitest scaffold', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('has jsdom DOM available', () => {
    const div = document.createElement('div');
    div.textContent = 'brilliance';
    expect(div.textContent).toBe('brilliance');
  });
});
