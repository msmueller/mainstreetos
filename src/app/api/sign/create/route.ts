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
  broker_name:     'Mark S. Mueller, CAIBVS™',
  broker_title:    'Managing Member',
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

  const {
    templateKey,
    notionLeadId,
    notionListingId,
    notionBuyerClientPageId,  // Phase 7 (System 3): Notion page ID in the
                              // 'Main Street Buyer Profile — Intake Form' DB
                              // (2ea28c7df4864076876f15fbcc6b7b45). Only used
                              // when templateKey === 'BuyerBrokerRep_NDA'.
    braEffectiveDate,         // Phase 7: ISO date string for the executed
                              // Exclusive Buyer Brokerage Agreement between
                              // Mark and the Buyer Client. Surfaces in the
                              // NDA preamble + §5 + signature block.
    buyer,
    suppressAutoEmail,
  } = body;

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

    // ----- 2. Resolve prefill from Notion (System-aware) -------------------
    // System 1 / 2 (sell-side): pull listing fields from LISTINGS DB.
    // System 3 (Phase 7, buyer-broker rep): pull buyer client fields from
    // 'Main Street Buyer Profile — Intake Form' DB. These never share data
    // — System 1 has a specific listing context; System 3 has no listing
    // (the outbound form is reusable across many Sellers).
    const isPhase7BuyerRep = templateKey === 'BuyerBrokerRep_NDA';

    const listingFields: Record<string, string> = (!isPhase7BuyerRep && notionListingId)
      ? await fetchListingPrefill(notionListingId)
      : {};

    const buyerClientFields: Record<string, string> = (isPhase7BuyerRep && notionBuyerClientPageId)
      ? await fetchBuyerClientPrefill(notionBuyerClientPageId)
      : {};

    // ----- 3. Build prefilled values --------------------------------------
    const filledValues: Record<string, unknown> = {
      ...BROKER_DEFAULTS,
      ...listingFields,
      ...buyerClientFields,
      effective_date:   new Date().toISOString().slice(0, 10),
      broker_signature: BROKER_SIGNATURE_URL,
    };

    // Phase 7: include BRA effective date in prefill (templated by the NDA
    // preamble + §5 + signature block as {{bra_effective_date}}).
    if (isPhase7BuyerRep && braEffectiveDate) {
      filledValues.bra_effective_date = braEffectiveDate;
    }

    // ----- 4. Insert envelope ---------------------------------------------
    // For Phase 7 the envelope's listing_business_name slot is repurposed
    // to display the Buyer Client's name (since there's no listing context).
    const envelopeDisplayLabel = isPhase7BuyerRep
      ? (buyerClientFields.buyer_name ?? buyer.name ?? null)
      : (listingFields.business_name ?? null);

    const { data: envelope, error: envErr } = await supabase
      .from('sign_envelopes')
      .insert({
        template_id:           template.id,
        template_key:          template.template_key,
        template_version:      template.version,
        filled_values:         filledValues,
        notion_lead_id:        notionLeadId ?? null,
        notion_listing_id:     isPhase7BuyerRep ? null : (notionListingId ?? null),
        listing_business_name: envelopeDisplayLabel,
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
    // Callers can set `suppressAutoEmail: true` (e.g. the Lead Router) to
    // skip this step — the caller is responsible for delivering the signingUrl
    // to the buyer some other way.
    const signingUrl = buildSigningUrl(buyerToken.raw);
    try {
      if (suppressAutoEmail) {
        // Skip auto-email; the caller embeds the signingUrl into its own email.
      } else {
      await sendSigningInvitation({
        to:           buyer.email,
        toName:       buyer.name,
        signingUrl,
        businessName: listingFields.business_name || 'a confidential listing',
        // Email signature uses the simple form ("Mark Mueller") for warmth;
        // the PDF and legal record still use the full BROKER_DEFAULTS.broker_name
        // ("Mark S. Mueller, CAIBVS™") for formality.
        brokerName:   'Mark Mueller',
        envelopeNumber: envelope.envelope_number,
      });
      }
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
      // signingUrl is ALWAYS returned to the caller. The buyer also gets it via
      // the auto-email (sendSigningInvitation), but the broker may want to
      // compose a personal email and paste the link in manually. Returning it
      // here is safe because /api/sign/create is service-role-scoped — anyone
      // who can hit this endpoint already has full broker authority.
      signingUrl,
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

/** Read listing properties from Notion LISTINGS and project to prefill field names.
 *  Property names below MUST match the LISTINGS database schema exactly
 *  (case-sensitive). Verified against La Guardiola Pizzeria page on 2026-05-14:
 *  - "Listing Name" is the title property
 *  - "BBS Listing #" is the BizBuySell listing identifier
 *  - "Headline" is the marketing tagline
 *  - "Industry Category" is the broad industry classification
 *  - "Location" is already pre-combined as "City, State"
 */
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
      case 'email':       return p.email ?? '';
      case 'phone_number':return p.phone_number ?? '';
      case 'url':         return p.url ?? '';
      default:            return '';
    }
  };

  return {
    business_name:      get('Listing Name'),
    listing_ref_number: get('BBS Listing #'),
    description:        get('Headline'),
    industry:           get('Industry Category'),
    location:           get('Location'),
    transaction_type:   'Business Sale',
  };
}

/** Read buyer-client properties from Notion 'Main Street Buyer Profile —
 *  Intake Form' DB (2ea28c7df4864076876f15fbcc6b7b45) and project to the
 *  Phase 7 BuyerBrokerRep_NDA fields_schema field names.
 *
 *  System 3 isolation: this function fetches from the BUYER profile DB and
 *  must never touch LISTINGS or LEADS. See
 *  memory/project_mainstreetos_clickwrap_three_systems.md.
 *
 *  Multi-select fields are returned as JSON-encoded arrays of strings so
 *  the signing page can render them as checkbox groups and the executed
 *  PDF can render them as bulleted lists.
 */
async function fetchBuyerClientPrefill(buyerClientPageId: string): Promise<Record<string, string>> {
  const page: any = await notion.pages.retrieve({ page_id: buyerClientPageId });
  const props = page.properties;

  // String getter — for text / select / single-value types
  const get = (name: string): string => {
    const p = props[name];
    if (!p) return '';
    switch (p.type) {
      case 'title':        return p.title.map((t: any) => t.plain_text).join('');
      case 'rich_text':    return p.rich_text.map((t: any) => t.plain_text).join('');
      case 'number':       return p.number != null ? String(p.number) : '';
      case 'select':       return p.select?.name ?? '';
      case 'status':       return p.status?.name ?? '';
      case 'multi_select': return p.multi_select.map((s: any) => s.name).join(', ');
      case 'date':         return p.date?.start ?? '';
      case 'email':        return p.email ?? '';
      case 'phone_number': return p.phone_number ?? '';
      case 'url':          return p.url ?? '';
      default:             return '';
    }
  };

  // Multi-select getter — returns JSON-encoded array (signing page parses this)
  const getMulti = (name: string): string => {
    const p = props[name];
    if (!p || p.type !== 'multi_select') return '';
    const values = p.multi_select.map((s: any) => s.name);
    return values.length > 0 ? JSON.stringify(values) : '';
  };

  // Currency getter — Notion 'number' type with format='dollar' is stored as number
  const getNumber = (name: string): string => {
    const p = props[name];
    if (!p || p.type !== 'number' || p.number == null) return '';
    return String(p.number);
  };

  // Yes/No select → '__YES__' / '__NO__' (matches Phase 1-2 checkbox convention)
  const getYesNo = (name: string): string => {
    const v = get(name);
    if (v === 'Yes') return '__YES__';
    if (v === 'No')  return '__NO__';
    return '';
  };

  return {
    // Section 1: Buyer Identity
    buyer_name:                          get('Buyer Name (Individual or Entity)'),
    buyer_phone:                         get('Phone'),
    buyer_email:                         get('Email'),
    buyer_mailing_address:               get('Mailing Address'),
    buyer_linkedin_url:                  get('LinkedIn URL'),
    buyer_entity_type:                   get('Entity Type'),
    buyer_state_of_formation:            get('State of Formation'),

    // Section 2: Background & Experience
    buyer_professional_background:       get('Professional Background'),
    buyer_direct_industry_experience:    get('Direct Industry Experience'),
    buyer_prior_business_ownership:      get('Prior Business Ownership'),
    buyer_prior_business_details:        get('Prior Business Details'),
    buyer_prior_director_experience:     get('Prior Director / Manager Experience'),
    buyer_licenses_certifications:       get('Licenses / Certifications'),

    // Section 3: Acquisition Criteria
    buyer_preferred_geography:           get('Preferred Geography'),
    buyer_preferred_industries:          get('Preferred Industries / Concepts'),
    buyer_deal_structures_considered:    getMulti('Deal Structures Considered'),
    buyer_real_estate_preference:        getMulti('Real Estate Preference'),
    buyer_target_asking_price_range:     get('Target Asking Price Range'),
    buyer_target_revenue_range:          get('Target Revenue Range'),
    buyer_target_sde_range:              get('Target SDE / Cash Flow Range'),
    buyer_hold_period_intent:            get('Hold Period Intent'),

    // Section 4: Capital Capacity
    buyer_max_deal_size:                 get('Maximum All-In Deal Size'),
    buyer_cash_for_down_payment:         getNumber('Cash Available for Down Payment'),
    buyer_total_equity_available:        getNumber('Total Equity Available'),
    buyer_primary_financing_source_multi: getMulti('Primary Financing Source'),
    buyer_outside_investors:             get('Outside Investors'),
    buyer_investor_structure:            get('Investor Structure'),

    // Section 5: Specific Interest
    buyer_listing_reference:             get('Listing Reference'),
    buyer_why_this_listing:              get('Why This Listing'),
    buyer_indicative_offer_range:        get('Indicative Offer Range'),
    buyer_operating_role_post_close:     get('Operating Role Post-Close'),

    // Section 6: Process & Timeline
    buyer_earliest_nda_execution:        get('Earliest NDA Execution'),
    buyer_earliest_pof_delivery:         get('Earliest POF Delivery After NDA'),
    buyer_earliest_loi_submission:       get('Earliest LOI Submission'),
    buyer_earliest_possible_close:       get('Earliest Possible Close'),
    buyer_other_active_diligence:        get('Other Deals in Active Diligence'),
    buyer_funding_contingencies:         get('Funding Contingencies'),

    // Section 7: Proof of Funds
    buyer_pof_methods:                   getMulti('POF Methods'),
    buyer_pof_method_notes:              get('POF Method Notes'),
    buyer_lender_name_contact:           get('Lender Name / Contact'),
    buyer_lender_loan_officer:           get('Lender / Loan Officer'),
    buyer_lender_prequal_status:         get('Lender Pre-Qualification Status'),

    // Section 8: Professional Advisors
    buyer_buyer_broker:                  get('Buyer Broker') || 'Mark Mueller, CRE Resources, LLC',
    buyer_side_attorney:                 get('Buyer Side Attorney'),
    buyer_cpa_accountant:                get('CPA / Accountant'),
    buyer_reference_1:                   get('Reference 1'),
    buyer_reference_2:                   get('Reference 2'),

    // Section 9: Attestation
    buyer_other_principals:              get('Other Principals / Co-Investors'),
    buyer_final_decision_authority:      get('Final Decision Authority'),
    buyer_acknowledgment:                get('Buyer Acknowledgment'),  // already __YES__ or __NO__
    buyer_authorized_signatory:          get('Authorized Signatory'),
  };
}
