// ============================================================
// MainStreetOS — CIM Context Loader (Phase 12.14b)
// ------------------------------------------------------------
// Given a seller_listing id and an RLS-scoped Supabase client,
// returns a discriminated union describing the rich context the
// CIM draft agent should see:
//
//   { mode: 'lean', listing }
//     — listing has no linked valuation (or RLS hides it).
//       The CIM will be drafted from top-line listing fields
//       only, exactly like Phase 12.14a.
//
//   { mode: 'rich', listing, valuation, financials, methods }
//     — listing.valuation_id points to a readable valuation.
//       The agent receives the full ontology: multi-year P&L
//       by FinancialCategory, SDE bridge add-backs, all 5
//       valuation_methods results with CSRP scores, and the
//       Agent 5 narrative JSONB.
//
// The loader NEVER throws for a missing/hidden valuation — it
// degrades gracefully to lean mode. It only throws if the
// listing itself can't be loaded (unauthorized / missing),
// which the route handles at the 404 boundary.
//
// Design note: this loader uses the AUTH-SCOPED client, not the
// service-role client. That means RLS is enforced — a broker
// can only load a valuation whose user_id matches theirs. If a
// listing accidentally points at someone else's valuation, the
// valuation fetch silently returns null and we drop to lean
// mode. This is intentional: we never leak a cross-broker
// valuation into a CIM prompt.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FinancialCategory,
  ValuationMethodType,
  EarningsMetric,
  ValuationStatus,
} from '@/lib/types'

// ─── Output shapes ────────────────────────────────────────────

export interface CimListingRow {
  id: string
  name: string | null
  industry: string | null
  asking_price_usd: number | null
  revenue_ttm_usd: number | null
  sde_ttm_usd: number | null
  ebitda_ttm_usd: number | null
  valuation_id: string | null
  business_address: string | null
  years_established: number | null
  employee_count: number | null
  broker_notes: string | null
}

export interface CimValuationRow {
  id: string
  business_name: string | null
  industry: string | null
  location: string | null
  status: ValuationStatus
  metric_type: EarningsMetric | null
  normalized_earnings: number | null
  annual_revenue: number | null
  valuation_low: number | null
  valuation_mid: number | null
  valuation_high: number | null
  year_weights: Record<string, number> | null
  weighting_method: string | null
  owner_comp_in_opex: boolean | null
  business_entity_type: string | null
  business_address: string | null
  owner_name: string | null
  years_in_operation: number | null
  num_employees: number | null
  owner_role: string | null
  owner_weekly_hours: number | null
  valuation_purpose: string | null
  valuation_date: string | null
  agent5_narrative: Record<string, unknown> | null
}

export interface CimFinancialRow {
  fiscal_year: number
  category: FinancialCategory
  line_item: string
  amount: number
  is_adjustment: boolean
  adjustment_reason: string | null
}

export interface CimMethodRow {
  method: ValuationMethodType
  result_value: number | null
  weight: number
  multiple_used: number | null
  cap_rate: number | null
  discount_rate: number | null
  csrp_score: Record<string, unknown> | null
  reasoning: string | null
}

export type CimContext =
  | { mode: 'lean'; listing: CimListingRow }
  | {
      mode: 'rich'
      listing: CimListingRow
      valuation: CimValuationRow
      financials: CimFinancialRow[]
      methods: CimMethodRow[]
    }

// ─── Helpers ──────────────────────────────────────────────────

function normalizeListing(row: Record<string, unknown>): CimListingRow {
  const custom = (row.custom_fields ?? {}) as Record<string, unknown>
  return {
    id: row.id as string,
    name: (row.name as string) ?? null,
    industry: (row.industry as string) ?? null,
    asking_price_usd: Number(row.asking_price_usd ?? 0) || null,
    revenue_ttm_usd: Number(row.revenue_ttm_usd ?? 0) || null,
    sde_ttm_usd: Number(row.sde_ttm_usd ?? 0) || null,
    ebitda_ttm_usd: Number(row.ebitda_ttm_usd ?? 0) || null,
    valuation_id: (row.valuation_id as string) ?? null,
    business_address:
      typeof custom.business_address === 'string'
        ? (custom.business_address as string)
        : null,
    years_established:
      typeof custom.years_established === 'number'
        ? (custom.years_established as number)
        : null,
    employee_count:
      typeof custom.employee_count === 'number'
        ? (custom.employee_count as number)
        : null,
    broker_notes:
      typeof custom.broker_notes === 'string'
        ? (custom.broker_notes as string)
        : null,
  }
}

function normalizeValuation(row: Record<string, unknown>): CimValuationRow {
  return {
    id: row.id as string,
    business_name: (row.business_name as string) ?? null,
    industry: (row.industry as string) ?? null,
    location: (row.location as string) ?? null,
    status: (row.status as ValuationStatus) ?? 'draft',
    metric_type: (row.metric_type as EarningsMetric) ?? null,
    normalized_earnings: Number(row.normalized_earnings ?? 0) || null,
    annual_revenue: Number(row.annual_revenue ?? 0) || null,
    valuation_low: Number(row.valuation_low ?? 0) || null,
    valuation_mid: Number(row.valuation_mid ?? 0) || null,
    valuation_high: Number(row.valuation_high ?? 0) || null,
    year_weights:
      (row.year_weights as Record<string, number> | null) ?? null,
    weighting_method: (row.weighting_method as string) ?? null,
    owner_comp_in_opex:
      typeof row.owner_comp_in_opex === 'boolean'
        ? (row.owner_comp_in_opex as boolean)
        : null,
    business_entity_type: (row.business_entity_type as string) ?? null,
    business_address: (row.business_address as string) ?? null,
    owner_name: (row.owner_name as string) ?? null,
    years_in_operation: (row.years_in_operation as number) ?? null,
    num_employees: (row.num_employees as number) ?? null,
    owner_role: (row.owner_role as string) ?? null,
    owner_weekly_hours: (row.owner_weekly_hours as number) ?? null,
    valuation_purpose: (row.valuation_purpose as string) ?? null,
    valuation_date: (row.valuation_date as string) ?? null,
    agent5_narrative:
      (row.agent5_narrative as Record<string, unknown> | null) ?? null,
  }
}

// ─── Main loader ──────────────────────────────────────────────

export async function loadCimContext(
  supabase: SupabaseClient,
  listingId: string
): Promise<CimContext> {
  // 1. Fetch the listing via RLS. If RLS hides it, surface the error
  //    to the caller — they return 404.
  const { data: listingRow, error: listingErr } = await supabase
    .from('seller_listings')
    .select(
      'id, name, industry, asking_price_usd, revenue_ttm_usd, sde_ttm_usd, ebitda_ttm_usd, valuation_id, custom_fields'
    )
    .eq('id', listingId)
    .single()

  if (listingErr || !listingRow) {
    throw new Error(
      `[cim-context-loader] listing not found or access denied: ${listingErr?.message ?? listingId}`
    )
  }

  const listing = normalizeListing(listingRow as Record<string, unknown>)

  // 2. If no valuation is linked, return lean mode immediately.
  if (!listing.valuation_id) {
    return { mode: 'lean', listing }
  }

  // 3. Try to load the valuation via RLS. If the broker doesn't own it,
  //    this silently returns null — we degrade to lean mode rather than
  //    failing the whole pipeline.
  const { data: valRow, error: valErr } = await supabase
    .from('valuations')
    .select(
      'id, business_name, industry, location, status, metric_type, normalized_earnings, annual_revenue, valuation_low, valuation_mid, valuation_high, year_weights, weighting_method, owner_comp_in_opex, business_entity_type, business_address, owner_name, years_in_operation, num_employees, owner_role, owner_weekly_hours, valuation_purpose, valuation_date, agent5_narrative'
    )
    .eq('id', listing.valuation_id)
    .maybeSingle()

  if (valErr || !valRow) {
    return { mode: 'lean', listing }
  }

  const valuation = normalizeValuation(valRow as Record<string, unknown>)

  // 4. Load financials + methods in parallel. Both are scoped to the
  //    valuation — RLS on those tables piggybacks on the valuation
  //    ownership check.
  const [finRes, methRes] = await Promise.all([
    supabase
      .from('financial_data')
      .select(
        'fiscal_year, category, line_item, amount, is_adjustment, adjustment_reason'
      )
      .eq('valuation_id', valuation.id)
      .order('fiscal_year', { ascending: true })
      .order('category', { ascending: true }),
    supabase
      .from('valuation_methods')
      .select(
        'method, result_value, weight, multiple_used, cap_rate, discount_rate, csrp_score, reasoning'
      )
      .eq('valuation_id', valuation.id)
      .order('weight', { ascending: false }),
  ])

  const financials: CimFinancialRow[] = (finRes.data ?? []).map((r) => ({
    fiscal_year: r.fiscal_year as number,
    category: r.category as FinancialCategory,
    line_item: (r.line_item as string) ?? '',
    amount: Number(r.amount ?? 0),
    is_adjustment: Boolean(r.is_adjustment),
    adjustment_reason: (r.adjustment_reason as string) ?? null,
  }))

  const methods: CimMethodRow[] = (methRes.data ?? []).map((r) => ({
    method: r.method as ValuationMethodType,
    result_value:
      r.result_value === null || r.result_value === undefined
        ? null
        : Number(r.result_value),
    weight: Number(r.weight ?? 0),
    multiple_used:
      r.multiple_used === null || r.multiple_used === undefined
        ? null
        : Number(r.multiple_used),
    cap_rate:
      r.cap_rate === null || r.cap_rate === undefined
        ? null
        : Number(r.cap_rate),
    discount_rate:
      r.discount_rate === null || r.discount_rate === undefined
        ? null
        : Number(r.discount_rate),
    csrp_score:
      (r.csrp_score as Record<string, unknown> | null) ?? null,
    reasoning: (r.reasoning as string) ?? null,
  }))

  return { mode: 'rich', listing, valuation, financials, methods }
}
