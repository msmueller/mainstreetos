# LEAD-ROUTER-SPEC.md (v2)

**Status:** v2 design — Paradigm B2 (direct Gmail API). Supersedes v1 (Saleshandy-based).
**Author:** Mark Mueller, with Claude (Opus 4.7) architecture sessions
**Created:** April 29, 2026
**Last updated:** April 29, 2026 (evening)
**Replaces:** v1 dated April 29, 2026 (morning)

## What changed from v1

v1 routed outbound through Saleshandy's API. v2 sends directly through Gmail API and owns the entire send/track/sequence stack inside MainStreetOS.

The reason: this is **inquiry-driven, relationship-bearing brokerage email**, not cold outreach. Recipients (buyers, sellers, attorneys, lenders, CPAs, co-brokers) expect emails to come from Mark Mueller's actual Gmail inbox. They will reply to that thread, eventually meet in person. Routing through a third-party SMTP layer creates the wrong signal and adds unnecessary cost. Send volume is low (5–30/day), so Saleshandy's deliverability infrastructure is overkill — Gmail's reputation on an established Workspace account on a real domain is better-suited.

The matcher, templating, Notion integration, Activity Log, and Supabase schema patterns from v1 carry forward. The send layer is replaced. New components: extractor, renderer, scheduler, calendar, gmail.

## Purpose

The Lead Router is the brain of MainStreetOS™'s outbound communication system. It takes a buyer inquiry email (typically from BizBuySell), and:

1. Extracts buyer attributes from the email body using Claude
2. Matches the inquiry to one of Mark's active listings using Claude
3. Picks the right template (per-listing → per-industry → generic fallback)
4. Renders the template with variables resolved from the lead, the listing, and external sources
5. Sends from Mark's Gmail account via Gmail API
6. Schedules follow-up sequence steps
7. Watches inbound Gmail for replies via Pub/Sub; cancels remaining sequence steps when a reply arrives
8. Logs every decision and engagement event

It owns the entire send/track/sequence stack — no third-party email engine.

## Why this exists

Existing tools assume the user knows which sequence each prospect belongs in. For inquiry-driven brokerage workflow, the matching and templating decision is the hard part. The Lead Router solves it. v2 also makes it the *send* engine, which removes vendor dependency and produces emails that look and feel like personal correspondence (because they are).

This is also the differentiated feature of MainStreetOS as a SaaS product. Architecture choices keep the productization path clean: templates are data not code, the matcher is configurable per broker, the sender interface is abstracted.

---

## Architecture overview

```
BizBuySell → Gmail Inbox
                 │
                 ▼ (Notion automation OR Gmail watch on incoming)
            Notion LEADS row created
                 │
                 ▼ (Notion webhook)
        ┌────────────────────────────────┐
        │   POST /api/router/route       │
        │                                │
        │   1. Extract buyer attributes  │  → extractor.ts (Claude)
        │   2. Match to listing          │  → matcher.ts (Claude)
        │   3. Pick template             │  → templates.ts (Supabase)
        │   4. Resolve variables         │  → renderer.ts
        │   5. Render subject + body     │  → renderer.ts
        │   6. Send via Gmail API        │  → gmail.ts
        │   7. Schedule follow-ups       │  → scheduler.ts
        │   8. Log everything            │  → notion.ts, sheets, supabase
        └────────┬───────────────────────┘
                 │
        ┌────────┼────────┬─────────────┐
        ▼        ▼        ▼             ▼
   Gmail API   Notion   Sheets    Supabase
   (send)     (update)  (log)     (schedule + audit)


Vercel cron (every 15 min)
        │
        ▼
   POST /api/router/cron/process-scheduled
        │
        ▼ (for each pending send)
   Check thread for reply → if reply, cancel
   Otherwise → render → send → log


Gmail Pub/Sub watch on Mark's inbox
        │
        ▼ (any new inbound message)
   POST /api/router/gmail/events
        │
        ▼
   Match to tracked thread_id
   Cancel pending scheduled_sends for thread
   Update Notion engagement
   Append to Activity Log
   Optionally classify reply intent via Claude
```

---

## Stack (existing — don't replace)

- **Frontend / API:** Next.js on Vercel (MainStreetOS repo)
- **Database / cache:** Supabase (Postgres + pgvector)
- **System of record:** Notion (Broker OS workspace — LEADS DB, Listings DB)
- **Email engine:** Gmail API (NEW in v2 — replaces Saleshandy)
- **Activity Log:** Google Sheet (Sheets MCP integration already deployed)
- **AI calls:** Anthropic API (Claude Opus 4.7)
- **Workflow glue:** Relay.app, GetSlap (still relevant for Notion automations)

---

## Repo structure

```
mainstreetos/
├── app/api/router/
│   ├── route/route.ts                    # Inbound: new Notion lead
│   ├── reroute/route.ts                  # Manual re-route
│   ├── health/route.ts                   # Health check
│   ├── cron/
│   │   ├── process-scheduled/route.ts    # Process pending sends
│   │   └── renew-gmail-watch/route.ts    # Renew Pub/Sub watch
│   └── gmail/
│       └── events/route.ts               # Gmail Pub/Sub webhook
├── lib/router/
│   ├── extractor.ts                      # Buyer attribute extraction
│   ├── matcher.ts                        # Listing match
│   ├── templates.ts                      # Template picker
│   ├── renderer.ts                       # Variable substitution
│   ├── sender.ts                         # Sender interface
│   ├── gmail.ts                          # Gmail API implementation
│   ├── scheduler.ts                      # Sequence scheduling
│   ├── calendar.ts                       # Calendar availability
│   ├── notion.ts                         # Notion wrapper
│   ├── supabase.ts                       # Supabase wrapper
│   ├── activity-log.ts                   # Sheets append helper
│   └── claude.ts                         # Anthropic SDK wrapper
├── prompts/router/
│   ├── extract-attributes.md
│   ├── match-listing.md
│   └── classify-reply.md                 # v1.1
├── vercel.json                           # Cron config
└── docs/
    └── LEAD-ROUTER-SPEC.md               # This file
```

---

## Data model

### Supabase tables (apply as new migration)

```sql
-- Templates
CREATE TABLE templates (
  id                    text PRIMARY KEY,
  name                  text NOT NULL,
  category              text NOT NULL,
  industry_tags         text[],
  listing_type          text,
  listing_id            text,                 -- per-listing override; nullable
  subject               text NOT NULL,
  body_html             text NOT NULL,
  body_text             text NOT NULL,
  variables             jsonb,
  active                boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_templates_listing
  ON templates(listing_id)
  WHERE listing_id IS NOT NULL;
CREATE INDEX idx_templates_category_active
  ON templates(category)
  WHERE active = true;

-- Sequences
CREATE TABLE sequences (
  id                    text PRIMARY KEY,
  name                  text NOT NULL,
  trigger_condition     text,
  description           text,
  active                boolean DEFAULT true
);

-- Sequence steps
CREATE TABLE sequence_steps (
  id                    serial PRIMARY KEY,
  sequence_id           text REFERENCES sequences(id),
  step_number           integer NOT NULL,
  delay_days            integer NOT NULL,
  template_id           text REFERENCES templates(id),
  stop_on_reply         boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_sequence_steps_unique
  ON sequence_steps(sequence_id, step_number);

-- Match decisions (audit log)
CREATE TABLE match_decisions (
  id                    serial PRIMARY KEY,
  lead_id               text NOT NULL,
  inquiry_email_id      text,
  matched_listing_id    text,
  match_confidence      numeric(3,2),
  match_reasoning       text,
  extracted_attributes  jsonb,
  template_id           text REFERENCES templates(id),
  sequence_id           text REFERENCES sequences(id),
  variables_used        jsonb,
  status                text,
  error                 text,
  created_at            timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_match_decisions_lead_id_active
  ON match_decisions(lead_id)
  WHERE status = 'enrolled';

-- Scheduled sends (cron processes this queue)
CREATE TABLE scheduled_sends (
  id                    serial PRIMARY KEY,
  lead_id               text NOT NULL,
  sequence_id           text NOT NULL,
  step_number           integer NOT NULL,
  template_id           text NOT NULL,
  scheduled_for         timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'pending',
  gmail_thread_id       text,
  gmail_message_id      text,
  send_attempts         integer DEFAULT 0,
  last_error            text,
  sent_at               timestamptz,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_scheduled_pending
  ON scheduled_sends(scheduled_for, status)
  WHERE status = 'pending';
CREATE INDEX idx_scheduled_thread
  ON scheduled_sends(gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL AND status = 'pending';

-- Tracked threads (lookup for inbound webhook)
CREATE TABLE tracked_threads (
  gmail_thread_id       text PRIMARY KEY,
  lead_id               text NOT NULL,
  matched_listing_id    text,
  first_message_at      timestamptz,
  last_outbound_at      timestamptz,
  last_inbound_at       timestamptz,
  reply_count           integer DEFAULT 0,
  status                text DEFAULT 'active',
  created_at            timestamptz DEFAULT now()
);

-- Listings cache (synced from Notion for fast match)
CREATE TABLE listings_cache (
  notion_id             text PRIMARY KEY,
  name                  text,
  listing_number        text,
  industry              text,
  naics                 text,
  location              text,
  asking_price          numeric,
  sde                   numeric,
  ebitda                numeric,
  status                text,
  description           text,
  keywords              text[],
  cobroker              text,
  om_link               text,
  cim_link              text,
  bvr_link              text,
  workbook_link         text,
  nda_link              text,
  bbs_link              text,
  last_synced           timestamptz DEFAULT now()
);

CREATE INDEX idx_listings_active
  ON listings_cache(status)
  WHERE status = 'active';

-- Suppression list (Phase 6)
CREATE TABLE suppressed_emails (
  email                 text PRIMARY KEY,
  reason                text,
  suppressed_at         timestamptz DEFAULT now()
);
```

### Notion LEADS DB additions

| Property | Type | Set by |
|---|---|---|
| `router_status` | Select: pending / routed / failed / manual_review | Lead Router |
| `matched_listing` | Relation → Listings DB | Lead Router |
| `match_confidence` | Number | Lead Router |
| `template_used` | Text | Lead Router |
| `sequence_enrolled` | Text | Lead Router |
| `gmail_thread_id` | Text | Lead Router |
| `last_engagement` | Date | Gmail webhook |
| `engagement_type` | Select: sent / replied / bounced | Gmail webhook |
| `buyer_first_name` | Text | Extractor |
| `buyer_last_name` | Text | Extractor |
| `buyer_phone` | Phone | Extractor |
| `buyer_investment_range` | Text | Extractor |
| `buyer_timeframe` | Text | Extractor |
| `buyer_experience` | Text | Extractor |
| `buyer_industry_interest` | Text | Extractor |
| `extraction_confidence` | Number | Extractor |
| `urgency_level` | Select: low / medium / high | Extractor |
| `sophistication_level` | Select: novice / experienced / broker | Extractor |

### Notion Listings DB additions

These may already exist; verify:

| Property | Type |
|---|---|
| `listing_number` | Text (BBS reference) |
| `om_link` | URL |
| `cim_link` | URL |
| `bvr_link` | URL |
| `workbook_link` | URL |
| `nda_link` | URL |
| `bbs_link` | URL |

---

## Component specs

### 1. `lib/router/extractor.ts`

Pulls structured buyer attributes from inquiry email body.

```typescript
export type ExtractedAttributes = {
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_investment_range: string | null;
  buyer_timeframe: string | null;
  buyer_experience: string | null;
  buyer_industry_interest: string | null;
  buyer_specific_listing_mentioned: string | null;
  urgency_level: 'low' | 'medium' | 'high' | 'unknown';
  sophistication_level: 'novice' | 'experienced' | 'broker' | 'unknown';
  extraction_confidence: number;
};

export async function extractAttributes(
  emailBody: string,
  sender: string
): Promise<ExtractedAttributes>;
```

System prompt at `prompts/router/extract-attributes.md`:

```
You are extracting structured information from a buyer inquiry email sent to a business broker. Extract ONLY information explicitly present in the email. Do NOT infer.

Return ONLY a JSON object matching this schema:

{
  "buyer_first_name": <string or null>,
  "buyer_last_name": <string or null>,
  "buyer_email": <string or null>,
  "buyer_phone": <string or null>,
  "buyer_investment_range": <string or null>,
  "buyer_timeframe": <string or null>,
  "buyer_experience": <string under 20 words or null>,
  "buyer_industry_interest": <string or null>,
  "buyer_specific_listing_mentioned": <string or null>,
  "urgency_level": "low" | "medium" | "high" | "unknown",
  "sophistication_level": "novice" | "experienced" | "broker" | "unknown",
  "extraction_confidence": <number 0.0 to 1.0>
}

Rules:
- For buyer_investment_range, preserve the buyer's wording ("$400K-$500K", "around half a million", "up to $2M")
- For buyer_timeframe, preserve the buyer's wording ("3-4 months", "by year-end", "ASAP")
- For buyer_experience, summarize in your own words but keep under 20 words
- urgency_level "high" requires explicit timeline language, financing pre-approval, or stated deadline
- sophistication_level "broker" requires broker designation in signature OR direct CIM/LOI request
- sophistication_level "experienced" requires use of SDE/EBITDA/multiple/recasting terms
- extraction_confidence reflects how much was extractable; 0.9+ if most fields present, 0.3 if only name/email

Output ONLY the JSON. No preamble. No markdown fencing.
```

### 2. `lib/router/matcher.ts` (carries from v1)

Same shape as v1 with one update: matcher receives `ExtractedAttributes` alongside the lead so it can use buyer-stated investment range and industry interest as match signals. Update the system prompt at `prompts/router/match-listing.md`:

```
## Use of extracted attributes

If buyer_specific_listing_mentioned is non-null and matches a listing name closely, set confidence ≥ 0.9 and pick that listing.

If buyer_investment_range is non-null, prefer listings whose asking_price falls within or near that range. A buyer saying "$400K-$500K" with a listing asking $475K is a strong match signal.

If buyer_industry_interest is non-null, weight industry-matching listings higher.
```

The rest of the v1 matcher prompt (confidence rubric, scenarios, sophistication signals, urgency signals, tie-breaking) carries forward unchanged.

### 3. `lib/router/templates.ts` — picker priority

```typescript
export async function pickTemplate({
  scenario,
  listing_id,
  industry,
}: {
  scenario: string;
  listing_id?: string | null;
  industry?: string | null;
}): Promise<Template> {
  const category = scenarioToCategory(scenario);

  // 1. Per-listing override
  if (listing_id) {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('category', category)
      .eq('listing_id', listing_id)
      .eq('active', true)
      .maybeSingle();
    if (data) return data;
  }

  // 2. Per-industry
  if (industry) {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('category', category)
      .contains('industry_tags', [industry])
      .is('listing_id', null)
      .eq('active', true)
      .maybeSingle();
    if (data) return data;
  }

  // 3. Generic fallback
  const { data } = await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .eq('listing_type', 'any')
    .is('listing_id', null)
    .eq('active', true)
    .maybeSingle();

  if (data) return data;
  throw new Error(`No template for scenario=${scenario} listing=${listing_id} industry=${industry}`);
}
```

### 4. `lib/router/renderer.ts` — variable substitution

Use Handlebars (`npm install handlebars`). Mature, safe, supports helpers.

```typescript
import Handlebars from 'handlebars';

export type RenderContext = {
  lead: NotionLead;
  listing: Listing | null;
  attrs: ExtractedAttributes;
  calendar_slots: string;
  env: { broker_name: string; broker_phone: string; broker_email: string; broker_firm: string };
};

export function renderTemplate(
  template: Template,
  ctx: RenderContext
): { subject: string; html: string; text: string };
```

Implementation requirements:

- Build a flat variable map from `ctx` covering every variable used in any template
- Apply per-template fallbacks for missing values (defined in template's `variables` jsonb metadata)
- HTML-escape user-supplied data in HTML body
- Preserve formatting in plain-text body
- Throw descriptive errors if a required variable has no value AND no fallback

Variable naming convention (flat): `buyer_first_name`, `listing_name`, `asking_price`, etc. See `EMAIL-TEMPLATE-001` for the full list used by the generic initial response template.

### 5. `lib/router/sender.ts` — sender interface

```typescript
export interface Sender {
  send(params: SendParams): Promise<SendResult>;
}

export type SendParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string;
  cc?: string[];
};

export type SendResult = {
  success: boolean;
  message_id: string;
  thread_id: string;
  provider: 'gmail' | 'saleshandy' | 'mixmax';
  error?: string;
};
```

Non-negotiable: even though only `gmail.ts` ships in v2, all sends go through `sender.send()` so future implementations swap cleanly.

### 6. `lib/router/gmail.ts` — Gmail API implementation

Uses `googleapis` SDK (`npm install googleapis`).

OAuth: extends the existing `cre-resources-claude` Google Cloud project (already set up for Sheets MCP). Add scopes:

```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar.readonly
```

Generate refresh token once via a CLI script; store as `GOOGLE_OAUTH_REFRESH_TOKEN` env var.

Core operations:

```typescript
import { google } from 'googleapis';

export class GmailSender implements Sender {
  async send(params: SendParams): Promise<SendResult> {
    // 1. Build RFC 2822 MIME multipart message (HTML + text alternative)
    // 2. Add In-Reply-To and References headers if threading
    // 3. Base64url encode the raw message
    // 4. POST to gmail.users.messages.send with userId='me' and threadId if provided
    // 5. Parse threadId and id from response
    // 6. Return SendResult { success, message_id, thread_id, provider: 'gmail' }
  }

  async getThread(threadId: string): Promise<Thread>;

  async hasReplyAfter(
    threadId: string,
    afterTimestamp: Date,
    fromMark: string
  ): Promise<boolean> {
    // Fetch thread, return true if any message in thread is FROM != fromMark AND date > afterTimestamp
  }

  async startWatch(): Promise<{ historyId: string; expiration: Date }>;

  async listHistorySince(historyId: string): Promise<HistoryItem[]>;
}
```

Gmail API gotchas:

- **Daily send limit:** 2,000/day for Workspace, 500/day free Gmail. Track in `scheduled_sends`; abort cron if approaching.
- **Pub/Sub watch expires every 7 days.** Renew via daily cron.
- **Threading requires `In-Reply-To` and `References`** headers using the original message's `Message-ID` (not Gmail's internal `id`). Subject must start with `Re: ` if threading.
- **Watch requires Pub/Sub topic + push subscription** with auth header pointing at `/api/router/gmail/events`.

### 7. `lib/router/scheduler.ts`

```typescript
export async function scheduleSequence({
  lead_id,
  sequence_id,
  initial_send_result,
}: {
  lead_id: string;
  sequence_id: string;
  initial_send_result: SendResult;
}): Promise<void> {
  // 1. Fetch sequence_steps for this sequence_id, ordered by step_number
  // 2. Step 1 already sent — skip
  // 3. For each remaining step, INSERT scheduled_sends with:
  //      scheduled_for = now() + delay_days
  //      gmail_thread_id = initial_send_result.thread_id
  //      status = 'pending'
}

export async function cancelPendingForThread(
  thread_id: string,
  reason: string
): Promise<number> {
  // UPDATE scheduled_sends
  //   SET status='cancelled', last_error=reason
  //   WHERE gmail_thread_id = thread_id AND status = 'pending'
  // Return affected row count.
}
```

### 8. `lib/router/calendar.ts`

```typescript
export async function getAvailableSlots({
  days_ahead = 5,
  slot_duration_minutes = 30,
  business_hours_start = 9,
  business_hours_end = 17,
  max_slots = 3,
}): Promise<string>;
```

Returns human-readable string like `"Tuesday at 2pm, Wednesday at 10am, or Thursday at 3pm"`. Falls back to `"any time that works for you"` on Calendar API failure.

Uses Google Calendar API freebusy query against Mark's primary calendar.

---

## API routes

### `POST /api/router/route` — main inbound

**Auth:** Shared secret in `x-router-secret` header.

**Query params:**
- `dry_run=true` — full flow without sending, scheduling, or updating Notion. Returns the would-be rendered email.

**Body:** `{ "lead_id": "notion-page-id" }`

**Flow:**
1. Verify auth.
2. Idempotency check on `match_decisions`.
3. Fetch lead from Notion (raw email body, sender info).
4. Call `extractor.extractAttributes()`.
5. Update Notion lead with extracted attributes.
6. Fetch active listings.
7. Call `matcher.matchListing()` with attributes injected.
8. If confidence < 0.6 → mark `manual_review` and return.
9. Determine `sequence_id` from `scenario` (look up `sequences.trigger_condition`).
10. Call `templates.pickTemplate()` for step 1.
11. Fetch matched listing details (from `listings_cache` or live Notion).
12. Call `calendar.getAvailableSlots()`.
13. Build `RenderContext`, call `renderer.renderTemplate()`.
14. If `dry_run=true` → return rendered email and exit.
15. Call `gmail.send()`.
16. Update Notion lead: `router_status='routed'`, `gmail_thread_id`, etc.
17. INSERT `tracked_threads` row.
18. Call `scheduler.scheduleSequence()` to queue follow-up steps.
19. Log to `match_decisions`.
20. Append to Activity Log Sheet.

### `POST /api/router/cron/process-scheduled`

Runs every 15 minutes via Vercel cron.

**Auth:** Vercel cron secret in `Authorization` header.

**Flow:**
1. Query `scheduled_sends WHERE status='pending' AND scheduled_for <= NOW()` ordered by `scheduled_for`, limit 50.
2. For each:
   a. Check `gmail.hasReplyAfter(thread_id, sequence_step_created_at, broker_email)` → if reply, mark `cancelled` (reason `'reply_received'`) and skip.
   b. Check `tracked_threads.status` → if not `active`, mark `cancelled` and skip.
   c. Check daily send count → if > 90% of limit, pause and alert.
   d. Check `suppressed_emails` → if recipient suppressed, mark `cancelled`.
   e. Otherwise: re-render template (latest listing data), send via Gmail, update `scheduled_sends.status='sent'`, log Activity.
   f. On error: increment `send_attempts`, set `last_error`. After 3 attempts, mark `failed`.
3. Return summary `{ processed, sent, cancelled, failed }`.

### `POST /api/router/cron/renew-gmail-watch`

Daily at 6am. Renews Gmail Pub/Sub watch (expires every 7 days).

### `POST /api/router/gmail/events` — Pub/Sub webhook

**Auth:** Verify Pub/Sub message JWT.

**Flow:**
1. Decode Pub/Sub message → contains new `historyId`.
2. Call `gmail.listHistorySince(previous_historyId)` to get changes.
3. For each new inbound message:
   a. Look up `tracked_threads` by `thread_id`.
   b. If found → cancel pending sends, update `tracked_threads`, update Notion engagement, append to Activity Log.
   c. (v1.1) Optionally classify reply intent via Claude.
4. Persist new `historyId`.

### `POST /api/router/reroute` — manual override

Cancels existing sequence sends, re-runs match logic with overrides, schedules new sequence. Body: `{ lead_id, force_listing_id?, force_template_id?, force_sequence_id? }`.

### `GET /api/router/health`

Returns 200 with status block per dependency (Anthropic, Notion, Supabase, Gmail).

### Vercel cron config (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/router/cron/process-scheduled",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/router/cron/renew-gmail-watch",
      "schedule": "0 6 * * *"
    }
  ]
}
```

---

## Environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...

NOTION_API_KEY=secret_...
NOTION_LEADS_DB_ID=...
NOTION_LISTINGS_DB_ID=...

SUPABASE_URL=https://djbtlhuncpxbxtjbrhsc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
GOOGLE_PUBSUB_TOPIC=projects/cre-resources-claude/topics/gmail-events

ROUTER_SECRET=...
VERCEL_CRON_SECRET=...

SHEETS_PIPELINE_ID=...
SHEETS_ACTIVITY_LOG_TAB=Activity Log

BROKER_NAME=Mark Mueller
BROKER_PHONE=...
BROKER_EMAIL=mark@creresources.biz
BROKER_FIRM=CRE Resources, LLC

NDA_LINK_DEFAULT=...
```

---

## Build order

### Phase 1: Google API setup (Day 1, evening)

- Open `cre-resources-claude` Google Cloud project.
- Enable Gmail API and Pub/Sub API.
- Add Gmail + Calendar scopes to existing OAuth consent screen.
- Generate Mark's Gmail refresh token via one-time CLI script.
- Create Pub/Sub topic `gmail-events` and a push subscription pointing at `/api/router/gmail/events` with auth.
- Save credentials to `.env.local`.

### Phase 2: Backbone (Days 2–3)

- Create `app/api/router/` and `lib/router/` directory structure.
- Apply Supabase migration.
- Build `lib/router/` wrappers (notion, supabase, claude, gmail, calendar).
- Build renderer with Handlebars.
- Build a CLI test script: render a template against a sample lead/listing. Iterate on output.
- Seed `templates` with the EMAIL-TEMPLATE-001 generic initial response.

### Phase 3: Extractor + matcher (Days 4–5)

- Build `extractor.ts` with `extract-attributes.md` prompt.
- Test against 5 real BBS inquiries (read-only). Verify field extraction matches Mark's judgment.
- Build `matcher.ts` (from v1) with attribute-aware updates.
- Test end-to-end: real inquiry → extraction → matching, no sending.

### Phase 4: Sender + dry-run end-to-end (Day 6)

- Build `gmail.send()`.
- Test sending one email mark@creresources.biz → mark@creresources.biz with a real listing and a personal inquiry.
- Wire up `/api/router/route` with `dry_run=true` default for first 3 days.
- Test against 5 real recent leads in dry-run. Review rendered output before any real sends.

### Phase 5: Live wiring with safety rails (Day 7)

- Notion automation: new lead with `router_status='pending'` → POST to `/api/router/route`.
- First 3 leads: dry-run only. Mark reviews each.
- After 3 successful dry-runs, flip default to live sending.
- Manual review queue: Notion view filtered to `router_status='manual_review'`.

### Phase 6: Sequencing + cron (Week 2)

- Build `scheduler.ts`.
- Seed `sequences` and `sequence_steps` with starter sequences (Initial → Day 3 → Day 7 → Day 14).
- Build `/api/router/cron/process-scheduled`.
- Wire Vercel cron.
- Run cron in dry-run mode for 24 hours to verify behavior.
- Flip to live.
- Add `suppressed_emails` table and pre-send check.

### Phase 7: Reply detection (Week 2–3)

- Set up Pub/Sub watch on Mark's inbox.
- Build `/api/router/gmail/events` handler.
- Wire reply detection → cancel pending sends + Notion update + Activity Log.
- Daily cron renews Pub/Sub watch.

### Phase 8: Refinements (Week 3+)

- Per-listing template overrides (La Guardiola, RE Farm Cafe, Yogi, Philly Pretzel Ewing).
- Reply intent classifier (Claude classifies as scheduling / question / declining / ghosting).
- `/api/router/reroute` endpoint.
- Co-broker logic (cc Sung Yun on co-brokered leads).
- Dashboard in MainStreetOS UI: pending queue, recent matches, reply rate by template.

---

## Non-negotiable safety rails

1. **`dry_run=true` is the default for the first 3 days of live operation.** No real emails until extractor, matcher, and renderer are validated against ≥ 5 real leads.
2. **Every routing decision logged to `match_decisions`** with full reasoning.
3. **Buyer email bodies never appear in plaintext logs outside Supabase.** No `console.log`, no error-message inclusion.
4. **Idempotency check on `lead_id`** before enrolling.
5. **Low-confidence matches (< 0.6) → manual review.** Never auto-enroll.
6. **Daily send limit guard.** Cron aborts and alerts at 90% of Gmail daily limit.
7. **Suppression list enforced before every send.**
8. **Reply detection MUST cancel pending sends.** Critical to avoid sending "haven't heard from you" after the buyer already replied.
9. **Sender abstraction (`Sender` interface) is non-negotiable from day one.** Even though only `gmail.ts` ships in v2.
10. **HTML escaping on all user-supplied data.** Buyer name from extraction goes through escape in renderer.

---

## Productization considerations

When MainStreetOS becomes a SaaS product:

- **Templates:** add `broker_id` foreign key. Each broker has their own library.
- **Per-broker Gmail OAuth:** each broker connects their own Gmail. Refresh tokens encrypted (Supabase Vault).
- **Per-broker Notion workspace:** broker provides API key + workspace IDs.
- **Sender choice:** brokers choose Gmail (default) or Saleshandy/Mixmax via the same `Sender` interface.
- **Sequence library:** ship with starter sequences brokers clone and customize.
- **Pricing tier:** Lead Router = differentiator at $497–$1,497/mo.
- **Compliance:** unsubscribe link rendering, suppression list per broker, CAN-SPAM audit before SaaS launch.

---

## Known gaps and v1.1 candidates

- HMAC signature verification on inbound webhooks (current: shared secret)
- Exponential backoff on Gmail API failures
- "Teach the matcher" feedback loop (Mark marks a match wrong → tunes prompt)
- Reply intent classifier
- Test suite for matcher (golden test cases)
- Observability — Sentry/Logtail
- Suppression list management UI
- Per-listing NDA tokenized links (gated CIM/BVR access, auto-revoke)
- Mobile-friendly review queue (PWA in MainStreetOS)

---

## References

- Gmail API: https://developers.google.com/workspace/gmail/api/reference/rest
- Gmail Pub/Sub watch: https://developers.google.com/workspace/gmail/api/guides/push
- Google Calendar API: https://developers.google.com/calendar/api/v3/reference
- Anthropic API SDK: https://docs.claude.com/en/api/client-sdks
- Existing Sheets MCP setup: `~/.config/claude-mcp/`
- v1 spec (superseded): see git history before this commit

---

## Glossary

- **BBS** — BizBuySell, primary lead source
- **CIM** — Confidential Information Memorandum, post-NDA
- **CSRP** — Company-Specific Risk Premium
- **DD** — Due Diligence
- **LOI** — Letter of Intent
- **NDA** — Non-Disclosure Agreement
- **OM** — Offering Memorandum, pre-NDA marketing
- **SDE** — Seller's Discretionary Earnings
- **BVR** — Business Valuation Report
