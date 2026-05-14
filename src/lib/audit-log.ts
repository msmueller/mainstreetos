/**
 * MainStreetOS · Click-Wrap Signing — Audit Event Logger
 *
 * Single chokepoint for writing to sign_events. Every state change, every
 * client interaction, every server-side validation is logged through here.
 *
 * Design principles:
 *   - Append-only. Never UPDATE or DELETE rows in sign_events.
 *   - Atomic. The event row is inserted in the same transaction as any
 *     state change it describes (handled in the calling code).
 *   - Hashed. Each event gets a SHA-256 of its canonical content for integrity.
 *   - Captures attribution at the moment of every event (IP, UA, geolocation).
 */

import { createClient } from '@supabase/supabase-js';
import { sha256Hex } from './signing-tokens';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ----------------------------------------------------------------------------
// Event taxonomy
// ----------------------------------------------------------------------------
// Keep this list in sync with the architecture document section 4.

export type SigningEventType =
  // Envelope lifecycle
  | 'envelope.created'
  | 'envelope.sent'
  | 'envelope.opened'           // first open by any signer
  | 'envelope.signed'           // all signers complete
  | 'envelope.declined'
  | 'envelope.expired'
  | 'envelope.voided'
  // Per-signer lifecycle
  | 'signer.invited'
  | 'signer.opened'             // this signer opened the link
  | 'signer.viewing'            // sustained presence (heartbeat)
  | 'signer.agreed'             // checked consent box
  | 'signer.signed'             // completed signature
  | 'signer.declined'
  // User interactions
  | 'scroll.25' | 'scroll.50' | 'scroll.75' | 'scroll.100'
  | 'field.entered'
  | 'field.changed'
  | 'field.cleared'
  | 'consent.given'
  | 'consent.withdrawn'
  // Server validations
  | 'validation.passed'
  | 'validation.failed'
  // Security
  | 'security.token_invalid'
  | 'security.token_expired'
  | 'security.token_consumed'
  | 'security.replay_attempt'
  | 'security.ip_changed'
  | 'security.ua_changed'
  | 'security.scroll_skipped';  // tried to sign without scrolling whole doc

export type AttributionContext = {
  ipAddress?: string;
  userAgent?: string;
  geolocation?: { country?: string; region?: string; city?: string };
  sessionId?: string;
};

export type EventInput = {
  envelopeId: string;
  signerId?: string;
  eventType: SigningEventType;
  documentSha256?: string;
  disclosureSha256?: string;
  payload?: Record<string, any>;
  attribution?: AttributionContext;
};

// ----------------------------------------------------------------------------
// The logger
// ----------------------------------------------------------------------------

/**
 * Write a single audit event. Returns the inserted row's id (bigint).
 * 
 * This function NEVER throws on logging failure — audit logging must not
 * block the user's signing flow. Errors are logged to console and the
 * caller continues. (For mission-critical events you'd queue + retry.)
 */
export async function logEvent(input: EventInput): Promise<number | null> {
  try {
    const eventContent = canonicalEventContent(input);
    const eventSha256 = sha256Hex(eventContent);

    const { data, error } = await supabase
      .from('sign_events')
      .insert({
        envelope_id:        input.envelopeId,
        signer_id:          input.signerId ?? null,
        event_type:         input.eventType,
        ip_address:         input.attribution?.ipAddress ?? null,
        user_agent:         input.attribution?.userAgent ?? null,
        geolocation:        input.attribution?.geolocation ?? null,
        session_id:         input.attribution?.sessionId ?? null,
        document_sha256:    input.documentSha256 ?? null,
        disclosure_sha256:  input.disclosureSha256 ?? null,
        payload:            input.payload ?? null,
        event_sha256:       eventSha256,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[audit-log] insert failed:', error.message, input);
      return null;
    }
    return data.id;
  } catch (err: any) {
    console.error('[audit-log] unexpected error:', err.message);
    return null;
  }
}

/** Convenience: log multiple events in order. */
export async function logEvents(inputs: EventInput[]): Promise<(number | null)[]> {
  return Promise.all(inputs.map(logEvent));
}

// ----------------------------------------------------------------------------
// Attribution extraction from incoming HTTP requests
// ----------------------------------------------------------------------------

/**
 * Pull attribution context from a Next.js Request. Vercel forwards the real
 * client IP in x-forwarded-for; we take the first entry (the original client).
 */
export function attributionFromRequest(req: Request): AttributionContext {
  const headers = req.headers;
  const xff = headers.get('x-forwarded-for') ?? '';
  const ipAddress = xff.split(',')[0]?.trim() || headers.get('x-real-ip') || undefined;
  const userAgent = headers.get('user-agent') ?? undefined;

  // Vercel-specific geolocation headers (free tier provides country only)
  const geolocation: AttributionContext['geolocation'] = {};
  const country = headers.get('x-vercel-ip-country');
  const region  = headers.get('x-vercel-ip-country-region');
  const city    = headers.get('x-vercel-ip-city');
  if (country) geolocation.country = country;
  if (region) geolocation.region = region;
  if (city) geolocation.city = decodeURIComponent(city);

  return {
    ipAddress,
    userAgent,
    geolocation: Object.keys(geolocation).length ? geolocation : undefined,
    sessionId: headers.get('x-mainstreetos-session') ?? undefined,
  };
}

// ----------------------------------------------------------------------------
// Event canonicalization (for hashing)
// ----------------------------------------------------------------------------

/**
 * Produce a deterministic byte representation of an event for hashing.
 * Stable ordering of keys, no whitespace variations.
 */
function canonicalEventContent(input: EventInput): string {
  const obj = {
    envelopeId:        input.envelopeId,
    signerId:          input.signerId ?? null,
    eventType:         input.eventType,
    documentSha256:    input.documentSha256 ?? null,
    disclosureSha256:  input.disclosureSha256 ?? null,
    payload:           sortObjectKeys(input.payload ?? null),
    attribution: {
      ipAddress:   input.attribution?.ipAddress ?? null,
      userAgent:   input.attribution?.userAgent ?? null,
      geolocation: sortObjectKeys(input.attribution?.geolocation ?? null),
      sessionId:   input.attribution?.sessionId ?? null,
    },
    occurredAtMs: Date.now(),
  };
  return JSON.stringify(obj);
}

function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted: any = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = sortObjectKeys(obj[k]);
  }
  return sorted;
}
