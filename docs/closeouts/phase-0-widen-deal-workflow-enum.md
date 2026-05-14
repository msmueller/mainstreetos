# Phase 0 Closeout — Widen `deal_workflow` Enum (3 → 6)

**Phase:** Phase 0 warm-up
**Status:** Complete
**Closeout date:** 2026-04-22
**Migration:** `phase_0_widen_deal_workflow_enum_cre_consulting`
**Predecessors:** Blueprint adoption of six Design Invariants; Phase 6b CRE Overlay planned as peer to Phase 6 BIZ
**Production branch:** main (migration applied via Supabase MCP)

## What landed

A single-statement, idempotent enum-widening migration added three new values to `public.deal_workflow`:

| # | Value | Purpose |
|---|---|---|
| 1 | `seller_disposition` | BIZ sell-side (existing) |
| 2 | `buyer_lead_management` | Buyer lead qualification, both verticals (existing) |
| 3 | `buyer_acquisition_search` | BIZ retained buyer search (existing) |
| 4 | `cre_sale` | CRE investment sale / user-sale (new) |
| 5 | `cre_lease` | CRE tenant rep or landlord rep (new) |
| 6 | `consulting_engagement` | Advisory retainer, all practices (new) |

Migration body:

```sql
ALTER TYPE public.deal_workflow ADD VALUE IF NOT EXISTS 'cre_sale';
ALTER TYPE public.deal_workflow ADD VALUE IF NOT EXISTS 'cre_lease';
ALTER TYPE public.deal_workflow ADD VALUE IF NOT EXISTS 'consulting_engagement';
```

## Design Invariants exercised

- **#1 (A contact is not a deal)** — unaffected; opportunity semantics still live off the `contacts` table.
- **#6 (CRE and BIZ share a core, not identical stages)** — widening lets CRE and consulting work ride the same `deal_workflow` axis that BIZ uses; pipeline stages stay per-vertical in separate enums (`seller_listing_stage`, `cre_opportunity_stage`, etc.).

## Why enum widening instead of a `deals → opportunities` rename

The original proposal was to introduce an `Opportunity` object spanning CRE + BIZ + consulting. A full table rename is unnecessary in the current schema for two reasons:

1. The legacy `public.deals` table no longer exists. It was split during Phase 1 into four canonical parents (`seller_listings`, `buyer_engagements`, `buyer_leads`, `consulting_projects`) and dropped in migration `103_drop_legacy_tables`. A `deals → opportunities` rename therefore has no target.
2. `deal_workflow` itself now only appears on the frozen `archive.deals_legacy_20260420` copy. Widening it is zero-risk to production writes and preserves the enum's semantic intent for future adoption.

The widening is therefore a **forward-looking vocabulary move**: Phase 6b (`cre_listings`) and any future consulting opportunity table can adopt `deal_workflow` as their workflow-type discriminator rather than forking CRE-specific equivalents. This directly implements Invariant #6.

## Verification

Ran via Supabase MCP:

```sql
SELECT e.enumlabel, e.enumsortorder
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'deal_workflow'
ORDER BY e.enumsortorder;
```

Result: 6 rows in order — `seller_disposition` (1), `buyer_lead_management` (2), `buyer_acquisition_search` (3), `cre_sale` (4), `cre_lease` (5), `consulting_engagement` (6). ✅

Archive sanity check:

```sql
SELECT deal_workflow::text AS value, COUNT(*) FROM archive.deals_legacy_20260420 GROUP BY 1;
```

Result: 13 rows on `seller_disposition`, 1 on `buyer_acquisition_search`, 9 NULL — matches pre-migration state. No rows on new values (expected). ✅

Reference check: `pg_attribute` + `pg_get_functiondef` grep confirmed `deal_workflow` is not referenced by any live public table, view, or function — only the archive table.

Security advisors: no new warnings introduced by this migration.

## Deferred

- `seller_org_id` / `buyer_org_id` FK columns on canonical parents → Phase 1 (after `organizations` ships).
- Adoption of `deal_workflow` by `cre_listings` → Phase 6b migration 038.

## Follow-ups

- Tick the Phase 0 checkbox on the Attio Parity Blueprint (page `3489af0754ec81908f4dfc1e1640b27a`). The exact Notion markdown representation of the bullet didn't match `update_content` old_str candidates; the cosmetic tick can be handled manually or via a focused block-level fetch in a later session.
- Link this closeout page from the Phase 0 entry in the Blueprint's phased table.
