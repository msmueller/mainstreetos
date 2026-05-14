/**
 * Smoke test for commit 2: extractor + matcher.
 *
 * Run with:
 *   node --env-file=.env.local --import tsx scripts/smoke-router-ai.ts
 *
 * Hits the live Anthropic API. Costs <$0.10 per run.
 */

import { extractAttributes, matchListing } from '../src/lib/router';
import type { Listing, LeadContext } from '../src/lib/router';

const fakeEmail = `Hi Mark,

I saw your listing for the pizzeria in Bridgewater on BizBuySell (Listing #2103847). I'm a first-time buyer with about $400K-$500K to invest, looking to close in the next 3-4 months. Pre-approved on SBA financing through Live Oak.

I've owned a small printing business for 12 years (just sold it) and I'm looking for something with strong cash flow and good real estate. Can you send me the CIM and we can set up a call?

Thanks,
Tom Pellegrino
tom.pellegrino.biz@gmail.com
(908) 555-0143`;

const listings: Listing[] = [
  {
    id: 'aaaa-1111-aaaa-1111',
    notion_page_id: 'n1',
    name: 'La Guardiola Pizzeria',
    listing_title: null,
    listing_number: '2103847',
    industry: 'Restaurants & Food Service',
    naics: null,
    location: 'Bridgewater, NJ',
    asking_price: 475000,
    sde: 165000,
    ebitda: 145000,
    status: 'active',
    description: 'Established neighborhood pizzeria with strong delivery base',
    keywords: [],
    cobroker: null,
    om_link: null,
    cim_link: null,
    bvr_link: null,
    workbook_link: null,
    nda_link: null,
    bbs_link: null,
    loi_link: null,
  },
  {
    id: 'bbbb-2222-bbbb-2222',
    notion_page_id: 'n2',
    name: 'Yogi International',
    listing_title: null,
    listing_number: '2098221',
    industry: 'Wholesale & Distribution',
    naics: null,
    location: 'Edison, NJ',
    asking_price: 1850000,
    sde: 520000,
    ebitda: 460000,
    status: 'active',
    description: 'B2B import/export of specialty foods',
    keywords: [],
    cobroker: 'Sung Yun Lee',
    om_link: null,
    cim_link: null,
    bvr_link: null,
    workbook_link: null,
    nda_link: null,
    bbs_link: null,
    loi_link: null,
  },
  {
    id: 'cccc-3333-cccc-3333',
    notion_page_id: 'n3',
    name: 'Philly Pretzel Factory - Ewing',
    listing_title: null,
    listing_number: '2110945',
    industry: 'Restaurants & Food Service',
    naics: null,
    location: 'Ewing, NJ',
    asking_price: 295000,
    sde: 95000,
    ebitda: 82000,
    status: 'active',
    description: 'Franchise pretzel shop, established 8 years',
    keywords: [],
    cobroker: null,
    om_link: null,
    cim_link: null,
    bvr_link: null,
    workbook_link: null,
    nda_link: null,
    bbs_link: null,
    loi_link: null,
  },
];

const lead: LeadContext = {
  buyer_lead_id: 'test-lead-1',
  notion_page_id: 'page-1',
  buyer_first_name: 'Tom',
  buyer_last_name: 'Pellegrino',
  buyer_email: 'tom.pellegrino.biz@gmail.com',
  buyer_phone: '(908) 555-0143',
  email_subject: 'Inquiry from BizBuySell - Listing 2103847',
  email_body: fakeEmail,
  source: 'BBS',
  created_at: new Date().toISOString(),
  cobroker: null,
  previous_interactions_count: 0,
};

async function main() {
  console.log('=== EXTRACTING ATTRIBUTES ===');
  const attrs = await extractAttributes(fakeEmail, 'tom.pellegrino.biz@gmail.com');
  console.log(JSON.stringify(attrs, null, 2));

  console.log('\n=== MATCHING AGAINST 3 LISTINGS ===');
  const match = await matchListing({ lead, listings, attrs });
  console.log(JSON.stringify(match, null, 2));

  console.log('\n=== EXPECTED ===');
  console.log('  matched_listing_index: 0  (La Guardiola, listing #2103847 mentioned by buyer)');
  console.log('  matched_listing_id:    aaaa-1111-aaaa-1111');
  console.log('  confidence:            >= 0.9 (explicit listing # match)');
  console.log('  scenario:              new_buyer  (previous_interactions_count = 0)');
}

main().catch((e) => {
  console.error('SMOKE TEST FAILED:', e);
  process.exit(1);
});
