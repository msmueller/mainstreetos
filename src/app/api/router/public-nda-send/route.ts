/**
 * MainStreetOS · POST /api/router/public-nda-send
 *
 * Option 3 (2026-07-08): auto-send Email #1 to a NON-BBS lead with the STATIC
 * per-listing public "Start NDA" link — no AI listing-match, no envelope mint.
 *
 * Unlike /api/router/route (BBS inbound: extract → match → mint per-buyer NDA →
 * Email #1), a non-BBS lead is entered by Mark with the listing already linked
 * via the 📋 LISTINGS relation, and the public page needs no pre-minted link
 * (it mints when the buyer actually signs). So this endpoint:
 *   1. reads the lead + its linked listing from Notion,
 *   2. resolves that listing's public NDA slug from Supabase seller_listings,
 *   3. renders the SAME Lead Router Email #1 template with {{nda_link}} = the
 *      public URL (reusing renderEmail + pickTemplate + GmailSender), and
 *   4. sends it and stamps the lead (LEAD Email #1 date + pipeline stage).
 *
 * Auth: shared secret in x-router-secret (ROUTER_SECRET), same as the Router.
 * Body: { "notion_lead_page_id": "<uuid>" }
 * Query: ?dry_run=true → render + return the email, send nothing, stamp nothing.
 *
 * Invoked by the auto-route cron's third leg (Send Public NDA checkbox), or
 * manually for a single lead.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  getRouterSupabase,
  getNotionClient,
  buildLeadContextFromNotion,
  pickTemplate,
  renderEmail,
  getAvailableSlots,
  GmailSender,
  updateNotionLead,
} from '@/lib/router';
import type { ExtractedAttributes, Listing } from '@/lib/router';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Auth
  const auth = req.headers.get('x-router-secret');
  if (!process.env.ROUTER_SECRET || auth !== process.env.ROUTER_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get('dry_run') === 'true';

  let body: { notion_lead_page_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const leadId = body.notion_lead_page_id;
  if (!leadId) {
    return NextResponse.json({ error: 'missing_lead', detail: 'notion_lead_page_id is required' }, { status: 400 });
  }

  try {
    // 2. Read the lead page for the linked listing + guard fields.
    const notion = getNotionClient();
    const page: any = await notion.pages.retrieve({ page_id: leadId });
    const props = page?.properties ?? {};

    if (props['Completed NDA']?.checkbox === true) {
      return NextResponse.json({ status: 'skipped', reason: 'nda_already_completed' });
    }

    const listingRelationId: string | null = props['📋 LISTINGS']?.relation?.[0]?.id ?? null;
    if (!listingRelationId) {
      return NextResponse.json({ status: 'skipped', reason: 'no_linked_listing',
        detail: 'Lead has no 📋 LISTINGS relation; cannot resolve a public NDA link.' }, { status: 422 });
    }

    // 3. Resolve the listing's public slug from Supabase (canonical source).
    const supabase = getRouterSupabase();
    const { data: listingRow, error: listErr } = await supabase
      .from('seller_listings')
      .select('id, name, listing_number, nda_public_slug, nda_public_enabled, nda_public_display, notion_page_id')
      .eq('notion_page_id', listingRelationId)
      .maybeSingle();

    if (listErr) {
      return NextResponse.json({ status: 'error', error: `listing lookup failed: ${listErr.message}` }, { status: 500 });
    }
    if (!listingRow || !listingRow.nda_public_slug || !listingRow.nda_public_enabled) {
      return NextResponse.json({ status: 'skipped', reason: 'listing_not_public',
        detail: 'Linked listing has no enabled public NDA slug (nda_public_enabled + nda_public_slug).' }, { status: 422 });
    }

    const display = (listingRow.nda_public_display ?? {}) as Record<string, any>;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.mainstreetos.biz').replace(/\/+$/, '');
    const publicUrl = `${baseUrl}/nda/${listingRow.nda_public_slug}`;

    // 4. Lead context (buyer identity) + a listing object for the renderer.
    const lead = await buildLeadContextFromNotion(leadId);
    if (!lead.buyer_email && !dryRun) {
      return NextResponse.json({ status: 'skipped', reason: 'no_buyer_email' }, { status: 422 });
    }

    // Minimal listing object — only the fields Email #1 reads. nda_link is the
    // STATIC public URL; om_link comes from the public display config.
    const listing = {
      id: listingRow.id,
      name: display.business_name ?? listingRow.name ?? 'the listing',
      listing_title: display.listing_title ?? null,
      listing_number: listingRow.listing_number ?? null,
      om_link: display.om_link ?? null,
      nda_link: publicUrl,
    } as unknown as Listing;

    // 5. Email #1 template (per-listing → per-industry → generic).
    const picked = await pickTemplate({
      category: 'initial_response',
      listing_id: listingRow.id as string,
      industry: null,
    });

    const available_slots = await getAvailableSlots();

    const rendered = renderEmail({
      subject_template: picked.subject_template,
      body_template: picked.body_template,
      ctx: {
        lead,
        listing,
        attrs: {} as ExtractedAttributes,
        available_slots,
        broker: {
          name: process.env.BROKER_NAME ?? 'Mark Mueller',
          phone: process.env.BROKER_PHONE ?? '',
          email: process.env.BROKER_EMAIL ?? 'markm@creresources.biz',
          firm: process.env.BROKER_FIRM ?? 'CRE Resources, LLC',
          buyer_profile_link: process.env.BUYER_PROFILE_LINK,
          // Public URL as the generic fallback too, so {{nda_link}} resolves to
          // it even if a template references the generic form.
          generic_nda_link: publicUrl,
          buyer_acquisition_process: process.env.BUYER_ACQUISITION_PROCESS_LINK,
        },
      },
    });

    if (dryRun) {
      return NextResponse.json({
        status: 'dry_run',
        notion_lead_page_id: leadId,
        public_url: publicUrl,
        listing: { id: listingRow.id, name: listing.name, slug: listingRow.nda_public_slug },
        rendered: { to: lead.buyer_email, subject: rendered.subject, html: rendered.html, text: rendered.text },
      });
    }

    // 6. Send via the same Gmail sender the BBS Email #1 uses.
    const send = await new GmailSender().send({
      to: lead.buyer_email!,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (!send.success) {
      return NextResponse.json({ status: 'send_failed', error: send.error }, { status: 502 });
    }

    // 7. Stamp the lead (same shape as BBS Email #1): sent-date + advance stage.
    try {
      await updateNotionLead(leadId, {
        LEAD_email_1_date: new Date().toISOString().slice(0, 10),
        pipeline_stage: 'initial_response_sent',
      });
    } catch (stampErr: any) {
      console.error('[public-nda-send] Notion stamp failed (non-fatal):', stampErr.message);
    }

    return NextResponse.json({
      status: 'sent',
      notion_lead_page_id: leadId,
      public_url: publicUrl,
      to: lead.buyer_email,
      gmail_message_id: send.message_id,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err?.message ?? String(err) }, { status: 500 });
  }
}
