/**
 * POST /api/router/route
 *
 * Lead Router — main inbound orchestrator. Triggered when a new buyer
 * inquiry needs to be routed to a listing and a response generated.
 *
 * Auth: shared secret in `x-router-secret` header (compared to ROUTER_SECRET).
 *
 * Body:
 *   { "notion_lead_page_id": "<uuid>" }      // primary path
 *   { "buyer_lead_id":       "<uuid>" }      // alternative — looks up
 *                                            //   notion_page_id via Supabase
 *
 * Query:
 *   ?dry_run=true   Run extractor + matcher + renderer; return the would-be
 *                   email; do NOT send and do NOT write any audit rows.
 *
 * Live-send + audit-write code arrives in commit 4b. v4a is read-only:
 * dry_run mode only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  getRouterSupabase,
  buildLeadContextFromNotion,
  fetchActiveListings,
  enrichListingFromNotion,
  extractAttributes,
  matchListing,
  pickTemplate,
  renderEmail,
  getAvailableSlots,
  GmailSender,
  persistSentEmail,
  logMatchDecision,
  updateNotionLead,
  deriveBuyerQuality,
} from '@/lib/router';
import type { MatchResult, ExtractedAttributes } from '@/lib/router';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Auth
  const auth = req.headers.get('x-router-secret');
  if (!process.env.ROUTER_SECRET || auth !== process.env.ROUTER_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Inputs
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';

  let body: { notion_lead_page_id?: string; buyer_lead_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const notion_lead_page_id = await resolveNotionPageId(body);
  if (!notion_lead_page_id) {
    return NextResponse.json(
      { error: 'missing_lead', detail: 'Pass notion_lead_page_id (preferred) or buyer_lead_id' },
      { status: 400 }
    );
  }

  // 3. Idempotency check (skipped in dry_run — repeated dry-runs are safe)
  if (!dryRun) {
    const existing = await checkExistingEnrollment(notion_lead_page_id);
    if (existing) {
      return NextResponse.json({
        status: 'already_routed',
        lr_match_decision_id: existing.id,
        sequence_enrollment_id: existing.sequence_enrollment_id,
        matched_listing_id: existing.matched_listing_id,
      });
    }
  }

  // 4. Pipeline
  try {
    const lead = await buildLeadContextFromNotion(notion_lead_page_id);
    const listings = await fetchActiveListings();

    const attrs = await extractAttributes(
      lead.email_body ?? '',
      lead.buyer_email ?? ''
    );

    const match = await matchListing({ lead, listings, attrs });

    // Low-confidence path: never auto-enroll, always manual review
    if (match.confidence < 0.6 || match.scenario === 'unmatched' || !match.matched_listing_id) {
      return NextResponse.json({
        status: 'manual_review',
        notion_lead_page_id,
        match,
        attrs,
        reason:
          match.scenario === 'unmatched'
            ? 'No matching listing'
            : `Confidence ${match.confidence} below threshold 0.6`,
      });
    }

    // Pick template (per-listing → per-industry → generic)
    const picked = await pickTemplate({
      category: 'initial_response',
      listing_id: match.matched_listing_id,
      industry: match.industry,
    });

    // Hydrate matched listing from Notion (URL fields etc.)
    const matchedRow = listings.find((l) => l.id === match.matched_listing_id);
    if (!matchedRow) {
      throw new Error(`matched_listing_id ${match.matched_listing_id} not in active listings`);
    }
    const enriched = await enrichListingFromNotion(matchedRow);

    // Calendar availability
    const available_slots = await getAvailableSlots();

    // Phase 8 (2026-05-26): pick click-wrap template based on Buyer Profile
    // Type. Resolution order: LEADS row's Buyer Profile Type (Mark sets per
    // lead) → LISTING's Default Buyer Profile Type (high-value listings like
    // Royal Silk and Yogi International default to Institutional) →
    // "MainStreet O&O" (Main Street NDA_BuyerProfile fallback).
    //
    // LEADS DB select values (exact strings, verified 2026-05-26 against
    // Notion data source 3349af07-54ec-809f-ab32-000b3719dfbf):
    //   - "Institutional"   → corporate-grade buyer (PE, family office,
    //                          strategic, sophisticated entity)
    //   - "Investment"      → investment-grade buyer (similar profile depth
    //                          needed; routes to Corporate template)
    //   - "MidMarket O&O"   → mid-market owner-operator (heavier than std
    //                          Main Street, lighter than Corporate)
    //   - "MainStreet O&O"  → traditional Main Street owner-operator (default)
    const effectiveBuyerProfileType =
      lead.buyer_profile_type
      ?? enriched.default_buyer_profile_type
      ?? 'MainStreet O&O';
    let ndaTemplateKey: string;
    switch (effectiveBuyerProfileType) {
      case 'Institutional':
      case 'Investment':
        // Both route to the seeded Corporate template — 9-section, 54-field
        // profile + 13-clause NDA.
        ndaTemplateKey = 'NDA_BuyerProfile_Corporate';
        break;
      case 'MidMarket O&O':
        // MidMarket template not yet seeded; fall back to standard for now
        // so sends don't fail. Swap to 'NDA_BuyerProfile_MidMarket' once
        // seeded.
        ndaTemplateKey = 'NDA_BuyerProfile';
        break;
      case 'MainStreet O&O':
      default:
        ndaTemplateKey = 'NDA_BuyerProfile';
    }
    console.log(`[router/route] Buyer Profile Type='${effectiveBuyerProfileType}' (from ${lead.buyer_profile_type ? 'LEADS row' : enriched.default_buyer_profile_type ? 'LISTING default' : 'fallback'}) → templateKey='${ndaTemplateKey}'`);

    // Mint click-wrap NDA envelope (graceful: failure does NOT block Email #1).
    // The Router calls /api/sign/create with suppressAutoEmail=true; click-wrap
    // creates the envelope, returns a unique signingUrl, and SKIPS sending its
    // own buyer email — the Router will embed the link in its templated Email #1
    // so the buyer gets one cohesive message from us.
    let nda_signing_url: string | null = null;
    if (!dryRun && enriched.notion_page_id) {
      try {
        const ndaBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.mainstreetos.biz';
        const ndaRes = await fetch(`${ndaBaseUrl}/api/sign/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateKey: ndaTemplateKey,
            notionLeadId: notion_lead_page_id,
            notionListingId: enriched.notion_page_id,
            buyer: {
              email: lead.buyer_email,
              name: [lead.buyer_first_name, lead.buyer_last_name].filter(Boolean).join(' ') || undefined,
              phone: lead.buyer_phone ?? undefined,
            },
            suppressAutoEmail: true,
          }),
        });
        if (ndaRes.ok) {
          const ndaData = await ndaRes.json();
          nda_signing_url = ndaData.signingUrl ?? null;
          // Override the enriched listing's static nda_link with the
          // per-envelope, per-buyer signing URL so the existing {{nda_link}}
          // template placeholder picks up the dynamic URL automatically.
          if (nda_signing_url) {
            (enriched as { nda_link: string | null }).nda_link = nda_signing_url;
          }
        } else {
          console.error('[router/route] click-wrap create returned non-OK:', ndaRes.status, await ndaRes.text().catch(() => ''));
        }
      } catch (ndaErr: any) {
        // Graceful degradation: log and proceed. Email #1 will send without
        // the NDA link, and Mark can manually mint a follow-up NDA later.
        console.error('[router/route] click-wrap create errored:', ndaErr?.message ?? ndaErr);
      }
    }

    // Render
    const rendered = renderEmail({
      subject_template: picked.subject_template,
      body_template: picked.body_template,
      ctx: {
        lead,
        listing: enriched,
        attrs,
        available_slots,
        broker: {
          name: process.env.BROKER_NAME ?? 'Mark Mueller',
          phone: process.env.BROKER_PHONE ?? '',
          email: process.env.BROKER_EMAIL ?? 'markm@creresources.biz',
          firm: process.env.BROKER_FIRM ?? 'CRE Resources, LLC',
          buyer_profile_link: process.env.BUYER_PROFILE_LINK,
          // When a per-envelope NDA was successfully minted, override the
          // env-var fallback "generic" NDA link with the per-buyer signing URL.
          generic_nda_link: nda_signing_url ?? process.env.GENERIC_NDA_LINK,
          buyer_acquisition_process: process.env.BUYER_ACQUISITION_PROCESS_LINK,
        },
      },
    });

    if (dryRun) {
      // Log dry-run audit row (helps post-hoc analytics on dry-run usage)
      await logMatchDecision({
        buyer_lead_id: lead.buyer_lead_id || null,
        notion_lead_page_id,
        inquiry_gmail_message_id: null,
        matched_listing_id: match.matched_listing_id,
        matched_scenario: match.scenario,
        match_confidence: match.confidence,
        match_reasoning: match.reasoning,
        extracted_attributes: attrs,
        template_id: picked.template.id,
        email_sequence_id: picked.template.email_sequence_id,
        sequence_enrollment_id: null,
        variables_used: null,
        status: 'dry_run',
        error: null,
        dry_run: true,
        broker_id: process.env.BROKER_USER_ID ?? null,
      });

      return NextResponse.json({
        status: 'dry_run',
        notion_lead_page_id,
        match,
        attrs,
        template_id: picked.template.id,
        sequence_id: picked.template.email_sequence_id,
        listing: {
          id: enriched.id,
          name: enriched.name,
          asking_price: enriched.asking_price,
          listing_number: enriched.listing_number,
        },
        rendered: {
          to: lead.buyer_email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        },
      });
    }

    // ---- LIVE SEND PATH ----------------------------------------------------
    if (!lead.buyer_email) {
      throw new Error('Cannot send: lead has no buyer_email');
    }

    const sender = new GmailSender();
    const send = await sender.send({
      to: lead.buyer_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (!send.success) {
      const errorAuditId = await logMatchDecision({
        buyer_lead_id: lead.buyer_lead_id || null,
        notion_lead_page_id,
        inquiry_gmail_message_id: null,
        matched_listing_id: match.matched_listing_id,
        matched_scenario: match.scenario,
        match_confidence: match.confidence,
        match_reasoning: match.reasoning,
        extracted_attributes: attrs,
        template_id: picked.template.id,
        email_sequence_id: picked.template.email_sequence_id,
        sequence_enrollment_id: null,
        variables_used: null,
        status: 'failed',
        error: send.error ?? 'Gmail send failed',
        dry_run: false,
        broker_id: process.env.BROKER_USER_ID ?? null,
      });
      return NextResponse.json(
        { status: 'send_failed', error: send.error, audit_id: errorAuditId.id },
        { status: 502 }
      );
    }

    // Persist email_threads + email_messages
    const ownerUserId = process.env.BROKER_USER_ID;
    if (!ownerUserId) {
      throw new Error('BROKER_USER_ID not set in env');
    }

    const persisted = await persistSentEmail({
      send,
      owner_user_id: ownerUserId,
      account_email: process.env.BROKER_EMAIL ?? 'markm@creresources.biz',
      from_name: process.env.BROKER_NAME ?? 'Mark Mueller',
      to_email: lead.buyer_email,
      subject: rendered.subject,
      body_text: rendered.text,
      body_html: rendered.html,
    });

    // Compute buyer_quality from attrs (rough first pass — Mark refines later)
    const buyerQuality = deriveBuyerQualityFromAttrs(attrs);

    // Log audit row (status=enrolled, dry_run=false)
    const audit = await logMatchDecision({
      buyer_lead_id: lead.buyer_lead_id || null,
      notion_lead_page_id,
      inquiry_gmail_message_id: send.message_id,
      matched_listing_id: match.matched_listing_id,
      matched_scenario: match.scenario,
      match_confidence: match.confidence,
      match_reasoning: match.reasoning,
      extracted_attributes: attrs,
      template_id: picked.template.id,
      email_sequence_id: picked.template.email_sequence_id,
      sequence_enrollment_id: null, // wired in commit 4c
      variables_used: null,
      status: 'enrolled',
      error: null,
      dry_run: false,
      broker_id: ownerUserId,
    });

    // Update Notion: stamp date, advance Pipeline Stage, set Disposition,
    // attach matched listing relation
    await updateNotionLead(notion_lead_page_id, {
      LEAD_email_1_date: new Date().toISOString().slice(0, 10),
      pipeline_stage: 'initial_response_sent',
      disposition: 'active',
      ...(buyerQuality ? { buyer_quality: buyerQuality } : {}),
      matched_listing_relation: enriched.notion_page_id ?? undefined,
    });

    return NextResponse.json({
      status: 'routed',
      notion_lead_page_id,
      match,
      template_id: picked.template.id,
      sequence_id: picked.template.email_sequence_id,
      gmail_message_id: send.message_id,
      gmail_thread_id: send.thread_id,
      email_thread_id: persisted.email_thread_id,
      email_message_id: persisted.email_message_id,
      audit_id: audit.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveNotionPageId(body: {
  notion_lead_page_id?: string;
  buyer_lead_id?: string;
}): Promise<string | null> {
  if (body.notion_lead_page_id) return body.notion_lead_page_id;
  if (!body.buyer_lead_id) return null;

  const supabase = getRouterSupabase();
  const { data } = await supabase
    .from('buyer_leads')
    .select('notion_page_id')
    .eq('id', body.buyer_lead_id)
    .maybeSingle();
  return (data?.notion_page_id as string | null) ?? null;
}

/**
 * Rough first-pass Buyer Quality derivation from extractor output.
 * Maps attribute richness onto Fit/Timing/Motivation 1-5 ratings, then
 * aggregates. Mark refines per-lead in Notion.
 */
function deriveBuyerQualityFromAttrs(attrs: ExtractedAttributes) {
  // Fit: signals from buyer_industry_interest + investment range alignment
  let fit: number | null = null;
  if (attrs.buyer_investment_range) fit = (fit ?? 2) + 1;
  if (attrs.buyer_industry_interest) fit = (fit ?? 2) + 1;
  if (attrs.buyer_specific_listing_mentioned) fit = 5;

  // Timing: derived from urgency_level + buyer_timeframe presence
  let timing: number | null = null;
  if (attrs.urgency_level === 'high') timing = 5;
  else if (attrs.urgency_level === 'medium') timing = 3;
  else if (attrs.urgency_level === 'low') timing = 2;
  if (attrs.buyer_timeframe && timing === null) timing = 3;

  // Motivation: sophistication + experience signals
  let motivation: number | null = null;
  if (attrs.sophistication_level === 'broker' || attrs.sophistication_level === 'experienced') motivation = 4;
  else if (attrs.sophistication_level === 'novice') motivation = 2;
  if (attrs.buyer_experience && motivation === null) motivation = 3;

  return deriveBuyerQuality({ fit, timing, motivation });
}

interface ExistingEnrollment {
  id: number;
  sequence_enrollment_id: string | null;
  matched_listing_id: string | null;
}

async function checkExistingEnrollment(
  notion_lead_page_id: string
): Promise<ExistingEnrollment | null> {
  const supabase = getRouterSupabase();
  const { data } = await supabase
    .from('lr_match_decisions')
    .select('id, sequence_enrollment_id, matched_listing_id')
    .eq('notion_lead_page_id', notion_lead_page_id)
    .eq('status', 'enrolled')
    .eq('dry_run', false)
    .maybeSingle();

  if (!data) return null;
  return {
    id: Number(data.id),
    sequence_enrollment_id: (data.sequence_enrollment_id as string | null) ?? null,
    matched_listing_id: (data.matched_listing_id as string | null) ?? null,
  };
}
