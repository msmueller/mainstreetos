/**
 * MainStreetOS — Model Router: Usage Examples
 * Drop these patterns into your Next.js API routes / agent orchestrator.
 */

import {
  resolveModel,
  buildPipeline,
  estimateRelativeCost,
  MODELS,
} from "../lib/modelRouter";

// ─── Example 1: Single task resolution ───────────────────────────────────────
// In your valuation API route (/api/valuation/synthesize)

export async function runValuationSynthesis(dealData: unknown, brokerLicense: "standard" | "premium") {
  const { model, tier, reason } = resolveModel({
    task: "val.synthesize",
    license: brokerLicense,
  });

  console.log(`[Router] ${tier} → ${model} | ${reason}`);
  // model will always be Opus here — val.synthesize is a hard gate
  // Pass `model` directly to your Anthropic SDK call:
  //   const response = await anthropic.messages.create({ model, ... })
  return { model, tier };
}

// ─── Example 2: Legal risk escalation ────────────────────────────────────────
// In your document generation route — detects adversarial situations

export async function generateDealDocument(
  docType: "loi" | "termSheet" | "demandLetter",
  isAdversarial: boolean,
  dealSizeUsd: number,
  license: "standard" | "premium"
) {
  const task = isAdversarial ? "deal.documentLegal" : "deal.documentStandard";

  const { model, tier, reason } = resolveModel({
    task,
    license,
    dealSizeUsd,
    legalRisk: docType === "demandLetter" || isAdversarial,
  });

  console.log(`[Router] ${docType} → ${tier} (${model}) | ${reason}`);
  return { model, tier };
}

// ─── Example 3: Full pipeline for a new listing ───────────────────────────────
// Resolve models for every step upfront — hand off to your agent orchestrator

export async function runNewListingPipeline(
  dealSizeUsd: number,
  license: "standard" | "premium"
) {
  const steps = buildPipeline(
    [
      "doc.extractFinancials",   // T3 — Haiku
      "doc.assembleBreif",       // T2 — Sonnet
      "val.normalizeFinancials", // T3 — Haiku
      "val.selectComps",         // T2 — Sonnet
      "val.synthesize",          // T1 — Opus (hard gate)
      "doc.draft",               // T2 — Sonnet (OM/CIM from brief)
      "doc.qcFormat",            // T3 — Haiku
    ],
    { license, dealSizeUsd }
  );

  const economics = estimateRelativeCost(steps);

  console.log("\n[Pipeline] New listing pipeline:");
  steps.forEach((s) =>
    console.log(`  ${s.task.padEnd(26)} → ${s.tier} (${s.model})`)
  );
  console.log(`\n[Economics] Total cost units: ${economics.totalUnits}`);
  console.log(`[Economics] ${economics.savingsVsAllT1}`);
  console.log(`[Economics] Breakdown:`, economics.breakdown);

  return steps;
}

// ─── Example 4: Lead intake pipeline ─────────────────────────────────────────
// Called by your BizBuySell webhook handler

export async function runLeadIntakePipeline(license: "standard" | "premium") {
  const steps = buildPipeline(
    ["lead.ingest", "lead.classify", "lead.respond", "lead.notionWrite"],
    { license }
  );

  // Example output for a premium broker:
  // lead.ingest       → T3 (claude-haiku-4-5-20251001)
  // lead.classify     → T3 (claude-haiku-4-5-20251001)
  // lead.respond      → T2 (claude-sonnet-4-5)
  // lead.notionWrite  → T3 (claude-haiku-4-5-20251001)

  return steps;
}

// ─── Example 5: Anthropic SDK integration pattern ────────────────────────────
// How to pass the resolved model into your actual API call

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // picks up ANTHROPIC_API_KEY from env

export async function callWithRouting(
  task: Parameters<typeof resolveModel>[0]["task"],
  prompt: string,
  license: "standard" | "premium" = "premium",
  dealSizeUsd?: number
) {
  const { model, tier, reason } = resolveModel({ task, license, dealSizeUsd });

  console.log(`[Router] ${task} → ${tier} | ${reason}`);

  const response = await anthropic.messages.create({
    model,          // ← routed model drops in here
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  return {
    content: response.content,
    model,
    tier,
    usage: response.usage, // track input/output tokens per tier for analytics
  };
}

// ─── Example 6: Force override for batch operations ──────────────────────────
// When running large batch jobs where cost matters more than peak quality

export async function batchProofreadDocuments(docs: string[], license: "standard" | "premium") {
  const { model } = resolveModel({
    task: "util.proofread",
    license,
    forceTier: "T3", // Always Haiku for batch — explicit override
  });

  // model === MODELS.T3 regardless of license
  return { model, docs };
}
