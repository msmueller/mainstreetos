// MainStreetOS Database Types
// Auto-generated from Supabase schema — keep in sync with migrations

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise'
export type ValuationStatus = 'draft' | 'processing' | 'review' | 'complete' | 'archived'
export type EarningsMetric = 'sde' | 'ebitda'
export type FinancialCategory =
  | 'revenue' | 'cogs' | 'operating_expense' | 'non_operating'
  | 'owner_compensation' | 'depreciation' | 'amortization'
  | 'interest' | 'taxes' | 'adjustment' | 'sde_addback'
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

// ─── Deal Pipeline Types ─────────────────────────────────────────────────────

export type DealStatus = 'active' | 'under_contract' | 'closed' | 'expired' | 'withdrawn'
export type DealType = 'business_acquisition' | 'business_disposition' | 'cre_acquisition' | 'cre_disposition'
export type TransactionSide = 'sell_side' | 'buy_side' | 'dual_agency' | 'consulting'
export type SellerStage =
  | 'prospecting' | 'engagement' | 'discovery_valuation'
  | 'packaging_marketing' | 'offers_negotiation' | 'due_diligence' | 'settlement_closure'
export type DealWorkflow = 'seller_disposition' | 'buyer_lead_management' | 'buyer_acquisition_search'
export type ConfidentialTier = 'level_1_basic' | 'level_2_nda_required' | 'level_3_deal_room'
export type ContactRole =
  | 'buyer' | 'seller' | 'buyer_attorney' | 'seller_attorney'
  | 'buyer_accountant' | 'seller_accountant' | 'lender' | 'landlord'
  | 'co_broker' | 'consultant' | 'other'
export type BuyerStage =
  | 'inquiry' | 'nda_executed' | 'qualified' | 'loi_negotiation'
  | 'under_contract' | 'due_diligence' | 'financing' | 'closing' | 'terminated'
export type PortalCode = 'om' | 'cim' | 'bp' | 'dp' | 'cp' | 'pp' | 'bvr'

export interface Deal {
  id: string
  broker_id: string
  listing_name: string
  business_name: string | null
  business_address: string | null
  industry: string | null
  naics_code: string | null
  sic_code: string | null
  asking_price: number | null
  deal_amount: number | null
  annual_revenue: number | null
  sde: number | null
  ebitda: number | null
  ffe_value: number | null
  inventory_value: number | null
  monthly_lease_rate: number | null
  potential_commission: number | null
  deal_status: DealStatus | null
  deal_type: DealType | null
  transaction_side: TransactionSide | null
  seller_stage: SellerStage | null
  deal_workflow: DealWorkflow | null
  confidential_tier: ConfidentialTier | null
  seller_contact_id: string | null
  buyer_contact_id: string | null
  valuation_id: string | null
  engagement_date: string | null
  listing_date: string | null
  expiration_date: string | null
  close_date: string | null
  bbs_listing_url: string | null
  om_url: string | null
  cim_url: string | null
  description: string | null
  notes: string | null
  next_step: string | null
  listing_engagement_stage: string | null
  acquisition_criteria: Record<string, unknown>
  retainer_amount: number | null
  retainer_paid: boolean
  scope_of_work: string | null
  target_businesses: unknown[]
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  broker_id: string
  auth_user_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  occupation: string | null
  linkedin_url: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  liquid_cash: number | null
  down_payment_available: number | null
  current_income: number | null
  min_investment: number | null
  max_investment: number | null
  total_assets: number | null
  total_liabilities: number | null
  credit_score: number | null
  business_experience: string | null
  financing_plan: string | null
  desired_industries: string | null
  desired_location: string | null
  is_active: boolean
  proof_of_funds_received: boolean
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealAccess {
  id: string
  deal_id: string
  contact_id: string
  role: ContactRole
  current_stage: BuyerStage
  portal: PortalCode
  max_tier: ConfidentialTier
  nda_signed: boolean
  nda_signed_date: string | null
  nda_document_url: string | null
  is_active: boolean
  granted_by: string | null
  granted_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealDocument {
  id: string
  deal_id: string
  document_name: string
  document_type: string
  description: string | null
  storage_path: string | null
  file_size_bytes: number | null
  mime_type: string | null
  min_stage: BuyerStage
  confidential_tier: ConfidentialTier
  granted_contacts: string[]
  uploaded_by: string | null
  uploaded_at: string
  version: number
  is_active: boolean
  created_at: string
}

export const SELLER_STAGES: { key: SellerStage; label: string }[] = [
  { key: 'prospecting', label: 'Prospecting' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'discovery_valuation', label: 'Discovery & Valuation' },
  { key: 'packaging_marketing', label: 'Marketing & Listing' },
  { key: 'offers_negotiation', label: 'Offers & Negotiation' },
  { key: 'due_diligence', label: 'Due Diligence' },
  { key: 'settlement_closure', label: 'Settlement & Closure' },
]

export interface DealWithCounts extends Deal {
  buyer_count: number
  active_buyers: number
  nda_signed_count: number
}

// ─── Subscription & Licensing ────────────────────────────────────────────────

// Map subscription tier → model router broker license
export type BrokerLicense = 'standard' | 'premium'
export function toBrokerLicense(tier: SubscriptionTier): BrokerLicense {
  return tier === 'professional' || tier === 'enterprise' ? 'premium' : 'standard'
}

// Tier limits
export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 1,
  starter: 5,
  professional: 25,
  enterprise: 999,
}
