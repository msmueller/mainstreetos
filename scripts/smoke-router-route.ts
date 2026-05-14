/**
 * End-to-end dry-run smoke test for the Lead Router.
 *
 * Exercises the same pipeline the /api/router/route endpoint runs (in
 * dry_run mode), but bypasses HTTP so we can run it directly via tsx.
 *
 * Run:
 *   node --env-file=.env.local --import tsx scripts/smoke-router-route.ts <notion_page_id>
 *
 * If no page id is passed, defaults to the most recent LEADS row.
 */

import {
  buildLeadContextFromNotion,
  fetchActiveListings,
  extractAttributes,
  matchListing,
  pickTemplate,
  enrichListingFromNotion,
  renderEmail,
  getAvailableSlots,
  GmailSender,
  persistSentEmail,
  logMatchDecision,
  updateNotionLead,
  deriveBuyerQuality,
} from '../src/lib/router';
import type { ExtractedAttributes } from '../src/lib/router';

const PAGE_ID = process.argv[2] ?? '4d2986b1-d34e-46c8-915b-2426c5db8fab';
const LIVE = process.argv.includes('--live');

async function main() {
  console.log(`>>> Notion lead page: ${PAGE_ID}\n`);

  const lead = await buildLeadContextFromNotion(PAGE_ID);
  console.log('=== LEAD CONTEXT ===');
  console.log(`  buyer:                 ${lead.buyer_first_name ?? '?'} ${lead.buyer_last_name ?? ''}`.trim());
  console.log(`  email:                 ${lead.buyer_email}`);
  console.log(`  source:                ${lead.source}`);
  console.log(`  date:                  ${lead.created_at}`);
  console.log(`  prev interactions:     ${lead.previous_interactions_count}`);
  console.log(`  body length:           ${(lead.email_body ?? '').length} chars`);
  console.log();

  const listings = await fetchActiveListings();
  console.log(`=== ACTIVE LISTINGS: ${listings.length} ===`);
  for (const l of listings) {
    console.log(`  [${l.listing_number ?? '----'}] ${l.name.padEnd(35)} ${l.industry ?? '?'.padEnd(28)}  asking=${l.asking_price ? '$' + l.asking_price.toLocaleString() : 'N/A'}`);
  }
  console.log();

  const attrs = await extractAttributes(lead.email_body ?? '', lead.buyer_email ?? '');
  console.log('=== EXTRACTED ATTRIBUTES ===');
  console.log(JSON.stringify(attrs, null, 2));
  console.log();

  const match = await matchListing({ lead, listings, attrs });
  console.log('=== MATCH RESULT ===');
  console.log(JSON.stringify(match, null, 2));
  console.log();

  if (match.confidence < 0.6 || !match.matched_listing_id) {
    console.log('=> manual_review (would NOT auto-enroll)');
    return;
  }

  const picked = await pickTemplate({
    category: 'initial_response',
    listing_id: match.matched_listing_id,
    industry: match.industry,
  });
  console.log(`=== TEMPLATE: ${picked.template.id} ===`);
  console.log(`  sequence: ${picked.template.email_sequence_id}`);
  console.log();

  const matchedRow = listings.find((l) => l.id === match.matched_listing_id)!;
  const enriched = await enrichListingFromNotion(matchedRow);
  console.log('=== ENRICHED LISTING URL FIELDS ===');
  console.log(`  om_link:       ${enriched.om_link ?? '(null)'}`);
  console.log(`  cim_link:      ${enriched.cim_link ?? '(null)'}`);
  console.log(`  bvr_link:      ${enriched.bvr_link ?? '(null)'}`);
  console.log(`  workbook_link: ${enriched.workbook_link ?? '(null)'}`);
  console.log(`  nda_link:      ${enriched.nda_link ?? '(null)'}`);
  console.log(`  bbs_link:      ${enriched.bbs_link ?? '(null)'}`);
  console.log();

  const available_slots = await getAvailableSlots();
  console.log(`=== CALENDAR SLOTS ===`);
  console.log(`  ${available_slots}`);
  console.log();

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
        generic_nda_link: process.env.GENERIC_NDA_LINK,
        buyer_acquisition_process: process.env.BUYER_ACQUISITION_PROCESS_LINK,
      },
    },
  });

  console.log('=== RENDERED ===');
  console.log(`To:      ${lead.buyer_email}`);
  console.log(`Subject: ${rendered.subject}`);
  console.log();
  console.log('--- Plain text ---');
  console.log(rendered.text);

  if (!LIVE) {
    console.log('\n(Pass --live to actually send + persist + update Notion.)');
    return;
  }

  // ---- LIVE PATH (mirrors /api/router/route live-send branch) -------------
  console.log('\n=== LIVE SEND ===');
  if (!lead.buyer_email) {
    throw new Error('Lead has no buyer_email');
  }

  const sender = new GmailSender();
  const send = await sender.send({
    to: lead.buyer_email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  console.log('Send result:', { success: send.success, message_id: send.message_id, thread_id: send.thread_id });

  if (!send.success) {
    throw new Error(`Send failed: ${send.error}`);
  }

  const ownerUserId = process.env.BROKER_USER_ID!;
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
  console.log('Persisted:', persisted);

  const buyerQuality = deriveBQ(attrs);

  const audit = await logMatchDecision({
    buyer_lead_id: lead.buyer_lead_id || null,
    notion_lead_page_id: PAGE_ID,
    inquiry_gmail_message_id: send.message_id,
    matched_listing_id: match.matched_listing_id,
    matched_scenario: match.scenario,
    match_confidence: match.confidence,
    match_reasoning: match.reasoning,
    extracted_attributes: attrs,
    template_id: picked.template.id,
    email_sequence_id: picked.template.email_sequence_id,
    sequence_enrollment_id: null,
    variables_used: null,
    status: 'enrolled',
    error: null,
    dry_run: false,
    broker_id: ownerUserId,
  });
  console.log('lr_match_decisions row:', audit);

  await updateNotionLead(PAGE_ID, {
    LEAD_email_1_date: new Date().toISOString().slice(0, 10),
    pipeline_stage: 'initial_response_sent',
    disposition: 'active',
    ...(buyerQuality ? { buyer_quality: buyerQuality } : {}),
    matched_listing_relation: enriched.notion_page_id ?? undefined,
  });
  console.log('Notion lead updated.');

  console.log('\n=== ALL SIDE EFFECTS COMPLETE ===');
  console.log('  Gmail message_id:    ', send.message_id);
  console.log('  email_threads.id:    ', persisted.email_thread_id);
  console.log('  email_messages.id:   ', persisted.email_message_id);
  console.log('  lr_match_decisions.id:', audit.id);
  console.log('  Notion LEADS row updated: Pipeline Stage, Disposition, LEAD Email #1, 📋 LISTINGS');
}

function deriveBQ(attrs: ExtractedAttributes) {
  let fit: number | null = null;
  if (attrs.buyer_investment_range) fit = (fit ?? 2) + 1;
  if (attrs.buyer_industry_interest) fit = (fit ?? 2) + 1;
  if (attrs.buyer_specific_listing_mentioned) fit = 5;
  let timing: number | null = null;
  if (attrs.urgency_level === 'high') timing = 5;
  else if (attrs.urgency_level === 'medium') timing = 3;
  else if (attrs.urgency_level === 'low') timing = 2;
  if (attrs.buyer_timeframe && timing === null) timing = 3;
  let motivation: number | null = null;
  if (attrs.sophistication_level === 'broker' || attrs.sophistication_level === 'experienced') motivation = 4;
  else if (attrs.sophistication_level === 'novice') motivation = 2;
  if (attrs.buyer_experience && motivation === null) motivation = 3;
  return deriveBuyerQuality({ fit, timing, motivation });
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
