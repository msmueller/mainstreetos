import { NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/gmail/client'

/**
 * GET /api/gmail/callback
 * Handles the OAuth callback from Google.
 * Exchanges the authorization code for tokens and displays the refresh token.
 * Save the refresh token as GOOGLE_REFRESH_TOKEN in your .env.local
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'No authorization code received' }, { status: 400 })
    }

    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    // Return the refresh token so the user can save it
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Gmail Connected</title></head>
      <body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h1 style="color: #16a34a;">Gmail Connected Successfully</h1>
        <p>Copy this refresh token and add it to your <code>.env.local</code> file:</p>
        <pre style="background: #f1f5f9; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 14px;">GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || 'NOT_RETURNED — You may already have one stored'}</pre>
        <p style="color: #64748b; font-size: 14px;">
          Then restart your dev server or redeploy on Vercel with this env var set.
          <br/>You can close this window.
        </p>
      </body>
      </html>
    `

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to exchange code for tokens' },
      { status: 500 }
    )
  }
}
