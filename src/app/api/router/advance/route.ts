/**
 * POST /api/router/advance
 *
 * Lead Router — gated step advancement for Emails #2 through #5.
 *
 * Auth: shared secret in `x-router-secret` header.
 *
 * Body:
 *   { "notion_lead_page_id": "<uuid>" }                   // auto-detect from gate state
 *   { "notion_lead_page_id": "<uuid>", "category": "..." } // forced (e.g. Notion button)
 *
 * Query:
 *   ?dry_run=true   Render and return; no send, no DB writes, no Notion update.
 *
 * Flow:
 *   1. Auth check
 *   2. Read Notion gate state (Pipeline Stage, Completed NDA / Buyer Profile / LOI)
 *   3. Decide next step (or surface gate-not-met error)
 *   4. Find existing Gmail thread for proper threading
 *   5. Pick template for the next category
 *   6. Render
 *   7. Send (threaded via In-Reply-To/References)
 *   8. Persist email_message in existing email_threads
 *   9. Supersede prior enrolled audit row, insert new enrolled row
 *  10. Update Notion: stamp the right email date, advance Pipeline Stage
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  buildLeadContextFromNotion,
  fetchActiveListings,
  enrichListingFromNotion,
  pickTemplate,
  renderEmail,
  getAvailableSlots,
  GmailSender,
  insertEmailMessage,
  upsertEmailThread,
  logMatchDecision,
  supersedePriorEnrollments,
  updateNotionLead,
  readAndDecide,
} from '@/lib/router';
import { findEmailThreadForLead } from '@/lib/router/threads';
import type { TemplateCategory } from '@/lib/router';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get('x-router-secret');
  if (!process.env.ROUTER_SECRET || auth !== process.env.ROUTER_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';

  let body: { notion_lead_page_id?: string; category?: TemplateCategory };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { notion_lead_page_id, category: forceCategory } = body;
  if (!notion_lead_page_id) {
    return NextResponse.json({ error: 'missing_notion_lead_page_id' }, { status: 400 });
  }

  try {
    // 1. Read gate state and decide
    const { gate, decision } = await readAndDecide({
      notion_lead_page_id,
      forceCategory,
    });

    if (!decision.can_advance) {
      return NextResponse.json(
        {
          status: 'cannot_advance',
          error: decision.error,
          detail: decision.detail,
          gate,
        },
        { status: 409 }
      );
    }

    const nextCategory = decision.next_category!;
    const nextPipelineStage = decision.next_pipeline_stage!;
    const nextDisposition = decision.next_disposition!;
    const notionDateField = decision.notion_date_field!;

    // 2. Build lead context (for renderer)
    const lead = await buildLeadContextFromNotion(notion_lead_page_id);
    if (!lead.buyer_email) {
      return NextResponse.json(
        { status: 'error', error: 'lead_has_no_email', detail: 'Cannot send: lead has no buyer_email.' },
        { status: 400 }
      );
    }

    // 3. Find the existing Gmail thread (so Email #2-5 thread under Email #1)
    const existingThread = await findEmailThreadForLead(notion_lead_page_id);
    if (!existingThread) {
      return NextResponse.json(
        {
          status: 'no_prior_thread',
          detail: 'No prior Gmail thread found for this lead. Send Email #1 via /api/router/route first.',
        },
        { status: 409 }
      );
    }

    // 4. Find the previously matched listing so we render the right context
    const prior = await fetchPriorMatch(notion_lead_page_id);
    if (!prior?.matched_listing_id) {
      return NextResponse.json(
        {
          status: 'no_prior_match',
          detail: 'No matched_listing_id found in prior audit row. Cannot render without listing context.',
        },
        { status: 409 }
      );
    }

    const listings = await fetchActiveListings();
    const matchedRow = listings.find((l) => l.id === prior.matched_listing_id);
    if (!matchedRow) {
      return NextResponse.json(
        {
          status: 'matched_listing_inactive',
          detail: `Listing ${prior.matched_listing_id} is no longer active. Reroute manually.`,
        },
        { status: 409 }
      );
    }
    const enriched = await enrichListingFromNotion(matchedRow);

    // 5. Pick template for the new category
    let picked;
    try {
      picked = await pickTemplate({
        category: nextCategory,
        listing_id: matchedRow.id,
        industry: matchedRow.industry,
      });
    } catch (e) {
      return NextResponse.json(
        {
          status: 'no_template',
          detail: `No template seeded for category='${nextCategory}'. Author the template in lr_templates first.`,
          underlying: e instanceof Error ? e.message : String(e),
        },
        { status: 409 }
      );
    }

    // 6. Render
    const available_slots = await getAvailableSlots();
    const rendered = renderEmail({
      subject_template: picked.subject_template,
      body_template: picked.body_template,
      ctx: {
        lead,
        listing: enriched,
        // Re-use prior extracted attributes from the audit row so the renderer
        // has buyer_first_name / timeframe / range etc.
        attrs: (prior.extracted_attributes ?? defaultAttrs(lead.buyer_first_name)) as any,
        available_slots,
        broker: {
          name: process.env.BROKER_NAME ?? 'Mark Mueller',
          phone: process.env.BROKER_PHONE ?? '',
          email: process.env.BROKER_EMAIL ?? 'markm@creresources.biz',
          firm: process.env.BROKER_FIRM ?? 'CRE Resources, LLC',
          buyer_profile_link: process.env.BUYER_PROFILE_LINK,
          generic_nda_link: process.env.GENERIC_NDA_LINK,
          buyer_acquisition_process: process.env.BUYER_ACQUISITION_PROCESS_LINK,
        },
      },
    });

    if (dryRun) {
      return NextResponse.json({
        status: 'dry_run',
        notion_lead_page_id,
        category: nextCategory,
        next_pipeline_stage: nextPipelineStage,
        template_id: picked.template.id,
        thread: {
          gmail_thread_id: existingThread.gmail_thread_id,
          last_rfc822_message_id: existingThread.last_rfc822_message_id,
        },
        rendered: {
          to: lead.buyer_email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        },
      });
    }

    // 7. Live send (threaded)
    const sender = new GmailSender();
    const send = await sender.send({
      to: lead.buyer_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      thread_id: existingThread.gmail_thread_id,
      in_reply_to: existingThread.last_rfc822_message_id ?? undefined,
      references: existingThread.references.length ? existingThread.references.join(' ') : undefined,
    });

    if (!send.success) {
      const errAudit = await logMatchDecision({
        buyer_lead_id: lead.buyer_lead_id || null,
        notion_lead_page_id,
        inquiry_gmail_message_id: null,
        matched_listing_id: matchedRow.id,
        matched_scenario: null,
        match_confidence: null,
        match_reasoning: null,
        extracted_attributes: (prior.extracted_attributes as any) ?? null,
        template_id: picked.template.id,
        email_sequence_id: picked.template.email_sequence_id,
        sequence_enrollment_id: null,
        variables_used: null,
        status: 'failed',
        error: send.error ?? 'send_failed',
        dry_run: false,
        broker_id: process.env.BROKER_USER_ID ?? null,
      });
      return NextResponse.json(
        { status: 'send_failed', error: send.error, audit_id: errAudit.id },
        { status: 502 }
      );
    }

    const ownerUserId = process.env.BROKER_USER_ID;
    if (!ownerUserId) {
      throw new Error('BROKER_USER_ID not set in env');
    }

    // 8. Persist new email_message under the existing thread (UPSERT thread bumps count)
    const emailThreadId = await upsertEmailThread({
      provider_thread_id: send.thread_id,
      owner_user_id: ownerUserId,
      account_email: process.env.BROKER_EMAIL ?? 'markm@creresources.biz',
      subject: rendered.subject,
      participant_emails: [process.env.BROKER_EMAIL ?? 'markm@creresources.biz', lead.buyer_email],
    });
    const emailMessageId = await insertEmailMessage({
      thread_id: emailThreadId,
      provider_message_id: send.message_id,
      rfc822_message_id: send.rfc822_message_id ?? null,
      owner_user_id: ownerUserId,
      from_email: process.env.BROKER_EMAIL ?? 'markm@creresources.biz',
      from_name: process.env.BROKER_NAME ?? 'Mark Mueller',
      to_emails: [lead.buyer_email],
      subject: rendered.subject,
      body_text: rendered.text,
      body_html: rendered.html,
    });

    // 9. Supersede prior enrolled audit, insert new enrolled audit
    await supersedePriorEnrollments(notion_lead_page_id);
    const audit = await logMatchDecision({
      buyer_lead_id: lead.buyer_lead_id || null,
      notion_lead_page_id,
      inquiry_gmail_message_id: send.message_id,
      matched_listing_id: matchedRow.id,
      matched_scenario: null, // matcher not re-run for advance
      match_confidence: null,
      match_reasoning: `Advanced from prior enrollment via /api/router/advance: ${decision.detail}`,
      extracted_attributes: (prior.extracted_attributes as any) ?? null,
      template_id: picked.template.id,
      email_sequence_id: picked.template.email_sequence_id,
      sequence_enrollment_id: null,
      variables_used: null,
      status: 'enrolled',
      error: null,
      dry_run: false,
      broker_id: ownerUserId,
    });

    // 10. Update Notion: stamp the right email date, advance Pipeline Stage
    await updateNotionLead(notion_lead_page_id, {
      [notionDateField]: new Date().toISOString().slice(0, 10),
      pipeline_stage: nextPipelineStage,
      disposition: nextDisposition,
    } as any);

    return NextResponse.json({
      status: 'advanced',
      notion_lead_page_id,
      category: nextCategory,
      pipeline_stage: nextPipelineStage,
      disposition: nextDisposition,
      template_id: picked.template.id,
      gmail_message_id: send.message_id,
      gmail_thread_id: send.thread_id,
      email_message_id: emailMessageId,
      audit_id: audit.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PriorMatch {
  matched_listing_id: string | null;
  extracted_attributes: Record<string, unknown> | null;
  template_id: string | null;
}

async function fetchPriorMatch(notion_lead_page_id: string): Promise<PriorMatch | null> {
  const { getRouterSupabase } = await import('@/lib/router');
  const supabase = getRouterSupabase();
  const { data } = await supabase
    .from('lr_match_decisions')
    .select('matched_listing_id, extracted_attributes, template_id')
    .eq('notion_lead_page_id', notion_lead_page_id)
    .eq('dry_run', false)
    .in('status', ['enrolled', 'superseded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    matched_listing_id: (data.matched_listing_id as string | null) ?? null,
    extracted_attributes: (data.extracted_attributes as Record<string, unknown> | null) ?? null,
    template_id: (data.template_id as string | null) ?? null,
  };
}

function defaultAttrs(firstName: string | null) {
  return {
    buyer_first_name: firstName,
    buyer_last_name: null,
    buyer_email: null,
    buyer_phone: null,
    buyer_investment_range: null,
    buyer_timeframe: null,
    buyer_experience: null,
    buyer_industry_interest: null,
    buyer_specific_listing_mentioned: null,
    urgency_level: 'unknown' as const,
    sophistication_level: 'unknown' as const,
    extraction_confidence: 0,
  };
}
