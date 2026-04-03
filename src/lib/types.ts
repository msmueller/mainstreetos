// MainStreetOS Database Types
// Auto-generated from Supabase schema — keep in sync with migrations

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise'
export type ValuationStatus = 'draft' | 'processing' | 'review' | 'complete' | 'archived'
export type EarningsMetric = 'sde' | 'ebitda'
export type FinancialCategory =
  | 'revenue' | 'cogs' | 'operating_expense' | 'non_operating'
  | 'owner_compensation' | 'depreciation' | 'amortization'
  | 'interest' | 'taxes' | 'adjustment'
export type ValuationMethodType =
  | 'market_multiple' | 'capitalization_of_earnings' | 'dcf'
  | 'asset_based' | 'rule_of_thumb'

export interface User {
  id: string
  full_name: string
  company_name: string | null
  license_number: string | null
  subscription_tier: SubscriptionTier
  valuations_this_month: number
  subscriber_mcp_key: string | null
  created_at: string
  updated_at: string
}

export interface Valuation {
  id: string
  user_id: string
  business_name: string
  sic_code: string | null
  naics_code: string | null
  industry: string | null
  business_description: string | null
  location: string | null
  annual_revenue: number | null
  metric_type: EarningsMetric | null
  normalized_earnings: number | null
  valuation_low: number | null
  valuation_mid: number | null
  valuation_high: number | null
  status: ValuationStatus
  report_url: string | null
  agent_log: Record<string, unknown>[]
  year_weights: Record<string, number>
  weighting_method: string
  owner_comp_in_opex: boolean
  created_at: string
  updated_at: string
}

export interface FinancialData {
  id: string
  valuation_id: string
  fiscal_year: number
  category: FinancialCategory
  line_item: string
  amount: number
  is_adjustment: boolean
  adjustment_reason: string | null
  created_at: string
}

export interface ValuationMethod {
  id: string
  valuation_id: string
  method: ValuationMethodType
  result_value: number | null
  weight: number
  multiple_used: number | null
  cap_rate: number | null
  discount_rate: number | null
  csrp_score: Record<string, unknown> | null
  reasoning: string | null
  created_at: string
}

// Form input types (for creating new records)
export interface NewValuationInput {
  business_name: string
  sic_code?: string
  naics_code?: string
  industry?: string
  business_description?: string
  location?: string
  annual_revenue?: number
}

export interface FinancialLineItem {
  fiscal_year: number
  category: FinancialCategory
  line_item: string
  amount: number
}

// Tier limits
export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 1,
  starter: 5,
  professional: 25,
  enterprise: 999,
}
