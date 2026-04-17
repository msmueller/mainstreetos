import { NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/gmail/client'

/**
 * GET /api/gmail/auth
 * Redirects to Google OAuth consent screen to authorize Gmail access.
 * After authorization, Google redirects back to /api/gmail/callback.
 */
export async function GET() {
  try {
    const oauth2Client = getOAuth2Client()

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
    })

    return NextResponse.redirect(authUrl)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate auth URL' },
      { status: 500 }
    )
  }
}
