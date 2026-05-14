/**
 * Lead Router — listings access
 *
 * fetchActiveListings:    pulls all stage='active' rows from seller_listings
 *                         in Listing shape, ready for the matcher.
 * enrichListingFromNotion: given a Listing, fetches its Notion page and
 *                         overlays URL fields (om_link, cim_link, etc.).
 *                         Used after match, before render. Strategy = B
 *                         (Notion as source of truth for URL fields).
 */

import { getRouterSupabase } from './supabase';
import { fetchNotionListing } from './notion';
import type { Listing } from './types';

/**
 * Fetch all active seller_listings rows in `Listing` shape.
 * URL fields are NOT populated here — the caller calls
 * `enrichListingFromNotion` once a specific listing has been matched.
 */
export async function fetchActiveListings(): Promise<Listing[]> {
  const supabase = getRouterSupabase();

  const { data, error } = await supabase
    .from('seller_listings')
    .select(
      'id, name, stage, notion_page_id, industry, asking_price_usd, sde_ttm_usd, ebitda_ttm_usd, listing_number, bbs_link, om_link, cim_link, bvr_link, workbook_link, nda_link, loi_link'
    )
    .eq('stage', 'active');

  if (error) {
    throw new Error(`fetchActiveListings: ${error.message}`);
  }

  return (data ?? []).map(rowToListing);
}

function rowToListing(row: Record<string, unknown>): Listing {
  return {
    id: String(row.id),
    notion_page_id: (row.notion_page_id as string | null) ?? null,
    name: String(row.name ?? '(untitled listing)'),
    listing_title: null, // populated from Notion via enrichListingFromNotion
    listing_number: (row.listing_number as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    naics: null,
    location: null,
    asking_price: row.asking_price_usd === null ? null : Number(row.asking_price_usd),
    sde: row.sde_ttm_usd === null ? null : Number(row.sde_ttm_usd),
    ebitda: row.ebitda_ttm_usd === null ? null : Number(row.ebitda_ttm_usd),
    status: String(row.stage ?? 'active'),
    description: null,
    keywords: [],
    cobroker: null,
    om_link: (row.om_link as string | null) ?? null,
    cim_link: (row.cim_link as string | null) ?? null,
    bvr_link: (row.bvr_link as string | null) ?? null,
    workbook_link: (row.workbook_link as string | null) ?? null,
    nda_link: (row.nda_link as string | null) ?? null,
    bbs_link: (row.bbs_link as string | null) ?? null,
    loi_link: (row.loi_link as string | null) ?? null,
  };
}

/**
 * Overlay Notion-side URL fields, listing #, industry, location, and
 * description onto a Listing. Mark maintains these in Notion as the
 * primary source. seller_listings columns will hydrate as we sync.
 *
 * Conservative: only overwrites fields if Notion has a value. Returns the
 * input listing unchanged if it has no notion_page_id.
 */
export async function enrichListingFromNotion(listing: Listing): Promise<Listing> {
  if (!listing.notion_page_id) return listing;

  try {
    const n = await fetchNotionListing(listing.notion_page_id);

    return {
      ...listing,
      listing_title: n.listing_title ?? listing.listing_title,
      listing_number: n.listing_number ?? listing.listing_number,
      industry: n.industry ?? listing.industry,
      location: n.location ?? listing.location,
      description: n.description ?? listing.description,
      om_link: n.om_link ?? listing.om_link,
      cim_link: n.cim_link ?? listing.cim_link,
      bvr_link: n.bvr_link ?? listing.bvr_link,
      workbook_link: n.workbook_link ?? listing.workbook_link,
      nda_link: n.nda_link ?? listing.nda_link,
      bbs_link: n.bbs_link ?? listing.bbs_link,
      loi_link: n.loi_link ?? listing.loi_link,
    };
  } catch (err) {
    // Log but don't fail the whole render — URL fields gracefully fall
    // back to "[link forthcoming]" via the renderer.
    console.warn(
      `enrichListingFromNotion: failed for ${listing.notion_page_id}:`,
      err instanceof Error ? err.message : err
    );
    return listing;
  }
}
