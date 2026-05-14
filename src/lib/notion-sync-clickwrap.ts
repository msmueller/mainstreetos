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
 *   5. Leave Status and Status Update alone — Mark progresses stages manually.
 *
 * Required env: NOTION_API_KEY
 *
 * Failure mode: this function NEVER throws to the caller. The signing flow is
 * already complete by the time this runs; a Notion sync failure should not
 * roll back the signature. Errors are logged for retry.
 */

import { Client as NotionClient } from '@notionhq/client';

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

// ============================================================================
// Public type
// ============================================================================

export type SyncCompletedSignatureInput = {
  notionPageId: string;       // the LEADS page ID
  templateKey: string;        // 'NDA_BuyerProfile' for v1
  fieldValues: Record<string, any>;
  signedPdfUrl: string;
  auditPdfUrl: string;
  completedAt: string;        // ISO date
  signerEmail: string;
  signerName: string;
};

// ============================================================================
// Buyer Type mapping  (C1 — confirmed by Mark)
// ============================================================================
//
// NDA option (what the buyer picked)  →  Notion Buyer Type option
//
const BUYER_TYPE_MAP: Record<string, string> = {
  'Corporate Business Buyer':  'Corporate Acquisition',
  'Private Entrepreneur':      'Owner/Operator',
  'Partnership Investment':    'Investor',
  'Private Equity Investor':   'Investor',
  'Employee Acquisition':      'Employee Acquisition',
};

// ============================================================================
// Main export
// ============================================================================

export async function syncCompletedSignatureToNotion(
  input: SyncCompletedSignatureInput
): Promise<void> {
  const {
    notionPageId, templateKey, fieldValues,
    signedPdfUrl, auditPdfUrl, completedAt,
    signerEmail, signerName,
  } = input;

  if (templateKey !== 'NDA_BuyerProfile') {
    console.warn(`[notion-sync] templateKey '${templateKey}' has no mapping yet; skipping property update.`);
    return;
  }

  try {
    // ---- 1 & 2 & 3: Update properties on the LEADS page ---------------------
    const properties: Record<string, any> = buildPropertyPatch({
      fieldValues,
      signedPdfUrl,
      auditPdfUrl,
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
  } catch (err: any) {
    // Top-level failure: log and swallow. The route also catches this.
    console.error('[notion-sync] failed:', err.message, err.body ?? '');
  }
}

// ============================================================================
// Property patch builder
// ============================================================================

function buildPropertyPatch(args: {
  fieldValues: Record<string, any>;
  signedPdfUrl: string;
  auditPdfUrl: string;
}): Record<string, any> {
  const { fieldValues: v, signedPdfUrl, auditPdfUrl } = args;
  const patch: Record<string, any> = {};

  // 1. Always check the Completed NDA checkbox.
  patch['Completed NDA'] = { checkbox: true };

  // 2. Direct text-style fields — only set when the buyer provided a value.
  if (text(v.buyer_address)) {
    patch['BP Full Address'] = richText(v.buyer_address);
  }
  if (text(v.buyer_phone)) {
    patch['Phone'] = { phone_number: String(v.buyer_phone).trim() };
  }
  if (text(v.buyer_email)) {
    patch['Email'] = { email: String(v.buyer_email).trim().toLowerCase() };
  }
  if (text(v.buyer_entity) || text(v.buyer_company)) {
    patch['Company'] = richText(text(v.buyer_entity) ? v.buyer_entity : v.buyer_company);
  }
  if (text(v.business_experience)) {
    patch['BP Additional Comments'] = richText(v.business_experience);
  }
  if (text(v.credit_net_worth)) {
    patch['BP Credit Score'] = richText(v.credit_net_worth);
  }
  if (text(v.funding_source)) {
    patch['BP Plan to Finance'] = richText(v.funding_source);
  }

  // 3. Numeric (currency) — funds_available may include $/, commas etc.
  const fundsNumber = parseCurrency(v.funds_available);
  if (fundsNumber !== null) {
    patch['BP Liquid Cash'] = { number: fundsNumber };
  }

  // 4. Buyer Type — apply the C1 mapping.
  const ndaBuyerType = String(v.buyer_type ?? '').trim();
  const mapped = BUYER_TYPE_MAP[ndaBuyerType];
  if (mapped) {
    patch['Buyer Type'] = { select: { name: mapped } };
  }

  // 5. Buyer Profile (file column) — attach signed PDF + audit certificate.
  //    Notion external-file format: { type:'external', name, external:{url} }.
  patch['Buyer Profile'] = {
    files: [
      {
        type: 'external',
        name: `Signed NDA — Envelope ${shortId(signedPdfUrl)}.pdf`,
        external: { url: signedPdfUrl },
      },
      {
        type: 'external',
        name: `Audit Certificate — Envelope ${shortId(auditPdfUrl)}.pdf`,
        external: { url: auditPdfUrl },
      },
    ],
  };

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
