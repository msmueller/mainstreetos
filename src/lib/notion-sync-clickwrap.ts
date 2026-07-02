/**
 * MainStreetOS · Notion sync on signing completion
 *
 * Called from /api/sign/execute after the signed PDF and audit certificate are
 * uploaded to Supabase Storage. Updates the buyer's row in the LEADS database.
 *
 * Concrete behavior (per Mark's 2026-05-01 decisions):
 *   1. Check the "Completed NDA" checkbox.
 *   2. Populate the buyer-profile fields on the lead from what the buyer typed
 *      in the NDA form (BP Full Address, BP Liquid Cash, BP Plan to Finance,
 *      BP Credit Score, Phone, Email, Company, BP Additional Comments,
 *      Buyer Type — with the C1 mapping defined below).
 *   3. Attach the signed PDF and audit certificate URLs to the "Buyer Profile"
 *      file column on the lead. (Notion API limitation: external file embed —
 *      Notion does not allow direct upload via API.)
 *   4. Append a comment to the lead page with a one-line "✓ NDA signed by …"
 *      summary including both URLs.
 *   5. Auto-advance Pipeline Stage → "3. NDA Executed" and Status →
 *      "Active" on signing completion. (Updated 2026-06-01: Mark reversed the
 *      prior "leave stages alone" decision now that buyer signing is reliable
 *      enough to trust as a stage advancement signal. Updated 2026-06-05:
 *      legacy "Status Update" field retired — write canonical "Status" health
 *      field instead.)
 *
 * Required env: NOTION_API_KEY
 * Feature flag:  NDA_NOTION_SYNC — 'on' | 'true' | '1' enables the sync;
 *                anything else (including unset) disables ALL Notion writes
 *                from this module. Ships dark by default (2026-07-02 Build A).
 *
 * Failure mode: this function NEVER throws to the caller. The signing flow is
 * already complete by the time this runs; a Notion sync failure should not
 * roll back the signature. Errors are logged AND reported via the returned
 * NotionSyncResult so the caller can decide whether to stamp
 * sign_envelopes.notion_synced_at (only on { ok: true }).
 */

import { Client as NotionClient } from '@notionhq/client';

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

// ============================================================================
// Feature flag
// ============================================================================

/** Build A ships dark. Notion writes only happen when NDA_NOTION_SYNC is
 *  explicitly 'on' / 'true' / '1'. */
export function ndaNotionSyncEnabled(): boolean {
  const v = (process.env.NDA_NOTION_SYNC ?? '').trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1';
}

// ============================================================================
// Public type
// ============================================================================

export type SyncCompletedSignatureInput = {
  notionPageId: string;       // the LEADS page ID
  templateKey: string;        // envelope.template_key (NDA_BuyerProfile / _Corporate)
  fieldValues: Record<string, any>;
  signedPdfUrl: string;
  auditPdfUrl: string;
  /** Durable, non-expiring link for the LEADS "Signed NDA URL" property.
   *  Storage signed URLs expire (1 yr); pass the /api/sign/download/… redirect
   *  URL here instead so the Notion link keeps working. */
  signedNdaDurableUrl?: string;
  completedAt: string;        // ISO date
  signerEmail: string;
  signerName: string;
};

/** Outcome reported to the caller. Stamp notion_synced_at ONLY on ok:true. */
export type NotionSyncResult =
  | { ok: true }
  | { ok: false; skipped: 'flag_off' | 'unknown_template' }
  | { ok: false; error: string };

// ============================================================================
// Main export
// ============================================================================

export async function syncCompletedSignatureToNotion(
  input: SyncCompletedSignatureInput
): Promise<NotionSyncResult> {
  const {
    notionPageId, templateKey, fieldValues,
    signedPdfUrl, auditPdfUrl, signedNdaDurableUrl, completedAt,
    signerEmail, signerName,
  } = input;

  // Build A (2026-07-02): feature flag — ship dark, enable after the
  // test-envelope pass. Flag off means NO Notion writes of any kind.
  if (!ndaNotionSyncEnabled()) {
    console.log('[notion-sync] NDA_NOTION_SYNC is off; skipping Notion write-back.');
    return { ok: false, skipped: 'flag_off' };
  }

  // Phase 8 (2026-06-01): NDA_BuyerProfile_Corporate uses the same Notion
  // LEADS property set as NDA_BuyerProfile (only the buyer_profile_section
  // depth differs), so both templates flow through the same mapping.
  const KNOWN_SELL_SIDE_TEMPLATES = ['NDA_BuyerProfile', 'NDA_BuyerProfile_Corporate'];
  if (!KNOWN_SELL_SIDE_TEMPLATES.includes(templateKey)) {
    console.warn(`[notion-sync] templateKey '${templateKey}' has no mapping yet; skipping property update.`);
    return { ok: false, skipped: 'unknown_template' };
  }

  try {
    // ---- 1 & 2 & 3: Update properties on the LEADS page ---------------------
    const properties: Record<string, any> = buildPropertyPatch({
      fieldValues,
      signedPdfUrl,
      auditPdfUrl,
      signedNdaDurableUrl,
      completedAt,
    });

    await notion.pages.update({
      page_id: notionPageId,
      properties,
    });

    // ---- 4: Append a summary comment ----------------------------------------
    const summary = formatSigningSummary({
      signerName, signerEmail, completedAt, signedPdfUrl, auditPdfUrl,
    });
    try {
      await notion.comments.create({
        parent: { page_id: notionPageId },
        rich_text: summary,
      });
    } catch (commentErr: any) {
      // Comment-add failure is non-fatal — the signed PDF is already in the file column.
      console.error('[notion-sync] comment add failed (non-fatal):', commentErr.message);
    }

    return { ok: true };
  } catch (err: any) {
    // Top-level failure: log and report. Never throws — the signature is
    // already legally complete; the caller simply won't stamp notion_synced_at,
    // so the backfill/reconciler can retry later.
    console.error('[notion-sync] failed:', err.message, err.body ?? '');
    return { ok: false, error: String(err.message ?? err) };
  }
}

// ============================================================================
// Property patch builder
// ============================================================================

function buildPropertyPatch(args: {
  fieldValues: Record<string, any>;
  signedPdfUrl: string;
  auditPdfUrl: string;
  signedNdaDurableUrl?: string;
  completedAt: string;
}): Record<string, any> {
  const { fieldValues: v, signedPdfUrl, auditPdfUrl, signedNdaDurableUrl, completedAt } = args;
  const patch: Record<string, any> = {};

  // NOTE (2026-07-02): every property name + type below was verified against
  // the live LEADS data source (3349af07-54ec-809f-ab32-000b3719dfbf). Notion
  // rejects the ENTIRE pages.update call if any single property name or type
  // is wrong, so a mismatch here silently kills the whole write-back.

  // 1. Always check the Completed NDA checkbox + auto-advance stages.
  patch['Completed NDA'] = { checkbox: true };
  patch['Pipeline Stage'] = { select: { name: '3. NDA Executed' } };
  // Status Update retired 2026-06-05 — write canonical Status (health) instead.
  patch['Status'] = { status: { name: 'Active' } };
  // Date NDA Signed: date portion only (YYYY-MM-DD), per integration spec §4.
  patch['Date NDA Signed'] = { date: { start: String(completedAt).slice(0, 10) } };

  // 2. Direct text-style fields — only set when the buyer provided a value.
  if (text(v.buyer_address)) {
    patch['Full Address'] = richText(v.buyer_address);
  }
  if (text(v.buyer_phone)) {
    patch['Phone'] = { phone_number: String(v.buyer_phone).trim() };
  }
  if (text(v.buyer_email)) {
    patch['Email'] = { email: String(v.buyer_email).trim().toLowerCase() };
  }
  if (text(v.buyer_entity)) {
    patch['Buyer Entity'] = richText(v.buyer_entity);
  }
  if (text(v.buyer_company)) {
    patch['Buyer Company'] = richText(v.buyer_company);
  }
  if (text(v.business_experience)) {
    patch['Business Experience'] = richText(v.business_experience);
  }
  if (text(v.buyer_comments)) {
    // LEADS property is 'Buyer Comments' (plural) — 'Buyer Comment' 400s the patch.
    patch['Buyer Comments'] = richText(v.buyer_comments);
  }
  if (text(v.credit_net_worth)) {
    patch['Credit Score'] = richText(v.credit_net_worth);
  }
  if (text(v.primary_funding_source)) {
    // LEADS 'Primary Funding Source' is a multi_select, not rich_text.
    // The form may submit one value or a comma-separated list.
    patch['Primary Funding Source'] = {
      multi_select: String(v.primary_funding_source)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name })),
    };
  }
  if (text(v.describe_acquisition_funding)) {
    patch['Describe Acquisition Funding'] = richText(v.describe_acquisition_funding);
  }
  if (text(v.buyer_acquisition_type)) {
    patch['Acquisition Type'] = { select: { name: text(v.buyer_acquisition_type) } };
  }
  if (text(v.buyer_deal_structure)) {
    // The LEADS property name carries a trailing space: 'Deal Structure ' —
    // intentional here; do not "fix" it or the whole patch 400s.
    patch['Deal Structure '] = { select: { name: text(v.buyer_deal_structure) } };
  }

  // 3. Numeric (currency) — funds_available may include $/, commas etc.
  const fundsNumber = parseCurrency(v.funds_available);
  if (fundsNumber !== null) {
    patch['Liquid Cash'] = { number: fundsNumber };
  }

  // 3a. New fields (v2 template): text/currency/select + checkboxes.
  // 'Business Partner' is a checkbox on LEADS (was mis-typed as rich_text).
  if (v.buyer_business_partner === '__YES__' || v.buyer_business_partner === '__NO__') {
    patch['Business Partner'] = { checkbox: v.buyer_business_partner === '__YES__' };
  }
  if (text(v.buyer_timeframe_to_purchase)) {
    patch['Timeframe to Purchase'] = richText(v.buyer_timeframe_to_purchase);
  }
  const currentIncomeNumber = parseCurrency(v.buyer_current_income);
  if (currentIncomeNumber !== null) {
    patch['Current Income'] = { number: currentIncomeNumber };
  }
  if (text(v.buyer_financing_type)) {
    patch['Financing Type'] = { select: { name: text(v.buyer_financing_type) } };
  }
  if (text(v.buyer_foreign_buyer)) {
    patch['Foreign Buyer'] = { select: { name: text(v.buyer_foreign_buyer) } };
  }
  // Checkboxes — 'Consider Franchise' and 'US Citizen' are checkbox properties
  // on LEADS (writing rich_text 400s the whole patch). The form submits
  // '__YES__' / '__NO__'; an untouched checkbox stays empty and we skip it.
  if (v.buyer_consider_franchise === '__YES__' || v.buyer_consider_franchise === '__NO__') {
    patch['Consider Franchise'] = { checkbox: v.buyer_consider_franchise === '__YES__' };
  }
  if (v.buyer_us_citizen === '__YES__' || v.buyer_us_citizen === '__NO__') {
    patch['US Citizen'] = { checkbox: v.buyer_us_citizen === '__YES__' };
  }

  // 4. Buyer Type — pass through directly. Form Select options match the
  //    Notion Buyer Type Select column options 1:1 (no translation needed).
  if (text(v.buyer_type)) {
    patch['Buyer Type'] = { select: { name: text(v.buyer_type) } };
  }

  // 5. NDA file column — the signed PDF (the legally binding document).
  //    Notion external-file format: { type:'external', name, external:{url} }.
  patch['NDA'] = {
    files: [
      {
        type: 'external',
        name: `Signed NDA — Envelope ${shortId(signedPdfUrl)}.pdf`,
        external: { url: signedPdfUrl },
      },
    ],
  };

  // 6. Buyer Profile file column — audit certificate (the chronological
  //    event log proving intent, consent, attribution, and integrity).
  patch['Buyer Profile'] = {
    files: [
      {
        type: 'external',
        name: `Audit Certificate — Envelope ${shortId(auditPdfUrl)}.pdf`,
        external: { url: auditPdfUrl },
      },
    ],
  };

  // 7. Signed NDA URL — durable, non-expiring link to the signed PDF
  //    (the /api/sign/download/… redirect; re-signs storage on demand).
  //    Added 2026-07-02 (Build A); property created on LEADS the same day.
  if (signedNdaDurableUrl) {
    patch['Signed NDA URL'] = { url: signedNdaDurableUrl };
  }

  // (Removed 2026-07-02: a second 'Date NDA Signed' write here used the full
  //  ISO timestamp and silently overwrote the date-only value set in step 1.
  //  Spec §4 calls for YYYY-MM-DD; sub-day precision lives in the audit cert.)

  return patch;
}

// ============================================================================
// Comment summary
// ============================================================================

function formatSigningSummary(args: {
  signerName: string;
  signerEmail: string;
  completedAt: string;
  signedPdfUrl: string;
  auditPdfUrl: string;
}): any[] {
  const { signerName, signerEmail, completedAt, signedPdfUrl, auditPdfUrl } = args;
  const date = new Date(completedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return [
    {
      type: 'text',
      text: { content: `✓ NDA signed by ${signerName} (${signerEmail}) on ${date} ET. ` },
      annotations: { bold: true },
    },
    {
      type: 'text',
      text: { content: 'Signed NDA', link: { url: signedPdfUrl } },
    },
    { type: 'text', text: { content: '   ·   ' } },
    {
      type: 'text',
      text: { content: 'Audit certificate', link: { url: auditPdfUrl } },
    },
  ];
}

// ============================================================================
// Helpers
// ============================================================================

function text(v: any): string {
  return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim());
}

function richText(s: any): any {
  const value = text(s);
  if (!value) return { rich_text: [] };
  // Notion caps each rich_text segment at 2000 chars; chunk if needed.
  const chunks: any[] = [];
  for (let i = 0; i < value.length; i += 1900) {
    chunks.push({ type: 'text', text: { content: value.slice(i, i + 1900) } });
  }
  return { rich_text: chunks };
}

function parseCurrency(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function shortId(url: string): string {
  // Pull a short identifier from the URL for the Notion file label.
  // Falls back to current epoch if none can be extracted.
  const m = url.match(/\/([a-f0-9]{6,})/i);
  if (m) return m[1].slice(0, 8);
  return Date.now().toString(36);
}
