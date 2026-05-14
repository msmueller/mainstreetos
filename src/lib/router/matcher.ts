/**
 * Lead Router — listing matcher
 *
 * Picks one of the broker's active listings for a given buyer inquiry, or
 * returns scenario='unmatched' with confidence < 0.5.
 *
 * IMPORTANT: the model returns `matched_listing_index`. The server resolves
 * `matched_listing_id`, `business_name`, and `industry` from the index —
 * NEVER trust those fields from the model directly (hallucination guard).
 */

import fs from 'fs/promises';
import path from 'path';
import { callClaudeJSON } from './claude';
import type {
  ExtractedAttributes,
  LeadContext,
  Listing,
  MatchResult,
  MatchScenario,
  SophisticationLevel,
} from './types';

let cachedSystemPrompt: string | null = null;

async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = await fs.readFile(
    path.join(process.cwd(), 'prompts/router/match-listing.md'),
    'utf-8'
  );
  return cachedSystemPrompt;
}

const SCENARIOS: ReadonlyArray<MatchScenario> = [
  'new_buyer',
  'returning_buyer',
  'multi_interest',
  'cobroker_referral',
  'unmatched',
];

const SOPHIST: ReadonlyArray<SophisticationLevel> = [
  'novice',
  'experienced',
  'broker',
  'unknown',
];

const URGENCY: ReadonlyArray<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asEnum<T extends string>(v: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  if (typeof v === 'string' && (allowed as ReadonlyArray<string>).includes(v)) return v as T;
  return fallback;
}

function asInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return parseInt(v, 10);
  return null;
}

function buildUserMessage(
  lead: LeadContext,
  listings: Listing[],
  attrs: ExtractedAttributes
): string {
  const fmt = (n: number | null) => (n === null ? 'N/A' : `$${n.toLocaleString()}`);
  const listingsBlock = listings
    .map(
      (l, i) =>
        `[${i}] ${l.name}
  Industry:  ${l.industry ?? 'unknown'}${l.naics ? ` (NAICS ${l.naics})` : ''}
  Listing #: ${l.listing_number ?? 'n/a'}
  Location:  ${l.location ?? 'unknown'}
  Asking:    ${fmt(l.asking_price)}
  SDE:       ${fmt(l.sde)}
  Co-broker: ${l.cobroker ?? 'none'}
  Description: ${l.description ?? '(none)'}`
    )
    .join('\n\n');

  return [
    '# Inquiry email',
    `From: ${lead.buyer_email ?? '(unknown)'}`,
    `Subject: ${lead.email_subject ?? '(none)'}`,
    `Source: ${lead.source ?? 'unknown'}`,
    `Inquiry date: ${lead.created_at}`,
    `Co-broker referral: ${lead.cobroker ?? 'none'}`,
    `Previous interactions: ${lead.previous_interactions_count}`,
    '',
    'Body:',
    lead.email_body ?? '(no body captured)',
    '',
    '# Buyer attributes (from extractor)',
    `Investment range:           ${attrs.buyer_investment_range ?? 'not stated'}`,
    `Timeframe:                  ${attrs.buyer_timeframe ?? 'not stated'}`,
    `Industry interest:          ${attrs.buyer_industry_interest ?? 'not stated'}`,
    `Specific listing mentioned: ${attrs.buyer_specific_listing_mentioned ?? 'none'}`,
    `Buyer experience:           ${attrs.buyer_experience ?? 'not stated'}`,
    `Urgency:                    ${attrs.urgency_level}`,
    `Sophistication:             ${attrs.sophistication_level}`,
    '',
    '# Active listings',
    listingsBlock,
    '',
    'Return ONLY a JSON object matching the schema in your system prompt. No preamble. No markdown fencing.',
  ].join('\n');
}

function unmatchedResult(reason: string): MatchResult {
  return {
    matched_listing_index: null,
    matched_listing_id: null,
    business_name: null,
    industry: null,
    confidence: 0,
    scenario: 'unmatched',
    reasoning: reason,
    buyer_sophistication: 'unknown',
    urgency_signal: 'low',
  };
}

/**
 * Match a buyer inquiry to one of the broker's active listings.
 *
 * The caller is responsible for fetching the active listings — typically
 * from `seller_listings WHERE stage = 'active'`. Pass them in the order
 * you want the model to see; we reuse that ordering for index resolution.
 */
export async function matchListing(input: {
  lead: LeadContext;
  listings: Listing[];
  attrs: ExtractedAttributes;
}): Promise<MatchResult> {
  const { lead, listings, attrs } = input;

  if (listings.length === 0) {
    return unmatchedResult('No active listings to match against.');
  }

  const system = await getSystemPrompt();
  const user = buildUserMessage(lead, listings, attrs);
  const raw = (await callClaudeJSON<unknown>({ system, user, maxTokens: 1024 })) as Record<
    string,
    unknown
  >;

  const idx = asInt(raw.matched_listing_index);
  const confidence = clamp01(raw.confidence);
  const scenario = asEnum(raw.scenario, SCENARIOS, 'unmatched');
  const reasoning = typeof raw.reasoning === 'string' ? raw.reasoning : '';
  const buyer_sophistication = asEnum(raw.buyer_sophistication, SOPHIST, attrs.sophistication_level);
  const urgency_signal = asEnum(
    raw.urgency_signal,
    URGENCY,
    attrs.urgency_level === 'unknown' ? 'low' : attrs.urgency_level
  );

  // Hallucination guard: if model returned an out-of-range index,
  // treat as unmatched and cap confidence.
  if (idx !== null && (idx < 0 || idx >= listings.length)) {
    return {
      matched_listing_index: null,
      matched_listing_id: null,
      business_name: null,
      industry: null,
      confidence: Math.min(confidence, 0.4),
      scenario: 'unmatched',
      reasoning: `Model returned out-of-range index ${idx} (listings.length=${listings.length}). Original reasoning: ${reasoning}`,
      buyer_sophistication,
      urgency_signal,
    };
  }

  // Resolve index → listing fields server-side (do not trust model's IDs)
  if (idx === null || scenario === 'unmatched' || confidence < 0.5) {
    return {
      matched_listing_index: null,
      matched_listing_id: null,
      business_name: null,
      industry: null,
      confidence,
      scenario: 'unmatched',
      reasoning,
      buyer_sophistication,
      urgency_signal,
    };
  }

  const matched = listings[idx];

  return {
    matched_listing_index: idx,
    matched_listing_id: matched.id,
    business_name: matched.name,
    industry: matched.industry,
    confidence,
    scenario,
    reasoning,
    buyer_sophistication,
    urgency_signal,
  };
}
