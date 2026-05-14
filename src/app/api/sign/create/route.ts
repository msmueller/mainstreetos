/**
 * MainStreetOS · POST /api/sign/create
 *
 * Triggered when Mark clicks "Send NDA" in MainStreetOS.
 *
 * Workflow:
 *   1. Validate request (template, listing, buyer)
 *   2. Resolve listing data from Notion LISTINGS
 *   3. Build prefilled values (broker static + listing dynamic)
 *   4. Insert envelope, signers (broker auto-completed, buyer pending)
 *   5. Generate signing token for buyer
 *   6. Auto-create broker signature (Mark "signs" instantly with stored image)
 *   7. Log envelope.created + signer.invited + signer.signed (broker) events
 *   8. Email buyer the signing link
 *   9. Return success with envelope number
 *
 * Place at: app/api/sign/create/route.ts
 *
 * Body:
 *   {
 *     "templateKey": "NDA_BuyerProfile",
 *     "notionLeadId": "abc123",
 *     "notionListingId": "xyz789",
 *     "buyer": { "email": "buyer@example.com", "name": "John Smith", "phone": "+1-555-1234" }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client as NotionClient } from '@notionhq/client';
import { generateSigningToken, buildSigningUrl, sha256Hex } from '@/lib/signing-tokens';
import { logEvent, attributionFromRequest } from '@/lib/audit-log';
import { sendSigningInvitation } from '@/lib/email';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

// ============================================================================
// Broker static config
// ============================================================================

const BROKER_DEFAULTS = {
  broker_company:  'CRE Resources, LLC',
  broker_name:     'Mark S. Mueller',
  broker_title:    'Managing Member, CAIBVS™',
  broker_email:    'markm@creresources.biz',
  broker_phone:    '856.745.9706',
  broker_address:  'Titusville, NJ 08560',
};

const BROKER_SIGNATURE_URL = process.env.BROKER_SIGNATURE_URL!;

// ============================================================================
// Route handler
// ============================================================================

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { templateKey, notionLeadId, notionListingId, buyer } = body;

  if (!templateKey || !buyer?.email) {
    return json({ error: 'templateKey and buyer.email are required' }, 400);
  }
  if (!isValidEmail(buyer.email)) {
    return json({ error: 'invalid buyer email' }, 400);
  }

  const attribution = attributionFromRequest(req);

  try {
    // ----- 1. Resolve template (latest active version) ---------------------
    const { data: template, error: tplErr } = await supabase
      .from('sign_templates')
      .select('id, template_key, version, fields_schema, source_sha256, disclosure_version_id')
      .eq('template_key', templateKey)
      .eq('active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (tplErr || !template) {
      return json({ error: `template not found: ${templateKey}` }, 404);
    }

    const { data: disclosure } = await supabase
      .from('sign_disclosure_versions')
      .select('text_sha256')
      .eq('id', template.disclosure_version_id)
      .single();

    // ----- 2. Resolve listing from Notion (if provided) --------------------
    const listingFields = notionListingId
      ? await fetchListingPrefill(notionListingId)
      : {};

    // ----- 3. Build prefilled values --------------------------------------
    const filledValues = {
      ...BROKER_DEFAULTS,
      ...listingFields,
      effective_date:   new Date().toISOString().slice(0, 10),
      broker_signature: BROKER_SIGNATURE_URL,
    };

    // ----- 4. Insert envelope ---------------------------------------------
    const { data: envelope, error: envErr } = await supabase
      .from('sign_envelopes')
      .insert({
        template_id:           template.id,
        template_key:          template.template_key,
        template_version:      template.version,
        filled_values:         filledValues,
        notion_lead_id:        notionLeadId ?? null,
        notion_listing_id:     notionListingId ?? null,
        listing_business_name: listingFields.business_name ?? null,
        status:                'sent',
        created_by:            'mark@creresources.biz',
        expires_at:            new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, envelope_number')
      .single();

    if (envErr || !envelope) {
      console.error('[sign/create] envelope insert failed:', envErr);
      return json({ error: 'failed to create envelope' }, 500);
    }

    // ----- 5. Insert broker signer (auto-completed) -----------------------
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
        // No token_sha256 — broker doesn't need a link
      })
      .select('id')
      .single();

    if (bsErr || !brokerSigner) {
      console.error('[sign/create] broker signer insert failed:', bsErr);
      return json({ error: 'failed to create broker signer' }, 500);
    }

    // ----- 6. Insert buyer signer with token ------------------------------
    const buyerToken = generateSigningToken();

    const { data: buyerSigner, error: bySerr } = await supabase
      .from('sign_signers')
      .insert({
        envelope_id:      envelope.id,
        role:             'buyer',
        signing_order:    2,
        email:            buyer.email.toLowerCase().trim(),
        name:             buyer.name ?? null,
        phone:            buyer.phone ?? null,
        token_sha256:     buyerToken.hash,
        token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        status:           'sent',
        invited_at:       new Date().toISOString(),
      })
      .select('id')
      .single();

    if (bySerr || !buyerSigner) {
      console.error('[sign/create] buyer signer insert failed:', bySerr);
      return json({ error: 'failed to create buyer signer' }, 500);
    }

    // ----- 7. Log audit events --------------------------------------------
    await Promise.all([
      logEvent({
        envelopeId:       envelope.id,
        eventType:        'envelope.created',
        documentSha256:   template.source_sha256,
        disclosureSha256: disclosure?.text_sha256,
        attribution,
        payload: {
          template_key:    template.template_key,
          template_version: template.version,
          listing_id:      notionListingId,
          lead_id:         notionLeadId,
        },
      }),
      logEvent({
        envelopeId:       envelope.id,
        signerId:         brokerSigner.id,
        eventType:        'signer.signed',
        attribution,
        payload: {
          auto_completed: true,
          method:         'auto_image',
          signature_url:  BROKER_SIGNATURE_URL,
        },
      }),
      logEvent({
        envelopeId:       envelope.id,
        signerId:         buyerSigner.id,
        eventType:        'signer.invited',
        attribution,
        payload: { email: buyer.email },
      }),
    ]);

    // ----- 8. Email buyer the signing link --------------------------------
    const signingUrl = buildSigningUrl(buyerToken.raw);
    try {
      await sendSigningInvitation({
        to:           buyer.email,
        toName:       buyer.name,
        signingUrl,
        businessName: listingFields.business_name ?? 'a confidential listing',
        brokerName:   BROKER_DEFAULTS.broker_name,
        envelopeNumber: envelope.envelope_number,
      });
    } catch (emailErr: any) {
      // Email failure doesn't void the envelope — broker can resend manually
      console.error('[sign/create] email send failed:', emailErr.message);
      await logEvent({
        envelopeId: envelope.id,
        signerId:   buyerSigner.id,
        eventType:  'validation.failed',
        attribution,
        payload: { reason: 'email_send_failed', detail: emailErr.message },
      });
    }

    // ----- 9. Return success ----------------------------------------------
    return json({
      ok: true,
      envelopeId:     envelope.id,
      envelopeNumber: envelope.envelope_number,
      buyerEmail:     buyer.email,
      // signingUrl is intentionally NOT returned in production —
      // include only for testing in Preview / local dev (Vercel sets
      // NODE_ENV='production' even on Preview, so we key off VERCEL_ENV
      // which distinguishes 'production' | 'preview' | 'development').
      signingUrl: process.env.VERCEL_ENV === 'production' ? undefined : signingUrl,
    });
  } catch (err: any) {
    console.error('[sign/create] unhandled error:', err);
    return json({ error: 'internal error', detail: err.message }, 500);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Read listing properties from Notion and project to prefill field names. */
async function fetchListingPrefill(listingPageId: string): Promise<Record<string, string>> {
  const page: any = await notion.pages.retrieve({ page_id: listingPageId });
  const props = page.properties;

  const get = (name: string): string => {
    const p = props[name];
    if (!p) return '';
    switch (p.type) {
      case 'title':       return p.title.map((t: any) => t.plain_text).join('');
      case 'rich_text':   return p.rich_text.map((t: any) => t.plain_text).join('');
      case 'number':      return p.number != null ? String(p.number) : '';
      case 'select':      return p.select?.name ?? '';
      case 'multi_select':return p.multi_select.map((s: any) => s.name).join(', ');
      case 'date':        return p.date?.start ?? '';
      default:            return '';
    }
  };

  const city  = get('City');
  const state = get('State');
  return {
    business_name:      get('Name'),
    listing_ref_number: get('Listing Ref'),
    description:        get('Description'),
    industry:           get('Industries'),
    location:           [city, state].filter(Boolean).join(', '),
    transaction_type:   get('Transaction Type') || 'Business Sale',
  };
}
