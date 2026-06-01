/**
 * @file Surface-mode toggle tests for the v33.67–v33.76 Tier 1/2 ships.
 *
 * Locks in:
 *   - FocusMode.toggle adds/removes body.focus-mode and respects the disabled flag
 *   - LetterSeries.toggle adds/removes body.letter-series and persists
 *   - SplitPane.toggle adds/removes body.studio-split-pane and persists
 *   - FolioEasel.toggle adds/removes body.folio-easel and persists
 *   - ThoughtBoard.addPin / removePin / setMode round-trip via localStorage
 *   - TimeRibbon.render emits the empty-state when agentCommands is empty
 *
 * These are pure behavioral tests — no DOM rendering, no canvas, no remote IO.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const focusSrc = fs.readFileSync(path.resolve(__dirname, '../../js/core/40-focus-mode.js'), 'utf-8');
const ribbonSrc = fs.readFileSync(path.resolve(__dirname, '../../js/core/41-time-ribbon.js'), 'utf-8');
const letterSrc = fs.readFileSync(path.resolve(__dirname, '../../js/core/42-letter-series.js'), 'utf-8');
const boardSrc = fs.readFileSync(path.resolve(__dirname, '../../js/core/43-thought-board.js'), 'utf-8');
const splitSrc = fs.readFileSync(path.resolve(__dirname, '../../js/core/44-split-pane.js'), 'utf-8');
const easelSrc = fs.readFileSync(path.resolve(__dirname, '../../js/core/45-folio-easel.js'), 'utf-8');

beforeEach(() => {
  // Reset globals + body class state.
  delete (window as any).FocusMode;
  delete (window as any).LetterSeries;
  delete (window as any).SplitPane;
  delete (window as any).FolioEasel;
  delete (window as any).ThoughtBoard;
  delete (window as any).TimeRibbon;
  delete (window as any).agentCommands;
  if (document.body) document.body.className = '';
  try { window.localStorage.clear(); } catch {}

  // eslint-disable-next-line no-eval
  (0, eval)(focusSrc);
  // eslint-disable-next-line no-eval
  (0, eval)(ribbonSrc);
  // eslint-disable-next-line no-eval
  (0, eval)(letterSrc);
  // eslint-disable-next-line no-eval
  (0, eval)(boardSrc);
  // eslint-disable-next-line no-eval
  (0, eval)(splitSrc);
  // eslint-disable-next-line no-eval
  (0, eval)(easelSrc);
});

describe('FocusMode', () => {
  it('toggle adds then removes body.focus-mode', () => {
    expect(document.body.classList.contains('focus-mode')).toBe(false);
    (window as any).FocusMode.toggle();
    expect(document.body.classList.contains('focus-mode')).toBe(true);
    (window as any).FocusMode.toggle();
    expect(document.body.classList.contains('focus-mode')).toBe(false);
  });

  it('respects roweos_focus_mode_disabled flag', () => {
    window.localStorage.setItem('roweos_focus_mode_disabled', 'true');
    (window as any).FocusMode.toggle();
    expect(document.body.classList.contains('focus-mode')).toBe(false);
  });

  it('exit() clears the class without toggling', () => {
    document.body.classList.add('focus-mode');
    (window as any).FocusMode.exit();
    expect(document.body.classList.contains('focus-mode')).toBe(false);
  });

  it('isOn reflects current body state', () => {
    expect((window as any).FocusMode.isOn()).toBe(false);
    document.body.classList.add('focus-mode');
    expect((window as any).FocusMode.isOn()).toBe(true);
  });
});

describe('LetterSeries', () => {
  it('toggle persists to localStorage', () => {
    (window as any).LetterSeries.toggle();
    expect(window.localStorage.getItem('roweos_letter_series')).toBe('true');
    expect(document.body.classList.contains('letter-series')).toBe(true);
    (window as any).LetterSeries.toggle();
    expect(window.localStorage.getItem('roweos_letter_series')).toBe('false');
  });

  it('apply(true) idempotent', () => {
    (window as any).LetterSeries.apply(true);
    (window as any).LetterSeries.apply(true);
    expect(document.body.classList.contains('letter-series')).toBe(true);
  });
});

describe('SplitPane', () => {
  it('toggle persists + flips body class', () => {
    (window as any).SplitPane.toggle();
    expect(document.body.classList.contains('studio-split-pane')).toBe(true);
    expect(window.localStorage.getItem('roweos_studio_split_pane')).toBe('true');
    (window as any).SplitPane.toggle();
    expect(document.body.classList.contains('studio-split-pane')).toBe(false);
  });
});

describe('FolioEasel', () => {
  it('toggle persists + flips body class', () => {
    (window as any).FolioEasel.toggle();
    expect(document.body.classList.contains('folio-easel')).toBe(true);
    expect(window.localStorage.getItem('roweos_folio_easel')).toBe('true');
    (window as any).FolioEasel.toggle();
    expect(document.body.classList.contains('folio-easel')).toBe(false);
  });
});

describe('ThoughtBoard', () => {
  it('addPin appends, getPins reads back', () => {
    const TB = (window as any).ThoughtBoard;
    expect(TB.getPins()).toEqual([]);
    const p = TB.addPin({ kind: 'note', title: 'first', body: 'body' });
    expect(p.id).toBeTruthy();
    expect(TB.getPins().length).toBe(1);
    expect(TB.getPins()[0].title).toBe('first');
  });

  it('removePin removes by id', () => {
    const TB = (window as any).ThoughtBoard;
    const a = TB.addPin({ title: 'a' });
    const b = TB.addPin({ title: 'b' });
    TB.removePin(a.id);
    const pins = TB.getPins();
    expect(pins.length).toBe(1);
    expect(pins[0].id).toBe(b.id);
  });

  it('setMode flips between pinboard and constellation', () => {
    const TB = (window as any).ThoughtBoard;
    TB.setMode('constellation');
    expect(TB.getMode()).toBe('constellation');
    TB.setMode('pinboard');
    expect(TB.getMode()).toBe('pinboard');
  });

  it('setMode rejects unknown values', () => {
    const TB = (window as any).ThoughtBoard;
    TB.setMode('pinboard');
    TB.setMode('garbage');
    expect(TB.getMode()).toBe('pinboard');
  });

  it('persists pins to localStorage', () => {
    const TB = (window as any).ThoughtBoard;
    TB.addPin({ title: 'persisted' });
    const raw = window.localStorage.getItem('roweos_thought_board');
    expect(raw).toBeTruthy();
    const arr = JSON.parse(raw!);
    expect(arr[0].title).toBe('persisted');
  });
});

describe('TimeRibbon', () => {
  beforeEach(() => {
    // Mount the DOM hooks the ribbon expects so render() doesn't no-op.
    document.body.innerHTML = `
      <div id="timeRibbon" data-state="">
        <span id="timeRibbonSummary"></span>
        <button id="timeRibbonSummarize" disabled></button>
        <div id="timeRibbonMarkers"></div>
        <div id="timeRibbonAxisLabels"></div>
        <div id="timeRibbonDetail" hidden></div>
        <div id="timeRibbonCursor" hidden></div>
      </div>
    `;
  });

  it('render with no agentCommands → empty state', () => {
    (window as any).agentCommands = [];
    (window as any).TimeRibbon.render();
    const ribbon = document.getElementById('timeRibbon');
    expect(ribbon!.getAttribute('data-state')).toBe('empty');
  });

  it('render with conversations → ready state + markers', () => {
    (window as any).agentCommands = [
      { id: 1, _modifiedAt: 1000, command: 'first', mode: 'brand' },
      { id: 2, _modifiedAt: 2000, command: 'second', mode: 'life' },
      { id: 3, _modifiedAt: 3000, command: 'third', mode: 'brand' }
    ];
    (window as any).TimeRibbon.render();
    const ribbon = document.getElementById('timeRibbon');
    expect(ribbon!.getAttribute('data-state')).toBe('ready');
    const markers = document.getElementById('timeRibbonMarkers');
    expect(markers!.children.length).toBe(3);
  });

  it('skips preliminary entries', () => {
    (window as any).agentCommands = [
      { id: 1, _modifiedAt: 1000, command: 'kept', mode: 'brand' },
      { id: 2, _modifiedAt: 2000, command: 'dropped', mode: 'brand', preliminary: true }
    ];
    (window as any).TimeRibbon.render();
    const markers = document.getElementById('timeRibbonMarkers');
    expect(markers!.children.length).toBe(1);
  });

  it('respects roweos_deleted_chat_ids tombstones', () => {
    (window as any).agentCommands = [
      { id: 1, _modifiedAt: 1000, command: 'kept', mode: 'brand' },
      { id: 2, _modifiedAt: 2000, command: 'tombstoned', mode: 'brand' }
    ];
    window.localStorage.setItem('roweos_deleted_chat_ids', JSON.stringify([2]));
    (window as any).TimeRibbon.render();
    const markers = document.getElementById('timeRibbonMarkers');
    expect(markers!.children.length).toBe(1);
  });

  it('respects roweos_deleted_life_chat_ids tombstones', () => {
    (window as any).agentCommands = [
      { id: 1, _modifiedAt: 1000, command: 'kept-life', mode: 'life' },
      { id: 2, _modifiedAt: 2000, command: 'tombstoned-life', mode: 'life' }
    ];
    window.localStorage.setItem('roweos_deleted_life_chat_ids', JSON.stringify([2]));
    (window as any).TimeRibbon.render();
    const markers = document.getElementById('timeRibbonMarkers');
    expect(markers!.children.length).toBe(1);
  });
});
