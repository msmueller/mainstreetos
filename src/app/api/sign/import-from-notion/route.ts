/**
 * MainStreetOS · POST /api/sign/import-from-notion
 * ================================================================
 * Phase 7 (System 3 — Buyer-Broker Representation) entry point.
 *
 * Triggered by Mark when a Buyer Client has completed the Notion form
 * "Main Street Buyer Profile — Intake Form" (Notion DB
 * 2ea28c7df4864076876f15fbcc6b7b45) and is ready to receive the
 * outbound Buyer Profile & Pre-Signed NDA for signature.
 *
 * Workflow:
 *   1. Validate body — needs Notion page ID + BRA effective date
 *   2. Fetch the Notion page to pull buyer's email/name/phone for the
 *      signer record (the heavy 54-field prefill happens inside
 *      /api/sign/create via fetchBuyerClientPrefill)
 *   3. Call /api/sign/create with templateKey='BuyerBrokerRep_NDA' and
 *      the notion page reference. /api/sign/create handles envelope
 *      creation, signer creation, audit logging, and (optionally)
 *      buyer email delivery
 *   4. (Phase 7B / future) Mark the Notion row 'Imported to MSOS = true'
 *      and store the signingUrl as MSOS Questionnaire ID. For now this
 *      round-trip lives client-side in Mark's admin actions.
 *   5. Return the signing URL to the caller
 *
 * Body:
 *   {
 *     "notionPageId": "3669af0754ec81639d81ca92779d2b9f",  // Bansal record
 *     "braEffectiveDate": "2026-04-03",                    // ISO date
 *     "suppressAutoEmail": false                            // optional
 *   }
 *
 * Architectural isolation: this endpoint is part of System 3 (buy-side
 * buyer-broker representation). It must NOT invoke /api/router/route
 * (System 1 BBS lead automation) and must NOT write to the LEADS Notion
 * DB. See memory/project_mainstreetos_clickwrap_three_systems.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client as NotionClient } from '@notionhq/client';

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { notionPageId, braEffectiveDate, suppressAutoEmail } = body;

  if (!notionPageId) {
    return json({ error: 'notionPageId is required' }, 400);
  }
  if (!braEffectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(braEffectiveDate)) {
    return json({ error: 'braEffectiveDate is required in YYYY-MM-DD format' }, 400);
  }

  // ----- 1. Fetch Notion page to get the buyer's email/name/phone --------
  // (The full 54-field prefill happens inside /api/sign/create via
  // fetchBuyerClientPrefill — we only need the signer-identity fields here
  // to build the signer.email/name/phone params for /api/sign/create.)
  let buyerEmail = '';
  let buyerName = '';
  let buyerPhone = '';
  try {
    const page: any = await notion.pages.retrieve({ page_id: notionPageId });
    const props = page.properties ?? {};

    const get = (name: string): string => {
      const p = props[name];
      if (!p) return '';
      switch (p.type) {
        case 'title':        return p.title?.map((t: any) => t.plain_text).join('') ?? '';
        case 'rich_text':    return p.rich_text?.map((t: any) => t.plain_text).join('') ?? '';
        case 'email':        return p.email ?? '';
        case 'phone_number': return p.phone_number ?? '';
        default:             return '';
      }
    };

    buyerEmail = get('Email');
    buyerName  = get('Buyer Name (Individual or Entity)');
    buyerPhone = get('Phone');
  } catch (err: any) {
    console.error('[sign/import-from-notion] Notion fetch failed:', err.message);
    return json({ error: 'notion page not found or not accessible', detail: err.message }, 404);
  }

  if (!buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return json({
      error: 'buyer email missing or invalid in Notion record',
      detail: `Email property on Notion page ${notionPageId} returned: "${buyerEmail}"`,
    }, 400);
  }

  // ----- 2. Call /api/sign/create with the Phase 7 template --------------
  // We POST to ourselves rather than importing the create handler so that
  // the signer-identity / signer-token / email-delivery code paths stay
  // in one place. /api/sign/create branches on templateKey to pull the
  // 54-field prefill from the buyer client Notion record.
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://mainstreetos.biz').replace(/\/+$/, '');
  let createRes: Response;
  try {
    createRes = await fetch(`${baseUrl}/api/sign/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: 'BuyerBrokerRep_NDA',
        notionBuyerClientPageId: notionPageId,
        braEffectiveDate,
        buyer: {
          email: buyerEmail,
          name:  buyerName || undefined,
          phone: buyerPhone || undefined,
        },
        suppressAutoEmail: suppressAutoEmail ?? false,
      }),
    });
  } catch (err: any) {
    console.error('[sign/import-from-notion] /api/sign/create call failed:', err.message);
    return json({ error: 'internal: sign-create call failed', detail: err.message }, 500);
  }

  let createPayload: any;
  try {
    createPayload = await createRes.json();
  } catch {
    return json({ error: 'sign-create returned non-JSON' }, 502);
  }

  if (!createRes.ok) {
    return json({
      error: 'sign-create failed',
      detail: createPayload,
    }, createRes.status);
  }

  // ----- 3. Return result -------------------------------------------------
  // signingUrl is what Mark forwards to the Buyer Client (or what
  // sendSigningInvitation already mailed automatically). Phase 7B will
  // round-trip back to Notion to mark 'Imported to MSOS = true' and store
  // the envelope UUID in 'MSOS Questionnaire ID'.
  return json({
    ok:             true,
    envelopeId:     createPayload.envelopeId,
    envelopeNumber: createPayload.envelopeNumber,
    buyerEmail,
    buyerName,
    signingUrl:     createPayload.signingUrl,
    notionPageId,
    braEffectiveDate,
  });
}

function json(body: any, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}
