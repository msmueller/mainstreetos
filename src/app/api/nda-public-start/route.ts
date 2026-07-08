/**
 * MainStreetOS · POST /api/nda-public-start
 *
 * Server-side mint-and-complete for the per-listing public "Start NDA" page
 * (Build Spec v1.0 §5). A non-BBS prospect arrives at /nda/[slug] with only a
 * name + email, completes the NDA + Buyer Profile, and this endpoint mints the
 * envelope AND records the signature in one shot — no pre-minted per-buyer link.
 *
 * Two actions (single endpoint, discriminated by body.action):
 *   • "request-otp" — verify Turnstile, then email a 6-digit code to the buyer.
 *   • "submit"      — verify the OTP, validate all gates, dedup, mint the
 *                     envelope + signers + events, and run the SHARED completion
 *                     core (lib/complete-signing) so the legal artifact is
 *                     byte-identical to the token flow (/api/sign/execute).
 *
 * Security:
 *   • anon never touches base tables — the public PAGE reads via the
 *     get_public_listing_by_slug RPC; THIS route runs service-role server-side.
 *   • Two gates before any mint: Cloudflare Turnstile (at request-otp) + email
 *     OTP (at submit). Both fail closed (lib/anti-abuse).
 *   • Feature-flagged: NDA_PUBLIC_PAGE must be on, else 404 (ships dark).
 *   • Idempotent: a completed envelope for (listing, email) is returned rather
 *     than minting a duplicate.
 *
 * Notion linkage (Build A): the completion write-back + lead find-or-create are
 * gated by NDA_NOTION_SYNC. With that flag off (test mode) the signing still
 * completes; the envelope is simply unlinked, like a deliberate test envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { attributionFromRequest, logEvent } from '@/lib/audit-log';
import { completeSigning } from '@/lib/complete-signing';
import { verifyTurnstile, issueEmailOtp, verifyEmailOtp } from '@/lib/anti-abuse';
import { findOrCreatePublicNdaLead } from '@/lib/notion-lead-upsert';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Broker static config — mirrors /api/sign/create so the minted envelope and
// the rendered PDF carry identical broker identity + signature.
const BROKER_DEFAULTS = {
  broker_company: 'CRE Resources, LLC',
  broker_name:    'Mark S. Mueller, CAIBVS™',
  broker_title:   'Managing Member',
  broker_email:   'markm@creresources.biz',
  broker_phone:   '856.745.9706',
  broker_address: 'Titusville, NJ 08560',
};
const BROKER_SIGNATURE_URL = process.env.BROKER_SIGNATURE_URL ?? '';

// ============================================================================
// Handler
// ============================================================================

export async function POST(req: NextRequest) {
  // Feature flag — ships dark. Off = the whole endpoint 404s.
  if (!featureEnabled()) {
    return json({ error: 'not found' }, 404);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug) return json({ error: 'slug is required' }, 400);

  // Resolve the listing server-side (service-role; bypasses the anon RPC).
  const listing = await getEnabledListing(slug);
  if (!listing) return json({ error: 'not found' }, 404);

  const display = (listing.nda_public_display ?? {}) as Record<string, any>;
  const businessName: string = display.business_name ?? listing.name ?? 'the listing';

  switch (body.action) {
    case 'request-otp':
      return handleRequestOtp(req, { slug, email: body.email, businessName });
    case 'submit':
      return handleSubmit(req, { slug, listing, display, businessName, body });
    default:
      return json({ error: "unknown action (expected 'request-otp' | 'submit')" }, 400);
  }
}

// ============================================================================
// Action: request-otp
// ============================================================================

async function handleRequestOtp(
  req: NextRequest,
  args: { slug: string; email: string; businessName: string }
) {
  const email = String(args.email ?? '').trim();
  if (!isValidEmail(email)) return json({ error: 'a valid email is required' }, 400);

  const ip = attributionFromRequest(req).ipAddress;

  // Gate 1: Cloudflare Turnstile (human check) — fails closed.
  const turnstile = await verifyTurnstile(req.headers.get('x-turnstile-token') ?? undefined, ip);
  if (!turnstile.ok) {
    return json({ error: 'bot check failed; please retry', reason: turnstile.reason }, 403);
  }

  // Issue + email the OTP (rate-limited by email + IP inside).
  const issued = await issueEmailOtp({ email, listingSlug: args.slug, businessName: args.businessName, ip });
  if (!issued.ok) {
    if (issued.reason === 'rate_limited') {
      return json({ error: 'too many codes requested; please wait and try again', retryAfterSeconds: issued.retryAfterSeconds }, 429);
    }
    return json({ error: 'could not send verification code; please try again' }, 502);
  }

  return json({ ok: true, otpSent: true });
}

// ============================================================================
// Action: submit
// ============================================================================

async function handleSubmit(
  req: NextRequest,
  ctx: { slug: string; listing: any; display: Record<string, any>; businessName: string; body: any }
) {
  const { slug, listing, businessName, body } = ctx;

  const buyer = body.buyer ?? {};
  const email = String(buyer.email ?? '').trim();
  const name  = buyer.name ? String(buyer.name).trim() : undefined;
  const phone = buyer.phone ? String(buyer.phone).trim() : undefined;
  if (!isValidEmail(email)) return json({ error: 'a valid email is required' }, 400);

  // Gate: email OTP (proves the buyer controls the address). Turnstile was
  // enforced at request-otp; possession of the emailed code carries it forward.
  const otp = await verifyEmailOtp({ email, listingSlug: slug, code: String(body.otpCode ?? '') });
  if (!otp.ok) {
    return json({ error: 'email verification failed; request a new code', reason: otp.reason }, 401);
  }

  // Resolve the active template for this listing.
  const { data: template, error: tplErr } = await supabase
    .from('sign_templates')
    .select('id, template_key, version, source, fields_schema, disclosure_version_id')
    .eq('template_key', listing.default_sign_template_key)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  if (tplErr || !template) {
    return json({ error: `template not available: ${listing.default_sign_template_key}` }, 500);
  }

  const { data: disclosure, error: disErr } = await supabase
    .from('sign_disclosure_versions')
    .select('id, text_sha256')
    .eq('id', template.disclosure_version_id)
    .single();
  if (disErr || !disclosure) {
    return json({ error: 'disclosure version not available' }, 500);
  }

  // Collect buyer values; ensure identity fields are present from buyer{}.
  const fieldValues: Record<string, any> = { ...(body.fieldValues ?? {}) };
  if (fieldValues.buyer_email == null || fieldValues.buyer_email === '') fieldValues.buyer_email = email;
  if ((fieldValues.buyer_name == null || fieldValues.buyer_name === '') && name) fieldValues.buyer_name = name;
  if ((fieldValues.buyer_phone == null || fieldValues.buyer_phone === '') && phone) fieldValues.buyer_phone = phone;

  const typedSignature = String(body.typedSignature ?? fieldValues.buyer_typed_signature ?? '').trim();
  const drawnSignatureSvg: string | undefined = body.drawnSignatureSvg ?? fieldValues.buyer_drawn_signature ?? undefined;

  // Gate: required buyer fields (same rule as /api/sign/execute), with the
  // signature fields injected so the schema's required signature is satisfied.
  const fieldValuesForValidation = {
    ...fieldValues,
    buyer_typed_signature: typedSignature,
    buyer_drawn_signature: drawnSignatureSvg ?? '',
  };
  const missing = validateRequiredBuyerFields(template.fields_schema, fieldValuesForValidation);
  if (missing.length) {
    return json({ error: 'missing required fields', missing }, 400);
  }

  // Gate: consent + full acknowledgment of the NDA clauses + a typed signature.
  if (body.consent !== true) {
    return json({ error: 'you must consent to electronic signing (ESIGN/UETA)' }, 400);
  }
  if (body.acknowledgedAllClauses !== true) {
    return json({ error: 'you must acknowledge all NDA provisions before signing' }, 400);
  }
  if (!typedSignature) {
    return json({ error: 'a typed full legal name signature is required' }, 400);
  }

  // Gate: dedup — a completed envelope for (this listing, this email) returns
  // the prior acknowledgment instead of minting a duplicate.
  const dup = await findCompletedEnvelope(listing.notion_page_id, email);
  if (dup) {
    return json({ ok: true, alreadySigned: true, envelopeNumber: dup.envelope_number });
  }

  // Find-or-create the Notion LEAD (guarded by NDA_NOTION_SYNC; null when off
  // or on failure → envelope completes unlinked).
  const lead = await findOrCreatePublicNdaLead({
    email, name, phone,
    listingNotionPageId: listing.notion_page_id,
    source: 'Public NDA Page',
  });
  const notionLeadId = lead?.pageId ?? null;

  // Attribution — thread the client sessionId if the page supplied one.
  const attribution = attributionFromRequest(req);
  if (body.sessionId) attribution.sessionId = String(body.sessionId);

  try {
    // ---- Build broker/listing prefill (buyer values merge in at render) -----
    const filledValues: Record<string, any> = {
      ...BROKER_DEFAULTS,
      business_name:    businessName,
      listing_ref_number: listing.listing_number ?? '',
      description:      ctx.display.listing_title ?? '',
      effective_date:   new Date().toISOString().slice(0, 10),
      broker_signature: BROKER_SIGNATURE_URL,
    };

    // ---- Mint the envelope --------------------------------------------------
    const { data: envelope, error: envErr } = await supabase
      .from('sign_envelopes')
      .insert({
        template_id:           template.id,
        template_key:          template.template_key,
        template_version:      template.version,
        filled_values:         filledValues,
        notion_lead_id:        notionLeadId,
        notion_listing_id:     listing.notion_page_id ?? null,
        listing_business_name: businessName,
        status:                'sent',
        created_by:            'public-nda-page',
        expires_at:            new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, envelope_number')
      .single();
    if (envErr || !envelope) {
      console.error('[nda-public-start] envelope insert failed:', envErr);
      return json({ error: 'failed to create envelope' }, 500);
    }

    // ---- Broker signer (auto-completed, mirrors /api/sign/create) -----------
    const { data: brokerSigner, error: bsErr } = await supabase
      .from('sign_signers')
      .insert({
        envelope_id:    envelope.id,
        role:           'broker',
        signing_order:  1,
        email:          BROKER_DEFAULTS.broker_email,
        name:           BROKER_DEFAULTS.broker_name,
        status:         'signed',
        auto_completed: true,
        signed_at:      new Date().toISOString(),
      })
      .select('id')
      .single();
    if (bsErr || !brokerSigner) {
      console.error('[nda-public-start] broker signer insert failed:', bsErr);
      return json({ error: 'failed to create broker signer' }, 500);
    }

    // ---- Buyer signer (no token — public self-service) ----------------------
    const nowIso = new Date().toISOString();
    const { data: buyerSigner, error: bySErr } = await supabase
      .from('sign_signers')
      .insert({
        envelope_id:    envelope.id,
        role:           'buyer',
        signing_order:  2,
        email:          email.toLowerCase(),
        name:           name ?? null,
        phone:          phone ?? null,
        status:         'sent',
        auto_completed: true,
        invited_at:     nowIso,
        first_opened_at: nowIso,
        agreed_at:      nowIso,
      })
      .select('id')
      .single();
    if (bySErr || !buyerSigner) {
      console.error('[nda-public-start] buyer signer insert failed:', bySErr);
      return json({ error: 'failed to create buyer signer' }, 500);
    }

    // ---- Synthetic lifecycle events (opened → agreed) -----------------------
    await logEvent({
      envelopeId:       envelope.id,
      eventType:        'envelope.created',
      disclosureSha256: disclosure.text_sha256,
      attribution,
      payload: { template_key: template.template_key, template_version: template.version, source: 'public_nda_page', listing_slug: slug },
    });
    await logEvent({
      envelopeId: envelope.id,
      signerId:   brokerSigner.id,
      eventType:  'signer.signed',
      attribution,
      payload: { auto_completed: true, method: 'auto_image', signature_url: BROKER_SIGNATURE_URL },
    });
    await logEvent({
      envelopeId: envelope.id,
      signerId:   buyerSigner.id,
      eventType:  'envelope.opened',
      attribution,
      payload: { via: 'public_nda_page' },
    });
    const consentEventId = await logEvent({
      envelopeId:       envelope.id,
      signerId:         buyerSigner.id,
      eventType:        'consent.given',
      disclosureSha256: disclosure.text_sha256,
      attribution,
      payload: { acknowledged_all_clauses: true },
    });
    await logEvent({
      envelopeId: envelope.id,
      signerId:   buyerSigner.id,
      eventType:  'signer.agreed',
      attribution,
    });
    const validationEventId = await logEvent({
      envelopeId:       envelope.id,
      signerId:         buyerSigner.id,
      eventType:        'validation.passed',
      disclosureSha256: disclosure.text_sha256,
      attribution,
    });

    // ---- Record the signature via the SHARED completion core ----------------
    const signatureMethod: 'typed' | 'drawn' | 'typed_and_drawn' =
      drawnSignatureSvg ? 'typed_and_drawn' : 'typed';

    const result = await completeSigning({
      envelope: {
        id:                    envelope.id,
        envelope_number:       envelope.envelope_number,
        template_key:          template.template_key,
        template_version:      template.version,
        filled_values:         filledValues,
        notion_lead_id:        notionLeadId,
        notion_listing_id:     listing.notion_page_id ?? null,
        notion_synced_at:      null,
        listing_business_name: businessName,
      },
      signer:     { id: buyerSigner.id, email: email.toLowerCase() },
      template:   { id: template.id, source: template.source },
      disclosure: { id: disclosure.id, text_sha256: disclosure.text_sha256 },
      mergedValues:     { ...filledValues, ...fieldValues },
      buyerFieldValues: fieldValues,
      signatureMethod,
      typedSignature,
      drawnSignatureSvg,
      sessionId:        body.sessionId ? String(body.sessionId) : undefined,
      consentEventId,
      validationEventId,
      attribution,
      signerName:       typedSignature,
    });

    return json({
      ok:             true,
      envelopeNumber: result.envelopeNumber,
      signedPdfUrl:   result.signedPdfUrl,
      auditPdfUrl:    result.auditPdfUrl,
    });
  } catch (err: any) {
    console.error('[nda-public-start] mint/complete failed:', err);
    return json({ error: 'failed to record signature', detail: err.message }, 500);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function featureEnabled(): boolean {
  const v = (process.env.NDA_PUBLIC_PAGE ?? '').trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getEnabledListing(slug: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('seller_listings')
    .select('id, name, listing_number, notion_page_id, default_sign_template_key, nda_public_enabled, nda_public_display')
    .eq('nda_public_slug', slug)
    .eq('nda_public_enabled', true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[nda-public-start] listing lookup failed:', error.message);
    return null;
  }
  if (!data || !data.default_sign_template_key) return null;
  return data;
}

function validateRequiredBuyerFields(schema: any[], values: Record<string, any>): string[] {
  const missing: string[] = [];
  for (const field of schema ?? []) {
    if (field.role !== 'buyer') continue;
    if (!field.required) continue;
    const v = values[field.name];
    if (v === undefined || v === null || v === '') missing.push(field.name);
  }
  return missing;
}

/** Dedup: has this email already completed an envelope for this listing? */
async function findCompletedEnvelope(
  notionListingId: string | null,
  email: string
): Promise<{ envelope_number: number } | null> {
  if (!notionListingId) return null;

  const { data: envs, error } = await supabase
    .from('sign_envelopes')
    .select('id, envelope_number')
    .eq('notion_listing_id', notionListingId)
    .eq('status', 'completed');
  if (error || !envs || envs.length === 0) return null;

  const ids = envs.map((e: any) => e.id);
  const { data: signers } = await supabase
    .from('sign_signers')
    .select('envelope_id')
    .in('envelope_id', ids)
    .eq('role', 'buyer')
    .ilike('email', email);

  if (!signers || signers.length === 0) return null;

  const matchId = new Set(signers.map((s: any) => s.envelope_id));
  const match = envs.find((e: any) => matchId.has(e.id));
  return match ? { envelope_number: match.envelope_number } : null;
}
