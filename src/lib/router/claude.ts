/**
 * Lead Router — Anthropic SDK wrapper
 *
 * Centralizes the model constant and JSON-parse cleaning so the extractor and
 * matcher don't duplicate that logic.
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Current Claude Opus model identifier as of April 2026.
 * Note: prior session notes referenced "claude-opus-4-7" — that is NOT a
 * real model id. The current Opus model string is `claude-opus-4-6`.
 */
export const LR_MODEL = 'claude-opus-4-6';

/**
 * Lower-tier model for cheap classification work (used by reply-intent
 * classification later). Not currently used by the matcher.
 */
export const LR_MODEL_HAIKU = 'claude-haiku-4-5-20251001';

let cached: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Lead Router: ANTHROPIC_API_KEY is not set');
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

/**
 * Strip markdown fencing the model sometimes emits despite "no markdown"
 * instructions, then JSON.parse. Throws with a useful preview on failure.
 */
export function cleanJson<T = unknown>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const preview = cleaned.length > 240 ? `${cleaned.slice(0, 240)}…` : cleaned;
    throw new Error(`Failed to parse Claude JSON output. Preview: ${preview}`);
  }
}

/**
 * One-shot Claude call returning parsed JSON.
 *
 * The matcher and extractor both follow the same shape: a system prompt
 * loaded from a markdown file, a single user message, parse JSON out.
 */
export async function callClaudeJSON<T = unknown>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  const client = getClaudeClient();
  const response = await client.messages.create({
    model: opts.model ?? LR_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });

  const first = response.content[0];
  const text = first?.type === 'text' ? first.text : '';
  return cleanJson<T>(text);
}
