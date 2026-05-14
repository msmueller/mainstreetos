/**
 * Lead Router — email_threads + email_messages writers.
 *
 * After the GmailSender successfully delivers, we persist the conversation
 * shape into Supabase so the dashboard, the cron, and future reply-detection
 * logic all see a consistent picture.
 *
 * Strategy:
 *   - email_threads is keyed by (provider, provider_thread_id).
 *     For Email #1 the thread is brand new — INSERT.
 *     For Email #2+ in the same Gmail thread (replies/follow-ups) — UPSERT.
 *   - email_messages is one row per send.
 */

import { getRouterSupabase } from './supabase';
import type { SendResult } from './types';

export interface EmailThreadInsert {
  provider_thread_id: string;
  owner_user_id: string;
  account_email: string;
  subject: string;
  participant_emails: string[];
  primary_contact_id?: string | null;
  primary_organization_id?: string | null;
}

export interface EmailMessageInsert {
  thread_id: string;
  provider_message_id: string;
  rfc822_message_id?: string | null;
  owner_user_id: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  cc_emails?: string[];
  subject: string;
  body_text?: string;
  body_html?: string;
}

/**
 * Upsert an email_threads row keyed by (provider, provider_thread_id).
 * Returns the row's UUID for FK use by email_messages.
 */
export async function upsertEmailThread(input: EmailThreadInsert): Promise<string> {
  const supabase = getRouterSupabase();

  // Look up existing thread by provider+thread_id
  const { data: existing } = await supabase
    .from('email_threads')
    .select('id')
    .eq('provider', 'google')
    .eq('provider_thread_id', input.provider_thread_id)
    .maybeSingle();

  if (existing?.id) {
    // Bump message_count + last_message_at
    await supabase
      .from('email_threads')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: (await getMessageCount(String(existing.id))) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return String(existing.id);
  }

  // Insert new thread
  const { data, error } = await supabase
    .from('email_threads')
    .insert({
      provider: 'google',
      provider_thread_id: input.provider_thread_id,
      owner_user_id: input.owner_user_id,
      account_email: input.account_email,
      subject: input.subject,
      participant_emails: input.participant_emails,
      message_count: 1,
      unread_count: 0,
      matched_contacts: [],
      matched_orgs: [],
      primary_contact_id: input.primary_contact_id ?? null,
      primary_organization_id: input.primary_organization_id ?? null,
      last_message_at: new Date().toISOString(),
      is_starred: false,
      is_archived: false,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`upsertEmailThread: ${error?.message ?? 'no row returned'}`);
  }
  return String(data.id);
}

async function getMessageCount(thread_id: string): Promise<number> {
  const supabase = getRouterSupabase();
  const { count } = await supabase
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', thread_id);
  return count ?? 0;
}

/**
 * Insert one email_messages row. Returns the new UUID.
 */
export async function insertEmailMessage(input: EmailMessageInsert): Promise<string> {
  const supabase = getRouterSupabase();

  const { data, error } = await supabase
    .from('email_messages')
    .insert({
      thread_id: input.thread_id,
      provider: 'google',
      provider_message_id: input.provider_message_id,
      rfc822_message_id: input.rfc822_message_id ?? null,
      owner_user_id: input.owner_user_id,
      direction: 'outbound',
      from_email: input.from_email,
      from_name: input.from_name ?? null,
      to_emails: input.to_emails,
      cc_emails: input.cc_emails ?? [],
      bcc_emails: [],
      subject: input.subject,
      body_text: input.body_text ?? null,
      body_html: input.body_html ?? null,
      sent_at: new Date().toISOString(),
      attachments: [],
      // attachment_count is a generated column — derived from attachments
      is_read: true,
      is_starred: false,
      is_spam: false,
      matched_contact_ids: [],
      matched_org_ids: [],
      matched_deal_refs: {},
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`insertEmailMessage: ${error?.message ?? 'no row returned'}`);
  }
  return String(data.id);
}

/**
 * Convenience wrapper: persist a successful send into email_threads + email_messages
 * in one call. Returns both UUIDs.
 */
export async function persistSentEmail(opts: {
  send: SendResult;
  owner_user_id: string;
  account_email: string;
  from_name?: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string;
}): Promise<{ email_thread_id: string; email_message_id: string }> {
  const email_thread_id = await upsertEmailThread({
    provider_thread_id: opts.send.thread_id,
    owner_user_id: opts.owner_user_id,
    account_email: opts.account_email,
    subject: opts.subject,
    participant_emails: [opts.account_email, opts.to_email],
  });

  const email_message_id = await insertEmailMessage({
    thread_id: email_thread_id,
    provider_message_id: opts.send.message_id,
    rfc822_message_id: opts.send.rfc822_message_id ?? null,
    owner_user_id: opts.owner_user_id,
    from_email: opts.account_email,
    from_name: opts.from_name,
    to_emails: [opts.to_email],
    subject: opts.subject,
    body_text: opts.body_text,
    body_html: opts.body_html,
  });

  return { email_thread_id, email_message_id };
}
