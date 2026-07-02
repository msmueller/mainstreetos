/**
 * MainStreetOS · POST /api/sign/mint-for-lead
 *
 * Build C, Option A (2026-07-02): per-lead NDA mint for the Responder flow.
 * Called when a lead is flagged for NDA send (Email Type to Send = 'NDA Send')
 * OUTSIDE the initial Lead Router enrollment (which already mints its own
 * envelope for Email 1). Returns a per-buyer signingUrl for the Responder to
 * embed in its templated email — this endpoint sends nothing itself.
 *
 * Flow:
 *   1. Auth via x-router-secret (same shared-secret pattern as the Router).
 *   2. Read the LEAD page from Notion: buyer email/name/phone, Completed NDA,
 *      and the 📋 LISTINGS relation (the linked listing page id).
 *   3. Refuse if the NDA is already executed, or if an active (sent) envelope
 *      already exists for this lead (409; pass force:true to mint anyway —
 *      signing tokens are stored hashed, so a lost URL can only be replaced
 *      by minting a fresh envelope).
 *   4. Call /api/sign/create with suppressAutoEmail:true and NO templateKey —
 *      Build B derives the template from the lead's Buyer Type (spec §5).
 *      Linkage is guaranteed: notion_lead_id + notion_listing_id always set.
 *
 * Body:
 *   {
 *     "notion_lead_page_id": "<uuid>",          // required
 *     "notion_listing_page_id": "<uuid>",       // optional override; default =
 *                                               //   first 📋 LISTINGS relation
 *     "template_key": "NDA_BuyerProfile",       // optional override; default =
 *                                               //   derived from Buyer Type
 *     "force": false                            // mint even if an active
 *                                               //   envelope already exists
 *   }
 *
 * Returns: { ok, envelopeId, envelopeNumber, signingUrl, templateKey }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client as NotionClient } from '@notionhq/client';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

export async function POST(req: NextRequest) {
  // ----- 1. Auth --------------------------------------------------------------
  const auth = req.headers.get('x-router-secret');
  if (!process.env.ROUTER_SECRET || auth !== process.env.ROUTER_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: {
    notion_lead_page_id?: string;
    notion_listing_page_id?: string;
    template_key?: string;
    force?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const leadPageId = body.notion_lead_page_id;
  if (!leadPageId) {
    return json({ error: 'notion_lead_page_id is required' }, 400);
  }

  try {
    // ----- 2. Read the LEAD from Notion ---------------------------------------
    const page: any = await notion.pages.retrieve({ page_id: leadPageId });
    if (!page?.properties) {
      return json({ error: `lead page ${leadPageId} returned no properties` }, 404);
    }
    const props = page.properties;

    const buyerEmail: string | null = props['Email']?.email ?? null;
    if (!buyerEmail) {
      return json({ error: 'lead has no Email — cannot mint an NDA envelope' }, 422);
    }

    const firstName = plainText(props['First Name']);
    const lastName  = plainText(props['Last Name']);
    const buyerName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
    const buyerPhone: string | undefined = props['Phone']?.phone_number ?? undefined;

    if (props['Completed NDA']?.checkbox === true) {
      return json({ error: 'nda_already_executed', detail: 'Completed NDA is already checked on this lead.' }, 409);
    }

    const listingPageId: string | null =
      body.notion_listing_page_id
      ?? props['📋 LISTINGS']?.relation?.[0]?.id
      ?? null;
    if (!listingPageId) {
      return json({
        error: 'no_linked_listing',
        detail: 'Lead has no 📋 LISTINGS relation and no notion_listing_page_id was provided. ' +
                'Sell-side NDA envelopes must be listing-linked (Build B).',
      }, 422);
    }

    // ----- 3. Duplicate-envelope guard ----------------------------------------
    if (!body.force) {
      const { data: existing } = await supabase
        .from('sign_envelopes')
        .select('id, envelope_number, status, created_at')
        .eq('notion_lead_id', leadPageId)
        .in('status', ['sent', 'partially_signed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return json({
          error: 'active_envelope_exists',
          detail: 'An unsigned envelope is already out for this lead. Signing URLs are not ' +
                  'recoverable (tokens are stored hashed) — pass force:true to mint a replacement.',
          existing: {
            envelopeId: existing.id,
            envelopeNumber: existing.envelope_number,
            status: existing.status,
            createdAt: existing.created_at,
          },
        }, 409);
      }
    }

    // ----- 4. Mint via /api/sign/create ---------------------------------------
    // No templateKey unless explicitly overridden — Build B derives it from
    // the lead's Buyer Type. suppressAutoEmail: the Responder owns delivery.
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.mainstreetos.biz').replace(/\/+$/, '');
    const createRes = await fetch(`${baseUrl}/api/sign/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(body.template_key ? { templateKey: body.template_key } : {}),
        notionLeadId: leadPageId,
        notionListingId: listingPageId,
        buyer: { email: buyerEmail, name: buyerName, phone: buyerPhone },
        suppressAutoEmail: true,
      }),
    });

    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      return json({ error: 'mint_failed', detail: created.error ?? `create returned ${createRes.status}` }, 502);
    }

    return json({
      ok: true,
      envelopeId: created.envelopeId,
      envelopeNumber: created.envelopeNumber,
      signingUrl: created.signingUrl,
      buyerEmail,
      notionLeadId: leadPageId,
      notionListingId: listingPageId,
    });
  } catch (err: any) {
    console.error('[sign/mint-for-lead] failed:', err);
    return json({ error: 'internal error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function plainText(p: any): string {
  const arr = p?.rich_text ?? p?.title ?? [];
  return arr.map((t: any) => t.plain_text).join('').trim();
}
