/**
 * Phase 14.1b — seller_listings.stage <-> SELLER_STAGES translation layer.
 *
 * 2026-08-01 finding: the live `seller_listings.stage` column is a Postgres
 * enum (`seller_listing_stage`, 11 values) that was never migrated to match
 * the 8-value `SELLER_STAGES` taxonomy ratified in Phase 13.6 (`lib/types.ts`).
 * Every row in seller_listings — not just one — carries a raw value from the
 * old enum. Writing a SELLER_STAGES key straight into that column (as the
 * Phase 14.1 stepper's "Move stage" control does) fails at the database
 * level, since Postgres enums reject any value outside their defined set.
 *
 * Decision (2026-08-01): keep the live DB enum as-is and translate at the
 * app boundary, rather than migrating the schema. This module is that
 * translation layer — every read/write of `seller_listings.stage` from the
 * deal detail page should go through these two functions instead of using
 * the raw column value directly.
 *
 * 2026-08-01 correction: the first version of this mapping was a reasonable
 * guess authored before finding the actual governing doc. The Notion
 * "🎚️ Deal Phase Crosswalk & Stage Governance — v1.1" page (updated
 * 2026-07-29, Mark-approved) already specifies the sanctioned D→A crosswalk
 * verbatim — this module now mirrors that table exactly rather than
 * guessing again:
 *   sourcing, qualifying  -> 1. Prospecting & Pitching
 *   mandate               -> 2. Engagement & Agreements
 *   valuation             -> 3. Discovery & Valuation
 *   active                -> 4. Packaging & Marketing
 *   under_loi             -> 5. Offers & Negotiation
 *   under_contract        -> 6. Due Diligence & Transaction
 *   closing, closed_won   -> 7. Settlement & Closure
 *   closed_lost, on_hold  -> 8. Withdrawn or Dormant
 * (The earlier draft wrongly split qualifying into its own bucket and put
 * mandate under packaging_marketing — both now corrected to match Notion.)
 *
 * The governing doc only defines the read-direction (D->A) crosswalk; it
 * doesn't disambiguate a single write-target for the two 2-to-1 buckets.
 * `dbStageFromSellerStage` picks the earliest DB stage in each collapsed
 * group for writes. One judgment call remains open: `closed_lost` vs.
 * `on_hold` both read as `withdrawn_dormant`, and the stepper's generic
 * "Move stage" write defaults to `on_hold` (paused) rather than
 * `closed_lost` (didn't sell) — flag if that's not the right default for a
 * manual stage change.
 */

import type { SellerStage } from './types'

/** Raw values of the live `seller_listing_stage` Postgres enum. */
export type DbSellerStage =
  | 'sourcing'
  | 'qualifying'
  | 'valuation'
  | 'mandate'
  | 'active'
  | 'under_loi'
  | 'under_contract'
  | 'closing'
  | 'closed_won'
  | 'closed_lost'
  | 'on_hold'

/** DB enum value -> app-level SELLER_STAGES key, for reads. */
const DB_TO_SELLER_STAGE: Record<DbSellerStage, SellerStage> = {
  sourcing: 'prospecting',
  qualifying: 'prospecting',
  mandate: 'engagement',
  valuation: 'discovery_valuation',
  active: 'packaging_marketing',
  under_loi: 'offers_negotiation',
  under_contract: 'due_diligence',
  closing: 'settlement_closure',
  closed_won: 'settlement_closure',
  closed_lost: 'withdrawn_dormant',
  on_hold: 'withdrawn_dormant',
}

/**
 * App-level SELLER_STAGES key -> canonical DB enum value, for writes.
 * Picks the earliest DB stage in each collapsed group (see module notes).
 */
const SELLER_STAGE_TO_DB: Record<SellerStage, DbSellerStage> = {
  prospecting: 'sourcing',
  engagement: 'mandate',
  discovery_valuation: 'valuation',
  packaging_marketing: 'active',
  offers_negotiation: 'under_loi',
  due_diligence: 'under_contract',
  settlement_closure: 'closing',
  withdrawn_dormant: 'on_hold',
}

/**
 * Translate a raw `seller_listings.stage` DB value into a SELLER_STAGES key
 * for the stepper. Returns null for null/empty input, and — importantly —
 * also returns null for any string that isn't a recognized DB enum value,
 * so the DealStageStepper's "unmapped stage" warning still fires on truly
 * unexpected data rather than silently mis-rendering it.
 */
export function sellerStageFromDb(dbValue: string | null | undefined): SellerStage | null {
  if (!dbValue) return null
  return DB_TO_SELLER_STAGE[dbValue as DbSellerStage] ?? null
}

/**
 * Translate a SELLER_STAGES key (from the stepper's "Move stage" menu) into
 * the DB enum value to write to `seller_listings.stage`.
 */
export function dbStageFromSellerStage(sellerStage: SellerStage): DbSellerStage {
  return SELLER_STAGE_TO_DB[sellerStage]
}
