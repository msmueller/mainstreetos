/**
 * MainStreetOS — Model Routing Utility
 * Routes AI pipeline tasks to the correct Claude model tier
 * based on task type, deal complexity, and broker license level.
 *
 * Tier 1 (Opus-class)    — Reasoning: valuation synthesis, deal strategy, legal drafting
 * Tier 2 (Sonnet-class)  — Execution: document drafting, comp analysis, email sequences
 * Tier 3 (Haiku-class)   — Cleanup:   extraction, classification, formatting, DB writes
 */

// ─── Model constants ──────────────────────────────────────────────────────────

export const MODELS = {
  T1: "claude-opus-4-5",       // Reasoning — frontier judgment
  T2: "claude-sonnet-4-5",     // Execution — competent drafting
  T3: "claude-haiku-4-5-20251001", // Cleanup  — mechanical accuracy
} as const;

export type ModelTier = "T1" | "T2" | "T3";
export type BrokerLicense = "standard" | "premium";

// ─── Task taxonomy ────────────────────────────────────────────────────────────

export type PipelineTask =
  // Pipeline 1: Lead intake & triage
  | "lead.ingest"          // T3 — parse BizBuySell payload, map to schema
  | "lead.classify"        // T3 — score intent, budget signal, buyer/seller tag
  | "lead.respond"         // T2 — draft personalized reply from lead context
  | "lead.notionWrite"     // T3 — push to LEADS db, set status, link CONTACTS

  // Pipeline 2: Document generation
  | "doc.extractFinancials" // T3 — pull P&L data, normalize to schema fields
  | "doc.assembleBreif"    // T2 — compose structured brief from data + Skill template
  | "doc.draft"            // T2 — generate OM / CIM / BVR sections from brief
  | "doc.qcFormat"         // T3 — proofread, consistency check, brand styles

  // Pipeline 3: Valuation
  | "val.normalizeFinancials" // T3 — extract multi-year SDE, add-backs, recast
  | "val.selectComps"         // T2 — match BizComps/DealStats to deal profile
  | "val.synthesize"          // T1 — CAIBVS™ weighting, method reconciliation, OOV
  | "val.formatReport"        // T3 — tables, narrative sections, USPAP structure

  // Pipeline 4: Deal strategy & advisory
  | "deal.assembleContext"    // T2 — pull deal file, financials, prior notes
  | "deal.strategy"           // T1 — deal structure, financing scenarios, risk flags
  | "deal.documentStandard"   // T2 — LOI / term sheet (standard deal)
  | "deal.documentLegal"      // T1 — LOI / term sheet (adversarial / legally complex)

  // Utility
  | "util.proofread"          // T3 — proofreading, grammar, consistency
  | "util.classify"           // T3 — general classification tasks
  | "util.extract"            // T3 — general field extraction from documents
  | "util.format";            // T3 — general formatting / brand application

// ─── Base routing table ───────────────────────────────────────────────────────

const BASE_ROUTING: Record<PipelineTask, ModelTier> = {
  // Pipeline 1
  "lead.ingest":            "T3",
  "lead.classify":          "T3",
  "lead.respond":           "T2",
  "lead.notionWrite":       "T3",

  // Pipeline 2
  "doc.extractFinancials":  "T3",
  "doc.assembleBreif":      "T2",
  "doc.draft":              "T2",
  "doc.qcFormat":           "T3",

  // Pipeline 3
  "val.normalizeFinancials":"T3",
  "val.selectComps":        "T2",
  "val.synthesize":         "T1",  // Hard gate — always Opus
  "val.formatReport":       "T3",

  // Pipeline 4
  "deal.assembleContext":   "T2",
  "deal.strategy":          "T1",  // Hard gate — always Opus
  "deal.documentStandard":  "T2",
  "deal.documentLegal":     "T1",  // Hard gate — adversarial = Opus

  // Utility
  "util.proofread":         "T3",
  "util.classify":          "T3",
  "util.extract":           "T3",
  "util.format":            "T3",
};

// Tasks that are ALWAYS Tier 1 regardless of license level.
// These are the hard gates — judgment calls that genuinely need frontier reasoning.
const TIER1_HARD_GATES = new Set<PipelineTask>([
  "val.synthesize",
  "deal.strategy",
  "deal.documentLegal",
]);

// ─── License profile overrides ────────────────────────────────────────────────
// Standard license: caps Tier 1 access — Sonnet handles tasks that would
// normally be Tier 1 except for the hard-gated ones.
// Premium license: full Tier 1 access as defined in base routing.

const STANDARD_LICENSE_OVERRIDES: Partial<Record<PipelineTask, ModelTier>> = {
  // deal.strategy and val.synthesize remain T1 (hard gates, kept in TIER1_HARD_GATES)
  // Everything else that was T1 falls to T2 under standard
  "deal.documentLegal": "T2", // Standard brokers get Sonnet for legal docs
                               // (override the hard gate at license level — see note below)
};

// ─── Routing context ──────────────────────────────────────────────────────────

export interface RoutingContext {
  task: PipelineTask;
  license?: BrokerLicense;

  /** Deal size in USD — triggers Opus upgrade for large deals on standard license */
  dealSizeUsd?: number;

  /** When true, forces Tier 1 regardless of license (e.g. commission dispute) */
  legalRisk?: boolean;

  /** Override token budget — useful for cost-sensitive batch operations */
  forceTier?: ModelTier;
}

// ─── Main routing function ────────────────────────────────────────────────────

export interface RoutingResult {
  model: string;
  tier: ModelTier;
  reason: string;
}

export function resolveModel(ctx: RoutingContext): RoutingResult {
  const {
    task,
    license = "premium",
    dealSizeUsd,
    legalRisk = false,
    forceTier,
  } = ctx;

  // 1. Explicit override wins everything
  if (forceTier) {
    return {
      model: MODELS[forceTier],
      tier: forceTier,
      reason: `Forced to ${forceTier} by caller`,
    };
  }

  // 2. Legal risk flag hard-routes to Tier 1 (adversarial, commission disputes, etc.)
  if (legalRisk) {
    return {
      model: MODELS.T1,
      tier: "T1",
      reason: "Legal risk flag — routing to Tier 1 for adversarial or legally consequential task",
    };
  }

  // 3. Hard gates always get Tier 1, regardless of license
  if (TIER1_HARD_GATES.has(task)) {
    return {
      model: MODELS.T1,
      tier: "T1",
      reason: `Hard gate: "${task}" requires frontier reasoning — license override not permitted`,
    };
  }

  // 4. Large deal upgrade: standard license gets Tier 1 for deals > $2M
  if (license === "standard" && dealSizeUsd && dealSizeUsd >= 2_000_000) {
    const baseTier = BASE_ROUTING[task];
    if (baseTier === "T1") {
      return {
        model: MODELS.T1,
        tier: "T1",
        reason: `Deal size $${(dealSizeUsd / 1_000_000).toFixed(1)}M ≥ $2M threshold — upgrading standard license to Tier 1`,
      };
    }
  }

  // 5. Standard license applies overrides
  if (license === "standard" && task in STANDARD_LICENSE_OVERRIDES) {
    const overrideTier = STANDARD_LICENSE_OVERRIDES[task]!;
    return {
      model: MODELS[overrideTier],
      tier: overrideTier,
      reason: `Standard license cap: "${task}" downgraded from T1 → ${overrideTier}`,
    };
  }

  // 6. Base routing table
  const tier = BASE_ROUTING[task];
  return {
    model: MODELS[tier],
    tier,
    reason: `Base routing: "${task}" → ${tier}`,
  };
}

// ─── Pipeline builder helper ──────────────────────────────────────────────────
// Convenience: resolve models for an entire pipeline at once.
// Returns an ordered array ready to hand off to your agent orchestrator.

export interface PipelineStep {
  task: PipelineTask;
  model: string;
  tier: ModelTier;
  reason: string;
}

export function buildPipeline(
  tasks: PipelineTask[],
  sharedCtx: Omit<RoutingContext, "task">
): PipelineStep[] {
  return tasks.map((task) => {
    const result = resolveModel({ ...sharedCtx, task });
    return { task, ...result };
  });
}

// ─── Cost estimation helper ───────────────────────────────────────────────────
// Rough relative cost multipliers (not actual API pricing — use for internal
// unit economics modeling only). Update as Anthropic pricing changes.

const RELATIVE_COST: Record<ModelTier, number> = {
  T1: 15,  // Opus-class
  T2: 3,   // Sonnet-class
  T3: 1,   // Haiku-class (baseline)
};

export function estimateRelativeCost(steps: PipelineStep[]): {
  totalUnits: number;
  breakdown: Record<ModelTier, number>;
  savingsVsAllT1: string;
} {
  const breakdown: Record<ModelTier, number> = { T1: 0, T2: 0, T3: 0 };

  let totalUnits = 0;
  for (const step of steps) {
    const cost = RELATIVE_COST[step.tier];
    breakdown[step.tier] += cost;
    totalUnits += cost;
  }

  const allT1Cost = steps.length * RELATIVE_COST.T1;
  const savingsPct = Math.round(((allT1Cost - totalUnits) / allT1Cost) * 100);

  return {
    totalUnits,
    breakdown,
    savingsVsAllT1: `${savingsPct}% cheaper than routing everything to Tier 1`,
  };
}
