# Email Template: NDA Received — Send OM + CIM (Generic)

**Template ID:** `tpl_nda_received_generic`
**Category:** `nda_received`
**Listing type:** `any`
**Industry tags:** `[]` (generic — no industry filter)
**Listing ID:** `null` (generic — no per-listing override)
**Active:** `true`

**Trigger:** `Completed NDA` checkbox flips to ✓ on the LEADS row, OR Notion button calls `/api/router/advance`.

**Pipeline transition:** Lead advances from "2. Initial Response Sent" (or "1. Inquiry") → "3. NDA Executed".
**Notion date stamped:** `PROSP Email #2`.
**Threaded under:** Email #1's Gmail conversation (sent as a reply with `Re:` prefix).

---

## Subject line

```
Confidential Information Memorandum (CIM) — {{listing_name}}
```

The Gmail sender automatically prepends `Re: ` because this email is sent within the existing thread, so the buyer sees `Re: Confidential Information Memorandum (CIM) — {{listing_name}}`.

## Body (HTML)

```html
<p>Hi {{buyer_first_name}},</p>

<p>Thank you for executing the NDA for <strong>{{listing_name}}</strong> (Listing #{{listing_number}}). The full Confidential Information Memorandum (CIM) is now available to you below — this is the detailed financial and operational overview of the business.</p>

<p><strong>Quick recap of what we discussed:</strong></p>
<ul>
  <li>Timeframe: {{buyer_timeframe}}</li>
  <li>Investment range: {{buyer_investment_range}}</li>
  <li>Asking price: {{asking_price}} | SDE: {{sde}}</li>
</ul>

<p><strong>Documents now available:</strong></p>
<ul>
  <li>Confidential Information Memorandum (CIM): <a href="{{cim_link}}">{{cim_link}}</a></li>
  <li>Offering Memorandum (OM): <a href="{{om_link}}">{{om_link}}</a></li>
  <li>Listing details: <a href="{{bbs_link}}">{{bbs_link}}</a></li>
</ul>

<p><strong>Next step — Buyer Profile and Qualification.</strong> To unlock the Business Valuation Report (BVR) and move into a substantive conversation about your fit for this acquisition, please complete the Buyer Profile. You can use either:</p>
<ul>
  <li>The Buyer Profile &amp; NDA form (if you haven't already submitted one), OR</li>
  <li>The CRE &amp; Business Buyer Qualification Questionnaire — I'll send the link upon request</li>
</ul>

<p>Once your Buyer Profile is in, I'll send the BVR and we can schedule a call to walk through the financials and your acquisition strategy.</p>

<p>Best timeframe to discuss? I'm available {{available_slots}} this week.</p>

<p>Best,<br>
{{broker_name}}<br>
Managing Member &amp; Managing Broker<br>
{{broker_firm}}<br>
{{broker_phone}} | {{broker_email}}</p>
```

## Variables required

### From inquiry email (extracted by `extractor.ts`, persisted in prior `lr_match_decisions.extracted_attributes`)

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
| `cim_link` | **YES** | `"[link forthcoming]"` ← critical for this email |
| `bbs_link` | no | `"[link forthcoming]"` |

### From environment / system

| Variable | Source |
|---|---|
| `available_slots` | Computed from Google Calendar API |
| `broker_name` | `process.env.BROKER_NAME` |
| `broker_phone` | `process.env.BROKER_PHONE` |
| `broker_email` | `process.env.BROKER_EMAIL` |
| `broker_firm` | `process.env.BROKER_FIRM` |

## Notes

- This is the **fallback** used when no per-industry or per-listing override exists for `category = nda_received`.
- The CIM link is the headline document of this email. If `{{cim_link}}` falls back to `[link forthcoming]`, the email is still useful (NDA acknowledged, OM still accessible) but flag the listing in Notion for missing CIM URL.
- Per-listing variants should preserve the same shape but can swap in deal-specific framing of the recap and next steps.
