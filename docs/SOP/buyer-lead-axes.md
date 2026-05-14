# Buyer Lead Axes — Cheat Sheet

**Status:** Active
**Last updated:** 2026-05-06
**Owner:** Mark Mueller
**Scope:** Lead workflow reference for CRE Resources, MainStreetOS, CRE-OS

---

## Overview

Buyer leads are tracked on **four orthogonal axes** instead of a single linear pipeline. Each lead carries a value on every axis. Filtered views slice across combinations to answer different questions.

| Axis | What it answers | Notion field | Supabase column |
|---|---|---|---|
| **Pipeline Stage** | Where is the lead in the lifecycle? (1–8) | `Pipeline Stage` | `buyer_leads.pipeline_stage` |
| **Disposition** | Is the lead alive, paused, or done? | `Disposition` | `buyer_leads.disposition` |
| **Buyer Quality** | How qualified is this buyer? (A–D) | `Buyer Quality` | `buyer_leads.buyer_quality` |
| **Listing Interest** | Which listing(s) is the buyer pursuing? | `📋 LISTINGS` relation | (via buyer-listing match) |

Why four axes: a single linear stage enum confuses "where in the journey" with "is the journey continuing" with "how good is this buyer." Splitting them lets the same buyer be Stage 5, Disposition Cold, Quality A — i.e., a strong qualified buyer who went silent — which is exactly the lead worth re-engaging. A flat enum can't represent that.

---

## Axis 1: Pipeline Stage

8 stages. Sequential. Each advance is gated by an objective signal — a checkbox flips, a document arrives, a date stamps. No subjective judgment calls.

### Pipeline Stage table

| # | Display label | Snake_case | Entry trigger | Email fires | Docs sent | Notion date stamped |
|---|---|---|---|---|---|---|
| 1 | 1. Inquiry | `inquiry` | Lead row created in LEADS DB | — | — | (Date Received) |
| 2 | 2. Initial Response Sent | `initial_response_sent` | Email #1 sent | Email #1 | OM | LEAD Email #1 |
| 3 | 3. NDA Executed | `nda_executed` | `Completed NDA` = ✓ | Email #2 | OM + CIM | PROSP Email #2 |
| 4 | 4. Buyer Profile Received | `buyer_profile_received` | `Completed Buyer Profile` = ✓ | Email #3 | BVR | PROSP Email #3 |
| 5 | 5. Qualified Buyer | `qualified_buyer` | Phone confirmation, lead qualified | Email #4 | Deal Workbook | QUALIF Email #4 |
| 6 | 6. LOI / IOI | `loi_ioi` | LOI/IOI received from buyer | Email #5 | Proposal counter | PROPSL Email #5 |
| 7 | 7. Under Contract | `under_contract` | Purchase agreement signed | — | — | (no email) |
| 8 | 8. Closing | `closing` | Diligence done, in settlement | — | — | (no email) |

### Per-stage detail

**Stage 1 — Inquiry.** Raw lead just landed in LEADS DB. No outbound has happened yet. Lead Router fires on this state.

**Stage 2 — Initial Response Sent.** Email #1 (OM share, NDA request) has gone to the buyer. Notion `LEAD Email #1` date is stamped. Awaiting NDA execution. Average dwell time: 2-7 days; if longer, Disposition flips to `awaiting_response`.

**Stage 3 — NDA Executed.** Buyer signed and returned NDA via Notion form, BBS download, or DocuSign. `Completed NDA` = ✓. Email #2 (OM + CIM share) fires automatically when you trigger it. Notion `PROSP Email #2` is stamped.

**Stage 4 — Buyer Profile Received.** Buyer Profile arrives via one of three paths — BBS download, Notion `Buyer Profile & NDA` form, or `CRE & Business Buyer Qualification Questionnaire` form. All three flip the same `Completed Buyer Profile` checkbox. Email #3 (BVR share) fires. Notion `PROSP Email #3` is stamped.

**Stage 5 — Qualified Buyer.** Phone confirmation has happened. The buyer's financial qualification has been verified — funds, timing, intent. Email #4 (Deal Workbook share) fires. Notion `QUALIF Email #4` is stamped.

**Stage 6 — LOI / IOI.** Buyer has submitted a Letter of Intent or Indication of Interest. Email #5 (Proposal/counter) fires. Notion `PROPSL Email #5` is stamped.

**Stage 7 — Under Contract.** Purchase agreement signed by both parties. Diligence opens. No automated email at this stage; manual outreach handles diligence coordination.

**Stage 8 — Closing.** Diligence complete. Settlement scheduled. On settlement, set Disposition to `closed_won` (success) or `closed_lost` (deal collapsed at the eleventh hour).

### Backward movement

Pipeline Stage advances forward in normal flow. To roll back (e.g., NDA was withdrawn after submission), set Disposition to `withdrawn` rather than reverting Stage. Stage indicates "what has happened"; Disposition indicates "is this lead still alive."

---

## Axis 2: Buyer Quality

A single A/B/C/D rating per buyer, derived from three 1-5 sub-ratings: Fit, Timing, Motivation.

### Quality rating table

| Quality | Definition | Average sub-rating |
|---|---|---|
| **A** | Strong fit + ready timing + active motivation. Cash buyer or pre-approved financing, named timeframe inside 90 days, prior business ownership or specific industry experience. | ≥ 4.5 |
| **B** | Strong fit + reasonable timing + clear motivation. Qualified financially, evaluating multiple deals, timeline 3–12 months. | ≥ 3.5 |
| **C** | Mixed fit OR uncertain timing OR unclear motivation. Passive interest, exploring options, no defined timeline. | ≥ 2.5 |
| **D** | Weak fit OR no timing OR no motivation. Tire kicker, asks "what's the price" with no follow-through. | < 2.5 |

### Sub-ratings (1–5 each)

| Sub-rating | Question it answers |
|---|---|
| **Fit Rating** | How well does this buyer match the listing(s) they're inquiring about? Industry experience, price-band match, geographic fit. |
| **Timing Rating** | How soon is this buyer ready to act? Stated timeframe, financing pre-approval, urgency signals. |
| **Motivation Rating** | How strong is the buyer's motivation to close? Career transition, family business succession, strategic reasons vs. casual exploration. |

Each rating is a 1–5 scale: 5 = exceptional, 4 = strong, 3 = adequate, 2 = weak, 1 = absent.

### Aggregation rule

```
avg of Fit + Timing + Motivation:
  ≥ 4.5  → A
  ≥ 3.5  → B
  ≥ 2.5  → C
  <  2.5 → D
```

If only some sub-ratings are populated, the aggregate uses just the populated ones. If none are populated, Buyer Quality is left null until enough signal exists.

### When to update

Update Buyer Quality whenever new information changes one of the sub-ratings: financial qualification reveals their funds (Fit + Timing), a phone call surfaces their motivation, market conditions shift their urgency. Treat as a living rating, not a one-time judgment.

---

## Axis 3: Disposition

Tracks whether the lead is currently engaged, paused, or finished. Orthogonal to Pipeline Stage — a Stage 5 lead can be Active OR Cold OR Withdrawn.

### Disposition table

| Disposition | Snake_case | When to apply |
|---|---|---|
| **Active** | `active` | Currently engaged, ball is moving in the relationship. Default for new leads. |
| **Awaiting Response** | `awaiting_response` | You sent something, waiting on the buyer. Last contact 5–14 days ago. |
| **Cold** | `cold` | Buyer has gone quiet. No response 14–30 days. Worth a nudge. |
| **Dormant** | `dormant` | Quiet 30+ days. Parked. Revisit periodically (every 90 days). |
| **Withdrawn** | `withdrawn` | Buyer explicitly opted out. Don't pursue further unless they re-engage. |
| **Disqualified** | `disqualified` | Failed qualification — insufficient funds, bad fit, fraudulent intent, etc. Permanent state. |
| **Closed Won** | `closed_won` | Deal closed successfully. This buyer became a customer. Final state for the deal. |
| **Closed Lost** | `closed_lost` | Progressed through the pipeline but didn't close. Lost to competitor, financing fell through, buyer changed mind, etc. |

### Disposition flow

```
            ┌──────────┐
            │  Active  │ ←─── default for new leads
            └────┬─────┘
                 │ no contact 5-14 days
                 ▼
         ┌─────────────────┐
         │ Awaiting Response│
         └────────┬────────┘
                  │ no contact 14-30 days
                  ▼
              ┌──────┐
              │ Cold │ ←─ outreach can revive
              └──┬───┘
                 │ no contact 30+ days
                 ▼
            ┌─────────┐
            │ Dormant │ ←─ revisit every 90 days
            └─────────┘

Buyer-initiated exit: Withdrawn  (explicit opt-out)
Broker-initiated exit: Disqualified  (failed qualification)
Final outcomes: Closed Won, Closed Lost
```

### Auto-aging (future)

When the Lead Router cron job is wired in v1.1, it will automatically advance Disposition based on contact age: Active → Awaiting Response (7d), → Cold (14d), → Dormant (30d). Manual override always wins.

---

## Axis 4: Listing Interest

Tracks which listing(s) the buyer is pursuing via the `📋 LISTINGS` relation in Notion.

### How it works

A single buyer can be linked to multiple listings. The same buyer is `Quality A` for La Guardiola (because the price band fits) and `Quality C` for Yogi International (price too low). The relation captures interest; Buyer Quality captures fitness against the buyer's overall criteria.

The Lead Router populates this relation automatically when it matches an inquiry to a listing — see `lr_match_decisions.matched_listing_id`. Manual additions also work.

### When to use

- One buyer asking about multiple listings → add multiple relations.
- Buyer drops a listing from consideration → unlink from the relation.
- Aggregate analytics: "all buyers interested in Yogi International" is a single Notion view filtered on the relation.

### Per-listing fitness (future)

Today, Buyer Quality is a single buyer-level rating. If the same buyer is A for one listing and C for another, you'd note that in the lead's `Notes` field. v2 may introduce a junction table (`buyer_listing_fitness`) with per-pair Fit/Timing/Motivation ratings — defer until usage justifies the complexity.

---

## Decision Matrix — Common Scenarios

| Scenario | Pipeline Stage | Disposition | Buyer Quality | Notes |
|---|---|---|---|---|
| Fresh BBS inquiry, just landed | `inquiry` | `active` | (assess later) | Lead Router fires Email #1 |
| Email #1 sent, no response in 7 days | `initial_response_sent` | `awaiting_response` | (assessed) | Auto-aging will flip later |
| Buyer signed NDA via Notion form | `nda_executed` | `active` | (re-assess) | Triggers Email #2 |
| Buyer profile arrived with strong financials | `buyer_profile_received` | `active` | likely B+ | Triggers Email #3 |
| Phone qualification confirmed buyer is serious | `qualified_buyer` | `active` | likely A or B | Triggers Email #4 |
| Buyer submitted LOI | `loi_ioi` | `active` | A | Triggers Email #5 |
| Buyer has gone quiet at Stage 5 for 3 weeks | `qualified_buyer` | `cold` | A | Worth a re-engagement nudge |
| Buyer explicitly says "not interested" | (last stage reached) | `withdrawn` | (preserve) | Don't auto-revive |
| Found out buyer can't actually finance | (last stage reached) | `disqualified` | D | Permanent |
| Deal closed, settlement complete | `closing` | `closed_won` | A | Final state |
| Deal fell through at LOI stage | `loi_ioi` | `closed_lost` | (preserve) | Final state |

---

## View Recipes — Filtered Notion Views

### Today's A-Buyers

```
Filter:  Disposition = Active AND Buyer Quality = A
Sort:    Pipeline Stage descending, last contact descending
```

This is your morning priority list — the strongest qualified buyers actively in motion.

### Stalled Deals

```
Filter:  Pipeline Stage ≥ 4 AND Disposition IN [Cold, Dormant]
Sort:    Pipeline Stage descending
```

Qualified buyers who went silent. Highest re-engagement value.

### NDA Awaiting

```
Filter:  Pipeline Stage = 2. Initial Response Sent
         AND Date Received > 7 days ago
         AND Disposition ≠ Withdrawn
```

Sent Email #1 a week+ ago, no NDA back yet. Worth a nudge.

### Buyer Profile Awaiting

```
Filter:  Pipeline Stage = 3. NDA Executed
         AND Completed Buyer Profile = false
         AND Disposition = Active
```

NDA signed, but Buyer Profile hasn't come back. Email #3 won't fire until it does.

### Disqualified This Quarter

```
Filter:  Disposition = Disqualified AND Date Received > 90 days ago
```

Useful for analytics — what % of leads disqualify and why.

### Closed Won — Deal Velocity

```
Filter:  Disposition = Closed Won
Show:    Date Received → settlement date span
```

Average deal length. Useful for forecasting.

---

## Mapping to Old Status Update (transitional)

The old `Status Update` field is preserved during Phase 1–4 of the migration. Approximate mapping below; final mapping is reviewed row-by-row in Phase 3.

| Old Status Update | New Pipeline Stage | New Disposition |
|---|---|---|
| 1. LEAD | 1. Inquiry | Active |
| 2. PROSPECT | 3. NDA Executed | Active |
| 3. QUALIFIED | 5. Qualified Buyer | Active |
| 4. OFFER (LOI) | 6. LOI / IOI | Active |
| 5. CONTRACT | 7. Under Contract | Active |
| 6. DILIGENCE | 7. Under Contract | Active |
| 7. SETTLEMENT | 8. Closing | Active |
| 8. Closed | 8. Closing | Closed Won |
| 9. Dormant - WITHDRAWN | (preserve last stage) | Withdrawn |
| 10. DISQUALIFIED | (preserve last stage) | Disqualified |

The old field will be deprecated in Phase 5 of the retool.

---

## Quick Reference Card

```
PIPELINE STAGE     1 → Inquiry
                   2 → Initial Response Sent  (Email #1, OM)
                   3 → NDA Executed            (Email #2, OM+CIM)
                   4 → Buyer Profile Received  (Email #3, BVR)
                   5 → Qualified Buyer         (Email #4, Workbook)
                   6 → LOI / IOI               (Email #5, Proposal)
                   7 → Under Contract
                   8 → Closing

DISPOSITION        Active | Awaiting Response | Cold | Dormant
                   Withdrawn | Disqualified | Closed Won | Closed Lost

BUYER QUALITY      A (≥4.5)  B (≥3.5)  C (≥2.5)  D (<2.5)
SUB-RATINGS        Fit + Timing + Motivation, each 1–5

LISTING INTEREST   📋 LISTINGS relation. Many-to-many. Same buyer can
                   pursue multiple listings.
```

---

## Schema references

- Supabase enums: `buyer_pipeline_stage`, `buyer_disposition`, `buyer_quality`
- Supabase columns: `buyer_leads.pipeline_stage`, `disposition`, `buyer_quality`, `fit_rating`, `timing_rating`, `motivation_rating`
- Notion LEADS DB properties: `Pipeline Stage`, `Disposition`, `Buyer Quality`, `Fit Rating`, `Timing Rating`, `Motivation Rating`
- Code mapping: `src/lib/router/buyer-axes.ts` (canonical translator)
- Migration: `supabase/migrations/20260506*_lead_router_retool_phase1_axes.sql`
