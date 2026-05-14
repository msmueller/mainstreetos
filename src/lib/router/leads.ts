/**
 * Lead Router — lead context assembly
 *
 * The Router takes a Notion LEADS page id as input. Notion is the system
 * of record for inquiry content (Email, Message, BBS Listing Title, etc.).
 * This module reads the Notion page and assembles a `LeadContext` that
 * the matcher and renderer can consume.
 */

import { getRouterSupabase } from './supabase';
import { fetchNotionLead } from './notion';
import type { LeadContext } from './types';

/**
 * Build a LeadContext from a Notion LEADS page id.
 *
 * - buyer_lead_id is resolved from buyer_leads.notion_page_id when a
 *   linked Supabase row exists; otherwise empty string.
 * - previous_interactions_count counts prior buyer_leads with the same
 *   buyer email (joined via contacts) — used by the matcher's
 *   new_buyer / returning_buyer scenario logic.
 */
export async function buildLeadContextFromNotion(
  notion_page_id: string
): Promise<LeadContext> {
  const notionLead = await fetchNotionLead(notion_page_id);

  // Resolve buyer_lead_id (may be empty if no Supabase mirror exists yet)
  const buyer_lead_id = await findBuyerLeadIdByNotion(notion_page_id);

  // Count previous interactions on the buyer's email
  const previous_interactions_count = await countPreviousInteractions(
    notionLead.buyer_email,
    notionLead.created_at
  );

  return {
    buyer_lead_id: buyer_lead_id ?? '',
    notion_page_id,
    buyer_first_name: notionLead.buyer_first_name,
    buyer_last_name: notionLead.buyer_last_name,
    buyer_email: notionLead.buyer_email,
    buyer_phone: notionLead.buyer_phone,
    email_subject: notionLead.email_subject,
    email_body: notionLead.email_body,
    source: notionLead.source ?? 'BBS',
    created_at: notionLead.created_at,
    cobroker: null,
    previous_interactions_count,
  };
}

async function findBuyerLeadIdByNotion(notion_page_id: string): Promise<string | null> {
  const supabase = getRouterSupabase();
  const { data } = await supabase
    .from('buyer_leads')
    .select('id')
    .eq('notion_page_id', notion_page_id)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

/**
 * Counts prior buyer_leads with the same buyer email. Returns 0 if email
 * is missing or anything errors — the matcher will treat as new_buyer.
 *
 * Implementation: joins buyer_leads → contacts on primary_contact_id and
 * matches by lowercased email. Excludes the current lead's row by
 * filtering `created_at < before_iso`.
 */
export async function countPreviousInteractions(
  buyer_email: string | null,
  before_iso: string
): Promise<number> {
  if (!buyer_email) return 0;

  const supabase = getRouterSupabase();
  const lowered = buyer_email.toLowerCase().trim();

  try {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', lowered)
      .limit(50);

    const contactIds = (contacts ?? []).map((c) => String(c.id));
    if (contactIds.length === 0) return 0;

    const { count } = await supabase
      .from('buyer_leads')
      .select('id', { count: 'exact', head: true })
      .in('primary_contact_id', contactIds)
      .lt('created_at', before_iso);

    return count ?? 0;
  } catch {
    return 0;
  }
}
