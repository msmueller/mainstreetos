/**
 * Lead Router — Notion API wrapper
 *
 * Maps Notion's display-name properties (e.g., "First Name", "Email") onto
 * the snake_case fields the rest of the Router uses. The integration this
 * key belongs to is "MainStreetOS AI Drafts" — both LEADS and Listings
 * databases must be shared with it via Notion → DB → Connections.
 */

import { Client } from '@notionhq/client';
import type { Listing, LeadContext } from './types';
import {
  pipelineStageToNotionLabel,
  dispositionToNotionLabel,
  buyerQualityToNotionLabel,
  type PipelineStage,
  type Disposition,
  type BuyerQuality,
} from './buyer-axes';

let cached: Client | null = null;

export function getNotionClient(): Client {
  if (cached) return cached;
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error('Lead Router: NOTION_API_KEY is not set');
  }
  cached = new Client({ auth: apiKey });
  return cached;
}

// ---------------------------------------------------------------------------
// Property extraction helpers — Notion's API returns properties in nested
// shapes that depend on the property type. These helpers normalize.
// ---------------------------------------------------------------------------

type NotionProps = Record<string, any>;

function readTitle(p: any): string | null {
  if (!p?.title?.length) return null;
  return p.title.map((t: any) => t.plain_text).join('').trim() || null;
}

function readRichText(p: any): string | null {
  if (!p?.rich_text?.length) return null;
  return p.rich_text.map((t: any) => t.plain_text).join('').trim() || null;
}

function readNumber(p: any): number | null {
  return typeof p?.number === 'number' ? p.number : null;
}

function readEmail(p: any): string | null {
  return p?.email ?? null;
}

function readPhone(p: any): string | null {
  return p?.phone_number ?? null;
}

function readSelect(p: any): string | null {
  return p?.select?.name ?? null;
}

function readUrl(p: any): string | null {
  return p?.url ?? null;
}

function readDate(p: any): string | null {
  return p?.date?.start ?? null;
}

// ---------------------------------------------------------------------------
// LEADS DB — fetch by page id
// ---------------------------------------------------------------------------

/**
 * Mapping from Notion property name → flat snake_case field used by the
 * Router. Source of truth for naming drift. If Mark renames a Notion
 * property, update here, not the matcher prompt.
 */
const LEADS_PROPERTY_MAP = {
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  message: 'Message',
  date_received: 'Date Received',
  listing_number: 'Listing Number',
  bbs_listing_title: 'BBS Listing Title',
  source: 'Lead Type',
  status: 'Status',
  status_update: 'Status Update',
  buyer_type: 'Buyer Type',
  amount_to_invest: 'Amount to Invest',
  timeframe: 'TimeFrame',
  desired_industries: 'BP Desired Industries',
  company: 'Company',
  zip_code: 'Zip Code',
  // Phase 8 (2026-05-26): drives click-wrap template selection.
  // Values: "Institutional" → NDA_BuyerProfile_Corporate;
  // "MainStreetO&O" → NDA_BuyerProfile_MidMarket (not yet seeded);
  // empty/other → NDA_BuyerProfile (default).
  buyer_profile_type: 'Buyer Profile Type',
} as const;

/**
 * Fetch a Notion LEADS row by its page id and flatten to LeadContext-ready
 * fields. The caller is responsible for joining buyer_leads.id and
 * computing previous_interactions_count.
 */
export async function fetchNotionLead(pageId: string): Promise<{
  notion_page_id: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  email_subject: string | null;
  email_body: string | null;
  source: string | null;
  created_at: string;
  listing_number_mentioned: string | null;
  bbs_listing_title_mentioned: string | null;
  amount_to_invest: number | null;
  timeframe: string | null;
  desired_industries: string | null;
  buyer_profile_type: string | null;
}> {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) {
    throw new Error(`Notion page ${pageId} did not return properties`);
  }

  const props = page.properties as NotionProps;
  const map = LEADS_PROPERTY_MAP;

  return {
    notion_page_id: pageId,
    buyer_first_name: readRichText(props[map.first_name]),
    buyer_last_name: readRichText(props[map.last_name]),
    buyer_email: readEmail(props[map.email]),
    buyer_phone: readPhone(props[map.phone]),
    email_subject: readRichText(props[map.bbs_listing_title]) ?? null,
    email_body: readRichText(props[map.message]),
    source: readSelect(props[map.source]),
    created_at: readDate(props[map.date_received]) ?? new Date().toISOString(),
    listing_number_mentioned: (() => {
      const n = readNumber(props[map.listing_number]);
      return n === null ? null : String(n);
    })(),
    bbs_listing_title_mentioned: readRichText(props[map.bbs_listing_title]),
    amount_to_invest: readNumber(props[map.amount_to_invest]),
    timeframe: readSelect(props[map.timeframe]),
    desired_industries: readRichText(props[map.desired_industries]),
    buyer_profile_type: readSelect(props[map.buyer_profile_type]),
  };
}

// ---------------------------------------------------------------------------
// Listings DB — fetch by page id
// ---------------------------------------------------------------------------

const LISTINGS_PROPERTY_MAP = {
  listing_name: 'Listing Name',
  listing_number: 'BBS Listing #',
  listing_title: 'BBS Listing Title',
  industry: 'Industry Category',
  asking_price: 'Asking Price',
  sde: 'Cash Flow (SDE)',
  revenue: 'Revenue',
  status: 'Listing Status',
  location: 'Location',
  headline: 'Headline',
  om_link: 'OM Link',
  cim_link: 'CIM',
  bvr_link: 'BVR', // formerly BVA — Mark renamed
  workbook_link: 'Deal Workbook',
  nda_link: 'NDA & Buyer Profile',
  bbs_link: 'Listing Link',
  loi_link: 'LOI Form',
  // Phase 8 (2026-05-26): listing-level fallback used by the Lead Router
  // when a new LEADS row's own Buyer Profile Type is empty. Set this to
  // "Institutional" on high-value listings (Royal Silk, Yogi International,
  // etc.) and all future inquiries auto-route to NDA_BuyerProfile_Corporate.
  default_buyer_profile_type: 'Default Buyer Profile Type',
} as const;

export async function fetchNotionListing(pageId: string): Promise<Partial<Listing> & { notion_page_id: string }> {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) {
    throw new Error(`Notion page ${pageId} did not return properties`);
  }

  const props = page.properties as NotionProps;
  const map = LISTINGS_PROPERTY_MAP;

  return {
    notion_page_id: pageId,
    name: readTitle(props[map.listing_name]) ?? '(untitled listing)',
    listing_title: readRichText(props[map.listing_title]),
    listing_number: readRichText(props[map.listing_number]),
    industry: readSelect(props[map.industry]),
    asking_price: readNumber(props[map.asking_price]),
    sde: readNumber(props[map.sde]),
    status: readSelect(props[map.status]) ?? 'unknown',
    location: readRichText(props[map.location]),
    description: readRichText(props[map.headline]),
    om_link: readUrl(props[map.om_link]),
    cim_link: readUrl(props[map.cim_link]),
    bvr_link: readUrl(props[map.bvr_link]),
    workbook_link: readUrl(props[map.workbook_link]),
    nda_link: readUrl(props[map.nda_link]),
    bbs_link: readUrl(props[map.bbs_link]),
    loi_link: readUrl(props[map.loi_link]),
    default_buyer_profile_type: readSelect(props[map.default_buyer_profile_type]),
  };
}

// ---------------------------------------------------------------------------
// LEADS DB — write back router metadata
// ---------------------------------------------------------------------------

/**
 * Update a LEADS row with Router output. Only writes properties that exist
 * in the LEADS DB schema today. Properties the Router conceptually wants
 * (router_status, match_confidence, etc.) are NOT in Notion yet — those
 * stay in lr_match_decisions in Supabase. Add them to Notion later for
 * visibility if Mark wants them surfaced in the LEADS view.
 */
export interface UpdateNotionLeadPatch {
  /** Stamp Email #1 sent date (entry to Pipeline Stage 2). */
  LEAD_email_1_date?: string;
  /** Stamp Email #2 sent date (entry to Pipeline Stage 3). */
  PROSP_email_2_date?: string;
  /** Stamp Email #3 sent date (entry to Pipeline Stage 4). Note: field is
   *  named "PROSP Email #3" in Mark's Notion (renamed from QUALIF Email #3). */
  PROSP_email_3_date?: string;
  /** Stamp Email #4 sent date (entry to Pipeline Stage 5). Note: field is
   *  named "QUALIF Email #4" in Mark's Notion (renamed from LOI Email #4). */
  QUALIF_email_4_date?: string;
  /** Stamp Email #5 sent date (entry to Pipeline Stage 6). */
  PROPSL_email_5_date?: string;
  /** Add a relation to the matched listing. */
  matched_listing_relation?: string;
  /** Set the new Pipeline Stage axis. */
  pipeline_stage?: PipelineStage;
  /** Set the new Disposition axis. */
  disposition?: Disposition;
  /** Set the Buyer Quality A/B/C/D rating. */
  buyer_quality?: BuyerQuality;
  /** Set Fit Rating (1-5). */
  fit_rating?: number;
  /** Set Timing Rating (1-5). */
  timing_rating?: number;
  /** Set Motivation Rating (1-5). */
  motivation_rating?: number;
}

export async function updateNotionLead(
  pageId: string,
  patch: UpdateNotionLeadPatch
): Promise<void> {
  const notion = getNotionClient();
  const properties: Record<string, any> = {};

  if (patch.LEAD_email_1_date) {
    properties['LEAD Email #1'] = { date: { start: patch.LEAD_email_1_date } };
  }
  if (patch.PROSP_email_2_date) {
    properties['PROSP Email #2'] = { date: { start: patch.PROSP_email_2_date } };
  }
  if (patch.PROSP_email_3_date) {
    properties['PROSP Email #3'] = { date: { start: patch.PROSP_email_3_date } };
  }
  if (patch.QUALIF_email_4_date) {
    properties['QUALIF Email #4'] = { date: { start: patch.QUALIF_email_4_date } };
  }
  if (patch.PROPSL_email_5_date) {
    properties['PROPSL Email #5'] = { date: { start: patch.PROPSL_email_5_date } };
  }
  if (patch.matched_listing_relation) {
    properties['📋 LISTINGS'] = {
      relation: [{ id: patch.matched_listing_relation }],
    };
  }
  if (patch.pipeline_stage) {
    properties['Pipeline Stage'] = {
      select: { name: pipelineStageToNotionLabel(patch.pipeline_stage) },
    };
  }
  if (patch.disposition) {
    properties['Disposition'] = {
      select: { name: dispositionToNotionLabel(patch.disposition) },
    };
  }
  if (patch.buyer_quality) {
    properties['Buyer Quality'] = {
      select: { name: buyerQualityToNotionLabel(patch.buyer_quality) },
    };
  }
  if (patch.fit_rating !== undefined) {
    properties['Fit Rating'] = { number: patch.fit_rating };
  }
  if (patch.timing_rating !== undefined) {
    properties['Timing Rating'] = { number: patch.timing_rating };
  }
  if (patch.motivation_rating !== undefined) {
    properties['Motivation Rating'] = { number: patch.motivation_rating };
  }

  if (Object.keys(properties).length === 0) return;

  await notion.pages.update({ page_id: pageId, properties });
}
