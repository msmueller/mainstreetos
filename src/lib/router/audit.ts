/**
 * Lead Router — lr_match_decisions audit row writer.
 *
 * Every Router invocation logs one audit row with status:
 *   - enrolled       successfully sent + enrolled
 *   - manual_review  low-confidence match flagged for human review
 *   - failed         pipeline error
 *   - dry_run        dry-run mode invoked (no side effects)
 *   - superseded     prior enrolled row replaced by reroute
 *
 * Idempotency on (buyer_lead_id) WHERE status='enrolled' AND dry_run=false
 * is enforced at the DB level via partial unique index.
 */

import { getRouterSupabase } from './supabase';
import type { MatchDecisionInsert } from './types';

export async function logMatchDecision(
  row: MatchDecisionInsert
): Promise<{ id: number }> {
  const supabase = getRouterSupabase();

  const { data, error } = await supabase
    .from('lr_match_decisions')
    .insert({
      buyer_lead_id: row.buyer_lead_id,
      notion_lead_page_id: row.notion_lead_page_id,
      inquiry_gmail_message_id: row.inquiry_gmail_message_id,
      matched_listing_id: row.matched_listing_id,
      matched_scenario: row.matched_scenario,
      match_confidence: row.match_confidence,
      match_reasoning: row.match_reasoning,
      extracted_attributes: row.extracted_attributes,
      template_id: row.template_id,
      email_sequence_id: row.email_sequence_id,
      sequence_enrollment_id: row.sequence_enrollment_id,
      variables_used: row.variables_used,
      status: row.status,
      error: row.error,
      dry_run: row.dry_run,
      broker_id: row.broker_id,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`logMatchDecision: ${error?.message ?? 'no row returned'}`);
  }
  return { id: Number(data.id) };
}

/**
 * Mark any prior enrolled audit row as 'superseded' before inserting a new
 * enrolled row for the same lead. Used by the reroute path. The partial
 * unique index requires this — only one 'enrolled' row per lead at a time.
 */
export async function supersedePriorEnrollments(
  notion_lead_page_id: string
): Promise<number> {
  const supabase = getRouterSupabase();
  const { data } = await supabase
    .from('lr_match_decisions')
    .update({ status: 'superseded' })
    .eq('notion_lead_page_id', notion_lead_page_id)
    .eq('status', 'enrolled')
    .eq('dry_run', false)
    .select('id');
  return (data ?? []).length;
}
