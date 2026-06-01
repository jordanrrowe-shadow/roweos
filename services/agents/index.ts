/**
 * @file services/agents/index.ts
 * @feature Agent system facade (v33.5 first cut)
 * @status in-progress
 *
 * Wraps the existing agent system in `src/js/core/11-agents.js` and the
 * streaming call paths in `src/js/core/13-studio.js` (callAnthropicStreaming,
 * callOpenAIStreaming) with strict TypeScript types.
 *
 * v33.5+ surfaces should import from `services/agents` rather than touching
 * globals. Implementation behind this facade swaps without callers changing.
 */

export type AgentId =
  | 'strategy'
  | 'marketing'
  | 'operations'
  | 'documents'
  | 'intelligence'
  | 'research'
  | 'image'
  | 'infographic'
  | 'social'
  | 'guided'
  | 'helper'
  | 'coach'
  | 'wellness'
  | 'tax'
  | 'personal'
  | 'standard';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { data: string; media_type: string } }
  | { type: 'tool_use'; name: string; input: unknown };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export interface StreamCallbacks {
  onChunk?: (text: string) => void;
  onComplete?: (full: string) => void;
  onError?: (err: Error) => void;
  abortSignal?: AbortSignal;
}

declare global {
  interface Window {
    callAnthropicStreaming?: (
      model: string,
      apiKey: string,
      messages: ChatMessage[],
      systemPrompt: string,
      onChunk?: (s: string) => void,
      onComplete?: (s: string) => void,
      onError?: (e: Error) => void,
      abortSignal?: AbortSignal
    ) => Promise<unknown>;
    callOpenAIStreaming?: (
      model: string,
      apiKey: string,
      messages: ChatMessage[],
      systemPrompt: string,
      onChunk?: (s: string) => void,
      onComplete?: (s: string) => void,
      onError?: (e: Error) => void,
      abortSignal?: AbortSignal
    ) => Promise<unknown>;
    callGoogleStreaming?: (
      model: string,
      apiKey: string,
      messages: ChatMessage[],
      systemPrompt: string,
      onChunk?: (s: string) => void,
      onComplete?: (s: string) => void,
      onError?: (e: Error) => void,
      abortSignal?: AbortSignal
    ) => Promise<unknown>;
    callNanobananaStreaming?: (
      model: string,
      apiKey: string,
      messages: ChatMessage[],
      systemPrompt: string,
      onChunk?: (s: string) => void,
      onComplete?: (s: string) => void,
      onError?: (e: Error) => void,
      abortSignal?: AbortSignal
    ) => Promise<unknown>;
    getAgentSystemPrompt?: (agentId: string) => string;
    buildBrandSystemPrompt?: (brand: unknown, agent: unknown) => string;
  }
}

export type Provider = 'anthropic' | 'openai' | 'google' | 'nanobanana';

export interface CallOptions {
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  apiKey: string;
  callbacks?: StreamCallbacks;
}

export async function callAnthropic(opts: CallOptions): Promise<void> {
  if (typeof window === 'undefined' || !window.callAnthropicStreaming) {
    throw new Error('[services/agents] callAnthropicStreaming unavailable');
  }
  await window.callAnthropicStreaming(
    opts.model,
    opts.apiKey,
    opts.messages,
    opts.systemPrompt,
    opts.callbacks?.onChunk,
    opts.callbacks?.onComplete,
    opts.callbacks?.onError,
    opts.callbacks?.abortSignal
  );
}

export async function callOpenAI(opts: CallOptions): Promise<void> {
  if (typeof window === 'undefined' || !window.callOpenAIStreaming) {
    throw new Error('[services/agents] callOpenAIStreaming unavailable');
  }
  await window.callOpenAIStreaming(
    opts.model,
    opts.apiKey,
    opts.messages,
    opts.systemPrompt,
    opts.callbacks?.onChunk,
    opts.callbacks?.onComplete,
    opts.callbacks?.onError,
    opts.callbacks?.abortSignal
  );
}

export async function callGoogle(opts: CallOptions): Promise<void> {
  if (typeof window === 'undefined' || !window.callGoogleStreaming) {
    throw new Error('[services/agents] callGoogleStreaming unavailable');
  }
  await window.callGoogleStreaming(
    opts.model,
    opts.apiKey,
    opts.messages,
    opts.systemPrompt,
    opts.callbacks?.onChunk,
    opts.callbacks?.onComplete,
    opts.callbacks?.onError,
    opts.callbacks?.abortSignal
  );
}

export async function callNanobanana(opts: CallOptions): Promise<void> {
  if (typeof window === 'undefined' || !window.callNanobananaStreaming) {
    throw new Error('[services/agents] callNanobananaStreaming unavailable');
  }
  await window.callNanobananaStreaming(
    opts.model,
    opts.apiKey,
    opts.messages,
    opts.systemPrompt,
    opts.callbacks?.onChunk,
    opts.callbacks?.onComplete,
    opts.callbacks?.onError,
    opts.callbacks?.abortSignal
  );
}

/**
 * Provider-routed dispatcher. Single entry point for chat surfaces.
 * Falls back to Anthropic when the provider is unknown.
 */
export async function dispatch(provider: Provider, opts: CallOptions): Promise<void> {
  switch (provider) {
    case 'anthropic':   return callAnthropic(opts);
    case 'openai':      return callOpenAI(opts);
    case 'google':      return callGoogle(opts);
    case 'nanobanana':  return callNanobanana(opts);
    default:            return callAnthropic(opts);
  }
}

export function getAgentSystemPrompt(agentId: AgentId): string {
  if (typeof window === 'undefined' || !window.getAgentSystemPrompt) return '';
  return window.getAgentSystemPrompt(agentId);
}

export function buildBrandSystemPrompt(brand: unknown, agent: unknown): string {
  if (typeof window === 'undefined' || !window.buildBrandSystemPrompt) return '';
  return window.buildBrandSystemPrompt(brand, agent);
}
