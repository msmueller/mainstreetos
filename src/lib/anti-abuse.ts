/**
 * MainStreetOS · Anti-abuse for the public per-listing "Start NDA" page
 *
 * The public Start NDA page (Build Spec v1.0 §5) mints a legally binding
 * envelope for an UNAUTHENTICATED visitor who supplies only a name + email.
 * Two gates stand in front of the mint, both enforced server-side:
 *
 *   1. Cloudflare Turnstile  — proves a human solved the challenge in the page.
 *   2. Email OTP             — proves the visitor controls the email address
 *                              the NDA will be attributed to.
 *
 * A rolling per-email / per-IP rate limit backs both (the OTP issuance rows in
 * public.nda_public_otp double as the rate-limit ledger).
 *
 * Design stance: FAIL CLOSED. A missing secret, a network error talking to
 * Turnstile, or a DB error all result in denial, never a silent pass. Codes are
 * stored only as salted SHA-256 hashes and compared in constant time.
 *
 * Required env:
 *   TURNSTILE_SECRET_KEY          — Cloudflare Turnstile secret (server side)
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY — site key (client widget; read in the page)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — service-role DB access
 *   (OTP delivery uses lib/email.ts → RESEND_API_KEY / EMAIL_FROM)
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sha256Hex, timingSafeEqual } from './signing-tokens';
import { sendOtpEmail } from './email';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ----------------------------------------------------------------------------
// Tunables
// ----------------------------------------------------------------------------

/** OTP length in digits. */
const OTP_DIGITS = 6;
/** OTP time-to-live. */
const OTP_TTL_MINUTES = 10;
/** Max failed verify attempts against a single issued code before it's dead. */
const OTP_MAX_ATTEMPTS = 5;
/** Rolling window for issuance rate limiting. */
const RATE_WINDOW_MINUTES = 60;
/** Max OTP issuances per email within the window. */
const RATE_MAX_PER_EMAIL = 5;
/** Max OTP issuances per IP within the window (looser; shared NATs exist). */
const RATE_MAX_PER_IP = 15;

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// ============================================================================
// Turnstile
// ============================================================================

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'verify_error' | 'rejected'; errorCodes?: string[] };

/**
 * Verify a Cloudflare Turnstile token server-side. Fails closed: if the secret
 * is unset or Cloudflare can't be reached, returns ok:false rather than
 * assuming success.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('[anti-abuse] TURNSTILE_SECRET_KEY is not set — failing closed.');
    return { ok: false, reason: 'not_configured' };
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'rejected', errorCodes: ['missing-input-response'] };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (remoteIp) form.set('remoteip', remoteIp);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    if (!res.ok) {
      console.error('[anti-abuse] Turnstile siteverify HTTP', res.status);
      return { ok: false, reason: 'verify_error' };
    }

    const data: { success?: boolean; ['error-codes']?: string[] } = await res.json();
    if (data.success) return { ok: true };
    return { ok: false, reason: 'rejected', errorCodes: data['error-codes'] ?? [] };
  } catch (err: any) {
    console.error('[anti-abuse] Turnstile verify threw:', err.message);
    return { ok: false, reason: 'verify_error' };
  }
}

// ============================================================================
// Email OTP
// ============================================================================

export type IssueOtpResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; reason: 'send_failed' | 'db_error' };

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: 'no_code' | 'expired' | 'too_many_attempts' | 'mismatch' | 'db_error' };

/**
 * Issue a fresh OTP for (email, listingSlug): rate-limit, generate, store the
 * salted hash, and email the plaintext code to the visitor. The plaintext code
 * is never persisted or returned.
 */
export async function issueEmailOtp(args: {
  email: string;
  listingSlug: string;
  businessName: string;
  ip?: string;
}): Promise<IssueOtpResult> {
  const email = normalizeEmail(args.email);
  const { listingSlug, businessName, ip } = args;

  // ---- Rate limit (per email + per IP within the rolling window) -----------
  const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();

  try {
    const { count: emailCount, error: emailErr } = await supabase
      .from('nda_public_otp')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', windowStart);
    if (emailErr) throw emailErr;

    if ((emailCount ?? 0) >= RATE_MAX_PER_EMAIL) {
      return { ok: false, reason: 'rate_limited', retryAfterSeconds: RATE_WINDOW_MINUTES * 60 };
    }

    if (ip) {
      const { count: ipCount, error: ipErr } = await supabase
        .from('nda_public_otp')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', windowStart);
      if (ipErr) throw ipErr;

      if ((ipCount ?? 0) >= RATE_MAX_PER_IP) {
        return { ok: false, reason: 'rate_limited', retryAfterSeconds: RATE_WINDOW_MINUTES * 60 };
      }
    }
  } catch (err: any) {
    console.error('[anti-abuse] OTP rate-limit query failed:', err.message);
    return { ok: false, reason: 'db_error' };
  }

  // ---- Generate + store -----------------------------------------------------
  const code = generateNumericCode(OTP_DIGITS);
  const codeHash = hashOtp({ listingSlug, email, code });
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  const { error: insErr } = await supabase.from('nda_public_otp').insert({
    email,
    listing_slug: listingSlug,
    code_sha256:  codeHash,
    ip:           ip ?? null,
    expires_at:   expiresAt,
  });
  if (insErr) {
    console.error('[anti-abuse] OTP insert failed:', insErr.message);
    return { ok: false, reason: 'db_error' };
  }

  // ---- Deliver --------------------------------------------------------------
  try {
    await sendOtpEmail({ to: email, code, businessName, ttlMinutes: OTP_TTL_MINUTES });
  } catch (err: any) {
    console.error('[anti-abuse] OTP email send failed:', err.message);
    return { ok: false, reason: 'send_failed' };
  }

  return { ok: true };
}

/**
 * Verify a submitted code against the most recent live OTP for (email, slug).
 * On success the row is consumed (single-use). On mismatch the attempt counter
 * is incremented; once it reaches OTP_MAX_ATTEMPTS the code is dead.
 */
export async function verifyEmailOtp(args: {
  email: string;
  listingSlug: string;
  code: string;
}): Promise<VerifyOtpResult> {
  const email = normalizeEmail(args.email);
  const { listingSlug } = args;
  const code = String(args.code ?? '').trim();

  let row: {
    id: string;
    code_sha256: string;
    attempts: number;
    expires_at: string;
    consumed_at: string | null;
  } | null = null;

  try {
    const { data, error } = await supabase
      .from('nda_public_otp')
      .select('id, code_sha256, attempts, expires_at, consumed_at')
      .eq('email', email)
      .eq('listing_slug', listingSlug)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    row = data;
  } catch (err: any) {
    console.error('[anti-abuse] OTP lookup failed:', err.message);
    return { ok: false, reason: 'db_error' };
  }

  if (!row) return { ok: false, reason: 'no_code' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, reason: 'expired' };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const expectedHash = hashOtp({ listingSlug, email, code });
  const matches = timingSafeEqual(expectedHash, row.code_sha256);

  if (!matches) {
    // Increment attempts (best-effort; a failed increment shouldn't grant access).
    await supabase
      .from('nda_public_otp')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id);
    return { ok: false, reason: 'mismatch' };
  }

  // Consume the code (single-use). Guard on consumed_at IS NULL to defeat a
  // double-submit race.
  const { error: consumeErr } = await supabase
    .from('nda_public_otp')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null);
  if (consumeErr) {
    console.error('[anti-abuse] OTP consume failed:', consumeErr.message);
    return { ok: false, reason: 'db_error' };
  }

  return { ok: true };
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

/** Cryptographically-random N-digit numeric code, zero-padded. */
function generateNumericCode(digits: number): string {
  const max = 10 ** digits;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(digits, '0');
}

/** Salted hash so a code is only valid for the exact (slug, email) it was
 *  issued to, and a leaked hash can't be reused across listings. */
function hashOtp(args: { listingSlug: string; email: string; code: string }): string {
  return sha256Hex(`${args.listingSlug}:${normalizeEmail(args.email)}:${args.code}`);
}
