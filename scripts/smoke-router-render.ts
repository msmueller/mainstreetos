/**
 * Smoke test for commit 3: renderer + GmailSender.
 *
 * Fetches the seeded `tpl_bbs_initial_generic` template from Supabase,
 * renders it against a realistic RenderContext, and prints the rendered
 * subject / HTML / plain text.
 *
 * Pass `--send` to actually deliver a test email to BROKER_EMAIL via
 * GmailSender (self-test). Without the flag, NO email is sent.
 *
 * Run with:
 *   node --env-file=.env.local --import tsx scripts/smoke-router-render.ts
 *   node --env-file=.env.local --import tsx scripts/smoke-router-render.ts --send
 */

import {
  renderEmail,
  GmailSender,
  getRouterSupabase,
} from '../src/lib/router';
import type {
  RenderContext,
  LeadContext,
  Listing,
  ExtractedAttributes,
} from '../src/lib/router';

async function main() {
  const supabase = getRouterSupabase();

  // Fetch the seeded template + its sequence_steps row
  const { data: template, error: tplErr } = await supabase
    .from('lr_templates')
    .select('*, email_sequences(*)')
    .eq('id', 'tpl_bbs_initial_generic')
    .single();

  if (tplErr || !template) {
    throw new Error(`Could not load tpl_bbs_initial_generic: ${tplErr?.message}`);
  }

  const { data: step, error: stepErr } = await supabase
    .from('sequence_steps')
    .select('subject_template, body_template, body_is_html, step_number')
    .eq('sequence_id', template.email_sequence_id)
    .eq('step_number', 1)
    .single();

  if (stepErr || !step) {
    throw new Error(`Could not load step 1 of sequence ${template.email_sequence_id}: ${stepErr?.message}`);
  }

  console.log('Loaded template:', template.id);
  console.log('  -> sequence:', template.email_sequence_id);
  console.log('  -> step 1 body length:', step.body_template.length, 'chars\n');

  // Build a realistic RenderContext (Tom Pellegrino + La Guardiola)
  const lead: LeadContext = {
    buyer_lead_id: 'test-1',
    notion_page_id: null,
    buyer_first_name: 'Tom',
    buyer_last_name: 'Pellegrino',
    buyer_email: 'tom.pellegrino.biz@gmail.com',
    buyer_phone: '(908) 555-0143',
    email_subject: 'Inquiry from BizBuySell - Listing 2103847',
    email_body: 'See above',
    source: 'BBS',
    created_at: new Date().toISOString(),
    cobroker: null,
    previous_interactions_count: 0,
  };

  const listing: Listing = {
    id: 'aaaa-1111-aaaa-1111',
    notion_page_id: 'n1',
    name: 'La Guardiola Pizzeria',
    listing_title: '$165K SDE Bridgewater NJ Pizzeria with Real Estate Available',
    listing_number: '2103847',
    industry: 'Restaurants & Food Service',
    naics: null,
    location: 'Bridgewater, NJ',
    asking_price: 475000,
    sde: 165000,
    ebitda: 145000,
    status: 'active',
    description: 'Established neighborhood pizzeria',
    keywords: [],
    cobroker: null,
    om_link: 'https://docs.creresources.biz/laguardiola/om.pdf',
    cim_link: null, // demonstrate fallback
    bvr_link: null,
    workbook_link: null,
    nda_link: 'https://nda.creresources.biz/laguardiola',
    bbs_link: 'https://www.bizbuysell.com/Business-Opportunity/2103847',
    loi_link: null,
  };

  const attrs: ExtractedAttributes = {
    buyer_first_name: 'Tom',
    buyer_last_name: 'Pellegrino',
    buyer_email: 'tom.pellegrino.biz@gmail.com',
    buyer_phone: '(908) 555-0143',
    buyer_investment_range: '$400K-$500K',
    buyer_timeframe: '3-4 months',
    buyer_experience: 'Owned a small printing business for 12 years',
    buyer_industry_interest: 'pizzeria',
    buyer_specific_listing_mentioned: 'BizBuySell Listing #2103847',
    urgency_level: 'high',
    sophistication_level: 'experienced',
    extraction_confidence: 0.95,
  };

  const ctx: RenderContext = {
    lead,
    listing,
    attrs,
    available_slots: 'Tuesday at 2pm, Wednesday at 10am, or Thursday at 3pm',
    broker: {
      name: process.env.BROKER_NAME ?? 'Mark Mueller',
      phone: process.env.BROKER_PHONE ?? '',
      email: process.env.BROKER_EMAIL ?? 'markm@creresources.biz',
      firm: process.env.BROKER_FIRM ?? 'CRE Resources, LLC',
      buyer_profile_link: process.env.BUYER_PROFILE_LINK,
      generic_nda_link: process.env.GENERIC_NDA_LINK,
      buyer_acquisition_process: process.env.BUYER_ACQUISITION_PROCESS_LINK,
    },
  };

  const rendered = renderEmail({
    subject_template: step.subject_template,
    body_template: step.body_template,
    ctx,
  });

  console.log('=== RENDERED SUBJECT ===');
  console.log(rendered.subject);
  console.log('\n=== RENDERED PLAIN TEXT ===');
  console.log(rendered.text);
  console.log('\n=== RENDERED HTML (first 600 chars) ===');
  console.log(rendered.html.slice(0, 600) + (rendered.html.length > 600 ? '…' : ''));

  if (process.argv.includes('--send')) {
    console.log('\n=== SENDING TEST EMAIL ===');
    const sender = new GmailSender();
    const to = process.env.BROKER_EMAIL ?? 'markm@creresources.biz';
    const result = await sender.send({
      to,
      subject: `[Lead Router test] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.success) {
      console.log(`\nDelivered to ${to}. Check your inbox.`);
    }
  } else {
    console.log('\n(Pass --send to actually deliver a test email to BROKER_EMAIL.)');
  }
}

main().catch((e) => {
  console.error('SMOKE TEST FAILED:', e);
  process.exit(1);
});
