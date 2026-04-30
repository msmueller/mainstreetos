# Email Template: Initial BBS Inquiry Response (Generic)

**Template ID:** `tpl_bbs_initial_generic`
**Category:** `initial_response`
**Listing type:** `any`
**Industry tags:** `[]` (generic — no industry filter)
**Listing ID:** `null` (generic — no per-listing override)
**Active:** `true`

---

## Subject line

```
{{listing_name}} — Information for {{buyer_first_name}}
```

## Body (HTML)

```html
<p>Hi {{buyer_first_name}},</p>

<p>Thank you for your interest in <strong>{{listing_name}}</strong> (Listing #{{listing_number}}).</p>

<p>Based on what you mentioned about {{buyer_timeframe}} and {{buyer_investment_range}}, I think this could be a strong fit. The asking price is {{asking_price}} with SDE of {{sde}}.</p>

<p>I've attached our standard NDA. Once executed, I can send the full CIM with detailed financials.</p>

<p><strong>Quick links for review:</strong></p>
<ul>
  <li>Offering Memorandum: <a href="{{om_link}}">{{om_link}}</a></li>
  <li>NDA for execution: <a href="{{nda_link}}">{{nda_link}}</a></li>
  <li>Listing details: <a href="{{bbs_link}}">{{bbs_link}}</a></li>
</ul>

<p><strong>After NDA execution, you'll get access to:</strong></p>
<ul>
  <li>Confidential Information Memorandum: {{cim_link}}</li>
  <li>Business Valuation Report: {{bvr_link}}</li>
  <li>Deal Workbook: {{workbook_link}}</li>
</ul>

<p>Best timeframe to discuss? I'm available {{available_slots}} this week.</p>

<p>Best,<br>
Mark Mueller<br>
Managing Member &amp; Managing Broker<br>
CRE Resources, LLC<br>
{{broker_phone}} | {{broker_email}}</p>
```

## Body (plain text fallback)

```
Hi {{buyer_first_name}},

Thank you for your interest in {{listing_name}} (Listing #{{listing_number}}).

Based on what you mentioned about {{buyer_timeframe}} and {{buyer_investment_range}}, I think this could be a strong fit. The asking price is {{asking_price}} with SDE of {{sde}}.

I've attached our standard NDA. Once executed, I can send the full CIM with detailed financials.

Quick links for review:
- Offering Memorandum: {{om_link}}
- NDA for execution: {{nda_link}}
- Listing details: {{bbs_link}}

After NDA execution, you'll get access to:
- Confidential Information Memorandum: {{cim_link}}
- Business Valuation Report: {{bvr_link}}
- Deal Workbook: {{workbook_link}}

Best timeframe to discuss? I'm available {{available_slots}} this week.

Best,
Mark Mueller
Managing Member & Managing Broker
CRE Resources, LLC
{{broker_phone}} | {{broker_email}}
```

## Variables required

### From inquiry email (extracted by `extractor.ts`)

| Variable | Required? | Fallback if missing |
|---|---|---|
| `buyer_first_name` | yes | `"there"` |
| `buyer_timeframe` | no | `"your timeline"` |
| `buyer_investment_range` | no | `"your investment range"` |

### From matched listing (Notion Listings DB)

| Variable | Required? | Fallback if missing |
|---|---|---|
| `listing_name` | yes | `"the listing"` |
| `listing_number` | yes | `"[Listing #]"` |
| `asking_price` | yes | `"available upon request"` |
| `sde` | yes | `"available upon NDA"` |
| `om_link` | yes | `"[link forthcoming]"` |
| `nda_link` | yes | `"[link forthcoming]"` |
| `bbs_link` | no | `"[link forthcoming]"` |
| `cim_link` | yes | `"[link forthcoming]"` |
| `bvr_link` | yes | `"[link forthcoming]"` |
| `workbook_link` | yes | `"[link forthcoming]"` |

### From environment / system

| Variable | Source |
|---|---|
| `available_slots` | Computed from Google Calendar API (next 5 business hours of availability) |
| `broker_phone` | `process.env.BROKER_PHONE` |
| `broker_email` | `process.env.BROKER_EMAIL` |

## Conditional rendering notes

The renderer should support graceful degradation:

- If `buyer_timeframe` AND `buyer_investment_range` are both null, replace the entire sentence "Based on what you mentioned..." with: `"I'd love to learn more about your timeline and investment range so I can tailor what I share next."`
- If `available_slots` returns no openings (calendar fully booked or API failure), replace with: `"any time that works for you"`
- All `_link` variables that are null should fall back to `"[link forthcoming]"` rather than rendering broken URLs.

## Seed insertion SQL

```sql
INSERT INTO templates (
  id,
  name,
  category,
  industry_tags,
  listing_type,
  listing_id,
  subject,
  body_html,
  body_text,
  variables,
  active
) VALUES (
  'tpl_bbs_initial_generic',
  'BBS Initial Inquiry Response (Generic)',
  'initial_response',
  ARRAY[]::text[],
  'any',
  NULL,
  '{{listing_name}} — Information for {{buyer_first_name}}',
  '<p>Hi {{buyer_first_name}},</p><p>Thank you for your interest in <strong>{{listing_name}}</strong> (Listing #{{listing_number}}).</p>...',  -- truncated; full HTML body above
  'Hi {{buyer_first_name}},\n\nThank you for your interest in {{listing_name}}...',  -- truncated; full text body above
  '["buyer_first_name","buyer_timeframe","buyer_investment_range","listing_name","listing_number","asking_price","sde","om_link","nda_link","bbs_link","cim_link","bvr_link","workbook_link","available_slots","broker_phone","broker_email"]'::jsonb,
  true
);
```

(Cowork: when seeding, replace the truncated `body_html` and `body_text` with the full versions from the sections above.)

## Notes

- This is the **fallback** template used when no per-industry or per-listing override exists for `category = initial_response`.
- Per-industry variants (pizzeria, cafe, retail, etc.) and per-listing variants (La Guardiola, RE Farm Cafe, Yogi, Philly Pretzel) should follow the same shape but with industry-specific or deal-specific copy in place of the generic phrasing.
- The "After NDA execution..." block lists CIM/BVR/Workbook links as plain text (not hyperlinks) intentionally — these are confidential documents that shouldn't be clickable until NDA is countersigned. Per-listing variants may swap to hyperlinks if the documents are gated behind a tokenized URL.
