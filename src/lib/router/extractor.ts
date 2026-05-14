/**
 * Lead Router — buyer attribute extractor
 *
 * Pulls structured buyer info from an inquiry email body using Claude.
 * Output is the `ExtractedAttributes` type, which feeds both the matcher
 * and the renderer (so the email can address the buyer by their stated
 * timeframe and investment range).
 */

import fs from 'fs/promises';
import path from 'path';
import { callClaudeJSON } from './claude';
import type { ExtractedAttributes, UrgencyLevel, SophisticationLevel } from './types';

let cachedSystemPrompt: string | null = null;

async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  // NOTE: this reads at runtime from CWD. On Vercel, ensure
  // `prompts/router/*.md` is included in `outputFileTracingIncludes`
  // (see next.config.ts) or switch to an inline string constant.
  cachedSystemPrompt = await fs.readFile(
    path.join(process.cwd(), 'prompts/router/extract-attributes.md'),
    'utf-8'
  );
  return cachedSystemPrompt;
}

const URGENCY_VALUES: ReadonlyArray<UrgencyLevel> = ['low', 'medium', 'high', 'unknown'];
const SOPHIST_VALUES: ReadonlyArray<SophisticationLevel> = [
  'novice',
  'experienced',
  'broker',
  'unknown',
];

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asEnum<T extends string>(v: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  if (typeof v === 'string' && (allowed as ReadonlyArray<string>).includes(v)) return v as T;
  return fallback;
}

/**
 * Validate + coerce the model's raw output into an `ExtractedAttributes`.
 * The model can drift on enum casing or number ranges; coerce defensively
 * rather than throw on every minor discrepancy.
 */
function validate(raw: unknown): ExtractedAttributes {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    buyer_first_name: asString(r.buyer_first_name),
    buyer_last_name: asString(r.buyer_last_name),
    buyer_email: asString(r.buyer_email),
    buyer_phone: asString(r.buyer_phone),
    buyer_investment_range: asString(r.buyer_investment_range),
    buyer_timeframe: asString(r.buyer_timeframe),
    buyer_experience: asString(r.buyer_experience),
    buyer_industry_interest: asString(r.buyer_industry_interest),
    buyer_specific_listing_mentioned: asString(r.buyer_specific_listing_mentioned),
    urgency_level: asEnum(r.urgency_level, URGENCY_VALUES, 'unknown'),
    sophistication_level: asEnum(r.sophistication_level, SOPHIST_VALUES, 'unknown'),
    extraction_confidence: clamp01(r.extraction_confidence),
  };
}

/**
 * Extract buyer attributes from an inquiry email body.
 *
 * @param emailBody Plain-text body of the buyer's inquiry
 * @param sender    The "From" email address (passed for context only — the
 *                  extractor uses it to disambiguate name from signature)
 */
export async function extractAttributes(
  emailBody: string,
  sender: string
): Promise<ExtractedAttributes> {
  if (!emailBody || emailBody.trim().length === 0) {
    return {
      buyer_first_name: null,
      buyer_last_name: null,
      buyer_email: sender || null,
      buyer_phone: null,
      buyer_investment_range: null,
      buyer_timeframe: null,
      buyer_experience: null,
      buyer_industry_interest: null,
      buyer_specific_listing_mentioned: null,
      urgency_level: 'unknown',
      sophistication_level: 'unknown',
      extraction_confidence: 0,
    };
  }

  const system = await getSystemPrompt();
  const user = [
    '# Inquiry email',
    `From: ${sender || '(unknown)'}`,
    '',
    'Body:',
    emailBody,
    '',
    'Return ONLY the JSON object per your system prompt. No preamble. No markdown fencing.',
  ].join('\n');

  const raw = await callClaudeJSON<unknown>({ system, user, maxTokens: 800 });
  return validate(raw);
}
