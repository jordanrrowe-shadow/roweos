/**
 * @file services/stripe/index.ts
 * @feature Stripe webhook + Checkout facade (v33.5 first cut)
 * @status in-progress
 *
 * Wraps the existing Stripe endpoints (`api/create-checkout-session.js`,
 * `api/create-api-key-checkout.js`, `api/create-portal-session.js`,
 * `api/stripe-webhook.js`) with strict TypeScript types and a small
 * verification helper that future tests + future replacements can rely on.
 */

export type CheckoutKind = 'subscription' | 'api_key_purchase';
export type ApiKeyProvider = 'anthropic' | 'openai' | 'google';

export interface StripeCheckoutSubscription {
  kind: 'subscription';
  tier: 'founder' | 'basic' | 'premium';
  uid?: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutApiKey {
  kind: 'api_key_purchase';
  provider: ApiKeyProvider;
  uid?: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}

export type StripeCheckoutRequest = StripeCheckoutSubscription | StripeCheckoutApiKey;

export interface StripeCheckoutResponse {
  url: string;
  sessionId: string;
}

const ENDPOINTS = {
  subscription: '/api/create-checkout-session',
  api_key_purchase: '/api/create-api-key-checkout',
  portal: '/api/create-portal-session',
} as const;

export async function createCheckout(req: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
  const url = req.kind === 'subscription' ? ENDPOINTS.subscription : ENDPOINTS.api_key_purchase;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error('[services/stripe] checkout failed (' + r.status + '): ' + body);
  }
  const data = await r.json();
  if (!data || typeof data.url !== 'string' || typeof data.sessionId !== 'string') {
    throw new Error('[services/stripe] checkout returned invalid response');
  }
  return data;
}

export async function createPortalSession(uid: string, returnUrl: string): Promise<{ url: string }> {
  const r = await fetch(ENDPOINTS.portal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, returnUrl }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error('[services/stripe] portal failed (' + r.status + '): ' + body);
  }
  return r.json();
}

/**
 * Webhook event shape (subset). Used for typing the receiver only — the actual
 * verification + processing lives in `api/stripe-webhook.js` which uses the
 * Stripe SDK with the raw signature header.
 */
export interface StripeWebhookEvent {
  id: string;
  type:
    | 'checkout.session.completed'
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted'
    | 'invoice.payment_failed'
    | (string & {});
  data: { object: Record<string, unknown> };
  created: number;
  livemode: boolean;
}

/**
 * Pure helper: classify a checkout.session.completed event into our two
 * purchase kinds. Production webhooks set `metadata.type` (legacy) — this
 * helper accepts either `type` or `kind` so future Checkout creators can use
 * the cleaner `kind` field.
 */
export function classifyCompletedCheckout(event: StripeWebhookEvent): CheckoutKind | null {
  if (event.type !== 'checkout.session.completed') return null;
  const session = event.data.object as Record<string, unknown>;
  const metadata = session?.metadata as Record<string, string> | undefined;
  const tag = metadata?.type ?? metadata?.kind;
  if (tag === 'api_key_purchase') return 'api_key_purchase';
  if (tag === 'subscription' || session?.mode === 'subscription') return 'subscription';
  return null;
}

/**
 * Map an api_key_purchase event to the provider whose pool the key should be
 * assigned from. Production webhooks may carry the provider on either the
 * session metadata or as a top-level field (legacy create-api-key-checkout).
 */
export function apiKeyProviderFromEvent(event: StripeWebhookEvent): ApiKeyProvider | null {
  const session = event.data.object as Record<string, unknown>;
  const metadata = session?.metadata as Record<string, string> | undefined;
  const provider =
    metadata?.provider ??
    metadata?.api_provider ??
    (session?.api_provider as string | undefined);
  if (provider === 'anthropic' || provider === 'openai' || provider === 'google') return provider;
  return null;
}
