/**
 * MainStreetOS · GET /api/nethunt/sync/cron
 *
 * NetHunt <-> Notion LEADS sync — all three legs in one cron-driven handler
 * (built 2026-07-13). Notion is the system of record; NetHunt owns Gmail-side
 * lead comms. Runs on a Vercel cron; each leg is independently flag-gated and
 * ships DARK (off) so you can enable one at a time.
 *
 *   LEG B  edits-down   (NETHUNT_EDITS_DOWN)  Notion edit  -> update NetHunt record
 *   LEG C  create-down  (NETHUNT_CREATE_DOWN) new Notion lead (no CRM Record ID)
 *                                             -> create NetHunt record, stamp id back
 *   LEG A  intake-up    (NETHUNT_INTAKE_UP)   new NetHunt record -> create-once in Notion
 *
 * Match key both ways: Notion `CRM Source` = "NetHunt" AND
 *   `CRM Record ID` = NetHunt's system recordId (already backfilled).
 *
 * Loop guards (do not remove):
 *   - create-down stamps `Sync Origin` = "Notion" on the NetHunt record it makes;
 *     intake-up SKIPS any NetHunt record whose Sync Origin = "Notion".
 *   - intake-up reads only NetHunt *new-record* (created), never *updated*, and
 *     creates-once by checking for an existing Notion lead with the same recordId.
 *   - edits-down only UPDATES NetHunt; it never creates.
 *
 * Testing:
 *   ?dry_run=true                 inspect candidates, write nothing
 *   ?leg=edits-down|create-down|intake-up   run just one leg
 *
 * Auth: Vercel cron (Authorization: Bearer CRON_SECRET) or manual header
 *   x-router-secret (ROUTER_SECRET) / x-nethunt-secret (NETHUNT_SYNC_SECRET).
 *
 * Env vars:
 *   NOTION_API_KEY         (existing) — must have access to LEADS
 *   NOTION_LEADS_DB_ID     (existing) — LEADS database id (for creating pages)
 *   NETHUNT_EMAIL          your NetHunt login email
 *   NETHUNT_API_KEY        NetHunt -> Settings -> Integrations / API
 *   NETHUNT_SYNC_SECRET    any random string (optional manual-call auth)
 *   NETHUNT_EDITS_DOWN     "on" to enable leg B
 *   NETHUNT_CREATE_DOWN    "on" to enable leg C
 *   NETHUNT_INTAKE_UP      "on" to enable leg A
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client as NotionClient } from '@notionhq/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

const LEADS_DS = '3349af07-54ec-809f-ab32-000b3719dfbf';        // Notion LEADS data source
const LEADS_DB = process.env.NOTION_LEADS_DB_ID || '3349af0754ec80138dafd78925bbc7fb';
const NH_LEADS_FOLDER = '69812ddb5ed8af1acba42ccc';            // NetHunt LEADS folder
const NH_BASE = 'https://nethunt.com/api/v1/zapier';
const LOOKBACK_MIN = 20;   // overlap the cron interval a little so nothing is missed
const MAX_PER_RUN = 25;    // safety cap per leg per run

// Option fields mirrored verbatim between Notion and NetHunt (same option names on both sides).
const STATUS_PROP = 'Status';           // Notion type: status
const STAGE_PROP = 'Pipeline Stage';    // Notion type: select

function j(body: any, status = 200) { return NextResponse.json(body, { status }); }
function isOn(v?: string) { return !!v && ['on', 'true', '1', 'yes'].includes(v.toLowerCase()); }
function sinceISO(min = LOOKBACK_MIN) { return new Date(Date.now() - min * 60_000).toISOString(); }

// ---------- NetHunt REST helpers ----------
function nhHeaders() {
  const email = process.env.NETHUNT_EMAIL || '';
  const key = process.env.NETHUNT_API_KEY || '';
  const auth = Buffer.from(`${email}:${key}`).toString('base64');
  return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
}
async function nhUpdate(recordId: string, fieldActions: Record<string, any>) {
  const r = await fetch(`${NH_BASE}/actions/update-record/${recordId}?overwrite=true`, {
    method: 'POST', headers: nhHeaders(), body: JSON.stringify({ fieldActions }),
  });
  return { status: r.status, body: (await r.text()).slice(0, 300) };
}
async function nhCreate(folderId: string, fields: Record<string, any>) {
  const r = await fetch(`${NH_BASE}/actions/create-record/${folderId}`, {
    method: 'POST', headers: nhHeaders(), body: JSON.stringify({ timeZone: 'America/New_York', fields }),
  });
  const txt = await r.text();
  let recordId = '';
  try { recordId = JSON.parse(txt)?.recordId || ''; } catch { /* noop */ }
  return { status: r.status, recordId, body: txt.slice(0, 300) };
}
async function nhNewRecords(folderId: string, since: string, limit = MAX_PER_RUN) {
  const r = await fetch(`${NH_BASE}/triggers/new-record/${folderId}?since=${encodeURIComponent(since)}&limit=${limit}`, {
    headers: nhHeaders(),
  });
  if (r.status < 200 || r.status >= 300) return { status: r.status, records: [] as any[] };
  let records: any[] = [];
  try { records = await r.json(); } catch { records = []; }
  return { status: r.status, records };
}

// ---------- Notion read helpers ----------
function optName(props: any, name: string): string | null {
  const p = props?.[name];
  if (!p) return null;
  if (p.type === 'status') return p.status?.name ?? null;
  if (p.type === 'select') return p.select?.name ?? null;
  return null;
}
function txt(props: any, name: string): string {
  const p = props?.[name];
  if (!p) return '';
  if (p.type === 'title') return (p.title || []).map((x: any) => x.plain_text).join('');
  if (p.type === 'rich_text') return (p.rich_text || []).map((x: any) => x.plain_text).join('');
  if (p.type === 'email') return p.email || '';
  return '';
}
function num(props: any, name: string): number | null {
  const p = props?.[name];
  return p && p.type === 'number' ? (p.number ?? null) : null;
}
function nhFieldStr(rec: any, name: string): string {
  const v = rec?.fields?.[name];
  if (Array.isArray(v)) return String(v[0] ?? '');
  return v == null ? '' : String(v);
}

// =====================================================================
export async function GET(req: NextRequest) {
  // ----- auth -----
  const bearer = req.headers.get('authorization');
  const cronOk = !!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`;
  const rs = req.headers.get('x-router-secret');
  const ns = req.headers.get('x-nethunt-secret');
  const manualOk =
    (!!process.env.ROUTER_SECRET && rs === process.env.ROUTER_SECRET) ||
    (!!process.env.NETHUNT_SYNC_SECRET && ns === process.env.NETHUNT_SYNC_SECRET);
  if (!cronOk && !manualOk) return j({ error: 'unauthorized' }, 401);

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const only = url.searchParams.get('leg'); // optional single-leg run

  if (!process.env.NETHUNT_EMAIL || !process.env.NETHUNT_API_KEY) {
    return j({ error: 'NETHUNT_EMAIL / NETHUNT_API_KEY not set' }, 500);
  }

  const out: any = { dryRun, ran: [] as string[], editsDown: null, createDown: null, intakeUp: null };
  const want = (leg: string, flag?: string) => (!only || only === leg) && (isOn(flag) || dryRun);

  // ================= LEG B — edits-down =================
  if (want('edits-down', process.env.NETHUNT_EDITS_DOWN)) {
    out.ran.push('edits-down');
    const res: any[] = [];
    try {
      const q: any = await (notion as any).dataSources.query({
        data_source_id: LEADS_DS, page_size: MAX_PER_RUN,
        filter: { and: [
          { property: 'CRM Source', select: { equals: 'NetHunt' } },
          { property: 'CRM Record ID', rich_text: { is_not_empty: true } },
          { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceISO() } },
        ] },
      });
      for (const pg of q.results) {
        const p = pg.properties;
        const recordId = txt(p, 'CRM Record ID');
        const fieldActions: Record<string, any> = {};
        const st = optName(p, STATUS_PROP); if (st) fieldActions[STATUS_PROP] = { overwrite: true, add: st };
        const ps = optName(p, STAGE_PROP); if (ps) fieldActions[STAGE_PROP] = { overwrite: true, add: ps };
        if (!recordId || Object.keys(fieldActions).length === 0) continue;
        if (dryRun) { res.push({ page: pg.id, recordId, fieldActions }); continue; }
        const u = await nhUpdate(recordId, fieldActions);
        res.push({ page: pg.id, recordId, nethunt: u.status });
      }
    } catch (e: any) { res.push({ error: String(e?.message || e) }); }
    out.editsDown = { count: res.length, results: res };
  }

  // ================= LEG C — create-down =================
  if (want('create-down', process.env.NETHUNT_CREATE_DOWN)) {
    out.ran.push('create-down');
    const res: any[] = [];
    try {
      const q: any = await (notion as any).dataSources.query({
        data_source_id: LEADS_DS, page_size: MAX_PER_RUN,
        filter: { and: [
          { property: 'CRM Record ID', rich_text: { is_empty: true } },
          { property: 'Email', email: { is_not_empty: true } },
          { timestamp: 'created_time', created_time: { on_or_after: sinceISO(120) } },
        ] },
      });
      for (const pg of q.results) {
        const p = pg.properties;
        const email = txt(p, 'Email');
        const name = txt(p, 'Lead Name') || email;
        if (!email) continue;
        const fields: Record<string, any> = {
          'Name': name,
          'First Name': txt(p, 'First Name'),
          'Last Name': txt(p, 'Last Name'),
          'Email': [email],
          'Message': txt(p, 'Message'),
          'Source': optName(p, 'Source') || 'Notion',
          'Sync Origin': 'Notion',           // loop guard
          'Notion ID': pg.id,
          'Notion URL': pg.url,
        };
        const ln = num(p, 'Listing Number'); if (ln != null) fields['Listing Number'] = ln;
        const lname = txt(p, 'Listing Name'); if (lname) fields['Listing Name'] = lname;
        const st = optName(p, STATUS_PROP); if (st) fields[STATUS_PROP] = st;
        const ps = optName(p, STAGE_PROP); if (ps) fields[STAGE_PROP] = ps;
        Object.keys(fields).forEach((k) => { if (fields[k] === '' || fields[k] == null) delete fields[k]; });

        if (dryRun) { res.push({ page: pg.id, email, willCreateFields: fields }); continue; }
        const c = await nhCreate(NH_LEADS_FOLDER, fields);
        if (c.recordId) {
          await (notion as any).pages.update({
            page_id: pg.id,
            properties: {
              'CRM Record ID': { rich_text: [{ text: { content: c.recordId } }] },
              'CRM Source': { select: { name: 'NetHunt' } },
            },
          });
        }
        res.push({ page: pg.id, email, nethunt: c.status, recordId: c.recordId });
      }
    } catch (e: any) { res.push({ error: String(e?.message || e) }); }
    out.createDown = { count: res.length, results: res };
  }

  // ================= LEG A — intake-up =================
  if (want('intake-up', process.env.NETHUNT_INTAKE_UP)) {
    out.ran.push('intake-up');
    const res: any[] = [];
    try {
      const nr = await nhNewRecords(NH_LEADS_FOLDER, sinceISO(), MAX_PER_RUN);
      for (const rec of nr.records) {
        const recordId = rec.recordId || rec.id;
        if (!recordId) continue;
        if (nhFieldStr(rec, 'Sync Origin') === 'Notion') { res.push({ recordId, skip: 'sync-origin-notion' }); continue; }
        if (nhFieldStr(rec, 'Notion ID')) { res.push({ recordId, skip: 'already-has-notion-id' }); continue; }
        // create-once: does a Notion lead already carry this recordId?
        const exist: any = await (notion as any).dataSources.query({
          data_source_id: LEADS_DS, page_size: 1,
          filter: { property: 'CRM Record ID', rich_text: { equals: recordId } },
        });
        if (exist.results.length) { res.push({ recordId, skip: 'already-in-notion' }); continue; }

        const email = nhFieldStr(rec, 'Email');
        const name = nhFieldStr(rec, 'Name') || (nhFieldStr(rec, 'First Name') + ' ' + nhFieldStr(rec, 'Last Name')).trim() || email || 'NetHunt Lead';
        if (dryRun) { res.push({ recordId, willCreate: { name, email } }); continue; }

        const properties: any = {
          'Lead Name': { title: [{ text: { content: name } }] },
          'CRM Record ID': { rich_text: [{ text: { content: recordId } }] },
          'CRM Source': { select: { name: 'NetHunt' } },
        };
        if (email) properties['Email'] = { email };
        const msg = nhFieldStr(rec, 'Message'); if (msg) properties['Message'] = { rich_text: [{ text: { content: msg.slice(0, 1900) } }] };
        const st = nhFieldStr(rec, 'Status'); if (st) properties[STATUS_PROP] = { status: { name: st } };
        const ps = nhFieldStr(rec, 'Pipeline Stage'); if (ps) properties[STAGE_PROP] = { select: { name: ps } };
        const lnRaw = nhFieldStr(rec, 'Listing Number'); const lnN = lnRaw ? Number(lnRaw) : NaN;
        if (!Number.isNaN(lnN)) properties['Listing Number'] = { number: lnN };

        const created: any = await (notion as any).pages.create({ parent: { database_id: LEADS_DB }, properties });
        // stamp the NetHunt record so future runs skip it
        await nhUpdate(recordId, {
          'Notion ID': { overwrite: true, add: created.id },
          'Notion URL': { overwrite: true, add: created.url },
        });
        res.push({ recordId, createdNotion: created.id });
      }
    } catch (e: any) { res.push({ error: String(e?.message || e) }); }
    out.intakeUp = { count: res.length, results: res };
  }

  return j(out);
}
