#!/usr/bin/env node
/**
 * One-time Google OAuth refresh-token generator for Lead Router.
 *
 * Requests Gmail send/readonly/modify + Calendar readonly scopes against
 * the existing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env.local.
 *
 * Usage:
 *   node scripts/get-google-refresh-token.mjs
 *
 * On success, writes GOOGLE_OAUTH_REFRESH_TOKEN to .env.local.
 */

import { google } from 'googleapis';
import { createServer } from 'http';
import { URL } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '..', '.env.local');

function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    console.error(`Cannot find .env.local at: ${ENV_PATH}`);
    process.exit(1);
  }
  const text = readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

const env = loadEnv();
const CLIENT_ID = env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const PORT = 53682;
// Desktop OAuth clients in Google only accept bare loopback URIs (no path).
const REDIRECT = `http://localhost:${PORT}`;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('\n==============================================================');
console.log('  Google OAuth — Gmail + Calendar refresh-token generator');
console.log('==============================================================\n');
console.log('  Opening this URL in your default browser:\n');
console.log(`  ${authUrl}\n`);
console.log('  If the browser does not open, copy the URL above into a browser.\n');
console.log('  Sign in as markm@creresources.biz, then click Allow on each scope.');
console.log(`  Listening on ${REDIRECT} for the callback...\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // Desktop OAuth: Google redirects to http://localhost:PORT/?code=... — accept any path.
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    res.writeHead(400, { 'content-type': 'text/html' });
    res.end(`<h1>Auth failed</h1><p>${error}</p>`);
    console.error('Auth failed:', error);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.writeHead(400);
    res.end('Missing code');
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      res.writeHead(500, { 'content-type': 'text/html' });
      res.end(`<h1>No refresh token</h1><p>You may have previously authorized this app. Revoke at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> and rerun.</p>`);
      console.error('\nERROR: No refresh_token returned.');
      console.error('You may have previously authorized this app.');
      console.error('Revoke at https://myaccount.google.com/permissions and re-run.');
      server.close();
      process.exit(1);
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<h1>Done</h1><p>Refresh token captured. Return to your terminal.</p>');

    console.log('\n==============================================================');
    console.log('  SUCCESS — refresh token captured');
    console.log('==============================================================\n');
    console.log(`  GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log(`  Scopes: ${tokens.scope || '(see response)'}\n`);

    const envText = readFileSync(ENV_PATH, 'utf8');
    if (envText.includes('GOOGLE_OAUTH_REFRESH_TOKEN=')) {
      const updated = envText.replace(
        /GOOGLE_OAUTH_REFRESH_TOKEN=.*/g,
        `GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`
      );
      writeFileSync(ENV_PATH, updated);
      console.log('  Updated GOOGLE_OAUTH_REFRESH_TOKEN in .env.local\n');
    } else {
      const sep = envText.endsWith('\n') ? '' : '\n';
      writeFileSync(ENV_PATH, `${envText}${sep}GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      console.log('  Appended GOOGLE_OAUTH_REFRESH_TOKEN to .env.local\n');
    }

    server.close();
    process.exit(0);
  } catch (e) {
    console.error('Token exchange failed:', e.message);
    res.writeHead(500);
    res.end(`Token exchange failed: ${e.message}`);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  const opener =
    process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  try {
    spawn(opener, [authUrl], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // ignore — user can copy the URL manually
  }
});
