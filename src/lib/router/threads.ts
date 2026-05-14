/**
 * Lead Router — find an existing email thread for a lead so follow-up
 * emails (#2-5) thread under the same Gmail conversation as Email #1.
 *
 * Strategy: walk lr_match_decisions for the most recent enrolled match,
 * pull its inquiry_gmail_message_id, look up email_messages to get the
 * thread_id + rfc822_message_id of the last sent message.
 */

import { getRouterSupabase } from './supabase';

export interface ExistingThread {
  /** Supabase email_threads.id (uuid) */
  email_thread_id: string;
  /** Gmail thread id (the value passed as `threadId` to gmail.users.messages.send) */
  gmail_thread_id: string;
  /** RFC 822 Message-ID of the last sent message in this thread; used as
   *  In-Reply-To header for replies. Null if not stamped. */
  last_rfc822_message_id: string | null;
  /** Aggregate of all RFC 822 IDs in the thread, ordered earliest → latest.
   *  Joined into the References header. */
  references: string[];
}

export async function findEmailThreadForLead(
  notion_lead_page_id: string
): Promise<ExistingThread | null> {
  const supabase = getRouterSupabase();

  // 1. Find most recent enrolled match for this lead.
  const { data: match } = await supabase
    .from('lr_match_decisions')
    .select('inquiry_gmail_message_id')
    .eq('notion_lead_page_id', notion_lead_page_id)
    .eq('dry_run', false)
    .in('status', ['enrolled', 'superseded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!match?.inquiry_gmail_message_id) return null;

  // 2. Resolve to email_messages via provider_message_id, get the thread.
  const { data: msg } = await supabase
    .from('email_messages')
    .select('thread_id, rfc822_message_id')
    .eq('provider_message_id', match.inquiry_gmail_message_id)
    .maybeSingle();

  if (!msg?.thread_id) return null;

  const thread_id = String(msg.thread_id);

  // 3. Fetch the email_threads row to get provider_thread_id (Gmail's id).
  const { data: thread } = await supabase
    .from('email_threads')
    .select('provider_thread_id')
    .eq('id', thread_id)
    .maybeSingle();

  if (!thread?.provider_thread_id) return null;

  // 4. Pull all rfc822_message_ids in the thread, ordered earliest → latest,
  //    for the References header.
  const { data: allMessages } = await supabase
    .from('email_messages')
    .select('rfc822_message_id, sent_at')
    .eq('thread_id', thread_id)
    .order('sent_at', { ascending: true });

  const references = (allMessages ?? [])
    .map((m) => m.rfc822_message_id as string | null)
    .filter((id): id is string => Boolean(id));

  return {
    email_thread_id: thread_id,
    gmail_thread_id: String(thread.provider_thread_id),
    last_rfc822_message_id: references[references.length - 1] ?? null,
    references,
  };
}
