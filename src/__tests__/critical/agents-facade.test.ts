/**
 * @file Tests for services/agents facade.
 *
 * Same defensive-then-delegation pattern as sync-facade.test.ts:
 *   - Throws when globals missing
 *   - Routes to globals with correct args
 *   - Type-only checks for ChatMessage / ContentBlock / AgentId
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as agents from '../../../services/agents/index';

beforeEach(() => {
  delete (window as any).callAnthropicStreaming;
  delete (window as any).callOpenAIStreaming;
  delete (window as any).getAgentSystemPrompt;
  delete (window as any).buildBrandSystemPrompt;
});

describe('services/agents — defensive', () => {
  it('callAnthropic throws when global missing', async () => {
    await expect(
      agents.callAnthropic({
        model: 'claude-opus-4-8',
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        apiKey: 'k',
      })
    ).rejects.toThrow(/callAnthropicStreaming unavailable/);
  });

  it('callOpenAI throws when global missing', async () => {
    await expect(
      agents.callOpenAI({
        model: 'gpt-5',
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        apiKey: 'k',
      })
    ).rejects.toThrow(/callOpenAIStreaming unavailable/);
  });

  it('getAgentSystemPrompt returns "" when global missing', () => {
    expect(agents.getAgentSystemPrompt('strategy')).toBe('');
  });

  it('buildBrandSystemPrompt returns "" when global missing', () => {
    expect(agents.buildBrandSystemPrompt({}, {})).toBe('');
  });
});

describe('services/agents — delegation', () => {
  it('callAnthropic forwards model + messages + system + key + callbacks', async () => {
    let capturedArgs: any = null;
    (window as any).callAnthropicStreaming = (
      model: string, key: string, msgs: any, sys: string,
      onChunk: any, onComplete: any, onError: any, abortSignal: any
    ) => {
      capturedArgs = { model, key, msgs, sys, hasOnChunk: typeof onChunk === 'function', hasOnComplete: typeof onComplete === 'function', hasOnError: typeof onError === 'function', abortSignal };
      return Promise.resolve();
    };
    const ctrl = new AbortController();
    await agents.callAnthropic({
      model: 'claude-opus-4-8',
      apiKey: 'sk_test',
      systemPrompt: 'sysprompt',
      messages: [{ role: 'user', content: 'hello' }],
      callbacks: {
        onChunk: () => {},
        onComplete: () => {},
        onError: () => {},
        abortSignal: ctrl.signal,
      },
    });
    expect(capturedArgs.model).toBe('claude-opus-4-8');
    expect(capturedArgs.key).toBe('sk_test');
    expect(capturedArgs.sys).toBe('sysprompt');
    expect(capturedArgs.msgs).toEqual([{ role: 'user', content: 'hello' }]);
    expect(capturedArgs.hasOnChunk).toBe(true);
    expect(capturedArgs.hasOnComplete).toBe(true);
    expect(capturedArgs.hasOnError).toBe(true);
    expect(capturedArgs.abortSignal).toBe(ctrl.signal);
  });

  it('callOpenAI forwards args', async () => {
    let received: any = null;
    (window as any).callOpenAIStreaming = (...args: any[]) => {
      received = args;
      return Promise.resolve();
    };
    await agents.callOpenAI({
      model: 'gpt-5',
      apiKey: 'k2',
      systemPrompt: 's',
      messages: [{ role: 'user', content: 'q' }],
    });
    expect(received[0]).toBe('gpt-5');
    expect(received[1]).toBe('k2');
    expect(received[2]).toEqual([{ role: 'user', content: 'q' }]);
    expect(received[3]).toBe('s');
  });

  it('getAgentSystemPrompt delegates with the requested id', () => {
    let askedFor = '';
    (window as any).getAgentSystemPrompt = (id: string) => { askedFor = id; return 'PROMPT_' + id; };
    expect(agents.getAgentSystemPrompt('marketing')).toBe('PROMPT_marketing');
    expect(askedFor).toBe('marketing');
  });

  it('buildBrandSystemPrompt delegates', () => {
    (window as any).buildBrandSystemPrompt = (b: any, a: any) => 'B[' + b.name + '] A[' + a.id + ']';
    expect(agents.buildBrandSystemPrompt({ name: 'TRC' }, { id: 'strategy' })).toBe('B[TRC] A[strategy]');
  });
});

describe('services/agents — type compatibility', () => {
  it('ChatMessage with string content compiles', () => {
    const m: agents.ChatMessage = { role: 'user', content: 'hi' };
    expect(m.role).toBe('user');
  });
  it('ChatMessage with ContentBlock array compiles', () => {
    const m: agents.ChatMessage = {
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
    };
    expect(Array.isArray(m.content)).toBe(true);
  });
  it('AgentId values compile', () => {
    const id: agents.AgentId = 'strategy';
    expect(id).toBe('strategy');
  });
});
