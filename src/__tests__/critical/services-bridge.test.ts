/**
 * @file Tests for the runtime JS services bridge in 37-services-bridge.js.
 *
 * The bridge mirrors the TS facades (services/sync, services/agents) using plain JS
 * for callers that aren't going through esbuild yet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const bridgeSource = fs.readFileSync(path.resolve(__dirname, '../../js/core/37-services-bridge.js'), 'utf-8');

beforeEach(() => {
  delete (window as any).BrillianceServices;
  delete (window as any).writeDB;
  delete (window as any).readDB;
  delete (window as any).callAnthropicStreaming;
  delete (window as any).callOpenAIStreaming;
  delete (window as any).getAgentSystemPrompt;
  delete (window as any).buildBrandSystemPrompt;
  delete (window as any).firebaseUser;
  // eslint-disable-next-line no-eval
  (0, eval)(bridgeSource);
});

function getServices(): any { return (window as any).BrillianceServices; }

describe('BrillianceServices.sync — defensive', () => {
  it('writeDB rejects when global missing', async () => {
    await expect(getServices().sync.writeDB('a/b', { x: 1 })).rejects.toThrow(/writeDB unavailable/);
  });
  it('readDB rejects when global missing', async () => {
    await expect(getServices().sync.readDB('a/b')).rejects.toThrow(/readDB unavailable/);
  });
  it('writeDBDoc rejects when global missing', async () => {
    await expect(getServices().sync.writeDBDoc('coll', 'id', {})).rejects.toThrow(/writeDBDoc unavailable/);
  });

  it('mergeByTimestamp falls back to cloud when global missing', () => {
    expect(getServices().sync.mergeByTimestamp([{ id: 'a' }], [{ id: 'b' }])).toEqual([{ id: 'b' }]);
  });

  it('mergeByTimestamp falls back to local when cloud empty', () => {
    expect(getServices().sync.mergeByTimestamp([{ id: 'a' }], [])).toEqual([{ id: 'a' }]);
  });

  it('currentUser returns null when global missing', () => {
    expect(getServices().sync.currentUser()).toBeNull();
  });

  it('currentUser returns the user when set', () => {
    (window as any).firebaseUser = { uid: 'abc' };
    expect(getServices().sync.currentUser()).toEqual({ uid: 'abc' });
  });
});

describe('BrillianceServices.sync — delegation', () => {
  it('writeDB forwards to window.writeDB', async () => {
    let captured: any = null;
    (window as any).writeDB = (path: string, data: any) => {
      captured = { path, data };
      return Promise.resolve();
    };
    await getServices().sync.writeDB('test/path', { v: 1 });
    expect(captured).toEqual({ path: 'test/path', data: { v: 1 } });
  });

  it('readDB returns whatever the global returns', async () => {
    (window as any).readDB = () => Promise.resolve({ k: 'v' });
    expect(await getServices().sync.readDB('any')).toEqual({ k: 'v' });
  });

  it('mergeByTimestamp delegates when global available', () => {
    (window as any).mergeByTimestamp = () => [{ id: 'merged' }];
    expect(getServices().sync.mergeByTimestamp([], [])).toEqual([{ id: 'merged' }]);
  });
});

describe('BrillianceServices.agents — defensive', () => {
  it('callAnthropic rejects when global missing', async () => {
    await expect(
      getServices().agents.callAnthropic({ model: 'x', apiKey: 'y', systemPrompt: '', messages: [] })
    ).rejects.toThrow(/callAnthropicStreaming unavailable/);
  });

  it('callOpenAI rejects when global missing', async () => {
    await expect(
      getServices().agents.callOpenAI({ model: 'x', apiKey: 'y', systemPrompt: '', messages: [] })
    ).rejects.toThrow(/callOpenAIStreaming unavailable/);
  });

  it('getAgentSystemPrompt returns "" when global missing', () => {
    expect(getServices().agents.getAgentSystemPrompt('strategy')).toBe('');
  });

  it('buildBrandSystemPrompt returns "" when global missing', () => {
    expect(getServices().agents.buildBrandSystemPrompt({}, {})).toBe('');
  });
});

describe('BrillianceServices.agents — delegation', () => {
  it('callAnthropic forwards full args', async () => {
    let received: any[] = [];
    (window as any).callAnthropicStreaming = (...args: any[]) => {
      received = args;
      return Promise.resolve();
    };
    await getServices().agents.callAnthropic({
      model: 'm', apiKey: 'k', systemPrompt: 's', messages: [{ role: 'user', content: 'q' }],
      callbacks: { onChunk: () => {}, onComplete: () => {}, onError: () => {} }
    });
    expect(received[0]).toBe('m');
    expect(received[1]).toBe('k');
    expect(received[2]).toEqual([{ role: 'user', content: 'q' }]);
    expect(received[3]).toBe('s');
    expect(typeof received[4]).toBe('function');
    expect(typeof received[5]).toBe('function');
    expect(typeof received[6]).toBe('function');
  });

  it('getAgentSystemPrompt delegates with id', () => {
    (window as any).getAgentSystemPrompt = (id: string) => 'PROMPT_' + id;
    expect(getServices().agents.getAgentSystemPrompt('marketing')).toBe('PROMPT_marketing');
  });

  it('dispatch routes to correct provider', async () => {
    let lastProvider = '';
    (window as any).callAnthropicStreaming = () => { lastProvider = 'anthropic'; return Promise.resolve(); };
    (window as any).callOpenAIStreaming = () => { lastProvider = 'openai'; return Promise.resolve(); };
    (window as any).callGoogleStreaming = () => { lastProvider = 'google'; return Promise.resolve(); };
    (window as any).callNanobananaStreaming = () => { lastProvider = 'nanobanana'; return Promise.resolve(); };
    const opts = { model: 'm', apiKey: 'k', systemPrompt: '', messages: [] };
    await getServices().agents.dispatch('anthropic', opts);
    expect(lastProvider).toBe('anthropic');
    await getServices().agents.dispatch('openai', opts);
    expect(lastProvider).toBe('openai');
    await getServices().agents.dispatch('google', opts);
    expect(lastProvider).toBe('google');
    await getServices().agents.dispatch('nanobanana', opts);
    expect(lastProvider).toBe('nanobanana');
  });

  it('dispatch falls back to anthropic for unknown provider', async () => {
    let routedToAnthropic = false;
    (window as any).callAnthropicStreaming = () => { routedToAnthropic = true; return Promise.resolve(); };
    await getServices().agents.dispatch('mistral' as any, { model: 'm', apiKey: 'k', systemPrompt: '', messages: [] });
    expect(routedToAnthropic).toBe(true);
  });

  it('callGoogle rejects when global missing', async () => {
    delete (window as any).callGoogleStreaming;
    await expect(
      getServices().agents.callGoogle({ model: 'x', apiKey: 'y', systemPrompt: '', messages: [] })
    ).rejects.toThrow(/callGoogleStreaming unavailable/);
  });

  it('callNanobanana rejects when global missing', async () => {
    delete (window as any).callNanobananaStreaming;
    await expect(
      getServices().agents.callNanobanana({ model: 'x', apiKey: 'y', systemPrompt: '', messages: [] })
    ).rejects.toThrow(/callNanobananaStreaming unavailable/);
  });
});
