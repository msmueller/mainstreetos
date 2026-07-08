# Public "Start NDA" page — deploy & test runbook

Feature branch: `feat/nda-public-start-page` (commits `e619f36`, `0e8aa2c`).
Everything ships **dark**: `NDA_PUBLIC_PAGE=off` → the page and the API 404.
Nothing is live in production until you set the flag.

A throwaway test listing is already seeded: **`/nda/test-public-nda`**
(business "Test Listing — Do Not Contact", template `NDA_BuyerProfile`,
`notion_page_id = null` so no Notion side effects). Delete it after testing
(SQL at the bottom).

---

## 1. Push + deploy to a PREVIEW (not production)

```bash
git push -u origin feat/nda-public-start-page
```

Open a Vercel **Preview** deployment for the branch. Keep production untouched.

> Note: this session's sandbox could not `git push` (no creds) and left a stray
> empty `.git/index.lock`. On your machine: `rm -f .git/index.lock` then
> `git status` — the two commits are already in place; the lock is cosmetic.

## 2. Preview environment variables

Reuses the existing click-wrap config; the only NEW keys are the last three.

| Var | Value |
|---|---|
| `SUPABASE_URL` | prod project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service role |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `BROKER_NOTIFY_TO` | as prod |
| `BROKER_SIGNATURE_URL` | signed URL to `mark-signature.png` |
| `NEXT_PUBLIC_APP_URL` | the preview URL |
| `NOTION_API_KEY` | as prod (only used if the sync flag is on) |
| **`TURNSTILE_SECRET_KEY`** | Cloudflare Turnstile secret |
| **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** | Cloudflare Turnstile site key |
| **`NDA_PUBLIC_PAGE`** | `on` (preview only) |
| `NDA_NOTION_SYNC` | `off` for the first pass (leave prod dark) |

**First dry run without a real captcha:** use Cloudflare's always-pass test keys
so `request-otp` succeeds without solving a widget:
site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.
Swap to your real keys before enabling for buyers.

## 3. Manual test (experience it as a buyer)

1. Open `<preview>/nda/test-public-nda`. It should render the NDA + Buyer Profile.
2. With the flag **off**, confirm `<preview>/nda/test-public-nda` returns 404.
3. Enter **your own** name + email, complete the Turnstile check.
4. Click **Email me a verification code** → you receive a 6-digit code.
5. Enter the code, fill the required fields (Address, Liquid Cash, Primary
   Funding Source, Phone), tick both consent + acknowledgment, type your full
   legal name, click **Sign and Submit**.
6. Expect the "Signature recorded" screen + a signed-copy email + a broker
   notification to `markm@creresources.biz`.

## 4. Verify (run in Supabase SQL, prod project `djbtlhuncpxbxtjbrhsc`)

```sql
-- the new envelope
select envelope_number, template_key, status, listing_business_name,
       signed_pdf_path, audit_pdf_path, notion_lead_id, notion_synced_at
from sign_envelopes
where listing_business_name = 'Test Listing — Do Not Contact'
order by created_at desc limit 1;

-- signers: broker auto-signed + buyer auto_completed, both 'signed'
select role, email, status, auto_completed, signed_at
from sign_signers
where envelope_id = (select id from sign_envelopes
                     where listing_business_name='Test Listing — Do Not Contact'
                     order by created_at desc limit 1)
order by signing_order;

-- event chronology: envelope.created → signer.signed(broker) →
-- envelope.opened → consent.given → signer.agreed → validation.passed →
-- signer.signed(buyer) → envelope.signed
select event_type, occurred_at
from sign_events
where envelope_id = (select id from sign_envelopes
                     where listing_business_name='Test Listing — Do Not Contact'
                     order by created_at desc limit 1)
order by occurred_at;

-- audit chain integrity (must be 'consistent')
select envelope_number, integrity_status
from v_sign_audit_chain
where envelope_number = (select max(envelope_number) from sign_envelopes);
```

Also confirm the two PDFs exist in Storage buckets `signed-documents` and
`audit-certificates` under the envelope id.

## 5. Dedup + edge checks

- Re-submit the **same email** for the test slug → response `alreadySigned: true`,
  **no** second completed envelope.
- Wrong OTP → rejected; expired/after-5-attempts → rejected.
- Unknown slug (`/nda/nope`) → 404.

## 6. Go live (after the NJ-attorney gate — already signed off per §8)

1. Set `NDA_PUBLIC_PAGE=on` in **production**.
2. After the test pass looks right, set `NDA_NOTION_SYNC=on` so completions
   advance the Notion LEAD (Pipeline Stage → "3. NDA Executed", Status → Active).
3. Swap the interim links in the Email #1 templates (spec §11) to:
   - `https://mainstreetos.biz/nda/yogi-international`
   - `https://mainstreetos.biz/nda/royal-silk`

## 7. Cleanup the test data

```sql
-- test envelopes (and their children cascade if FKs are ON DELETE CASCADE;
-- otherwise delete signatures/signers/events first)
delete from sign_envelopes where listing_business_name = 'Test Listing — Do Not Contact';
-- the test listing
delete from seller_listings where nda_public_slug = 'test-public-nda';
```
