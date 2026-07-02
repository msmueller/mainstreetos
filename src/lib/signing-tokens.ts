/**
 * MainStreetOS · Click-Wrap Signing — Token Utilities
 *
 * Tokens authenticate signers without requiring accounts. Generated tokens are
 * shown once (in the email link) and stored only as SHA-256 hashes in the DB.
 *
 * Token format: 32 random bytes, base64url-encoded → 43 characters
 * Example: "h7Kz9-vQpL2mN8xR4tY6uW1aB3cD5eF7gH9iJ0kL2mN"
 *
 * Lifecycle:
 *   1. Generate raw token → email URL with raw token → store SHA-256(token)
 *   2. Signer clicks link → server hashes incoming token → looks up by hash
 *   3. Validate: not expired, not consumed, envelope is in valid state
 *   4. On signing completion: mark token consumed, never accept it again
 */

import crypto from 'crypto';

// ----------------------------------------------------------------------------
// Token generation
// ----------------------------------------------------------------------------

/** Generate a fresh signing token. Returns both the raw token (for the email URL)
 *  and its hash (for the DB). The raw token is shown ONCE; never logged. */
export function generateSigningToken(): { raw: string; hash: string } {
  const bytes = crypto.randomBytes(32);
  const raw = bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const hash = sha256Hex(raw);
  return { raw, hash };
}

/** Hash an incoming token for DB lookup. */
export function hashSigningToken(raw: string): string {
  if (!raw || typeof raw !== 'string' || raw.length < 30) {
    throw new Error('Invalid token format');
  }
  return sha256Hex(raw);
}

// ----------------------------------------------------------------------------
// Hashing primitives
// ----------------------------------------------------------------------------

/** SHA-256 of a string, hex-encoded. Used for tokens, documents, disclosures. */
export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Constant-time string comparison to prevent timing attacks on token lookup. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Signing URL construction
// ----------------------------------------------------------------------------

/** Build the public signing URL the buyer clicks in their email.
 *  Defensively strips trailing slashes from NEXT_PUBLIC_APP_URL so a misconfigured
 *  env var (e.g., "https://example.com/") doesn't produce a "//sign/..." double-
 *  slash URL — that breaks Next.js path matching and the buyer sees an
 *  "invalid or expired signing link" page. */
export function buildSigningUrl(rawToken: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://mainstreetos.biz').replace(/\/+$/, '');
  return `${baseUrl}/sign/${rawToken}`;
}

/** Build the durable download URL for a completed envelope's signed PDF or
 *  audit certificate (served by /api/sign/download/[envelopeId]/[doc], which
 *  re-signs storage on each click). This is what gets written to the Notion
 *  LEAD "Signed NDA URL" property — unlike storage signed URLs it never
 *  expires. `k` is a capability key: the first 16 hex chars of the document's
 *  SHA-256. Shared by the completion path and the backfill (Build A). */
export function buildDurableDownloadUrl(args: {
  envelopeId: string;
  doc: 'nda' | 'audit';
  sha256: string;
}): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://mainstreetos.biz').replace(/\/+$/, '');
  return `${baseUrl}/api/sign/download/${args.envelopeId}/${args.doc}?k=${args.sha256.slice(0, 16)}`;
}

// ----------------------------------------------------------------------------
// Token validation (no DB access — pure shape check)
// ----------------------------------------------------------------------------

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;

export function isWellFormedToken(raw: string): boolean {
  return typeof raw === 'string' && TOKEN_PATTERN.test(raw);
}
