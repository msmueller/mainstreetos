/**
 * End-to-end advance test for /api/router/advance.
 *
 * Mirrors the route handler logic via tsx (no HTTP). Reads the lead's gate
 * state, decides which step to fire, finds the existing Gmail thread,
 * sends a threaded reply, persists email_messages, supersedes the prior
 * audit row, logs a new enrolled audit row, advances the Notion Pipeline
 * Stage.
 *
 * Run:
 *   node --env-file=.env.local --import tsx scripts/smoke-router-advance.ts <page_id> [--live] [--category <name>]
 *
 * If --category is omitted the script auto-detects from gate state.
 * If --live is omitted the script renders + prints but does NOT send.
 */

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
  findEmailThreadForLead,
  getRouterSupabase,
} from '../src/lib/router';
import type { TemplateCategory, ExtractedAttributes } from '../src/lib/router';

const PAGE_ID = process.argv[2] ?? '3589af07-54ec-81a0-a4c4-d8f2487a80f2';
const LIVE = process.argv.includes('--live');
const FORCE_IDX = process.argv.indexOf('--category');
const FORCE_CATEGORY = FORCE_IDX > 0 ? (process.argv[FORCE_IDX + 1] as TemplateCategory) : undefined;

async function main() {
  console.log(`>>> Advance test for: ${PAGE_ID}${FORCE_CATEGORY ? ` (forced: ${FORCE_CATEGORY})` : ''}`);
  console.log(`>>> Mode: ${LIVE ? 'LIVE' : 'DRY-RUN'}\n`);

  // 1. Read gate + decide
  const { gate, decision } = await readAndDecide({
    notion_lead_page_id: PAGE_ID,
    forceCategory: FORCE_CATEGORY,
  });

  console.log('=== GATE STATE ===');
  console.log(JSON.stringify(gate, null, 2));
  console.log('\n=== DECISION ===');
  console.log(JSON.stringify(decision, null, 2));

  if (!decision.can_advance) {
    console.log('\nCANNOT ADVANCE — aborting.');
    return;
  }

  // 2. Fetch prior match
  const supabase = getRouterSupabase();
  const { data: prior } = await supabase
    .from('lr_match_decisions')
    .select('matched_listing_id, extracted_attributes, template_id')
    .eq('notion_lead_page_id', PAGE_ID)
    .eq('dry_run', false)
    .in('status', ['enrolled', 'superseded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prior?.matched_listing_id) {
    throw new Error('No prior match found. Run /api/router/route first to send Email #1.');
  }

  console.log('\n=== PRIOR MATCH ===');
  console.log(`  matched_listing_id:   ${prior.matched_listing_id}`);
  console.log(`  template_id:          ${prior.template_id}`);

  // 3. Find existing thread for proper threading
  const existingThread = await findEmailThreadForLead(PAGE_ID);
  if (!existingThread) {
    throw new Error('No prior Gmail thread found. Send Email #1 first via /api/router/route.');
  }
  console.log('\n=== EXISTING THREAD ===');
  console.log(`  gmail_thread_id:        ${existingThread.gmail_thread_id}`);
  console.log(`  last_rfc822_message_id: ${existingThread.last_rfc822_message_id}`);
  console.log(`  references count:       ${existingThread.references.length}`);

  // 4. Lead context
  const lead = await buildLeadContextFromNotion(PAGE_ID);
  if (!lead.buyer_email) throw new Error('Lead has no buyer_email');

  // 5. Fetch matched listing + enrich
  const listings = await fetchActiveListings();
  const matchedRow = listings.find((l) => l.id === prior.matched_listing_id);
  if (!matchedRow) throw new Error(`Matched listing ${prior.matched_listing_id} no longer active`);
  const enriched = await enrichListingFromNotion(matchedRow);

  // 6. Pick template
  const picked = await pickTemplate({
    category: decision.next_category!,
    listing_id: matchedRow.id,
    industry: matchedRow.industry,
  });
  console.log('\n=== TEMPLATE ===');
  console.log(`  template_id:       ${picked.template.id}`);
  console.log(`  email_sequence_id: ${picked.template.email_sequence_id}`);

  // 7. Render
  const available_slots = await getAvailableSlots();
  const rendered = renderEmail({
    subject_template: picked.subject_template,
    body_template: picked.body_template,
    ctx: {
      lead,
      listing: enriched,
      attrs: ((prior.extracted_attributes as ExtractedAttributes | null) ?? {
        buyer_first_name: lead.buyer_first_name,
        buyer_last_name: lead.buyer_last_name,
        buyer_email: lead.buyer_email,
        buyer_phone: null,
        buyer_investment_range: null,
        buyer_timeframe: null,
        buyer_experience: null,
        buyer_industry_interest: null,
        buyer_specific_listing_mentioned: null,
        urgency_level: 'unknown',
        sophistication_level: 'unknown',
        extraction_confidence: 0,
      }) as ExtractedAttributes,
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

  console.log('\n=== RENDERED ===');
  console.log(`To:      ${lead.buyer_email}`);
  console.log(`Subject: ${rendered.subject}  (sender will prepend "Re: " on send)`);
  console.log('\n--- Plain text ---');
  console.log(rendered.text);

  if (!LIVE) {
    console.log('\n(Pass --live to actually send + persist + advance.)');
    return;
  }

  // 8. Live send (threaded)
  console.log('\n=== LIVE SEND ===');
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
  console.log('Send result:', { success: send.success, message_id: send.message_id, thread_id: send.thread_id });
  if (!send.success) throw new Error(`Send failed: ${send.error}`);

  const ownerUserId = process.env.BROKER_USER_ID!;

  // 9. Persist new email_message in same thread
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

  // 10. Supersede prior + insert new audit
  await supersedePriorEnrollments(PAGE_ID);
  const audit = await logMatchDecision({
    buyer_lead_id: lead.buyer_lead_id || null,
    notion_lead_page_id: PAGE_ID,
    inquiry_gmail_message_id: send.message_id,
    matched_listing_id: matchedRow.id,
    matched_scenario: null,
    match_confidence: null,
    match_reasoning: `Advanced via smoke-router-advance: ${decision.detail}`,
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

  // 11. Notion update
  await updateNotionLead(PAGE_ID, {
    [decision.notion_date_field!]: new Date().toISOString().slice(0, 10),
    pipeline_stage: decision.next_pipeline_stage,
    disposition: decision.next_disposition,
  } as any);

  console.log('\n=== ADVANCE COMPLETE ===');
  console.log(`  Gmail message_id:    ${send.message_id}`);
  console.log(`  email_thread_id:     ${emailThreadId}`);
  console.log(`  email_message_id:    ${emailMessageId}`);
  console.log(`  lr_match_decisions:  #${audit.id}  (prior superseded)`);
  console.log(`  Notion advanced:     Pipeline Stage = ${decision.next_pipeline_stage}, ${decision.notion_date_field} stamped`);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
