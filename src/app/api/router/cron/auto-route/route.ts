/**
 * MainStreetOS · GET /api/router/cron/auto-route
 *
 * THE MISSING TRIGGER (built 2026-07-02): closes the gap between "a new lead
 * lands in Notion LEADS" and "the Lead Router sends Email 1 with a per-buyer
 * NDA signing link". Runs every 10 minutes via Vercel cron (vercel.json),
 * finds fresh unrouted buyer leads, and POSTs each to /api/router/route —
 * which does everything else (listing match, NDA mint, Email 1, Notion stamps)
 * and has its own idempotency (lr_match_decisions) and manual-review path
 * for low-confidence matches.
 *
 * Safety rails (a run can send REAL buyer emails, so belt and suspenders):
 *   - Feature flag LEAD_AUTOROUTE (default off) — ship dark, same pattern as
 *     NDA_NOTION_SYNC. Flag off: the cron exits without routing. dry_run
 *     listing still works so the candidate set can be inspected pre-enable.
 *   - Recency guard: only leads CREATED in the last LOOKBACK_DAYS (3). Old
 *     leads sitting at "1. Inquiry" from before automation never get blasted.
 *   - Candidate filter: Lead Type = Buyer Lead, Email present, Completed NDA
 *     unchecked, LEAD Email #1 not yet stamped, Pipeline Stage = "1. Inquiry"
 *     (or still empty).
 *   - Cap: at most MAX_PER_RUN (5) leads routed per run.
 *   - ?dry_run=true forwards the Router's own dry-run (no emails, no writes).
 *
 * Auth: either the Vercel cron header (Authorization: Bearer CRON_SECRET) or
 * x-router-secret (ROUTER_SECRET) for manual invocation/testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client as NotionClient } from '@notionhq/client';

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

const LEADS_DATA_SOURCE_ID = '3349af07-54ec-809f-ab32-000b3719dfbf';
const LOOKBACK_DAYS = 3;
const MAX_PER_RUN = 5;

export async function GET(req: NextRequest) {
  // ----- Auth: Vercel cron OR manual with router secret ----------------------
  const bearer = req.headers.get('authorization');
  const routerSecret = req.headers.get('x-router-secret');
  const cronOk = !!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`;
  const manualOk = !!process.env.ROUTER_SECRET && routerSecret === process.env.ROUTER_SECRET;
  if (!cronOk && !manualOk) {
    return json({ error: 'unauthorized' }, 401);
  }

  const dryRun = new URL(req.url).searchParams.get('dry_run') === 'true';
  const enabled = (process.env.LEAD_AUTOROUTE ?? '').trim().toLowerCase();
  const flagOn = enabled === 'on' || enabled === 'true' || enabled === '1';

  if (!flagOn && !dryRun) {
    return json({ enabled: false, routed: 0, note: 'LEAD_AUTOROUTE is off; set it to "on" to activate.' });
  }

  // ----- Find candidate leads -------------------------------------------------
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let candidates: Array<{ id: string; name: string }> = [];
  try {
    const res: any = await (notion as any).dataSources.query({
      data_source_id: LEADS_DATA_SOURCE_ID,
      page_size: 25,
      filter: {
        and: [
          { timestamp: 'created_time', created_time: { on_or_after: since } },
          { property: 'Lead Type', select: { equals: 'Buyer Lead' } },
          { property: 'Email', email: { is_not_empty: true } },
          { property: 'Completed NDA', checkbox: { equals: false } },
          { property: 'LEAD Email #1', date: { is_empty: true } },
          {
            or: [
              { property: 'Pipeline Stage', select: { equals: '1. Inquiry' } },
              { property: 'Pipeline Stage', select: { is_empty: true } },
            ],
          },
        ],
      },
    });

    candidates = (res.results ?? []).map((page: any) => ({
      id: page.id,
      name: (page.properties?.['Lead Name']?.title ?? [])
        .map((t: any) => t.plain_text).join('') || '(untitled)',
    }));
  } catch (err: any) {
    console.error('[auto-route] LEADS query failed:', err.message);
    return json({ error: 'leads query failed', detail: err.message }, 500);
  }

  const toRoute = candidates.slice(0, MAX_PER_RUN);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.mainstreetos.biz').replace(/\/+$/, '');
  const results: any[] = [];

  // ----- Route each candidate --------------------------------------------------
  for (const lead of toRoute) {
    try {
      const res = await fetch(`${baseUrl}/api/router/route${dryRun ? '?dry_run=true' : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-router-secret': process.env.ROUTER_SECRET!,
        },
        body: JSON.stringify({ notion_lead_page_id: lead.id }),
      });
      const body = await res.json().catch(() => ({}));
      results.push({
        lead: lead.name,
        notion_lead_page_id: lead.id,
        status: body.status ?? (res.ok ? 'ok' : `error_${res.status}`),
        ...(body.reason ? { reason: body.reason } : {}),
      });
    } catch (err: any) {
      results.push({ lead: lead.name, notion_lead_page_id: lead.id, status: 'error', detail: err.message });
    }
  }

  return json({
    enabled: flagOn,
    dry_run: dryRun,
    lookback_days: LOOKBACK_DAYS,
    candidates_found: candidates.length,
    processed: results.length,
    results,
  });
}

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}
