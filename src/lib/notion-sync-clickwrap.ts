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
  completedAt: string;
}): Record<string, any> {
  const { fieldValues: v, signedPdfUrl, auditPdfUrl, completedAt } = args;
  const patch: Record<string, any> = {};

  // 1. Always check the Completed NDA checkbox.
  patch['Completed NDA'] = { checkbox: true };

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
    patch['Buyer Comment'] = richText(v.buyer_comments);
  }
  if (text(v.credit_net_worth)) {
    patch['Credit Score'] = richText(v.credit_net_worth);
  }
  if (text(v.primary_funding_source)) {
    patch['Primary Funding Source'] = richText(v.primary_funding_source);
  }
  if (text(v.describe_acquisition_funding)) {
    patch['Describe Acquisition Funding'] = richText(v.describe_acquisition_funding);
  }
  if (text(v.buyer_acquisition_type)) {
    patch['Acquisition Type'] = { select: { name: text(v.buyer_acquisition_type) } };
  }
  if (text(v.buyer_deal_structure)) {
    patch['Deal Structure'] = { select: { name: text(v.buyer_deal_structure) } };
  }

  // 3. Numeric (currency) — funds_available may include $/, commas etc.
  const fundsNumber = parseCurrency(v.funds_available);
  if (fundsNumber !== null) {
    patch['Liquid Cash'] = { number: fundsNumber };
  }

  // 3a. New fields (v2 template): 5 text/currency/select + 2 checkboxes.
  if (text(v.buyer_business_partner)) {
    patch['Business Partner'] = richText(v.buyer_business_partner);
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
  // Checkboxes — write '__YES__' or '__NO__' as rich_text to match the existing
  // LEADS convention. If buyer touched the field at all the value will be one of
  // those two strings; an untouched checkbox stays empty and we skip writing it.
  if (v.buyer_consider_franchise === '__YES__' || v.buyer_consider_franchise === '__NO__') {
    patch['Consider Franchise'] = richText(v.buyer_consider_franchise);
  }
  if (v.buyer_us_citizen === '__YES__' || v.buyer_us_citizen === '__NO__') {
    patch['US Citizen'] = richText(v.buyer_us_citizen);
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

  // 7. Date NDA Signed — when the buyer completed signing (ISO 8601 with time).
  //    Notion date type accepts ISO strings; including time gives sub-day precision
  //    for audit/dispute purposes.
  patch['Date NDA Signed'] = {
    date: {
      start: completedAt,
    },
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
