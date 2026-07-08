-- ============================================================================
-- Per-listing public "Start NDA" page — email OTP + rate-limit store
-- Build Spec v1.0 §5 (anti-abuse). Pairs with lib/anti-abuse.ts.
--
-- The public Start NDA page accepts an unauthenticated visitor (name + email
-- only). Before minting a legally binding envelope we (a) verify a Cloudflare
-- Turnstile token and (b) require a 6-digit code emailed to the address. This
-- table backs (b) and also serves as the rate-limit ledger (issuance rows are
-- counted per email + per IP within a rolling window).
--
-- Security: PRIVATE. anon/authenticated get NO access. All reads/writes happen
-- through service-role server code (lib/anti-abuse.ts). Codes are stored only
-- as salted SHA-256 hashes, never in plaintext.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nda_public_otp (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL,          -- lowercased at write time
  listing_slug  text        NOT NULL,          -- nda_public_slug this code is scoped to
  code_sha256   text        NOT NULL,          -- sha256(`${slug}:${email}:${code}`)
  ip            text,                           -- issuing client IP (rate-limit axis)
  attempts      integer     NOT NULL DEFAULT 0, -- failed verify attempts against this row
  consumed_at   timestamptz,                    -- set once on successful verify
  expires_at    timestamptz NOT NULL,           -- issue time + TTL (default 10 min)
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nda_public_otp IS
  'Email OTP + rate-limit ledger for the public per-listing Start NDA page (Build Spec v1.0 §5). Private: service-role only. Codes stored as salted SHA-256, never plaintext.';

-- Lookups: latest live code for (email, slug); rate-limit counts by email/ip/time.
CREATE INDEX IF NOT EXISTS idx_nda_public_otp_email_slug_created
  ON public.nda_public_otp (lower(email), listing_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nda_public_otp_ip_created
  ON public.nda_public_otp (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nda_public_otp_expires
  ON public.nda_public_otp (expires_at);

-- Lock it down: RLS on, no policies → anon/authenticated see nothing.
-- service_role bypasses RLS, which is the only writer/reader.
ALTER TABLE public.nda_public_otp ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.nda_public_otp FROM anon, authenticated;
