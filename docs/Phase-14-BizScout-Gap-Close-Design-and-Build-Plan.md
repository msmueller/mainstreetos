# Phase 14 — BizScout DEALOS (BSDOS) Gap-Close: Design & Build Plan

**Status:** In progress — Phase 14.0 complete 2026-07-31; Phases 14.1–14.4 cleared to start immediately (no blockers); 14.5 waits on 14.3; 14.6 is a scoping spike, not a build commitment.
**Plan date:** 2026-07-31 · **Last updated:** 2026-07-31
**Predecessors:** Phase 13.6 (`SELLER_STAGES` 8-stage enum), Phase 13.6c (`BUYER_PIPELINE_STAGES` 14-stage "unified Buyer Journey ladder"), Phase 13.2 (`public.deals` archived)
**Basis:** Live read-only review of brokeros.bizscout.com (DEALOS 2.0) on 2026-07-31 — My Listings, All Deals, and a full deal record (Overview / Buyers / Smart Buyer Match tabs) — cross-checked against the 2026-07-30 BizScout vs. MainStreetOS SWOT (`Competition/` and the BizScout Pilot Agreement legal review), and a direct read of this codebase: `AGENTS.md`, `src/lib/types.ts`, `src/app/dashboard/page.tsx`, `src/app/dashboard/deals/pipeline-view.tsx`, `src/lib/router/matcher.ts`.
**Companion doc:** `MainStreetOS_BSDOS_Upgrade_Schedule.docx` (delivered to Mark 2026-07-31) — full narrative version of this plan, including the corrected BSDOS-vs-MSOS feature comparison and the BizScout Pro (buyer tier) findings.

## Confidentiality posture (per Mark, 2026-07-31 — governs all future BizScout contact)

- **BizScout does not know MSOS exists.** Mark's role with BizScout is, and should keep appearing to be, an ordinary working broker with live listings on their marketplace — not someone building a competing deal-OS. Keep it that way until Mark decides otherwise.
- BizScout previously interviewed Mark as a **"Broker Expert"** and extracted his general broker workflows, document types, and methodologies. That already happened and can't be walked back, but it was framed as generic industry expertise, not MSOS-specific. **No further system-development detail is to be shared with BizScout going forward** — nothing about this repo, this plan, MSOS's architecture, or the fact that a competing product is being built.
- Practical implication for every future BSDOS interaction (demos, support tickets, account fields, casual conversation with reps): engage purely as a customer evaluating their product for real brokerage use. Don't reference MSOS, Claude, this evaluation project, or "competitive analysis" in anything BizScout-facing.
- Remember the standing legal-review finding (2026-07-30): BizScout's Buyer Lead/deal-interaction data one-way-feeds their own Scout AI and matching models. Ordinary use of the platform as a broker is fine and expected (that's the whole point of the pilot); just don't feed it anything that would tip them off to parallel system-building.
- Attio has been fully cancelled — the account itself is closed, not just architecturally retired in the codebase (Design Invariant #7, 2026-07-14). The untracked `docs/Attio-*` files in §0 below are now purely historical record of a completed migration, not active integration docs.

## Why this plan exists

The 2026-07-30 SWOT benchmarked BizScout against the Notion/skill-based CRE-OS layer, not against this codebase. Restated against the actual MainStreetOS app, the honest gap is narrower than that SWOT suggested and concentrated in **UI surfacing of data this codebase already computes**, not missing schema. The one schema-level finding worth acting on is documentation debt, not a missing feature (§0 below).

## Key finding: the two-tier stage model already exists and is ahead of BSDOS

BSDOS separates a top-level listing-lifecycle stepper (8 stages, shown on every deal record) from a per-deal buyer kanban (7 stages, its own "Buyers" tab), with roll-up KPI tiles (Active Buyers, NDAs Signed, Live LOIs, Needs Attention). This codebase already has the schema equivalent, one tier deeper on the buyer side:

| # | `SELLER_STAGES` (this repo, Phase 13.6) | Closest BSDOS stage |
|---|---|---|
| 1 | Prospecting & Pitching | Pre-Listing |
| 2 | Engagement & Agreements | Seller Onboarding |
| 3 | Discovery & Valuation | (spans Seller Onboarding–Active Marketing) |
| 4 | Packaging & Marketing | Active Marketing |
| 5 | Offers & Negotiation | Under LOI |
| 6 | Due Diligence & Transaction | Due Diligence / Financing Contingency |
| 7 | Settlement & Closure | Closing |
| 8 | Withdrawn or Dormant | (no BSDOS equivalent) |

| # | `BUYER_PIPELINE_STAGES` (this repo, Phase 13.6c) | Closest BSDOS buyer-kanban stage |
|---|---|---|
| 1 | Inquiry | Pre-NDA |
| 2 | Initial Response Sent | Pre-NDA |
| 3 | NDA Executed | NDA Signed |
| 4 | Buyer Profile Received | (no equivalent) |
| 5 | Qualified Buyer / POF | (no equivalent) |
| 6 | CIM Review | (no equivalent) |
| 7 | LOI Negotiation | LOI Submitted / LOI Accepted |
| 8 | Under Contract | PA Submitted |
| 9 | Due Diligence | PA Submitted |
| 10 | Financing / Approvals | PA Accepted |
| 11 | Closing | PA Accepted |
| 12 | Closed Won | Closed Won |
| 13 | Closed Lost | (no equivalent) |
| 14 | Withdrawn / No longer pursuing | (no equivalent) |

**Do not merge these two enums.** BizScout's own two-track split (deal/listing stage vs. buyer pipeline, kept as separate UI surfaces) is the correct pattern precisely because it matches Design Invariant #4 ("a record can live in many processes") — one listing can carry several buyers at different pipeline stages simultaneously, which a single merged stage field cannot represent. `SELLER_STAGES` and `BUYER_PIPELINE_STAGES` are already two separate enums; every phase below keeps them visually and functionally separate.

BSDOS's listing "Status" field (My Listings → Filters → Status) is **not a workflow concept** — it has exactly two values, `Ready to Promote` / `Promoted`, gating a paid listing-boost feature. `DealStatus` (`active` / `under_contract` / `closed` / `expired` / `withdrawn`) already carries more real information and is already wired into `pipeline-view.tsx`. Nothing to build here.

## 0. Existing build — uncommitted work as of 2026-07-31

Before any Phase 14 work starts, this needs to be reconciled — it's the literal "completion of the existing build plan" half of this doc. `git status` on branch `feat/nda-public-start-page` (last commit `4a784be`, 2026-07-30) shows real, apparently-tested work sitting uncommitted, not broken work:

**Modified (tracked):** `.gitignore`, `src/lib/router/buyer-axes.ts`, `src/lib/router/notion.ts` — small diffs (82 and 31 lines), look like an in-progress edit to the lead router's buyer-axis scoring and the Notion sync client.

**Untracked — real feature work, appears complete/verified:**
- `nethunt-leads-intake/` — a deployed Notion Worker (per its own `DEPLOYED.md`: deployed 2026-07-14, `tsc --noEmit` clean, live create-once test passed, webhook signature verification confirmed against both valid and invalid secrets). Only Phase 5 remains, and it's UI/config, not code: wiring the three triggers by hand in the NetHunt and Notion automation UIs.
- `supabase/functions/sync-notion-leads/index.ts` — an Edge Function, untracked.
- `docs/proposed-migrations/` — two SQL files for the already-shipped Phase 12.15 data room (`20260715000000_phase_12_15_data_room.sql`, `...rpcs.sql`); given Phase 12.15 has a closeout doc, these may already be applied to the database and just never committed as migration files — verify against `supabase migrations list` before treating as pending.
- `scripts/` (several `.mjs`/`.sql`/`.sh` files) — lead-canonicalization and backfill tooling (`migrate-leads-canonical.mjs`, `leads-drop-prep.mjs`, `backfill-phase9-royal-silk.sql`, smoke-test scripts for the router).
- `docs/*.md` (Attio-Lead-Model-Redesign, Attio-Setup-Steps, MSOS-Notion-Attio-Migration-Maps, PR-leads-pipeline-canonical, Relay-Flow-Build-Spec, EMAIL1-TEMPLATES-public-nda-links) — design/spec docs from the June Attio→Notion-native migration (Design Invariant #7).
- `NDA Project/` — two NDA template `.docx` files plus a Notion form reference.
- Root-level one-off scripts (`backfill-lead-date.mjs`, `backfill-listing-name.mjs`, `create-missing-leads.mjs`, `fix-notion-listing-name.mjs`) and a stray file named `0`.
- `_to_delete/` and three `.git/*.lock.stale-*` files — harmless leftovers from a crashed git process on 2026-07-15 (already renamed away from active lock names; not blocking anything).

**Recommended reconciliation (not yet done — needs your sign-off before anyone commits on your behalf):** group into separate, reviewable commits rather than one `git add -A` — e.g. (1) the three modified router/gitignore files, (2) `nethunt-leads-intake/` as its own commit referencing its `DEPLOYED.md`, (3) `supabase/functions/sync-notion-leads/`, (4) `docs/proposed-migrations/` after confirming against live migration state, (5) the Attio-migration doc set, (6) the lead-canonicalization scripts, (7) `NDA Project/` reference docs. Delete or `.gitignore` the stale lock files and `_to_delete/` once confirmed harmless.

## Phase list

### Phase 14.0 — Stage-taxonomy documentation fix
**Status:** ✅ Done 2026-07-31 · **Depends on:** none

`AGENTS.md`'s "Canonical Pipeline Fields" section documented a 10-stage `Deal Phase` enum ratified 2026-06-05 (`Inquiry · Qualification · NDA Executed · CIM Review · LOI Negotiation · Under Contract · Due Diligence · Financing/Approvals · Closing · Terminated`) that the code had already moved past. Updated `AGENTS.md` in place: it now documents `SELLER_STAGES`/`BUYER_PIPELINE_STAGES` (Phase 13.6/13.6c) as canonical, keeps the old text in a collapsed "superseded" section for history, and links back to this plan doc. No schema change. **Not yet committed to git** — it's an edit to an already-untracked file; fold it into the AGENTS.md/docs commit group in §0's reconciliation, or commit standalone, whichever Mark prefers.

### Phase 14.1 — Deal-detail stage stepper
**Dates:** 2026-08-17 – 2026-08-28 · **Depends on:** 14.0 (done) · **Cleared to start immediately.**

Add a horizontal 8-node stepper to `/dashboard/deals/[id]`, bound to `seller_stage`, mirroring BSDOS's layout: filled dot = passed, ringed dot = current, hollow dot = upcoming, connected by a line; a "Move stage" control listing all 8 `SELLER_STAGES` with a checkmark on the current one, no per-stage gating. Labels and enum already exist — this is presentation-layer work only.

### Phase 14.2 — Buyers-tab kanban
**Dates:** 2026-08-31 – 2026-09-18 · **Depends on:** 14.0, 14.1

Add a "Buyers" tab to the deal detail page rendering a collapsed kanban over that deal's `DealAccess`/`buyer_leads` records (group the 14 `BUYER_PIPELINE_STAGES` down to a manageable number of visual columns, the way BSDOS collapses to 7), plus KPI tiles (Active Buyers, NDAs Signed, Live LOIs/Under Contract, Needs Attention) reusing the `BrokerTile` pattern already in `src/app/dashboard/page.tsx`. `active_buyers` and `nda_signed_count` are already computed (`DealWithCounts`) — this closes the SWOT's "no persistent visual buyer pipeline" weakness without new data plumbing.

### Phase 14.3 — Dashboard: priority deals + Match % column
**Dates:** 2026-09-21 – 2026-10-02 · **Depends on:** none. **Cleared to start immediately** — can run in parallel with 14.1/14.2, touches `dashboard/page.tsx` and the leads/deals list views, not the deal-detail page.

Add a ranked "Priority Deals" list and a "Needs Attention" tile to `src/app/dashboard/page.tsx` (queryable today via `activities` / `ai_drafts` / `buyer_engagements`). Surface `lib/router/matcher.ts` confidence scores as a visible "Match %" column on `/dashboard/leads` and `/dashboard/deals` — closes the most visible optics gap vs. BSDOS's "AI Match %" column, using a scoring engine this codebase already has (with a hallucination guard BSDOS's Smart Buyer Match doesn't document having).

### Phase 14.4 — Deal-linked task kanban
**Dates:** 2026-10-05 – 2026-10-16 · **Depends on:** none. **Cleared to start immediately** — new table + kanban, additive only.

Add a lightweight tasks table scoped to `deal_id` with a To Do / In Progress / Done kanban inside the deal detail page, wired to the existing `activities` log. Turns `ops-marketing-accountability` / `daily-accountability-agent` skill output into visible per-deal checklist items instead of only a skill-level report.

### Phase 14.5 — Listing Readiness Score
**Dates:** 2026-10-19 – 2026-10-30 · **Depends on:** 14.3

Derive a broker-facing 1–100 score from CSRP risk factors (`business-swot-risk-agent`), data completeness, and days-on-market — MainStreetOS's answer to "BizScout Score," grounded in real valuation methodology rather than a marketplace heuristic.

### Phase 14.6 — Off-market sourcing & industry-benchmark data (scoping spike)
**Dates:** 2026-11-02 – 2026-11-20 · **Depends on:** 14.5

Not a build commitment — a memo. Two questions, both data-licensing questions rather than engineering ones: (a) is an off-market sourcing feed (business-registration/data-provider triangulation, BizScout Pro's "Off-Market Leads") worth building vs. simply keeping a BizScout Pro seat ($83–199/mo); (b) license a real industry-benchmark source (IBISWorld or comparable — RMA, BizMiner) into `agent3-valuation-methods.ts`'s 7 hardcoded sector benchmarks. Deliverable: a build-vs-buy memo with rough cost/timeline for each, not code.

### Phase 14.7 — Recheck
**Dates:** late 2026-11 · **Depends on:** all prior phases

Re-pull the BSDOS dashboard and BizScout Pro pricing page. Revisit this plan if BSDOS's "Manage billing" promoted-listings tier goes live on the broker side, or if Radar/Off-Market Leads/BizScout Score meaningfully change buyer or seller behavior.

## Non-engineering action items (tracked here for visibility, owned by Mark)

- [x] **Done 2026-07-31 (per Mark):** written confirmation resolved — Mark has signed up for BSDOS membership.
- [x] **Done 2026-07-31 (per Mark):** attorney has signed off on the arbitration and indemnification terms.
- [ ] BizScout Pro (buyer tier) seat: not yet signed up. Mark is in a live demo with BizScout reps today, 2026-07-31 — see "BS Pro demo prep" below; this can shortcut part of the Phase 14.6 spike.
- [ ] Revisit this plan if BSDOS's paid broker tier or BizScout Pro's new capabilities change materially.

## BS Pro demo prep (2026-07-31 — live, same day)

Mark is watching a BizScout Pro demo with BizScout reps today, in his role as a working broker-customer evaluating an upgrade — not as anyone building a competing product (see Confidentiality posture above). Questions below are phrased the way an ordinary broker considering Pro would actually ask them; no MSOS references, no technical/analytical framing (API, methodology, redistribution rights, etc.) that would read as unusual due diligence. They still cover everything Phase 14.6 needs answered:

1. "How does Radar actually work day to day — do I set my criteria once and then just get alerts, or is it something I need to keep tuning?"
2. "For Off-Market Leads, where's that owner contact information coming from? I want to be careful that reaching out to someone who hasn't listed anywhere doesn't come across the wrong way."
3. "How is the BizScout Score put together? I'd want to understand what's behind it before I start using it to decide where to spend my time."
4. "The IBISWorld data that comes with Pro — can I actually use that when I'm putting materials together for a buyer, or is it just for my own reference inside BizScout?"
5. "Does upgrading to Pro change anything on my broker dashboard, or is it really just the buyer-search side of the site?"
6. "I noticed 'Manage billing' under My Listings — is a paid tier coming for brokers too, or is that not live yet?"
7. "What does onboarding to Pro actually look like — is there a trial, or do most people just go straight to the annual plan?"
8. "Since I'm mostly listing in New Jersey right now, will Off-Market Leads actually find much locally, or is it stronger in bigger metros?"

## Deferred / out of scope

- Rebuilding CRM/contacts, activity feed, or automation inside MSOS — Design Invariant #7 keeps this Notion/NetHunt-native by design. BSDOS having a native CRM tab is not a gap to close.
- Chasing BSDOS's owned marketplace reach (20,000+ listings / 150,000+ buyers) — a genuine network-effect gap that isn't closable by feature work; tracked as a threat in the companion SWOT, not a build phase.
