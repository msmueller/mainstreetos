# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What is MainStreetOS

MainStreetOS is an AI-native deal operating system for business brokers and CRE intermediaries. It automates business valuations using a multi-agent pipeline, generates deal documents (OM / CIM / BOV), manages sell-side, buy-side, and advisory pipelines across both BIZ and CRE verticals, and builds institutional memory via Open Brain semantic search.

## Design Invariants

Seven load-bearing architectural guardrails. Every migration, schema change, new object, and UI decision is reviewed against these rules. Adopted 2026-04-22 following YC Co-Founder build-out review. (These invariants originated in the CRM Redesign work; the external-Attio *parity* goal is retired — MSOS is now the standalone core CRM/deal OS, not a mirror of Attio.)

1. **A contact is not a deal.** Transaction logic never lives on `contacts`. Opportunity records (`deals`, future `opportunities`) carry deal state.
2. **A company is not a workflow.** `organizations` records persist; workflow state lives on list entries, not on the company itself.
3. **A list is not the source of truth; it is the process container.** Records outlive lists. A record in a "Hot Leads" list is still a contact first, a lead entry second.
4. **A record can live in many processes.** One contact can be a buyer lead, seller client, and consulting client simultaneously — each relationship lives on its own list entry, not by cloning the contact.
5. **AI sits on top of a strong schema, not in place of one.** Agents are drafters, classifiers, summarizers, and enrichers. They never write authoritative fields without human review via `/dashboard/drafts`.
6. **CRE and BIZ share a core, not identical stages.** One People/Company/Activity/Task layer; separate pipeline enums, overlay fields, and list configurations for CRE and BIZ work.
7. **The relationship layer is Notion-native, not rebuilt in MSOS.** *(Added 2026-06-04 (Roadmap v2.0); relationship layer moved to Notion-native 2026-07-14 after Attio/Relay were retired.)* MSOS owns and invests in the moat — the CAIBVS valuation engine, the agentic drafting/intelligence pipeline, Open Brain memory, the secure client portal + NDA lifecycle + document gating, buyer qualification, and CRE/BIZ convergence. The relationship / communications / automation layer — companies-as-CRM, activity feed, email/calendar handling, the Lists/Views/Dashboards builder, workflow automation, and contact enrichment — lives in **Notion (the canonical hub)** and **NetHunt (the mobile CRM connection)**. MSOS syncs it as a read-mostly mirror via the Notion API and **never rebuilds** it in-house; automation runs Notion-native (Notion Agents + Notion Workers) plus NetHunt Workflows/Webhooks. **No Attio, no Relay.** Where #7 conflicts with the in-house "list entry" language of #2–#4, #7 governs: build a primitive in MSOS only when it carries MSOS-owned process state; otherwise use Notion / NetHunt.

Before opening any migration PR, the author must state which invariant(s) the change exercises and how the change respects each one.

## Commands

```bash
npm run dev       # Start Next.js dev server (http://localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint (Next.js web vitals + TypeScript)
```

No test framework is configured yet.

## Environment Variables

Copy `.env.local.example` to `.env.local`. Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side Supabase access (used by agents)
- `OPENROUTER_API_KEY` - AI model API for agent pipeline
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Billing (Phase 1)

## Architecture

**Stack**: Next.js 16 (App Router, React 19), TypeScript strict mode, Tailwind CSS 4, Supabase (PostgreSQL + Auth)

**Path alias**: `@/*` maps to `./src/*`

### Source Layout (`src/`)

- `app/` - Next.js App Router pages, layouts, and API routes
- `lib/agents/` - Business logic: the 3-agent valuation pipeline
- `lib/supabase/` - Supabase client (browser), server, and middleware helpers
- `lib/types.ts` - All shared TypeScript interfaces and domain types
- `middleware.ts` - Auth middleware protecting `/dashboard` routes

### Agent Pipeline (core business logic)

The valuation system runs a sequential 3-agent pipeline triggered via `POST /api/agents/normalize`:

1. **Agent 2 - Normalization** (`agent2-normalization.ts`, ~325 lines): Ingests multi-year financials, calculates SDE/EBITDA, auto-selects earnings metric based on revenue/industry, applies weighting (linear_recent, equal, custom).

2. **Agent 3 - Valuation Methods** (`agent3-valuation-methods.ts`, ~544 lines): Runs 5 parallel methods (Market Multiple, Cap of Earnings, DCF, Asset-Based, Rule of Thumb). Applies CSRP 8-factor risk scoring. Queries Open Brain for comparable deal context. Contains industry benchmarks for 7 sectors.

3. **Agent 4 - Synthesis** (`agent4-synthesis.ts`, ~131 lines): Calculates weighted FMV across all methods, determines defensible range based on dispersion coefficient, auto-captures results to Open Brain for future deal memory.

Data flow: User financial input -> Agent 2 (normalize) -> Agent 3 (5 methods + CSRP) -> Agent 4 (range + Open Brain capture)

### Auth Flow

Supabase Auth with password-based login/signup. Server actions in `app/auth/actions.ts`. OAuth callback at `app/auth/callback/route.ts`. Middleware redirects unauthenticated users to `/login`.

### Database Tables (Supabase)

- `users` - Profiles + subscription tiers (free/starter/professional/enterprise)
- `valuations` - Business metadata + status (draft/processing/review/complete/archived)
- `financial_data` - Line-item financials by fiscal year and category
- `valuation_methods` - Results from each of the 5 valuation methods
- `thoughts` - Open Brain semantic memory entries

### Key Domain Types (`lib/types.ts`)

- `FinancialCategory` enum: revenue, cogs, operating_expense, non_operating, owner_compensation, depreciation, amortization, interest, taxes, adjustment, sde_addback
- `ValuationMethodType`: market_multiple, capitalization_of_earnings, dcf, asset_based, rule_of_thumb
- `EarningsMetric`: sde, ebitda
- `SubscriptionTier` with `TIER_LIMITS` defining monthly valuation caps per tier

## Canonical Pipeline Fields (Notion ↔ MSOS)

Source-of-truth registry for the deal/lead pipeline. Verbatim string matching is required between Notion and MSOS so the Notion-native sync (Notion Agents/Workers + the MSOS API) never silently drops a field. **Attio and the Relay sync are retired (2026-07-14)** — MSOS holds its pipeline data directly in Supabase and connects to Notion natively, with no Attio intermediary. (Legacy: the former "Notion ↔ Attio Sync — Field Map & Flow Spec v1.0" is superseded.)

**Superseded 2026-07-31 (Phase 14.0):** the single-track `Deal Phase` 10-stage model described below (ratified 2026-06-05) is retired in favor of the two-tier model actually shipped in Phase 13.6/13.6c. Kept verbatim beneath for history; do not build against it.

**Current canonical stages — two separate tiers, both in `src/lib/types.ts`. Do not merge them** (Design Invariant #4: a record can live in many processes — one listing can carry several buyers at different pipeline stages simultaneously, which a single merged stage field cannot represent):

- **`SELLER_STAGES`** (8 stages, Phase 13.6) — the listing/seller lifecycle: `prospecting` · `engagement` · `discovery_valuation` · `packaging_marketing` · `offers_negotiation` · `due_diligence` · `settlement_closure` · `withdrawn_dormant`. Labels are a verbatim mirror of Notion DEALS "Deal Stage." Drives the kanban/table on `/dashboard/deals` (`pipeline-view.tsx`); a stepper on `/dashboard/deals/[id]` shipped in Phase 14.1 (2026-08-01), reading/writing through `src/lib/stage-mapping.ts` since the live `seller_listings.stage` column is still on the older 11-value `seller_listing_stage` enum (see that file's header comment for the sanctioned crosswalk).
- **`BUYER_PIPELINE_STAGES`** (14 stages, Phase 13.6c, "unified Buyer Journey ladder") — per-buyer progress on a deal: `inquiry` · `initial_response_sent` · `nda_executed` · `buyer_profile_received` · `qualified_buyer` · `cim_review` · `loi_ioi` · `under_contract` · `due_diligence` · `financing_approvals` · `closing` · `closed_won` · `closed_lost` · `withdrawn`. Labels are a verbatim mirror of Notion LEADS "Pipeline Stage" and DEALS "Deal Phase." `active_buyers`/`nda_signed_count` are already computed (`DealWithCounts`); a kanban UI ships in Phase 14.2.

See `docs/Phase-14-BizScout-Gap-Close-Design-and-Build-Plan.md` for the full rationale (a BSDOS competitive comparison confirmed this two-tier split is the correct pattern) and the build sequence. See `docs/MSOS-Entity-Architecture-and-Workflow-Model.md` (2026-08-01) for the entity-level model this stage vocabulary sits on top of — what a DEAL vs. a LISTING actually is, and the ratified DealType-as-canonical decision.

<details>
<summary>Superseded 2026-07-31 — original single-track Deal Phase text, kept for history</summary>

**DEALS canonical stage = `Deal Phase`** (ratified 2026-06-05). 10 stages: Inquiry · Qualification · NDA Executed · CIM Review · LOI Negotiation · Under Contract · Due Diligence · Financing / Approvals · Closing · Terminated. Retire `Deal Stage`, `Listing Engagement Stage`, `Seller Pipeline Stage`; collapse `Status` to a health field. This **supersedes** the 2026-04-22 call (which kept `Seller Pipeline Stage` + a new `Buyer Pipeline Stage` and archived `Deal Phase`) because the v1.0 Field Map conversion handoff initializes `Deal Phase`. The §6 additive `Deal Phase` options (CIM Released, Buyer Meeting, IOI, Definitive Agreement, Post-Closing) remain a held decision.

**LEADS canonical stage = `Pipeline Stage`** (11 values) + `Status` (health: New · Active · Dormant · Closed · Withdrawn). Retire `Status Update` (legacy 10-stage) and `Disposition` (8-value axis folded into Pipeline Stage terminals + Status). `Source` and `Stage Entered` additive fields are live.

</details>

## Imported Claude Cowork project instructions

Pick up from prior chats and conversations for this subject including CoWork chat titled MainStreet OS build sprint continuation.   I'm getting "stalls" and errors on previous chats and need to continue the phases on this build.

**2026-07-31 update:** picked up here. A BizScout DEALOS competitive evaluation is filed at `docs/Phase-14-BizScout-Gap-Close-Design-and-Build-Plan.md` (Phase 14.0–14.7). Separately, the working tree as of 2026-07-31 carries substantial uncommitted work not yet reconciled into a commit — see that plan doc's "Existing build — uncommitted work" section before starting new feature work, so nothing already done gets redone or lost.

**2026-08-01 update:** Phase 14.1 (deal-detail stage stepper) shipped, including `src/lib/stage-mapping.ts` to bridge the live `seller_listing_stage` DB enum to `SELLER_STAGES`. A full DEALS/LISTINGS/PROJECTS entity-architecture audit and ratification also happened this session — see `docs/MSOS-Entity-Architecture-and-Workflow-Model.md` for the ratified DEAL/LISTING model and the open items it flags (DealType/TransactionSide/DealWorkflow field redundancy; the one-table-vs-two-table question for Deal/Listing). **PROJECTS development is explicitly deferred** until DEALS/LISTINGS are settled — do not start Phase-15-style Projects work without checking that doc first.
