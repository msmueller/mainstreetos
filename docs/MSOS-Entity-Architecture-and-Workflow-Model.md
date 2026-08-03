# MSOS Entity Architecture & Workflow Model — v1.0

**Status: GOVERNS the DEALS / LISTINGS / PROJECTS entity model.** Ratified 2026-08-01 (Mark, via Cowork session). Companion document to `docs/Phase-14-BizScout-Gap-Close-Design-and-Build-Plan.md` (which governs stage *vocabulary*); this doc governs entity *structure* — what each database is, what it contains, and how they relate. Where the two overlap, this document is authoritative for structure and the Phase 14 plan is authoritative for stage values.

**Scope note:** PROJECTS (Consulting Side) development is explicitly **deferred** per Mark's direction (2026-08-01) until DEALS and LISTINGS are correct and clear. This doc records the ratified target model for all three so nothing is redesigned twice, but only DEALS/LISTINGS work is cleared to proceed now.

## 1. The Three Workflows

| Workflow | Represents | Primary people | Portal |
|---|---|---|---|
| **Sell Side** | CRE/BIZ dispositions — you represent the seller/landlord | SELLERS (Landlords, Owners) | Seller Portal |
| **Buy Side** | CRE/BIZ acquisitions — you represent the buyer/tenant | BUYERS (Buyers, Tenants) | Buyer Portal |
| **Consulting Side** *(deferred)* | CRE/BIZ advisory engagements | CONSULTING CLIENTS | Client Portal |

All three portals already exist as distinct personas in the live code — confirmed directly from `src/app/portal/ProjectView.tsx`'s own header comment: *"Third portal surface (Roadmap v4.0): PROJECTS persona."* That comment only makes sense if Seller and Buyer portals are the first two — this is existing, intentional architecture, not something to build from scratch. A shared **Data Room** provides all three portals access to key files/documents (NDAs, CIMs, valuations, closing docs).

## 2. DEALS — ratified definition

**A DEAL is a transaction record.** It exists for both dispositions and acquisitions, differentiated by `DealType`:

- `business_disposition`, `cre_disposition` — Sell Side (you represent the seller/landlord)
- `business_acquisition`, `cre_acquisition` — Buy Side (you represent the buyer/tenant)

This field **already exists** in `src/lib/types.ts` on the `Deal` interface — it doesn't need to be invented, only used consistently. It matches Notion's own "Deal Type" field verbatim.

### Cleanup: three redundant fields — DONE (2026-08-01)

The live `Deal` type used to carry three fields that each tried to answer "which side is this deal on," in three different vocabularies. Resolved same-day:

| Field | Values | Status |
|---|---|---|
| `DealType` | business_acquisition, business_disposition, cre_acquisition, cre_disposition | **Canonical.** Kept — matches Notion's Deal Type verbatim, and was already the only one of the three doing real work (filtering, badges/colors/labels in `pipeline-view.tsx`, CSV export in `DealsViewSwitcher.tsx`). |
| `TransactionSide` | sell_side, buy_side, dual_agency, consulting | **Retired.** Confirmed zero usage anywhere outside its own declaration — never read, never set to anything but `null`. `dual_agency` and `consulting` had no equivalent in DealType; if either is needed later (consulting almost certainly will be, once Projects resumes), it gets designed fresh rather than resurrected from dead code. |
| `DealWorkflow` | seller_disposition, buyer_lead_management, buyer_acquisition_search | **Retired.** Its one real behavior — buyer-search rows redirecting to `/dashboard/leads` instead of a deal-detail page (`pipeline-view.tsx`, `DealsViewSwitcher.tsx`) — was ported to a new `isAcquisitionDealType(dt)` helper in `lib/types.ts`, keyed off DealType instead. Behavior is unchanged; the check is just no longer duplicated across two files in two different vocabularies. |

Verified via `tsc --noEmit` and `eslint` on the live repo after the change, plus a residual-reference grep across `src/` (no functional references to either retired name remain).

**New finding while doing this cleanup:** `src/app/dashboard/deals/page.tsx` already unifies two *real, separate, live* tables into the Deals list — `seller_listings` (sell-side, matches Section 3 below) and `buyer_engagements` (buy-side: acquisition_stage, target_industries). `public.deals` was archived to `archive.deals_legacy_20260420` when this split happened. This means Buy Side already has its own live table today, separate from the sell-side one — it isn't waiting on the Deal/Listing schema question in Section 3 at all, which only concerns the disposition side.

### Dual agency — modeled and gated (2026-08-01)

A BIZ or CRE deal can be dual agency (you represent both the seller/landlord and a specific buyer/tenant on the same transaction). This was previously not modeled anywhere — not in Notion, not in the DB, not in code — and the standard buyer paperwork ("CRE Buyer Pre-Qualification, Confidentiality & Acknowledgment," NJ governing law) explicitly disclaims it by default.

It's modeled as a fact about one buyer-on-one-listing relationship, not a `DealType` value: added `agency_type` (`seller_side_only` | `dual_agency`) and `dual_agency_disclosed_at` to `deal_access` (the buyer-transaction junction table), via the `deal_access_dual_agency_gate` migration. Applies uniformly to BIZ and CRE — no vertical-specific logic.

Per Mark's decision, this is a **hard gate**, not just a tracked flag: `advance_buyer_stage()` now raises an exception (blocking the stage write) when a buyer marked `dual_agency` tries to advance past `qualified` (into `loi_negotiation`, `under_contract`, `due_diligence`, `financing`, or `closing`) without a recorded `dual_agency_disclosed_at`. Client-side (`src/app/dashboard/deals/[id]/page.tsx`) now: shows agency status per buyer in the pipeline view; lets a broker mark/unmark a buyer as dual agency and record disclosure (writing directly to `deal_access`, not through the RPC); and surfaces the gate's rejection to the broker instead of silently swallowing it (the pre-existing `handleAdvanceStage` bug of always doing an optimistic update regardless of RPC success/failure was fixed as part of this work — the gate would otherwise have been invisible).

Not addressed here, and flagged for Mark/counsel rather than guessed at: actual dual-agency disclosure *language* — disclosure rules and required forms likely differ by state (Mark has both NJ and PA paperwork), and drafting that is a legal question, not a schema one.

## 3. LISTINGS — ratified definition

**"Listing is a thing a Deal produces, and a form of marketing of the Deal."** (Mark, 2026-08-01, verbatim.)

A LISTING is not an independent top-level container parallel to DEALS. It is a downstream marketing/syndication artifact produced by a **disposition-type** Deal once that Deal reaches its marketing stage. This matches SOP 1's literal step order: the DEAL record is created at Step 1.4 (Client Engagement & Intake) — before any buyer, before any marketing exists — and the LISTING record isn't created until Step 5.2 (Marketing & Listing), as a sub-step of an already-existing Deal.

Consequences of this ordering:

- Acquisition-type Deals (Buy Side) never produce a Listing — there's nothing to market; you're searching on the buyer's/tenant's behalf.
- Every Listing traces back to exactly one disposition Deal.
- "Listing Status" (Active, Under Contract, Closed, etc.) is a state of the marketing artifact; "Deal Stage" is the state of the underlying transaction. These can and should stay distinct fields even though they move together for most of a disposition's life.

### Open implementation question (not yet decided — flagged, not resolved)

Live today, there is no separate `deals` table — every field for both concepts (asking price, stage, valuation link, CIM/OM links) already lives on `seller_listings`, which has been serving as both objects combined into one row since before this model was ratified. Formalizing "Deal produces Listing" as two related tables (a lightweight deals header + a listings marketing-detail child) is a real schema migration, not a naming exercise, and has not been decided. Until it is, treat `seller_listings` as the practical stand-in for the disposition Deal + its Listing artifact combined, and do not build new code that assumes a physical split exists.

## 4. PROJECTS (deferred)

Consulting Side, backing the CONSULTING CLIENTS persona and Client Portal. **Development explicitly deferred (2026-08-01)** until DEALS and LISTINGS are settled and clear. See the standalone audit (`MSOS_Workflow_Redefinition_Audit.docx`, 2026-08-01) for the current-state findings: no ratified Notion SOP, no broker-side dashboard UI, three overlapping database tables (`public.projects`, `public.consulting_projects`, legacy `crm.project`). Nothing in that audit changes as a result of this document — it remains the reference for when Projects work resumes.

## 5. Second-level asset/detail databases

| Vertical | Asset detail | Deal/negotiation detail |
|---|---|---|
| CRE | PROPERTIES (`public.properties` — live) | OFFERS (not yet built) |
| BIZ | BUSINESSES (`public.business_profile` — live; naming mismatch to reconcile, see below) | OFFERS (not yet built) |

Both PROPERTIES and BUSINESSES exist live and populated — this part of the model was already correctly built. OFFERS does not exist as a table on either side yet (no `public.offers`); it's a clean, greenfield build once the Deal/Listing schema question in Section 3 is settled, since Offers presumably nest under whichever entity ends up being "the Deal" (or its per-buyer transaction thread).

**Naming note:** the live BIZ asset table is `business_profile` (singular), not `businesses` as referenced in SOPs and in this model's own language. Cosmetic, but worth a rename pass for consistency once schema work resumes.

## 6. Intake: OPPORTUNITIES and LEADS

Per the one Notion document that actually defines routing today (Co-Brokerage Team Hub, "Dual-Intake Model," SOP 7):

- **Sellers, Properties, Consulting** → OPPORTUNITIES database → converts to DEAL (disposition) or PROJECT.
- **Buyers, Tenants** → LEADS database → converts to DEAL (acquisition) once qualified, or attaches to an existing Listing's buyer-transaction thread.

This is narrower than "OPPORTUNITIES is for any type of workflow" — buy-side traffic is explicitly routed through LEADS, not OPPORTUNITIES, in the one document that defines this today. Recommend confirming this scoping explicitly before building an `opportunities` table, so it isn't built to ingest buy-side traffic it was never meant to touch. Neither `public.opportunities` nor a general-purpose `public.leads` table exists live yet (only `public.buyer_leads`, which is already buy-side-only, consistent with this model) — both are clean, greenfield builds.

## Change Log

- 2026-08-01 — v1.0. Ratified DEAL = transaction record (typed via DealType); LISTING = marketing artifact produced by a disposition Deal. Flagged DealType/TransactionSide/DealWorkflow redundancy for cleanup. Flagged Deal/Listing physical-schema question (one table vs. two) as open. Documented OPPORTUNITIES/LEADS intake scoping per the Dual-Intake Model. PROJECTS work confirmed deferred.
- 2026-08-01 (later same day) — Field cleanup done: `TransactionSide` and `DealWorkflow` removed from `lib/types.ts`; `DealType` is now the sole sell/buy discriminator, with a new `isAcquisitionDealType()` helper replacing DealWorkflow's one real behavior. Verified with tsc/eslint. Discovered `buyer_engagements` as the existing live buy-side table (separate from `seller_listings`) while making this change — Section 2 updated. The Deal/Listing one-table-vs-two-table question (Section 3) remains open and is unaffected by this cleanup.
- 2026-08-01 (later still) — Dual agency modeled and gated: `agency_type`/`dual_agency_disclosed_at` added to `deal_access` (migration `deal_access_dual_agency_gate`); `advance_buyer_stage()` now blocks stage advancement past `qualified` for undisclosed dual-agency buyers. Client-side UI, disclosure-recording handler, and the pre-existing `handleAdvanceStage` error-swallowing bug all shipped together in `deals/[id]/page.tsx` — see Section 2 addendum above. Verified with tsc/eslint against the live repo.
