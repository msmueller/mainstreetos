/**
 * Lead Router — Buyer pipeline / disposition / quality axes.
 *
 * Canonical (Supabase enum) values are snake_case. Notion uses human-friendly
 * display labels. This file is the single source of truth for translating
 * between the two. When you change a label here, change the Notion option
 * name AND the Supabase enum to match — keep them in lockstep.
 *
 * Adding a value (Phase 5+):
 *   1. Append to the canonical array below
 *   2. Add the display label to the corresponding map
 *   3. Add the value to the Supabase enum (ALTER TYPE ... ADD VALUE ...)
 *   4. Add the option to the Notion select property
 */

// ---------------------------------------------------------------------------
// Pipeline Stage
// ---------------------------------------------------------------------------

export const PIPELINE_STAGES = [
  'inquiry',
  'initial_response_sent',
  'nda_executed',
  'buyer_profile_received',
  'qualified_buyer',
  'loi_ioi',
  'under_contract',
  'closing',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  inquiry:                '1. Inquiry',
  initial_response_sent:  '2. Initial Response Sent',
  nda_executed:           '3. NDA Executed',
  buyer_profile_received: '4. Buyer Profile Received',
  qualified_buyer:        '5. Qualified Buyer',
  loi_ioi:                '6. LOI / IOI',
  under_contract:         '7. Under Contract',
  closing:                '8. Closing',
};

const NOTION_LABEL_TO_PIPELINE: Record<string, PipelineStage> = Object.fromEntries(
  Object.entries(PIPELINE_STAGE_LABELS).map(([k, v]) => [v, k as PipelineStage])
);

// ---------------------------------------------------------------------------
// Disposition
// ---------------------------------------------------------------------------

export const DISPOSITIONS = [
  'active',
  'awaiting_response',
  'cold',
  'dormant',
  'withdrawn',
  'disqualified',
  'closed_won',
  'closed_lost',
] as const;

export type Disposition = (typeof DISPOSITIONS)[number];

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  active:            'Active',
  awaiting_response: 'Awaiting Response',
  cold:              'Cold',
  dormant:           'Dormant',
  withdrawn:         'Withdrawn',
  disqualified:      'Disqualified',
  closed_won:        'Closed Won',
  closed_lost:       'Closed Lost',
};

const NOTION_LABEL_TO_DISPOSITION: Record<string, Disposition> = Object.fromEntries(
  Object.entries(DISPOSITION_LABELS).map(([k, v]) => [v, k as Disposition])
);

// ---------------------------------------------------------------------------
// Buyer Quality
// ---------------------------------------------------------------------------

export const BUYER_QUALITIES = ['a', 'b', 'c', 'd'] as const;
export type BuyerQuality = (typeof BUYER_QUALITIES)[number];

export const BUYER_QUALITY_LABELS: Record<BuyerQuality, string> = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
};

const NOTION_LABEL_TO_QUALITY: Record<string, BuyerQuality> = Object.fromEntries(
  Object.entries(BUYER_QUALITY_LABELS).map(([k, v]) => [v, k as BuyerQuality])
);

// ---------------------------------------------------------------------------
// Translators — Notion display label → canonical snake_case
// ---------------------------------------------------------------------------

export function pipelineStageFromNotionLabel(label: string | null | undefined): PipelineStage | null {
  if (!label) return null;
  return NOTION_LABEL_TO_PIPELINE[label] ?? null;
}

export function dispositionFromNotionLabel(label: string | null | undefined): Disposition | null {
  if (!label) return null;
  return NOTION_LABEL_TO_DISPOSITION[label] ?? null;
}

export function buyerQualityFromNotionLabel(label: string | null | undefined): BuyerQuality | null {
  if (!label) return null;
  return NOTION_LABEL_TO_QUALITY[label] ?? null;
}

// ---------------------------------------------------------------------------
// Translators — canonical snake_case → Notion display label
// ---------------------------------------------------------------------------

export function pipelineStageToNotionLabel(value: PipelineStage): string {
  return PIPELINE_STAGE_LABELS[value];
}

export function dispositionToNotionLabel(value: Disposition): string {
  return DISPOSITION_LABELS[value];
}

export function buyerQualityToNotionLabel(value: BuyerQuality): string {
  return BUYER_QUALITY_LABELS[value];
}

// ---------------------------------------------------------------------------
// Aggregate helper — derive Buyer Quality from sub-ratings
// ---------------------------------------------------------------------------

/**
 * Aggregate fit/timing/motivation 1-5 ratings into a Buyer Quality bucket.
 *
 *   A: avg ≥ 4.5  (strong on all three axes)
 *   B: avg ≥ 3.5
 *   C: avg ≥ 2.5
 *   D: avg < 2.5
 *
 * If any rating is null, the aggregate uses only the populated ratings.
 * If all ratings are null, returns null (don't guess).
 */
export function deriveBuyerQuality(opts: {
  fit: number | null;
  timing: number | null;
  motivation: number | null;
}): BuyerQuality | null {
  const ratings = [opts.fit, opts.timing, opts.motivation].filter(
    (r): r is number => typeof r === 'number'
  );
  if (ratings.length === 0) return null;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  if (avg >= 4.5) return 'a';
  if (avg >= 3.5) return 'b';
  if (avg >= 2.5) return 'c';
  return 'd';
}

// ---------------------------------------------------------------------------
// Legacy mapping — buyer_lead_stage (old) → buyer_pipeline_stage (new)
// ---------------------------------------------------------------------------
// Used by the Phase 3 backfill script to propose new values for existing rows.
// Reviewed and approved row-by-row by Mark before being applied.

export const LEGACY_STAGE_PROPOSED_MAPPING: Record<
  string,
  { pipeline_stage: PipelineStage; disposition: Disposition }
> = {
  new:          { pipeline_stage: 'inquiry',                disposition: 'active' },
  contacted:    { pipeline_stage: 'initial_response_sent',  disposition: 'active' },
  qualified:    { pipeline_stage: 'qualified_buyer',        disposition: 'active' },
  nurture:      { pipeline_stage: 'inquiry',                disposition: 'cold' },
  nda_sent:     { pipeline_stage: 'nda_executed',           disposition: 'active' },
  converted:    { pipeline_stage: 'closing',                disposition: 'closed_won' },
  disqualified: { pipeline_stage: 'inquiry',                disposition: 'disqualified' },
};
