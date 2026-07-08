/**
 * MainStreetOS · Notion LEADS find-or-create for the public Start NDA page
 *
 * A non-BBS prospect who signs via /nda/[slug] may have no existing LEADS row.
 * Build Spec v1.0 §5: "If no lead exists (non-BBS), create one from buyer
 * email/name first, then patch." This module finds the matching lead by email
 * or creates a fresh one, and returns its page id so the envelope can carry
 * notion_lead_id and the Build A completion write-back can advance it.
 *
 * Feature flag: gated by the SAME flag as the Notion write-back
 * (NDA_NOTION_SYNC via ndaNotionSyncEnabled). When off, this returns null and
 * the public signing still completes — the envelope is simply unlinked, exactly
 * like a deliberate test envelope. This keeps the public page shippable dark.
 *
 * Never throws to the caller: a Notion failure must not roll back a completed,
 * legally binding signature. Errors are logged and surface as null.
 *
 * Verified against the live LEADS data source
 * (3349af07-54ec-809f-ab32-000b3719dfbf): title property is 'Lead Name',
 * 'Email' is an email property, 'Lead Type' select includes 'Buyer Lead',
 * 'Pipeline Stage' select includes '1. Inquiry', '📋 LISTINGS' is the listing
 * relation. (Same property set the Lead Router + auto-route cron use.)
 */

import { Client as NotionClient } from '@notionhq/client';
import { ndaNotionSyncEnabled } from './notion-sync-clickwrap';

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY! });

const LEADS_DATA_SOURCE_ID = '3349af07-54ec-809f-ab32-000b3719dfbf';

export type LeadUpsertResult = { pageId: string; created: boolean } | null;

/**
 * Find a LEADS row by email, or create one. Returns the page id, or null when
 * the Notion sync flag is off or any Notion call fails.
 */
export async function findOrCreatePublicNdaLead(args: {
  email: string;
  name?: string | null;
  phone?: string | null;
  listingNotionPageId?: string | null;
  source?: string;
}): Promise<LeadUpsertResult> {
  if (!ndaNotionSyncEnabled()) {
    console.log('[notion-lead-upsert] NDA_NOTION_SYNC off; skipping lead find-or-create.');
    return null;
  }

  const email = String(args.email ?? '').trim();
  if (!email) return null;

  // ---- Find by email --------------------------------------------------------
  try {
    const res: any = await (notion as any).dataSources.query({
      data_source_id: LEADS_DATA_SOURCE_ID,
      page_size: 1,
      filter: { property: 'Email', email: { equals: email } },
    });
    const existing = res?.results?.[0];
    if (existing?.id) {
      return { pageId: existing.id, created: false };
    }
  } catch (err: any) {
    console.error('[notion-lead-upsert] LEADS lookup failed:', err.message);
    return null; // fail safe — envelope completes unlinked
  }

  // ---- Create ---------------------------------------------------------------
  const displayName = (args.name && args.name.trim()) || email;
  const baseProps: Record<string, any> = {
    'Lead Name': { title: [{ type: 'text', text: { content: displayName } }] },
    'Email':     { email },
    'Lead Type': { select: { name: 'Buyer Lead' } },
    'Pipeline Stage': { select: { name: '1. Inquiry' } },
  };
  if (args.phone && args.phone.trim()) {
    baseProps['Phone'] = { phone_number: args.phone.trim() };
  }

  // Riskier props (a bad relation id or an unknown option would 400 the whole
  // create): attempt WITH them first, then retry without on failure.
  const richProps: Record<string, any> = { ...baseProps };
  richProps['Source'] = { select: { name: args.source ?? 'Public NDA Page' } };
  if (args.listingNotionPageId) {
    richProps['📋 LISTINGS'] = { relation: [{ id: args.listingNotionPageId }] };
  }

  const create = async (properties: Record<string, any>) => {
    const page: any = await (notion as any).pages.create({
      parent: { type: 'data_source_id', data_source_id: LEADS_DATA_SOURCE_ID },
      properties,
    });
    return page?.id as string | undefined;
  };

  try {
    const id = await create(richProps);
    if (id) return { pageId: id, created: true };
  } catch (err: any) {
    console.warn('[notion-lead-upsert] full create failed; retrying minimal:', err.message);
  }

  try {
    const id = await create(baseProps);
    if (id) return { pageId: id, created: true };
  } catch (err: any) {
    console.error('[notion-lead-upsert] minimal create failed:', err.message);
  }

  return null;
}
