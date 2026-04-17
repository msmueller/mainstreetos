/**
 * Gmail API Client
 *
 * Uses Google OAuth2 with a stored refresh token to access Gmail.
 * Requires these env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN
 *
 * Setup instructions:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or use existing)
 *   3. Enable the Gmail API
 *   4. Create OAuth 2.0 credentials (Web application type)
 *   5. Add http://localhost:3000/api/gmail/callback as redirect URI
 *   6. Use /api/gmail/auth to get the refresh token
 */

import { google } from 'googleapis'

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars')
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/gmail/callback`
  )

  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken })
  }

  return oauth2Client
}

export function getGmailClient() {
  const auth = getOAuth2Client()
  return google.gmail({ version: 'v1', auth })
}

/**
 * Search Gmail for BBS inquiry emails
 */
export async function searchBbsEmails(afterDate?: string, maxResults = 50) {
  const gmail = getGmailClient()

  let query = 'from:interest@bizbuysell.com'
  if (afterDate) {
    query += ` after:${afterDate}`
  }

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  })

  return response.data.messages || []
}

/**
 * Get full email content by message ID
 */
export async function getEmailContent(messageId: string): Promise<{
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  date: string
  body: string
}> {
  const gmail = getGmailClient()

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  const headers = response.data.payload?.headers || []
  const getHeader = (name: string) =>
    headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

  // Extract body text
  let body = ''
  const payload = response.data.payload

  if (payload?.body?.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8')
  } else if (payload?.parts) {
    // Multipart email — find text/plain or text/html
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    const part = textPart || htmlPart

    if (part?.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8')
    }
  }

  // Strip HTML tags if we got HTML
  if (body.includes('<html') || body.includes('<div')) {
    body = body
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return {
    id: response.data.id || messageId,
    threadId: response.data.threadId || '',
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: getHeader('To'),
    date: getHeader('Date'),
    body,
  }
}
