/**
 * MainStreetOS · Click-Wrap Signing — Email Sender (Resend)
 *
 * Three transactional emails:
 *   1. sendSigningInvitation       — sent to buyer when broker fires /api/sign/create
 *   2. sendSignedCopy              — sent to buyer after a successful signature
 *   3. sendBrokerNotification      — sent to Mark when a buyer completes signing
 *
 * Branding: CRE Resources, LLC — editorial / serif body, navy #1e3a5f accent.
 * Every message has both an HTML and a plain-text body.
 *
 * Required env vars:
 *   RESEND_API_KEY    — Resend account secret
 *   EMAIL_FROM        — display sender, e.g. 'Mark Mueller <markm@creresources.biz>'
 *   EMAIL_REPLY_TO    — reply destination, default 'markm@creresources.biz'
 *   BROKER_NOTIFY_TO  — destination for "buyer just signed" alerts,
 *                       default 'markm@creresources.biz'
 */

import { Resend } from 'resend';

const RESEND = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.EMAIL_FROM ?? 'Mark Mueller <markm@creresources.biz>';
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'markm@creresources.biz';
const BROKER_NOTIFY_TO = process.env.BROKER_NOTIFY_TO ?? 'markm@creresources.biz';

// Brand palette (matches the signing page)
const ACCENT = '#1e3a5f';
const INK = '#0a1929';
const INK_SOFT = '#2c3e50';
const PAPER = '#fdfcf8';
const PAPER_WARM = '#f7f4ec';
const RULE = '#d8d2c4';

// ============================================================================
// 1. Signing invitation — sent to buyer
// ============================================================================

export async function sendSigningInvitation(args: {
  to: string;
  toName?: string;
  signingUrl: string;
  businessName: string;
  brokerName: string;
  envelopeNumber: number;
}): Promise<void> {
  const { to, toName, signingUrl, businessName, brokerName, envelopeNumber } = args;
  const greeting = toName ? `Hi ${escapeHtml(toName.split(' ')[0])},` : 'Hello,';

  const subject = `NDA for review and signing — ${businessName} (Envelope #${envelopeNumber})`;

  const html = layout({
    title: 'NDA for your review and signing',
    body: `
      <p>${greeting}</p>
      <p>Thank you for your interest in <strong>${escapeHtml(businessName)}</strong>.
      Before I can share confidential information about the business, I need you to
      review and sign the attached Non-Disclosure Agreement and Buyer Profile.</p>
      <p>The document takes about five minutes to complete and is signed
      electronically — no printing, scanning, or email back-and-forth required.</p>
      ${primaryButton(signingUrl, 'Review and sign the NDA')}
      <p style="font-size:14px;color:${INK_SOFT};margin-top:24px;">
        This link is unique to you and expires in 14 days.
        If you have any questions before signing, just reply to this email.
      </p>
      <p>Best regards,<br/>
      <strong>${escapeHtml(brokerName)}</strong><br/>
      CRE Resources, LLC</p>
    `,
    envelopeNumber,
  });

  const text = [
    greeting,
    '',
    `Thank you for your interest in ${businessName}.`,
    '',
    'Before I can share confidential information about the business, I need you to',
    'review and sign the Non-Disclosure Agreement and Buyer Profile. The document',
    'takes about five minutes and is signed electronically.',
    '',
    'Open and sign here:',
    signingUrl,
    '',
    'This link is unique to you and expires in 14 days.',
    'If you have any questions before signing, just reply to this email.',
    '',
    'Best regards,',
    brokerName,
    'CRE Resources, LLC',
    '',
    `Envelope #${envelopeNumber}`,
  ].join('\n');

  await send({ to, subject, html, text });
}

// ============================================================================
// 2. Signed copy — sent to buyer after they sign
// ============================================================================

export async function sendSignedCopy(args: {
  to: string;
  signedPdfUrl: string;
  businessName: string;
}): Promise<void> {
  const { to, signedPdfUrl, businessName } = args;

  const subject = `Your signed NDA — ${businessName}`;

  const html = layout({
    title: 'Your signed NDA',
    body: `
      <p>Thank you for completing the NDA for <strong>${escapeHtml(businessName)}</strong>.</p>
      <p>A copy of your signed agreement is linked below. We recommend you save it
      for your records — the link will remain valid for one year.</p>
      ${primaryButton(signedPdfUrl, 'Download your signed NDA')}
      <p style="font-size:14px;color:${INK_SOFT};margin-top:24px;">
        I will follow up shortly with the confidential information about the
        business. If you have any questions in the meantime, just reply to this
        email.
      </p>
      <p>Best regards,<br/>
      <strong>Mark Mueller</strong><br/>
      CRE Resources, LLC</p>
    `,
  });

  const text = [
    `Thank you for completing the NDA for ${businessName}.`,
    '',
    'A copy of your signed agreement is here (link valid for one year):',
    signedPdfUrl,
    '',
    'I will follow up shortly with the confidential information about the business.',
    'If you have any questions, just reply to this email.',
    '',
    'Best regards,',
    'Mark Mueller',
    'CRE Resources, LLC',
  ].join('\n');

  await send({ to, subject, html, text });
}

// ============================================================================
// 3. Broker notification — sent to Mark
// ============================================================================

export async function sendBrokerNotification(args: {
  envelopeNumber: number;
  signerEmail: string;
  signerName: string;
  businessName: string;
  signedPdfUrl: string;
}): Promise<void> {
  const { envelopeNumber, signerEmail, signerName, businessName, signedPdfUrl } = args;

  const subject = `${signerName} just signed the NDA for ${businessName} (Envelope #${envelopeNumber})`;

  const html = layout({
    title: 'NDA signed',
    body: `
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-family:'Charter',Georgia,serif;font-size:15px;color:${INK};">
        <tr><td style="padding:6px 0;color:${INK_SOFT};width:140px;">Buyer</td><td style="padding:6px 0;"><strong>${escapeHtml(signerName)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:${INK_SOFT};">Email</td><td style="padding:6px 0;">${escapeHtml(signerEmail)}</td></tr>
        <tr><td style="padding:6px 0;color:${INK_SOFT};">Listing</td><td style="padding:6px 0;">${escapeHtml(businessName)}</td></tr>
        <tr><td style="padding:6px 0;color:${INK_SOFT};">Envelope</td><td style="padding:6px 0;">#${envelopeNumber}</td></tr>
        <tr><td style="padding:6px 0;color:${INK_SOFT};">Signed at</td><td style="padding:6px 0;">${new Date().toUTCString()}</td></tr>
      </table>
      ${primaryButton(signedPdfUrl, 'View the signed NDA')}
      <p style="font-size:14px;color:${INK_SOFT};margin-top:24px;">
        The lead's Notion page has been updated automatically: <em>Completed NDA</em>
        is now checked, the buyer profile fields have been populated from the form,
        and the signed PDF + audit certificate are attached.
      </p>
    `,
    envelopeNumber,
  });

  const text = [
    'NDA signed.',
    '',
    `Buyer:     ${signerName}`,
    `Email:     ${signerEmail}`,
    `Listing:   ${businessName}`,
    `Envelope:  #${envelopeNumber}`,
    `Signed at: ${new Date().toUTCString()}`,
    '',
    'View the signed NDA:',
    signedPdfUrl,
    '',
    "The lead's Notion page has been updated automatically.",
  ].join('\n');

  await send({ to: BROKER_NOTIFY_TO, subject, html, text });
}

// ============================================================================
// Internal helpers
// ============================================================================

async function send(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const { to, subject, html, text } = args;
  const { data, error } = await RESEND.emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
    replyTo: REPLY_TO,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[email] sent', { to, subject, id: data?.id });
  }
}

function layout(args: {
  title: string;
  body: string;          // raw HTML — caller is responsible for escaping
  envelopeNumber?: number;
}): string {
  const { title, body, envelopeNumber } = args;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER_WARM};font-family:'Charter',Georgia,Cambria,serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER_WARM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${PAPER};border:1px solid ${RULE};">
          <!-- Masthead -->
          <tr>
            <td style="background:${INK};color:${PAPER};padding:18px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Georgia,serif;font-size:14px;letter-spacing:0.05em;">
                    <strong>CRE&nbsp;RESOURCES, LLC</strong>
                  </td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">
                    MainStreetOS Signing
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <h1 style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:600;color:${INK};letter-spacing:-0.01em;">
                ${escapeHtml(title)}
              </h1>
              <div style="height:2px;width:40px;background:${ACCENT};margin-top:14px;"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:16px 32px 24px 32px;font-family:Georgia,serif;font-size:16px;line-height:1.55;color:${INK};">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px 32px;border-top:1px solid ${RULE};font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${INK_SOFT};letter-spacing:0.04em;line-height:1.5;">
              <strong>Mark Mueller, CAIBVS™</strong>&nbsp;·&nbsp;Managing Member<br/>
              CRE Resources, LLC&nbsp;·&nbsp;Titusville, NJ 08560<br/>
              <a href="mailto:markm@creresources.biz" style="color:${INK_SOFT};text-decoration:none;">markm@creresources.biz</a>
              &nbsp;·&nbsp;856.745.9706
              &nbsp;·&nbsp;<a href="https://creresources.biz" style="color:${INK_SOFT};text-decoration:none;">creresources.biz</a>
              ${envelopeNumber ? `<br/><span style="opacity:0.7;">Envelope&nbsp;#${envelopeNumber}</span>` : ''}
            </td>
          </tr>
        </table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${INK_SOFT};opacity:0.6;margin-top:16px;">
          Powered by MainStreetOS
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function primaryButton(href: string, label: string): string {
  // Bulletproof button — table-based for max email-client compatibility.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td bgcolor="${ACCENT}" style="border-radius:2px;">
          <a href="${escapeAttribute(href)}"
             style="display:inline-block;padding:14px 28px;background:${ACCENT};color:${PAPER};font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:0.04em;text-decoration:none;border-radius:2px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(s: string): string {
  // Same as escapeHtml but kept distinct in case we want to differ later
  return escapeHtml(s);
}
