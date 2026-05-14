# Phase 1 Closeout — Core Objects: Org FKs on Canonical Parents

**Phase:** Phase 1 — Core Objects + org FKs
**Status:** Complete
**Closeout date:** 2026-04-22
**Migration:** `phase_1_core_objects_add_org_fks_buyer_leads_consulting`
**Predecessors:** Phase 0 (deal_workflow widening 3→6); `msos_024_organizations` (shipped); `msos_025_contact_organizations` (shipped)
**Production branch:** main (migration applied via Supabase MCP)

## What landed

Additive, idempotent migration that closes the remaining Phase 1 gap: two of the four canonical deal parents (`buyer_leads`, `consulting_projects`) were missing `organization_id` FK columns pointing at `public.organizations`. This migration adds them so all four parents now share the same org-linkage contract.

### Before

| Parent table | `organization_id` column | FK to `organizations` | Index |
|---|---|---|---|
| `seller_listings` | ✅ present | ✅ SET NULL | ✅ `idx_seller_listings_org` |
| `buyer_engagements` | ✅ present | ✅ SET NULL | ✅ `idx_buyer_engagements_org` |
| `buyer_leads` | ❌ missing | ❌ | ❌ |
| `consulting_projects` | ❌ missing | ❌ | ❌ |

### After

| Parent table | `organization_id` column | FK to `organizations` | Index |
|---|---|---|---|
| `seller_listings` | ✅ | ✅ SET NULL | ✅ `idx_seller_listings_org` |
| `buyer_engagements` | ✅ | ✅ SET NULL | ✅ `idx_buyer_engagements_org` |
| `buyer_leads` | ✅ **(new)** | ✅ **(new)** SET NULL | ✅ **(new)** `idx_buyer_leads_org` |
| `consulting_projects` | ✅ **(new)** | ✅ **(new)** SET NULL | ✅ **(new)** `idx_consulting_projects_org` |

Migration body:

```sql
ALTER TABLE public.buyer_leads
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.consulting_projects
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_buyer_leads_org
  ON public.buyer_leads (organization_id);

CREATE INDEX IF NOT EXISTS idx_consulting_projects_org
  ON public.consulting_projects (organization_id);
```

Plus column comments documenting purpose and phase provenance.

## Design Invariants exercised

- **#1 (A contact is not a deal)** — opportunity records (the four canonical parents) carry the organization linkage. Contacts reach organizations through the `contact_organizations` join table, not through parent tables. This migration preserves that boundary: the FK lives on the deal, not on the contact.
- **#2 (A company is not a workflow)** — `organizations` persists independently. The FK is `ON DELETE SET NULL` so the parent record outlives a deleted org (the org purge would otherwise cascade-destroy a deal, which violates both invariant #2 and #3).
- **#6 (CRE and BIZ share a core, not identical stages)** — a uniform `organization_id UUID → organizations.id` shape applies across all BIZ parents today and will apply identically to CRE parents when Phase 6b ships `cre_listings` and `properties`. One shape, many parents.

## Why additive-only, not a cleanup pass

The schema still carries three orphan legacy columns named `primary_organization_id` on `seller_listings`, `buyer_engagements`, and `buyer_leads`. They have no FK, are 100 % null across 40 live rows, and a codebase grep (`primary_organization_id`, `primaryOrganizationId`) returns zero hits. They are safe to drop, but doing so is a breaking change (even if no current consumer references them) and belongs in its own focused cleanup pass once the CIM/OM writers and dashboard queries are confirmed to only read `organization_id`.

**Deferred to Phase 1.1 (cleanup):** `ALTER TABLE ... DROP COLUMN primary_organization_id` on the three affected parents, with a security advisors check before and after.

## Verification

Ran via Supabase MCP after the migration.

**FK presence (expected: 4 rows, all → `organizations`, all `SET NULL`):**

```sql
SELECT conrelid::regclass::text AS table_name, conname, confrelid::regclass::text AS ref,
       CASE confdeltype WHEN 'n' THEN 'SET NULL' END AS on_delete
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid = 'public.organizations'::regclass
  AND conrelid::regclass::text IN ('seller_listings','buyer_engagements','buyer_leads','consulting_projects');
```

Result: 4 rows ✅
- `buyer_engagements_organization_id_fkey`
- `buyer_leads_organization_id_fkey` (new)
- `consulting_projects_organization_id_fkey` (new)
- `seller_listings_organization_id_fkey`

**Index presence (expected: 4 rows, one per parent):**

Result: 4 rows ✅
- `idx_buyer_engagements_org`
- `idx_buyer_leads_org` (new)
- `idx_consulting_projects_org` (new)
- `idx_seller_listings_org`

**RLS untouched:** RLS was already enabled on all four parents (policy counts: seller_listings=4, buyer_engagements=4, buyer_leads=4, consulting_projects=1). Adding a nullable column does not change the policy surface. No policies rewritten.

**Security advisors:** Only the two pre-existing `rls_policy_always_true` warnings on `buyer_profile_submissions.anon_insert_profile` and `nda_submissions.anon_insert_nda` — both intentional for the public NDA/inquiry intake flow. No new regressions introduced by this migration.

**Row-level impact:** Zero rows affected. All 40 existing rows across the four parents already had null org references; new columns default to null.

## Deferred

- **Phase 1.1 (cleanup):** Drop orphan `primary_organization_id` columns from `seller_listings`, `buyer_engagements`, `buyer_leads`.
- **Phase 1.2 (backfill):** Populate `organization_id` on existing rows by walking `primary_contact_id → contact_organizations → organization_id`. Requires confirming which of a contact's possibly-multiple orgs is the "right" one per parent — likely the most recent `is_primary = true` link.
- **Phase 1.3 (integrity):** Once backfilled, consider promoting `organization_id` to NOT NULL on `seller_listings` and `consulting_projects` (a listing or engagement without a client makes little sense). Leave `buyer_leads` and `buyer_engagements` nullable since a cold lead may not yet have an identified buying vehicle.

## Follow-ups

- Tick the Phase 1 checkbox on the Attio Parity Blueprint (page `3489af0754ec81908f4dfc1e1640b27a`). As noted in the Phase 0 closeout, `update_content` old_str matching against the Notion block stream is unreliable from the search-snippet layer; this can be handled manually or via a focused block-level fetch in a later session.
- Link this closeout page from the Phase 1 entry in the Blueprint's phased table.
- Update the CIM/OM context loaders (`src/lib/agents/*-context-loader.ts`) to prefer `organization_id` over any lingering `primary_contact_id → contact_organizations` joins when resolving the seller/buyer/client organization, now that the FK is canonical across all parents.
