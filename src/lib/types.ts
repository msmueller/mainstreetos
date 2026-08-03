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

/**
 * 2026-08-01 cleanup (see docs/MSOS-Entity-Architecture-and-Workflow-Model.md):
 * DealType is the single canonical field for sell/buy classification — it
 * mirrors Notion's own "Deal Type" field verbatim. TransactionSide and
 * DealWorkflow used to duplicate this in two other vocabularies and have
 * been retired; this helper replaces DealWorkflow's one real usage (the
 * buyer-search -> /dashboard/leads redirect in pipeline-view.tsx and
 * DealsViewSwitcher.tsx).
 */
export function isAcquisitionDealType(dt: DealType | null): boolean {
  return dt === 'business_acquisition' || dt === 'cre_acquisition'
}

export type SellerStage =
  | 'prospecting' | 'engagement' | 'discovery_valuation'
  | 'packaging_marketing' | 'offers_negotiation' | 'due_diligence' | 'settlement_closure'
  | 'withdrawn_dormant'
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
  seller_stage: SellerStage | null
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

// Phase 13.6 — labels are a verbatim mirror of Notion DEALS "Deal Stage" options.
export const SELLER_STAGES: { key: SellerStage; label: string }[] = [
  { key: 'prospecting', label: '1. Prospecting & Pitching' },
  { key: 'engagement', label: '2. Engagement & Agreements' },
  { key: 'discovery_valuation', label: '3. Discovery & Valuation' },
  { key: 'packaging_marketing', label: '4. Packaging & Marketing' },
  { key: 'offers_negotiation', label: '5. Offers & Negotiation' },
  { key: 'due_diligence', label: '6. Due Diligence & Transaction' },
  { key: 'settlement_closure', label: '7. Settlement & Closure' },
  { key: 'withdrawn_dormant', label: '8. Withdrawn or Dormant' },
]

// Phase 13.6c — unified 14-stage Buyer Journey ladder.
// Labels are a verbatim mirror of Notion LEADS "Pipeline Stage" and DEALS "Deal Phase".
// Keys mirror the buyer_pipeline_stage Postgres enum (loi_ioi retained as legacy key for stage 7).
export type BuyerPipelineStage =
  | 'inquiry' | 'initial_response_sent' | 'nda_executed' | 'buyer_profile_received'
  | 'qualified_buyer' | 'cim_review' | 'loi_ioi' | 'under_contract' | 'due_diligence'
  | 'financing_approvals' | 'closing' | 'closed_won' | 'closed_lost' | 'withdrawn'

export const BUYER_PIPELINE_STAGES: { key: BuyerPipelineStage; label: string }[] = [
  { key: 'inquiry', label: '1. Inquiry' },
  { key: 'initial_response_sent', label: '2. Initial Response Sent' },
  { key: 'nda_executed', label: '3. NDA Executed' },
  { key: 'buyer_profile_received', label: '4. Buyer Profile Received' },
  { key: 'qualified_buyer', label: '5. Qualified Buyer / POF' },
  { key: 'cim_review', label: '6. CIM Review' },
  { key: 'loi_ioi', label: '7. LOI Negotiation' },
  { key: 'under_contract', label: '8. Under Contract' },
  { key: 'due_diligence', label: '9. Due Diligence' },
  { key: 'financing_approvals', label: '10. Financing / Approvals' },
  { key: 'closing', label: '11. Closing' },
  { key: 'closed_won', label: '12. Closed Won' },
  { key: 'closed_lost', label: '13. Closed Lost' },
  { key: 'withdrawn', label: '14. Withdrawn / No longer pursuing' },
]

export interface DealWithCounts extends Deal {
  buyer_count: number
  active_buyers: number
  nda_signed_count: number
}

// ─── Communications / Activity Log ──────────────────────────────────────────

export type CommunicationType = 'email' | 'phone' | 'note' | 'text'
export type CommunicationDirection = 'inbound' | 'outbound'
export type CommunicationSource = 'manual' | 'gmail_sync' | 'bbs_scrape'

export interface Communication {
  id: string
  broker_id: string
  contact_id: string
  deal_id: string | null
  comm_type: CommunicationType
  direction: CommunicationDirection | null
  subject: string | null
  body: string | null
  summary: string | null
  gmail_message_id: string | null
  gmail_thread_id: string | null
  from_address: string | null
  to_addresses: string[] | null
  cc_addresses: string[] | null
  phone_number: string | null
  duration_minutes: number | null
  occurred_at: string
  logged_by: CommunicationSource
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export const COMM_TYPE_LABELS: Record<CommunicationType, string> = {
  email: 'Email',
  phone: 'Phone Call',
  note: 'Note',
  text: 'Text/SMS',
}

// ─── Projects (Consulting Side) ──────────────────────────────────────────────
// Phase 14.4 (2026-08-02) — broker dashboard build. public.projects canonicalized
// over public.consulting_projects (now archived) per docs/MSOS-Entity-Architecture-
// and-Workflow-Model.md Section 4. The client-portal side (ProjectView.tsx,
// project_access, project_deliverables) already existed from Phase 12.12-C —
// these types mirror that real, live schema, not a new design.

export type ServiceType =
  | 'business_valuation' | 'financial_modeling' | 'business_planning' | 'cre_bpo'
  | 'lease_abstract' | 'document_review' | 'market_analysis' | 'strategic_advisory'
  | 'consulting_general' | 'other'

export type ProjectStatus =
  | 'inquiry' | 'proposal_sent' | 'accepted' | 'in_progress' | 'under_review'
  | 'completed' | 'invoiced' | 'paid' | 'cancelled'

// Labels are this dashboard's own — Notion PROJECTS remains source-of-record
// (per ProjectView.tsx's own comment) and may use different labels; there is no
// ratified Notion SOP for Projects stage vocabulary as of 2026-08-01's audit.
export const PROJECT_STATUSES: { key: ProjectStatus; label: string }[] = [
  { key: 'inquiry', label: '1. Inquiry' },
  { key: 'proposal_sent', label: '2. Proposal Sent' },
  { key: 'accepted', label: '3. Accepted' },
  { key: 'in_progress', label: '4. In Progress' },
  { key: 'under_review', label: '5. Under Review' },
  { key: 'completed', label: '6. Completed' },
  { key: 'invoiced', label: '7. Invoiced' },
  { key: 'paid', label: '8. Paid' },
  { key: 'cancelled', label: '9. Cancelled' },
]

export type DeliverableType =
  | 'valuation_report' | 'financial_model' | 'business_plan' | 'market_study'
  | 'lease_abstract' | 'memo_opinion_letter' | 'presentation' | 'cim_document'
  | 'om_document' | 'other'

export type DeliverableStatus = 'not_started' | 'in_progress' | 'under_review' | 'completed' | 'delivered'

export interface Project {
  id: string
  broker_id: string
  project_name: string
  service_type: ServiceType
  scope_description: string | null
  client_contact_id: string | null
  project_status: ProjectStatus
  proposal_amount: number | null
  actual_fee: number | null
  payment_terms: string | null
  date_started: string | null
  due_date: string | null
  date_completed: string | null
  date_invoiced: string | null
  date_paid: string | null
  hours_estimated: number | null
  hours_actual: number | null
  lead_source: string | null
  conversion_opportunity: string | null
  related_deal_id: string | null
  valuation_id: string | null
  proposal_url: string | null
  invoice_url: string | null
  notes: string | null
  scope_statement: string | null
  engagement_type: string | null
  billing_model: string | null
  hourly_rate: number | null
  retainer_amount: number | null
  completion_percent: number | null
  kickoff_at: string | null
  target_completion_at: string | null
  actual_completion_at: string | null
  consulting_category: string | null
  engagement_tags: string[] | null
  // Ported from consulting_projects during the 2026-08-02 consolidation
  notion_page_id: string | null
  source_opportunity_id: string | null
  source_lead_id: string | null
  primary_business_id: string | null
  primary_property_id: string | null
  resulting_listing_id: string | null
  created_at: string
  updated_at: string
}

export interface ProjectWithCounts extends Project {
  client_name: string | null
  deliverable_count: number
  delivered_count: number
  access_count: number
}

export interface ProjectDeliverable {
  id: string
  project_id: string
  deliverable_name: string
  deliverable_type: DeliverableType
  description: string | null
  status: DeliverableStatus
  due_date: string | null
  date_completed: string | null
  date_delivered: string | null
  storage_path: string | null
  external_url: string | null
  visible_to_client: boolean
  notes: string | null
  created_at: string
}

export interface ProjectAccess {
  id: string
  project_id: string
  contact_id: string
  role: ContactRole
  portal: PortalCode
  is_active: boolean
  granted_by: string | null
  granted_at: string
  notes: string | null
  created_at: string
  updated_at: string
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
