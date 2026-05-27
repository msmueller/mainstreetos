/**
 * Lead Router — shared types
 *
 * Types in this file are deliberately flat and serializable so they can
 * cross the function boundary between Claude calls, Supabase rows, and
 * Gmail/Notion API objects without surprises.
 */

// ---------------------------------------------------------------------------
// Claude — extractor output
// ---------------------------------------------------------------------------

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'unknown';
export type SophisticationLevel = 'novice' | 'experienced' | 'broker' | 'unknown';

export interface ExtractedAttributes {
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_investment_range: string | null;
  buyer_timeframe: string | null;
  buyer_experience: string | null;
  buyer_industry_interest: string | null;
  buyer_specific_listing_mentioned: string | null;
  urgency_level: UrgencyLevel;
  sophistication_level: SophisticationLevel;
  extraction_confidence: number;
}

// ---------------------------------------------------------------------------
// Claude — matcher output
// ---------------------------------------------------------------------------

export type MatchScenario =
  | 'new_buyer'
  | 'returning_buyer'
  | 'multi_interest'
  | 'cobroker_referral'
  | 'unmatched';

export interface MatchResult {
  /** Index into the listings array provided to the matcher; null = unmatched */
  matched_listing_index: number | null;
  /** Resolved server-side from index, never trusted from the model */
  matched_listing_id: string | null;
  business_name: string | null;
  industry: string | null;
  confidence: number;
  scenario: MatchScenario;
  reasoning: string;
  buyer_sophistication: SophisticationLevel;
  urgency_signal: 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------------------
// Domain — what the Router fetches and passes around
// ---------------------------------------------------------------------------

/**
 * Flattened lead record assembled from buyer_leads + Notion LEADS row.
 * Property names use snake_case regardless of Notion's display names.
 */
export interface LeadContext {
  /** buyer_leads.id (canonical Supabase ID) */
  buyer_lead_id: string;
  /** buyer_leads.notion_page_id (matches LEADS DB row) */
  notion_page_id: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  /** Subject of the inquiry email if available */
  email_subject: string | null;
  /** Plain-text body of the inquiry email; never logged outside Supabase */
  email_body: string | null;
  /** "BBS", "Direct Email", "Referral", etc. */
  source: string | null;
  /** ISO timestamp of inquiry receipt */
  created_at: string;
  /** Co-broker name, if the lead was referred by one */
  cobroker: string | null;
  /** Number of prior buyer_leads with same email */
  previous_interactions_count: number;
  /** "Buyer Profile Type" from LEADS Notion row — drives click-wrap
   *  template selection. Values: "Institutional" + "Investment" →
   *  NDA_BuyerProfile_Corporate; "MidMarket O&O" → MidMarket (not yet
   *  seeded — falls back to default); "MainStreet O&O" / null / other →
   *  NDA_BuyerProfile (default). Optional so existing test fixtures
   *  (scripts/smoke-router-ai.ts, etc.) compile without modification. */
  buyer_profile_type?: string | null;
}

/**
 * Flattened listing record assembled from seller_listings + Notion Listings row.
 */
export interface Listing {
  /** seller_listings.id (canonical Supabase ID) */
  id: string;
  /** seller_listings.notion_page_id */
  notion_page_id: string | null;
  name: string;
  /** BBS Listing Title — the longer marketing headline from the Notion
   *  Listings DB (e.g., "$537K Revenue 58-Yr NJ Landmark Sandwich Shop"). */
  listing_title: string | null;
  listing_number: string | null;
  industry: string | null;
  /** NAICS code if known; not currently in Notion schema */
  naics: string | null;
  location: string | null;
  asking_price: number | null;
  sde: number | null;
  ebitda: number | null;
  /** Listing stage / status (e.g., 'active', 'pending') */
  status: string;
  description: string | null;
  keywords: string[];
  cobroker: string | null;
  /** Document/links pulled from seller_listings */
  om_link: string | null;
  cim_link: string | null;
  bvr_link: string | null;
  workbook_link: string | null;
  nda_link: string | null;
  bbs_link: string | null;
  /** Per-listing LOI form URL (typically a Google Docs template). */
  loi_link: string | null;
  /** "Default Buyer Profile Type" from LISTINGS Notion row — used as
   *  fallback by the Lead Router when a new LEADS row's own
   *  Buyer Profile Type is empty. Lets Mark flag high-value listings
   *  (Royal Silk, Yogi International, etc.) as Institutional once and
   *  have all future inquiries auto-route to NDA_BuyerProfile_Corporate.
   *  Optional so existing test fixtures (scripts/smoke-router-ai.ts, etc.)
   *  compile without modification. */
  default_buyer_profile_type?: string | null;
}

// ---------------------------------------------------------------------------
// lr_templates — picker registry
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | 'initial_response'        // Email #1 — fires on inquiry receipt
  | 'nda_received'            // Email #2 — gate: Completed NDA
  | 'buyer_profile_received'  // Email #3 — gate: Completed Buyer Profile
  | 'qualified'               // Email #4 — gate: manual phone qualification
  | 'loi_received'            // Email #5 — gate: Completed LOI
  | 'closing'                 // Reserved for future
  | 'unmatched';              // Fallback when matcher can't pick a listing

export type ListingType = 'any' | 'biz' | 'cre';

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  industry_tags: string[];
  listing_type: ListingType;
  listing_id: string | null;
  email_sequence_id: string;
  broker_id: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface RenderContext {
  lead: LeadContext;
  listing: Listing | null;
  attrs: ExtractedAttributes;
  /** Pre-formatted Calendar availability string */
  available_slots: string;
  /** Broker identity from env */
  broker: {
    name: string;
    phone: string;
    email: string;
    firm: string;
    /** Public Notion form URL for the Business Buyer Profile / Qualification
     *  Questionnaire. Used by Email #2 to direct buyers to fill out the form. */
    buyer_profile_link?: string;
    /** Generic NDA + Buyer Profile review/acknowledge URL, used as a fallback
     *  when a listing has no per-listing nda_link AND the buyer didn't execute
     *  NDA via BBS. Will be replaced by the legal Click-Wrap NDA form once
     *  that lands. */
    generic_nda_link?: string;
    /** Public Notion page describing the end-to-end Buyer Acquisition Process
     *  / Review Checklist. Embeddable in any email to give buyers a roadmap
     *  of what to expect through the deal. */
    buyer_acquisition_process?: string;
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Sender — abstracted interface (Gmail today, others later)
// ---------------------------------------------------------------------------

export interface SendParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** If present, send as a reply within this thread */
  thread_id?: string;
  /** RFC 822 Message-ID of the message we're replying to */
  in_reply_to?: string;
  /** Space-separated list of Message-IDs forming the thread chain */
  references?: string;
  cc?: string[];
}

export interface SendResult {
  success: boolean;
  /** Provider's internal message id (e.g., Gmail's "id") */
  message_id: string;
  /** Provider's thread id (e.g., Gmail's "threadId") */
  thread_id: string;
  /** RFC 822 Message-ID we generated (e.g., "<uuid@creresources.biz>"). Used to
   *  thread future replies via In-Reply-To / References headers. */
  rfc822_message_id?: string;
  /** Provider that handled the send */
  provider: 'gmail' | 'saleshandy' | 'mixmax';
  error?: string;
}

export interface Sender {
  send(params: SendParams): Promise<SendResult>;
}

// ---------------------------------------------------------------------------
// Audit row — lr_match_decisions insert shape
// ---------------------------------------------------------------------------

export type MatchDecisionStatus =
  | 'enrolled'
  | 'manual_review'
  | 'failed'
  | 'dry_run'
  | 'superseded';

export interface MatchDecisionInsert {
  buyer_lead_id: string | null;
  notion_lead_page_id: string | null;
  inquiry_gmail_message_id: string | null;
  matched_listing_id: string | null;
  matched_scenario: MatchScenario | null;
  match_confidence: number | null;
  match_reasoning: string | null;
  extracted_attributes: ExtractedAttributes | null;
  template_id: string | null;
  email_sequence_id: string | null;
  sequence_enrollment_id: string | null;
  variables_used: Record<string, string> | null;
  status: MatchDecisionStatus;
  error: string | null;
  dry_run: boolean;
  broker_id: string | null;
}
