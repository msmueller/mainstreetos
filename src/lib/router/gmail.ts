/**
 * Lead Router — Gmail API client
 *
 * Uses the Lead Router's dedicated OAuth client (GOOGLE_OAUTH_CLIENT_ID/
 * SECRET/REFRESH_TOKEN). Distinct from src/lib/gmail/client.ts which uses
 * the legacy Sheets-MCP credentials.
 *
 * Exports:
 *   - getRouterOAuth2Client / getRouterGmail: shared auth helpers
 *   - GmailSender:                            implements the Sender interface
 *   - pingGmail:                              health check
 *   - hasReplyAfter:                          used by the cron to cancel
 *                                             pending sends when a buyer
 *                                             has already replied
 */

import { google } from 'googleapis';
import { randomUUID } from 'node:crypto';
import type { OAuth2Client } from 'google-auth-library';
import type { gmail_v1 } from 'googleapis';
import type { Sender, SendParams, SendResult } from './types';

let cachedAuth: OAuth2Client | null = null;

export function getRouterOAuth2Client(): OAuth2Client {
  if (cachedAuth) return cachedAuth;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Lead Router: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET is not set'
    );
  }
  if (!refreshToken) {
    throw new Error(
      'Lead Router: GOOGLE_OAUTH_REFRESH_TOKEN is not set. Run scripts/get-google-refresh-token.mjs'
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  cachedAuth = auth;
  return auth;
}

export function getRouterGmail(): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth: getRouterOAuth2Client() });
}

// ---------------------------------------------------------------------------
// MIME assembly
// ---------------------------------------------------------------------------

/** RFC 2047 encoded-word for non-ASCII headers (subject, display name). */
function encodeRfc2047(s: string): string {
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?utf-8?B?${Buffer.from(s, 'utf-8').toString('base64')}?=`;
}

/** Break a base64 string into 76-character lines per RFC 5322 §2.1.1. */
function chunk76(b64: string): string {
  return b64.match(/.{1,76}/g)?.join('\r\n') ?? b64;
}

/** Base64url for the Gmail API's `raw` field (URL-safe, no padding). */
function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface MimeOpts {
  from_email: string;
  from_name?: string;
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  in_reply_to?: string;
  references?: string;
  message_id: string;
}

/**
 * Build an RFC 2822 multipart/alternative MIME message with text and HTML
 * parts. Both bodies are base64-encoded under UTF-8 to safely transport
 * any character. Returns the raw message string (not yet base64url'd for
 * Gmail's `raw` field — that happens in send()).
 */
function buildMime(opts: MimeOpts): string {
  const boundary = `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const fromHeader = opts.from_name
    ? `${encodeRfc2047(`"${opts.from_name}"`)} <${opts.from_email}>`
    : opts.from_email;

  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${opts.to}`,
  ];
  if (opts.cc?.length) headers.push(`Cc: ${opts.cc.join(', ')}`);
  headers.push(
    `Subject: ${encodeRfc2047(opts.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${opts.message_id}`
  );
  if (opts.in_reply_to) headers.push(`In-Reply-To: ${opts.in_reply_to}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  headers.push(
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  );

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    chunk76(Buffer.from(opts.text, 'utf-8').toString('base64')),
  ].join('\r\n');

  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    chunk76(Buffer.from(opts.html, 'utf-8').toString('base64')),
  ].join('\r\n');

  return [
    headers.join('\r\n'),
    '',
    textPart,
    htmlPart,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

// ---------------------------------------------------------------------------
// GmailSender — Sender implementation
// ---------------------------------------------------------------------------

export class GmailSender implements Sender {
  async send(params: SendParams): Promise<SendResult> {
    const gmail = getRouterGmail();

    const fromEmail = process.env.BROKER_EMAIL ?? 'markm@creresources.biz';
    const fromName = process.env.BROKER_NAME ?? 'Mark Mueller';

    // Subject: prepend "Re: " when threading and not already prefixed
    let subject = params.subject;
    if (params.thread_id && !/^re:\s/i.test(subject)) {
      subject = `Re: ${subject}`;
    }

    // Generate Message-ID we can later use to thread replies to follow-ups
    const messageId = `<${randomUUID()}@creresources.biz>`;

    const mime = buildMime({
      from_email: fromEmail,
      from_name: fromName,
      to: params.to,
      cc: params.cc,
      subject,
      html: params.html,
      text: params.text,
      in_reply_to: params.in_reply_to,
      references: params.references,
      message_id: messageId,
    });

    const raw = base64url(Buffer.from(mime, 'utf-8'));

    try {
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
          threadId: params.thread_id,
        },
      });

      return {
        success: true,
        message_id: result.data.id ?? '',
        thread_id: result.data.threadId ?? '',
        rfc822_message_id: messageId,
        provider: 'gmail',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message_id: '',
        thread_id: params.thread_id ?? '',
        provider: 'gmail',
        error: message,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Reply detection — used by the cron before each scheduled send
// ---------------------------------------------------------------------------

/**
 * Returns true if any message in the thread arrived AFTER `afterTimestamp`
 * AND was sent by an address other than `selfEmail`. Used to cancel
 * remaining sequence sends when the buyer has already replied.
 */
export async function hasReplyAfter(opts: {
  thread_id: string;
  after_timestamp: Date;
  self_email: string;
}): Promise<boolean> {
  const gmail = getRouterGmail();
  const afterMs = opts.after_timestamp.getTime();
  const selfLower = opts.self_email.toLowerCase();

  try {
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: opts.thread_id,
      format: 'metadata',
      metadataHeaders: ['From', 'Date'],
    });

    const messages = thread.data.messages ?? [];
    for (const msg of messages) {
      const internalDate = msg.internalDate ? Number(msg.internalDate) : 0;
      if (internalDate <= afterMs) continue;

      const headers = msg.payload?.headers ?? [];
      const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
      const isFromSelf = fromHeader.toLowerCase().includes(selfLower);
      if (!isFromSelf) return true;
    }
    return false;
  } catch {
    // On API failure, err on the side of caution and assume no reply
    // (i.e., let the next send proceed). The route handler logs the error
    // separately. We do NOT want a transient API blip to cancel sends.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function pingGmail(): Promise<{ email: string; messages_total: number }> {
  const gmail = getRouterGmail();
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return {
    email: profile.data.emailAddress ?? '(unknown)',
    messages_total: profile.data.messagesTotal ?? 0,
  };
}
