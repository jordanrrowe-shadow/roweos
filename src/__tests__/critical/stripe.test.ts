import { describe, it, expect } from 'vitest';
import {
  classifyCompletedCheckout,
  apiKeyProviderFromEvent,
  type StripeWebhookEvent,
} from '../../../services/stripe/index';

function ev(over: Partial<StripeWebhookEvent>): StripeWebhookEvent {
  return {
    id: 'evt_test',
    type: 'checkout.session.completed',
    data: { object: {} },
    created: Date.now(),
    livemode: false,
    ...over,
  };
}

describe('stripe — classifyCompletedCheckout', () => {
  it('returns null for non-completed event', () => {
    expect(classifyCompletedCheckout(ev({ type: 'customer.subscription.updated' }))).toBeNull();
  });

  it('classifies api_key_purchase via metadata.kind', () => {
    expect(
      classifyCompletedCheckout(
        ev({ data: { object: { metadata: { kind: 'api_key_purchase', provider: 'anthropic' } } } })
      )
    ).toBe('api_key_purchase');
  });

  it('classifies api_key_purchase via metadata.type (production legacy)', () => {
    expect(
      classifyCompletedCheckout(
        ev({ data: { object: { metadata: { type: 'api_key_purchase' } } } })
      )
    ).toBe('api_key_purchase');
  });

  it('classifies subscription via metadata.kind', () => {
    expect(
      classifyCompletedCheckout(ev({ data: { object: { metadata: { kind: 'subscription' } } } }))
    ).toBe('subscription');
  });

  it('classifies subscription via metadata.type', () => {
    expect(
      classifyCompletedCheckout(ev({ data: { object: { metadata: { type: 'subscription' } } } }))
    ).toBe('subscription');
  });

  it('classifies subscription via session.mode fallback when metadata absent', () => {
    expect(
      classifyCompletedCheckout(ev({ data: { object: { mode: 'subscription' } } }))
    ).toBe('subscription');
  });

  it('returns null when nothing distinguishing', () => {
    expect(classifyCompletedCheckout(ev({ data: { object: {} } }))).toBeNull();
  });
});

describe('stripe — apiKeyProviderFromEvent', () => {
  it('returns provider when valid', () => {
    expect(
      apiKeyProviderFromEvent(
        ev({ data: { object: { metadata: { provider: 'anthropic' } } } })
      )
    ).toBe('anthropic');
    expect(
      apiKeyProviderFromEvent(
        ev({ data: { object: { metadata: { provider: 'openai' } } } })
      )
    ).toBe('openai');
    expect(
      apiKeyProviderFromEvent(
        ev({ data: { object: { metadata: { provider: 'google' } } } })
      )
    ).toBe('google');
  });

  it('returns null on unknown provider', () => {
    expect(
      apiKeyProviderFromEvent(
        ev({ data: { object: { metadata: { provider: 'mistral' } } } })
      )
    ).toBeNull();
  });

  it('returns null when metadata missing', () => {
    expect(apiKeyProviderFromEvent(ev({ data: { object: {} } }))).toBeNull();
  });

  it('falls back to metadata.api_provider', () => {
    expect(
      apiKeyProviderFromEvent(
        ev({ data: { object: { metadata: { api_provider: 'openai' } } } })
      )
    ).toBe('openai');
  });

  it('falls back to top-level session.api_provider', () => {
    expect(
      apiKeyProviderFromEvent(ev({ data: { object: { api_provider: 'google' } } }))
    ).toBe('google');
  });
});
