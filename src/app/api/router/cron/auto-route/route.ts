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
 * Three independently-flagged legs (a run can send REAL buyer emails):
 *   LEG 1 (LEAD_AUTOROUTE) — BBS "New Listing Lead" auto-route via /api/router/route.
 *   LEG 2 (LEAD_AUTOROUTE) — manual "NDA Send" trigger → /api/sign/mint-for-lead.
 *   LEG 3 (NDA_PUBLIC_AUTOSEND) — non-BBS "Send Public NDA" checkbox → Email #1
 *     with the STATIC per-listing public link via /api/router/public-nda-send
 *     (no mint; the public page mints when the buyer signs). Added 2026-07-08.
 *
 * Safety rails (belt and suspenders):
 *   - Feature flags default off (ship dark). Flags off + not dry_run: exit.
 *   - LEG 1 recency guard (LOOKBACK_DAYS=3), candidate filter (BBS Email Type =
 *     "New Listing Lead", Lead Type = Buyer Lead, Email present, Completed NDA
 *     + NDA Received unchecked, LEAD Email #1 unstamped, stage 1/empty).
 *   - Cap MAX_PER_RUN (5) per leg.
 *   - LEG 2 & 3 clear their trigger after each attempt (success or failure) and
 *     write the outcome to Next Action, so a bad lead never retries forever.
 *   - ?dry_run=true inspects candidates without sending or writing.
 *
 * Auth: Vercel cron header (Authorization: Bearer CRON_SECRET) or x-router-secret
 * (ROUTER_SECRET) for manual invocation/testing.
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
  const flagOn = isOn(process.env.LEAD_AUTOROUTE);
  const publicSendOn = isOn(process.env.NDA_PUBLIC_AUTOSEND);

  if (!flagOn && !publicSendOn && !dryRun) {
    return json({ enabled: false, routed: 0, note: 'LEAD_AUTOROUTE and NDA_PUBLIC_AUTOSEND are both off.' });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.mainstreetos.biz').replace(/\/+$/, '');

  let candidates: Array<{ id: string; name: string }> = [];
  const results: any[] = [];
  const manualResults: any[] = [];
  const publicNdaResults: any[] = [];

  // ===========================================================================
  // LEG 1 + LEG 2 — BBS auto-route + manual "NDA Send" (LEAD_AUTOROUTE)
  // ===========================================================================
  if (flagOn || dryRun) {
    // ----- LEG 1: find + route fresh BBS buyer leads -------------------------
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    try {
      const res: any = await (notion as any).dataSources.query({
        data_source_id: LEADS_DATA_SOURCE_ID,
        page_size: 25,
        filter: {
          and: [
            { property: 'BBS Email Type', select: { equals: 'New Listing Lead' } },
            { timestamp: 'created_time', created_time: { on_or_after: since } },
            { property: 'Lead Type', select: { equals: 'Buyer Lead' } },
            { property: 'Email', email: { is_not_empty: true } },
            { property: 'Completed NDA', checkbox: { equals: false } },
            { property: 'NDA Received', checkbox: { equals: false } },
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
      candidates = (res.results ?? []).map((page: any) => ({ id: page.id, name: titleOf(page) }));
    } catch (err: any) {
      console.error('[auto-route] LEADS query failed:', err.message);
      return json({ error: 'leads query failed', detail: err.message }, 500);
    }

    for (const lead of candidates.slice(0, MAX_PER_RUN)) {
      try {
        const res = await fetch(`${baseUrl}/api/router/route${dryRun ? '?dry_run=true' : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-router-secret': process.env.ROUTER_SECRET! },
          body: JSON.stringify({ notion_lead_page_id: lead.id }),
        });
        const rbody = await res.json().catch(() => ({}));
        results.push({
          lead: lead.name,
          notion_lead_page_id: lead.id,
          status: rbody.status ?? (res.ok ? 'ok' : `error_${res.status}`),
          ...(rbody.reason ? { reason: rbody.reason } : {}),
        });
      } catch (err: any) {
        results.push({ lead: lead.name, notion_lead_page_id: lead.id, status: 'error', detail: err.message });
      }
    }

    // ----- LEG 2: manual "NDA Send" trigger ----------------------------------
    try {
      const manualRes: any = await (notion as any).dataSources.query({
        data_source_id: LEADS_DATA_SOURCE_ID,
        page_size: MAX_PER_RUN,
        filter: {
          and: [
            { property: 'Email Type to Send', select: { equals: 'NDA Send' } },
            { property: 'Email', email: { is_not_empty: true } },
            { property: 'Completed NDA', checkbox: { equals: false } },
          ],
        },
      });

      for (const page of manualRes.results ?? []) {
        const name = titleOf(page);
        if (dryRun) {
          manualResults.push({ lead: name, notion_lead_page_id: page.id, status: 'would_send_nda_invitation' });
          continue;
        }
        let outcome = '';
        try {
          const mintRes = await fetch(`${baseUrl}/api/sign/mint-for-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-router-secret': process.env.ROUTER_SECRET! },
            body: JSON.stringify({ notion_lead_page_id: page.id, send_email: true }),
          });
          const mintBody = await mintRes.json().catch(() => ({}));
          outcome = mintRes.ok
            ? `✓ NDA/Buyer Profile invitation emailed — envelope #${mintBody.envelopeNumber}`
            : `✗ NDA Send failed: ${mintBody.error ?? mintRes.status}${mintBody.detail ? ` — ${mintBody.detail}` : ''}`;
          manualResults.push({ lead: name, notion_lead_page_id: page.id, status: mintRes.ok ? 'sent' : 'failed', detail: mintBody.error ?? undefined });
        } catch (err: any) {
          outcome = `✗ NDA Send errored: ${err.message}`;
          manualResults.push({ lead: name, notion_lead_page_id: page.id, status: 'error', detail: err.message });
        }
        await clearTrigger(page.id, { 'Email Type to Send': { select: null } }, outcome);
      }
    } catch (err: any) {
      console.error('[auto-route] manual NDA Send query failed:', err.message);
      manualResults.push({ status: 'query_error', detail: err.message });
    }
  }

  // ===========================================================================
  // LEG 3 — non-BBS "Send Public NDA" checkbox (NDA_PUBLIC_AUTOSEND)
  // ===========================================================================
  if (publicSendOn || dryRun) {
    try {
      const pubRes: any = await (notion as any).dataSources.query({
        data_source_id: LEADS_DATA_SOURCE_ID,
        page_size: MAX_PER_RUN,
        filter: {
          and: [
            { property: 'Send Public NDA', checkbox: { equals: true } },
            { property: 'Email', email: { is_not_empty: true } },
            { property: 'Completed NDA', checkbox: { equals: false } },
          ],
        },
      });

      for (const page of pubRes.results ?? []) {
        const name = titleOf(page);
        if (dryRun) {
          publicNdaResults.push({ lead: name, notion_lead_page_id: page.id, status: 'would_send_public_nda' });
          continue;
        }
        let outcome = '';
        try {
          const r = await fetch(`${baseUrl}/api/router/public-nda-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-router-secret': process.env.ROUTER_SECRET! },
            body: JSON.stringify({ notion_lead_page_id: page.id }),
          });
          const b = await r.json().catch(() => ({}));
          const ok = r.ok && b.status === 'sent';
          outcome = ok
            ? `✓ Public NDA link emailed — ${b.public_url}`
            : `✗ Public NDA send ${b.status ?? r.status}: ${b.reason ?? b.error ?? ''}`;
          publicNdaResults.push({ lead: name, notion_lead_page_id: page.id, status: ok ? 'sent' : (b.status ?? 'failed'), detail: b.reason ?? b.error ?? undefined, public_url: b.public_url });
        } catch (err: any) {
          outcome = `✗ Public NDA send errored: ${err.message}`;
          publicNdaResults.push({ lead: name, notion_lead_page_id: page.id, status: 'error', detail: err.message });
        }
        // Always clear the checkbox + record the outcome so a lead never
        // silently re-sends every 10 minutes.
        await clearTrigger(page.id, { 'Send Public NDA': { checkbox: false } }, outcome);
      }
    } catch (err: any) {
      console.error('[auto-route] public NDA send query failed:', err.message);
      publicNdaResults.push({ status: 'query_error', detail: err.message });
    }
  }

  return json({
    lead_autoroute: flagOn,
    public_autosend: publicSendOn,
    dry_run: dryRun,
    lookback_days: LOOKBACK_DAYS,
    candidates_found: candidates.length,
    processed: results.length,
    results,
    manual_nda_sends: manualResults,
    public_nda_sends: publicNdaResults,
  });
}

// ---------------------------------------------------------------------------

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function isOn(v: string | undefined): boolean {
  const s = (v ?? '').trim().toLowerCase();
  return s === 'on' || s === 'true' || s === '1';
}

function titleOf(page: any): string {
  return (page?.properties?.['Lead Name']?.title ?? []).map((t: any) => t.plain_text).join('') || '(untitled)';
}

/** Clear a lead's trigger property and stamp the outcome to Next Action. */
async function clearTrigger(pageId: string, triggerPatch: Record<string, any>, outcome: string): Promise<void> {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        ...triggerPatch,
        'Next Action': { rich_text: [{ text: { content: `${outcome} (${new Date().toISOString().slice(0, 10)})` } }] },
      } as any,
    });
  } catch (err: any) {
    console.error('[auto-route] failed to clear trigger:', err.message);
  }
}
