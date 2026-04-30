# LEAD-ROUTER-SPEC.md

**Status:** v1 design — ready to build
**Author:** Mark Mueller, with Claude (Opus 4.7) architecture session
**Created:** April 29, 2026
**Last updated:** April 29, 2026

## Purpose

The Lead Router is the brain of the MainStreetOS™ outbound communication system. It takes a buyer inquiry email (typically from BizBuySell) and decides:

1. Which active listing the buyer is asking about
2. Which email template best fits this scenario
3. What deal data should populate the template
4. Which email sequence to enroll the prospect in
5. How to log the decision and engagement events back to the system of record

It does NOT send email. Saleshandy sends email. The Lead Router is the matching, decisioning, and orchestration layer that sits in front of Saleshandy and connects it to Notion (system of record), Supabase (state and templates), and a Google Sheets Activity Log.

## Why this exists

Existing email tools (Gmelius, Saleshandy, Lemlist, Klenty, etc.) assume the user knows which sequence each prospect belongs in. For inquiry-driven brokerage workflow — where a buyer emails about one of N active listings — that decision is the hard part. The Lead Router solves it.

This is also a productization candidate for the MainStreetOS SaaS tier ($497–$1,497/mo). Architecture choices throughout this spec keep that path clean: templates are data not code, the matcher is configurable per broker, integrations are decoupled.

---

## Architecture overview

```
BizBuySell → Gmail → GetSlap → Notion LEADS row
                                     │
                                     ▼ (Notion automation webhook)
                          ┌──────────────────────────┐
                          │   POST /api/route        │
                          │   Lead Router            │
                          │                          │
                          │   1. Fetch lead context  │
                          │   2. Match to listing    │
                          │   3. Pick template       │
                          │   4. Populate variables  │
                          │   5. Enroll in sequence  │
                          │   6. Log everything      │
                          └────────┬─────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                      ▼
     Saleshandy API           Notion API          Sheets MCP / API
     (POST prospect          (update LEAD row     (append to
      to sequence)            with match data)     Activity Log)


Saleshandy → webhook events → POST /api/saleshandy/events
                                     │
                                     ▼
                          Update Notion + Activity Log
                          Trigger stage transition if reply
```

---

## Repo structure

The Lead Router lives inside the MainStreetOS Next.js app. Two valid placements:

**Option A (recommended for v1):** Inline under the main app
```
mainstreetos/
├── app/
│   └── api/
│       └── router/
│           ├── route/route.ts
│           ├── saleshandy/
│           │   └── events/route.ts
│           ├── reroute/route.ts
│           └── health/route.ts
├── lib/
│   └── router/
│       ├── matcher.ts
│       ├── templates.ts
│       ├── saleshandy.ts
│       ├── notion.ts
│       ├── supabase.ts
│       ├── activity-log.ts
│       └── claude.ts
└── prompts/
    └── router/
        ├── match-listing.md
        └── pick-template.md
```

**Option B:** Separate workspace package (`apps/lead-router/`) — defer until productization.

---

## Data model

### Supabase tables (new)

```sql
-- Templates: source of truth for outbound copy
CREATE TABLE templates (
  id                    text PRIMARY KEY,
  name                  text NOT NULL,
  category              text NOT NULL,
  industry_tags         text[],
  listing_type          text,
  subject               text NOT NULL,
  body_html             text NOT NULL,
  body_text             text NOT NULL,
  variables             jsonb,
  saleshandy_step_id    text,
  active                boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Sequences: which Saleshandy sequence handles which scenario
CREATE TABLE sequences (
  id                    text PRIMARY KEY,
  name                  text NOT NULL,
  saleshandy_seq_id     text NOT NULL,
  trigger_condition     text,
  description           text,
  active                boolean DEFAULT true
);

-- Match log: every routing decision
CREATE TABLE match_decisions (
  id                    serial PRIMARY KEY,
  lead_id               text NOT NULL,
  inquiry_email_id      text,
  matched_listing_id    text,
  match_confidence      numeric(3,2),
  match_reasoning       text,
  template_id           text REFERENCES templates(id),
  sequence_id           text REFERENCES sequences(id),
  variables_used        jsonb,
  saleshandy_prospect_id text,
  status                text,
  error                 text,
  created_at            timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_match_decisions_lead_id_active
  ON match_decisions (lead_id)
  WHERE status = 'enrolled';

-- Listings cache: synced from Notion for fast matching
CREATE TABLE listings_cache (
  notion_id             text PRIMARY KEY,
  name                  text,
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
  last_synced           timestamptz DEFAULT now()
);

CREATE INDEX idx_listings_active ON listings_cache (status) WHERE status = 'active';
```

### Category enum (templates.category)

- `initial_response` — first reply to inquiry
- `nda_request` — sending NDA
- `cim_followup` — after CIM has been sent
- `loi_received` — when LOI comes in
- `due_diligence` — DD coordination
- `closing` — closing logistics
- `unmatched` — fallback when no listing matches

### Trigger condition enum (sequences.trigger_condition)

- `new_buyer` — first time hearing from this email
- `returning_buyer` — buyer has prior history
- `multi_interest` — buyer asked about multiple listings
- `cobroker_referral` — Sung Yun (or other) referred
- `unmatched` — couldn't match to a listing

### Notion LEADS DB additions

| Property | Type | Set by |
|---|---|---|
| `router_status` | Select: pending / routed / failed / manual_review | Lead Router |
| `matched_listing` | Relation → Listings DB | Lead Router |
| `match_confidence` | Number | Lead Router |
| `template_used` | Text | Lead Router |
| `sequence_enrolled` | Text | Lead Router |
| `saleshandy_prospect_id` | Text | Lead Router |
| `last_engagement` | Date | Saleshandy webhook |
| `engagement_type` | Select: sent / opened / clicked / replied / bounced | Saleshandy webhook |

---

## API routes

### `POST /api/router/route`

**Purpose:** Main inbound — Notion webhook calls this when a new lead row is created with `router_status = pending`.

**Auth:** Shared secret in `x-router-secret` header. Compared against `process.env.ROUTER_SECRET`.

**Query params:**
- `dry_run=true` — runs the full match + template logic, returns the would-be result, but does NOT call Saleshandy or update Notion.

**Request body:**
```json
{
  "lead_id": "notion-page-id-here"
}
```

**Response (success):**
```json
{
  "status": "routed",
  "match": {
    "listing_id": "...",
    "confidence": 0.87,
    "scenario": "new_buyer",
    "reasoning": "..."
  },
  "template": "tpl_pizzeria_initial",
  "saleshandy_prospect_id": "..."
}
```

**Response (low confidence):**
```json
{
  "status": "manual_review",
  "match": { ... }
}
```

**Implementation outline:**

```typescript
export async function POST(req: NextRequest) {
  // Auth check
  const auth = req.headers.get('x-router-secret');
  if (auth !== process.env.ROUTER_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const { lead_id } = await req.json();
  if (!lead_id) {
    return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  }

  // Idempotency check
  const existing = await checkExistingEnrollment(lead_id);
  if (existing && !dryRun) {
    return NextResponse.json({
      status: 'already_routed',
      saleshandy_prospect_id: existing.saleshandy_prospect_id
    });
  }

  try {
    const lead = await fetchLeadContext(lead_id);
    const listings = await fetchActiveListings();
    const match = await matchListing({ lead, listings });

    if (match.confidence < 0.6) {
      if (!dryRun) await markForManualReview(lead_id, match);
      return NextResponse.json({ status: 'manual_review', match });
    }

    const template = await pickTemplate({
      scenario: match.scenario,
      listing_id: match.matched_listing_id,
      industry: match.industry,
    });

    const variables = await populateVariables({
      template,
      lead,
      listing_id: match.matched_listing_id,
    });

    if (dryRun) {
      return NextResponse.json({
        status: 'dry_run',
        match,
        template: template.id,
        variables,
      });
    }

    const saleshandyResult = await enrollProspect({
      email: lead.buyer_email,
      first_name: lead.buyer_first_name,
      last_name: lead.buyer_last_name,
      sequence_step_id: template.saleshandy_step_id,
      custom_fields: variables,
    });

    await updateNotionLead(lead_id, {
      router_status: 'routed',
      matched_listing: match.matched_listing_id,
      match_confidence: match.confidence,
      template_used: template.id,
      sequence_enrolled: template.sequence_id,
      saleshandy_prospect_id: saleshandyResult.prospect_id,
    });

    await logMatchDecision({
      lead_id,
      matched_listing_id: match.matched_listing_id,
      match_confidence: match.confidence,
      match_reasoning: match.reasoning,
      template_id: template.id,
      sequence_id: template.sequence_id,
      variables_used: variables,
      saleshandy_prospect_id: saleshandyResult.prospect_id,
      status: 'enrolled',
    });

    await appendActivity({
      lead_id,
      business_name: match.business_name,
      direction: 'Outbound',
      type: 'Email',
      subject: `Routed: ${template.name}`,
      outcome: 'Sent',
      notes: `Matched to ${match.business_name} (confidence ${match.confidence}). Template: ${template.id}.`,
    });

    return NextResponse.json({
      status: 'routed',
      match,
      template: template.id,
      saleshandy_prospect_id: saleshandyResult.prospect_id,
    });
  } catch (err: any) {
    console.error('Router error:', err.message);
    await logMatchDecision({
      lead_id,
      status: 'failed',
      error: err.message,
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### `POST /api/router/saleshandy/events`

**Purpose:** Receives Saleshandy webhook events (open, click, reply, bounce) and updates Notion + Activity Log.

**Auth:** Custom header set when configuring webhook in Saleshandy dashboard.

**Implementation outline:**

```typescript
export async function POST(req: NextRequest) {
  const event = await req.json();

  const lead = await findLeadBySaleshandyId(event.prospect_id);
  if (!lead) {
    return NextResponse.json({ status: 'unknown_prospect' });
  }

  await updateNotionLead(lead.id, {
    last_engagement: new Date(event.timestamp),
    engagement_type: event.type.replace('email.', ''),
  });

  await appendActivity({
    lead_id: lead.id,
    business_name: lead.matched_listing_name,
    direction: 'Inbound',
    type: 'Email',
    subject: event.data?.subject ?? '',
    outcome: event.type === 'email.replied' ? 'Replied' : event.type.replace('email.', ''),
  });

  if (event.type === 'email.replied') {
    await triggerStageTransition(lead.id, event.data?.body);
  }

  return NextResponse.json({ status: 'logged' });
}
```

### `POST /api/router/reroute`

**Purpose:** Manually re-route a lead. Useful when the initial match was wrong, or when claude.ai (via the MCP) needs to update routing.

**Auth:** Shared secret.

**Body:** `{ lead_id, force?: boolean }`

Defer implementation until v1.1.

### `GET /api/router/health`

**Purpose:** Health check + connectivity test for SH, Notion, Supabase. Returns 200 if all three respond.

---

## The matcher (the only Claude API call)

This is the heart of the system. Keep it tight, structured, and fast.

### `lib/router/matcher.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const client = new Anthropic();

let cachedSystemPrompt: string | null = null;

async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = await fs.readFile(
    path.join(process.cwd(), 'prompts/router/match-listing.md'),
    'utf-8'
  );
  return cachedSystemPrompt;
}

export type MatchResult = {
  matched_listing_index: number | null;
  matched_listing_id: string | null;
  business_name: string | null;
  industry: string | null;
  confidence: number;
  scenario: 'new_buyer' | 'returning_buyer' | 'multi_interest' | 'cobroker_referral' | 'unmatched';
  reasoning: string;
  buyer_sophistication: 'novice' | 'experienced' | 'broker' | 'unknown';
  urgency_signal: 'low' | 'medium' | 'high';
};

export async function matchListing({
  lead,
  listings,
}: {
  lead: LeadContext;
  listings: Listing[];
}): Promise<MatchResult> {
  const systemPrompt = await getSystemPrompt();

  const userMessage = `
# Inquiry Email
From: ${lead.buyer_email}
Subject: ${lead.email_subject}
Body:
${lead.email_body}

# Lead metadata
Source: ${lead.source}
Inquiry date: ${lead.created_at}
Co-broker referral: ${lead.cobroker ?? 'none'}
Previous interactions: ${lead.previous_interactions_count}

# Active Listings
${listings.map((l, i) => `
[${i}] ${l.name}
  ID: ${l.notion_id}
  Industry: ${l.industry} (NAICS ${l.naics})
  Location: ${l.location}
  Asking: $${l.asking_price?.toLocaleString() ?? 'N/A'}
  SDE: $${l.sde?.toLocaleString() ?? 'N/A'}
  Co-broker: ${l.cobroker ?? 'none'}
  Description: ${l.description}
  Keywords: ${l.keywords?.join(', ') ?? ''}
`).join('\n')}

Return ONLY a JSON object matching the schema in your system prompt. No preamble. No markdown fencing.
`.trim();

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as MatchResult;
  } catch (err) {
    throw new Error(`Matcher returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}
```

### `prompts/router/match-listing.md`

```markdown
You are a business brokerage assistant for CRE Resources, LLC. Your job is to match a buyer inquiry email to one of the broker's active listings, or determine that no match exists.

## Output schema

Return ONLY this JSON object. No preamble. No markdown fencing.

{
  "matched_listing_index": <integer index from listings array, or null>,
  "matched_listing_id": <Notion ID string, or null>,
  "business_name": <listing name string, or null>,
  "industry": <industry string, or null>,
  "confidence": <number 0.0 to 1.0>,
  "scenario": "new_buyer" | "returning_buyer" | "multi_interest" | "cobroker_referral" | "unmatched",
  "reasoning": "<one sentence explaining the match>",
  "buyer_sophistication": "novice" | "experienced" | "broker" | "unknown",
  "urgency_signal": "low" | "medium" | "high"
}

## Confidence scoring

- 0.9+ : Email explicitly names the listing OR includes the BizBuySell listing reference number.
- 0.7–0.9 : Strong industry + location + price range alignment, but no explicit name reference.
- 0.5–0.7 : Industry match only, weak other signals.
- < 0.5 : Likely unmatched. Recommend manual review (set scenario = "unmatched").

## Scenarios

- "new_buyer" : First contact from this email address (previous_interactions_count = 0).
- "returning_buyer" : previous_interactions_count > 0.
- "multi_interest" : Email mentions multiple listings or asks about a portfolio.
- "cobroker_referral" : Lead has a non-null co-broker on the inquiry.
- "unmatched" : No reasonable match. Confidence MUST be < 0.5.

## Sophistication signals

- "broker" : email signature includes broker designation, mentions deal terms, asks for CIM or LOI directly.
- "experienced" : uses terms like SDE, EBITDA, multiple, recasting; asks intelligent diligence questions.
- "novice" : asks "what's the price" or "how much money does it make"; unfamiliar with NDA process.
- "unknown" : insufficient signal.

## Urgency signals

- "high" : explicit timeline, mentions financing pre-approval, "ready to move quickly," etc.
- "medium" : engaged but no explicit urgency.
- "low" : tire-kicker, vague interest.

## Tie-breaking

If two listings score equally well:
1. Prefer the listing where industry + NAICS exactly matches.
2. Then prefer the listing where price band is closest to any price the buyer mentioned.
3. Then prefer the listing where location is closest to anything the buyer mentioned.
4. If still tied, set scenario = "multi_interest" and pick the higher-asking-price listing.
```

---

## Template registry

Templates are stored in Supabase. They reference Saleshandy step IDs (which are sequence-step bindings). When a template is "picked," the Router enrolls the prospect at that specific step.

### `lib/router/templates.ts`

```typescript
export async function pickTemplate({
  scenario,
  listing_id,
  industry,
}: {
  scenario: string;
  listing_id?: string | null;
  industry?: string | null;
}) {
  const category = scenarioToCategory(scenario);

  // 1. Industry-specific match
  if (industry) {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('category', category)
      .contains('industry_tags', [industry])
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // 2. Generic for this category
  const { data: generic } = await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .eq('listing_type', 'any')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (generic) return generic;

  // 3. Fallback
  throw new Error(`No template found for scenario=${scenario} industry=${industry}`);
}

function scenarioToCategory(scenario: string): string {
  switch (scenario) {
    case 'new_buyer':
    case 'returning_buyer':
    case 'cobroker_referral':
      return 'initial_response';
    case 'multi_interest':
      return 'initial_response';
    case 'unmatched':
      return 'unmatched';
    default:
      return 'initial_response';
  }
}

export async function populateVariables({
  template,
  lead,
  listing_id,
}: {
  template: Template;
  lead: LeadContext;
  listing_id: string | null;
}): Promise<Record<string, string>> {
  const listing = listing_id ? await fetchListing(listing_id) : null;

  return {
    business_name: listing?.name ?? '[Listing]',
    asking_price: listing?.asking_price
      ? `$${listing.asking_price.toLocaleString()}`
      : 'available upon request',
    sde: listing?.sde ? `$${listing.sde.toLocaleString()}` : 'N/A',
    industry: listing?.industry ?? '',
    location: listing?.location ?? '',
    buyer_first_name: lead.buyer_first_name ?? 'there',
    broker_name: 'Mark Mueller',
    broker_firm: 'CRE Resources, LLC',
    broker_phone: process.env.BROKER_PHONE ?? '',
    broker_email: process.env.BROKER_EMAIL ?? '',
    nda_link: process.env.NDA_LINK ?? '',
  };
}
```

In Saleshandy, templates use `{{variable_name}}` placeholders. These are passed via the `customFields` parameter on the prospect-add API call.

---

## Saleshandy client

### `lib/router/saleshandy.ts`

```typescript
const SH_BASE = 'https://open-api.saleshandy.com/v1';

async function shRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SH_BASE}${path}`, {
    ...options,
    headers: {
      'x-api-key': process.env.SALESHANDY_API_KEY!,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Saleshandy API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function enrollProspect({
  email,
  first_name,
  last_name,
  sequence_step_id,
  custom_fields,
}: {
  email: string;
  first_name?: string;
  last_name?: string;
  sequence_step_id: string;
  custom_fields: Record<string, string>;
}) {
  const result = await shRequest('/prospects', {
    method: 'POST',
    body: JSON.stringify({
      email,
      firstName: first_name,
      lastName: last_name,
      stepId: sequence_step_id,
      customFields: custom_fields,
    }),
  });
  return { prospect_id: result.payload.prospect.id };
}

export async function listSequences() {
  return shRequest('/sequences');
}

export async function pauseProspect(prospect_id: string) {
  return shRequest(`/prospects/${prospect_id}/pause`, { method: 'POST' });
}
```

NOTE: API endpoint paths above are based on the Saleshandy public docs as of April 2026. Verify exact path and field names against the live API doc at `https://developer.saleshandy.com/api-reference/introduction` and adjust if needed.

---

## Environment variables

```bash
# .env.local additions
ANTHROPIC_API_KEY=sk-ant-...
SALESHANDY_API_KEY=...
NOTION_API_KEY=secret_...
NOTION_LEADS_DB_ID=...
NOTION_LISTINGS_DB_ID=...
SUPABASE_URL=https://djbtlhuncpxbxtjbrhsc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ROUTER_SECRET=<random_string_for_inbound_webhook_auth>
SHEETS_PIPELINE_ID=<google_sheet_id>
BROKER_PHONE=...
BROKER_EMAIL=mark@creresources.biz
NDA_LINK=<your_nda_link>
```

---

## Build order

### Phase 1: Saleshandy migration (Day 1, complete tonight)
- Saleshandy account set up
- Gmail / sending domain connected
- Top 3–5 templates migrated from Gmelius
- 1–2 active sequences recreated
- API key generated, stored in env
- `stepId` for each sequence's first step recorded

### Phase 2: Backbone scaffolding (Days 2–3)
- Create directory structure under `app/api/router/` and `lib/router/`
- Build the four lib wrappers (saleshandy, notion, supabase, claude)
- Apply Supabase migration (the four new tables)
- Health check route working
- Manually test `enrollProspect` from a script — confirm one test prospect lands in Saleshandy correctly

### Phase 3: Matcher only, no enrollment (Days 4–5)
- Build `matchListing` against `match-listing.md`
- Test against 5–10 real recent leads (read-only mode)
- Tune the prompt until confidence aligns with judgment
- This is the riskiest part of the build — spend time here

### Phase 4: Templates + variables (Day 6)
- Seed `templates` table with 3–5 templates
- Build `pickTemplate` and `populateVariables`
- End-to-end test in dry-run mode

### Phase 5: Live wiring with safety rails (Day 7)
- `dry_run=true` query param on `/api/router/route`
- Notion automation: new lead with `router_status = pending` → POST to endpoint
- Run on 1 lead manually first
- Verify SH enrollment, Notion update, Activity Log append
- Allow next 3–5 leads to route automatically with monitoring

### Phase 6: Webhooks + closed loop (Week 2)
- Saleshandy webhooks → `/api/router/saleshandy/events`
- Engagement events flow to Notion + Activity Log
- Reply detection → stage transition logic
- Manual review queue (Notion view filtered to `router_status = manual_review`)

### Phase 7: Refinements (Week 3+)
- `/api/router/reroute` endpoint
- Per-listing template overrides
- Co-broker logic (cc Sung Yun on co-brokered leads)
- Small dashboard showing match quality and sequence performance

---

## Non-negotiable safety rails

1. **`dry_run=true` must be the default for all initial testing.** No real emails go out until the matcher and templates are validated against at least 5 real leads.
2. **Every routing decision is logged to `match_decisions` with full reasoning.** Audit trail is mandatory.
3. **Buyer email bodies never appear in plaintext logs outside Supabase.** No `console.log`, no error message includes them.
4. **Idempotency check on `lead_id`.** If a lead has already been routed (status = enrolled), the endpoint returns the existing enrollment without re-enrolling.
5. **Low-confidence matches (< 0.6) flow to manual review.** They do NOT auto-enroll.

---

## Productization considerations

When MainStreetOS becomes a SaaS product for other brokers:

- **Templates table** is per-broker (add `broker_id` foreign key). Each broker has their own template library.
- **Matcher prompt** could be partially per-broker (broker-specific tone, brokerage name, regional context). For v1, keep it shared.
- **Saleshandy API key** is per-broker and stored encrypted (use Supabase Vault).
- **Notion workspace mapping** is per-broker. The Lead Router must be told which Notion workspace to read from.
- **Pricing tier:** Lead Router as a feature is the differentiator at the $497–$1,497/mo tier.

---

## Known gaps and v1.1 candidates

- HMAC signature verification on inbound webhooks (current: shared secret)
- Exponential backoff on Saleshandy API failures
- Rate limiting awareness (Saleshandy has limits — not currently enforced client-side)
- PII handling review before SaaS launch
- Test suite (matcher should have golden test cases for confidence scoring)
- Observability — structured logging + Sentry/Logtail
- A way for me to "teach" the matcher when it's wrong (feedback loop into match_decisions and prompt tuning)

---

## References

- Saleshandy API: `https://developer.saleshandy.com/api-reference/introduction`
- Saleshandy webhooks: `https://docs.saleshandy.com/en/collections/9160197-webhooks-new`
- Anthropic API (TypeScript SDK): `https://docs.claude.com/en/api/client-sdks`
- Google Sheets MCP (already deployed for this account): `~/.config/claude-mcp/`

---

## Glossary

- **BBS** — BizBuySell, primary lead source
- **CIM** — Confidential Information Memorandum, post-NDA detailed business document
- **CSRP** — Company-Specific Risk Premium, used in valuation discount rate buildup
- **DD** — Due Diligence
- **LOI** — Letter of Intent
- **NDA** — Non-Disclosure Agreement, gating document for CIM access
- **OM** — Offering Memorandum, pre-NDA marketing document
- **SDE** — Seller's Discretionary Earnings
- **SH** — Saleshandy
