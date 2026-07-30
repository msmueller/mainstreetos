import { createClient } from '@/lib/supabase/server'
import type { DealStatus, DealType, DealWithCounts, SellerStage } from '@/lib/types'
import DealsViewSwitcher from './DealsViewSwitcher'
import TopBar from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

// ============================================================
// Phase 13.2 — Track-native data source
// ------------------------------------------------------------
// public.deals was archived (archive.deals_legacy_20260420) when
// the data model split into seller_listings (sell-side) and
// buyer_engagements (buy-side). This page now reads the live
// tables and adapts rows into the legacy DealWithCounts shape
// that PipelineView / DealsViewSwitcher render, so the UI layer
// needed no rewrite. Buyer counts resolve deal_access rows via
// the canonical parent_id with a fallback to the legacy deal_id.
// ============================================================

const LISTING_STATUS: Record<string, DealStatus> = {
  mandate: 'active',
  qualifying: 'active',
  active: 'active',
  under_contract: 'under_contract',
  closed_won: 'closed',
  closed_lost: 'closed',
}

// Phase 13.6 — crosswalk: seller_listing_stage → canonical Deal Stage (Notion parity)
const LISTING_SELLER_STAGE: Record<string, SellerStage> = {
  sourcing: 'prospecting',
  qualifying: 'prospecting',
  valuation: 'discovery_valuation',
  mandate: 'engagement',
  active: 'packaging_marketing',
  under_loi: 'offers_negotiation',
  under_contract: 'due_diligence',
  closing: 'settlement_closure',
  closed_won: 'settlement_closure',
  closed_lost: 'withdrawn_dormant',
  on_hold: 'withdrawn_dormant',
}

const DEAL_TYPES: DealType[] = [
  'business_acquisition',
  'business_disposition',
  'cre_acquisition',
  'cre_disposition',
]

/** Null-filled legacy Deal scaffold; overridden per row below. */
const DEAL_DEFAULTS = {
  business_name: null,
  business_address: null,
  industry: null,
  naics_code: null,
  sic_code: null,
  asking_price: null,
  deal_amount: null,
  annual_revenue: null,
  sde: null,
  ebitda: null,
  ffe_value: null,
  inventory_value: null,
  monthly_lease_rate: null,
  potential_commission: null,
  deal_status: null as DealStatus | null,
  deal_type: null as DealType | null,
  transaction_side: null,
  seller_stage: null as SellerStage | null,
  deal_workflow: null,
  confidential_tier: null,
  seller_contact_id: null,
  buyer_contact_id: null,
  valuation_id: null,
  engagement_date: null,
  listing_date: null,
  expiration_date: null,
  close_date: null,
  bbs_listing_url: null,
  om_url: null,
  cim_url: null,
  description: null,
  notes: null,
  next_step: null,
  listing_engagement_stage: null,
  acquisition_criteria: {} as Record<string, unknown>,
  retainer_amount: null,
  retainer_paid: false,
  scope_of_work: null,
  target_businesses: [] as unknown[],
}

interface ListingRow {
  id: string
  name: string | null
  owner_user_id: string | null
  stage: string | null
  industry: string | null
  asking_price_usd: number | null
  revenue_ttm_usd: number | null
  sde_ttm_usd: number | null
  ebitda_ttm_usd: number | null
  commission_pct: number | null
  valuation_id: string | null
  custom_fields: Record<string, unknown> | null
  last_activity_at: string | null
  created_at: string
  updated_at: string
}

interface EngagementRow {
  id: string
  name: string | null
  owner_user_id: string | null
  stage: string | null
  acquisition_stage: string | null
  target_industries: string[] | null
  created_at: string
  updated_at: string
}

interface AccessRow {
  parent_id: string | null
  deal_id: string | null
  is_active: boolean
  nda_signed: boolean
}

function potentialCommission(asking: number | null, pct: number | null): number | null {
  if (asking == null || pct == null) return null
  // commission_pct is stored either as a percentage (10) or a fraction (0.10)
  return pct > 1 ? (asking * pct) / 100 : asking * pct
}

export default async function DealsPage() {
  const supabase = await createClient()
  await supabase.auth.getUser()

  const [listingsRes, engagementsRes, accessRes] = await Promise.all([
    supabase
      .from('seller_listings')
      .select(
        'id, name, owner_user_id, stage, industry, asking_price_usd, revenue_ttm_usd, sde_ttm_usd, ebitda_ttm_usd, commission_pct, valuation_id, custom_fields, last_activity_at, created_at, updated_at'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('buyer_engagements')
      .select('id, name, owner_user_id, stage, acquisition_stage, target_industries, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase.from('deal_access').select('parent_id, deal_id, is_active, nda_signed'),
  ])

  const listings = (listingsRes.data || []) as ListingRow[]
  const engagements = (engagementsRes.data || []) as EngagementRow[]
  const accessRows = (accessRes.data || []) as AccessRow[]

  const countsFor = (recordId: string) => {
    const access = accessRows.filter((a) => a.parent_id === recordId || a.deal_id === recordId)
    return {
      buyer_count: access.length,
      active_buyers: access.filter((a) => a.is_active).length,
      nda_signed_count: access.filter((a) => a.nda_signed).length,
    }
  }

  const listingDeals: DealWithCounts[] = listings.map((l) => {
    const custom = l.custom_fields || {}
    const customType = typeof custom.deal_type === 'string' ? (custom.deal_type as DealType) : null
    return {
      ...DEAL_DEFAULTS,
      id: l.id,
      broker_id: l.owner_user_id || '',
      listing_name: l.name || 'Unnamed Listing',
      industry: l.industry,
      asking_price: l.asking_price_usd != null ? Number(l.asking_price_usd) : null,
      annual_revenue: l.revenue_ttm_usd != null ? Number(l.revenue_ttm_usd) : null,
      sde: l.sde_ttm_usd != null ? Number(l.sde_ttm_usd) : null,
      ebitda: l.ebitda_ttm_usd != null ? Number(l.ebitda_ttm_usd) : null,
      potential_commission: potentialCommission(
        l.asking_price_usd != null ? Number(l.asking_price_usd) : null,
        l.commission_pct != null ? Number(l.commission_pct) : null
      ),
      deal_status: LISTING_STATUS[l.stage || ''] || 'active',
      deal_type: customType && DEAL_TYPES.includes(customType) ? customType : 'business_disposition',
      deal_workflow: 'seller_disposition',
      seller_stage: LISTING_SELLER_STAGE[l.stage || ''] || null,
      valuation_id: l.valuation_id,
      created_at: l.created_at,
      updated_at: l.updated_at,
      ...countsFor(l.id),
    }
  })

  const engagementDeals: DealWithCounts[] = engagements.map((e) => ({
    ...DEAL_DEFAULTS,
    id: e.id,
    broker_id: e.owner_user_id || '',
    listing_name: e.name || 'Unnamed Buyer Search',
    industry: e.target_industries?.length ? e.target_industries.join(', ') : null,
    deal_status: 'active' as DealStatus,
    deal_type: 'business_acquisition' as DealType,
    deal_workflow: 'buyer_acquisition_search',
    created_at: e.created_at,
    updated_at: e.updated_at,
    ...countsFor(e.id),
  }))

  const dealsWithCounts = [...listingDeals, ...engagementDeals].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )

  return (
    <div>
      <TopBar
        breadcrumbs={[
          { label: 'Records', href: '/dashboard' },
          { label: 'Deals' },
        ]}
        title="Deal Pipeline"
        subtitle="Manage your active deals, listings, and buyer searches."
      />

      <DealsViewSwitcher deals={dealsWithCounts} />
    </div>
  )
}
