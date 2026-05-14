/**
 * Lead Router — gated step advancement.
 *
 * Given a lead's current Notion state (Pipeline Stage + gate checkboxes),
 * determines which Email # should fire next, what category template to use,
 * what target Pipeline Stage to advance to, and which Notion date field
 * to stamp.
 *
 * Used by /api/router/advance to decide what to do for a given lead.
 */

import { fetchNotionLead } from './notion';
import { getNotionClient } from './notion';
import {
  pipelineStageFromNotionLabel,
  type PipelineStage,
  type Disposition,
} from './buyer-axes';
import type { TemplateCategory } from './types';

// ---------------------------------------------------------------------------
// Gate state — read directly from Notion since checkboxes drive progression
// ---------------------------------------------------------------------------

export interface LeadGateState {
  pipeline_stage: PipelineStage | null;
  completed_nda: boolean;
  completed_buyer_profile: boolean;
  completed_loi: boolean;
}

export async function readLeadGateState(notion_page_id: string): Promise<LeadGateState> {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: notion_page_id });
  if (!('properties' in page)) {
    throw new Error(`Notion page ${notion_page_id} returned no properties`);
  }
  const props = page.properties as Record<string, any>;

  const pipelineLabel = props['Pipeline Stage']?.select?.name ?? null;

  return {
    pipeline_stage: pipelineStageFromNotionLabel(pipelineLabel),
    completed_nda: Boolean(props['Completed NDA']?.checkbox),
    completed_buyer_profile: Boolean(props['Completed Buyer Profile']?.checkbox),
    completed_loi: Boolean(props['Completed LOI']?.checkbox),
  };
}

// ---------------------------------------------------------------------------
// Step advancement decision
// ---------------------------------------------------------------------------

export type AdvanceErrorCode =
  | 'no_pipeline_stage'         // lead never went through Email #1
  | 'gate_not_met'              // gate condition not satisfied yet
  | 'beyond_email_5'            // already past LOI; no auto-email
  | 'invalid_state';

export interface AdvanceDecision {
  /** Whether advancement is possible right now. */
  can_advance: boolean;
  /** If can_advance is false, why. */
  error?: AdvanceErrorCode;
  /** Human-readable explanation suitable for client display. */
  detail: string;
  /** The category to pick a template for. */
  next_category?: TemplateCategory;
  /** Pipeline Stage to advance the lead INTO after sending. */
  next_pipeline_stage?: PipelineStage;
  /** Disposition to set after sending (always 'active' for normal advancement). */
  next_disposition?: Disposition;
  /** Which Notion date field to stamp. */
  notion_date_field?:
    | 'PROSP_email_2_date'
    | 'PROSP_email_3_date'
    | 'QUALIF_email_4_date'
    | 'PROPSL_email_5_date';
}

/**
 * Pure-logic decision tree. Given the gate state, return what to do.
 *
 * Manual qualification (Email #4) is always allowed once the lead is at
 * Stage 4 — it's a manual-trigger event, not a checkbox flip.
 */
export function decideNextStep(
  gate: LeadGateState,
  forceCategory?: TemplateCategory
): AdvanceDecision {
  const stage = gate.pipeline_stage;

  // Caller can force a specific transition (used by Notion buttons that
  // know which step to fire — e.g., "Mark phone-qualified" button → Email #4).
  if (forceCategory) {
    return decideForced(gate, forceCategory);
  }

  if (!stage) {
    return {
      can_advance: false,
      error: 'no_pipeline_stage',
      detail:
        'Lead has no Pipeline Stage set. Run /api/router/route first to send Email #1 and advance to "2. Initial Response Sent".',
    };
  }

  // Email #2 — NDA Received
  if (stage === 'inquiry' || stage === 'initial_response_sent') {
    if (!gate.completed_nda) {
      return {
        can_advance: false,
        error: 'gate_not_met',
        detail: `Lead at "${stage}" stage; Completed NDA checkbox is not set. Email #2 fires when NDA is executed.`,
      };
    }
    return {
      can_advance: true,
      detail: 'NDA executed; advancing to Email #2 (OM + CIM).',
      next_category: 'nda_received',
      next_pipeline_stage: 'nda_executed',
      next_disposition: 'active',
      notion_date_field: 'PROSP_email_2_date',
    };
  }

  // Email #3 — Buyer Profile Received
  if (stage === 'nda_executed') {
    if (!gate.completed_buyer_profile) {
      return {
        can_advance: false,
        error: 'gate_not_met',
        detail: 'Lead at "nda_executed"; Completed Buyer Profile checkbox is not set. Email #3 fires when Buyer Profile arrives.',
      };
    }
    return {
      can_advance: true,
      detail: 'Buyer Profile received; advancing to Email #3 (BVR).',
      next_category: 'buyer_profile_received',
      next_pipeline_stage: 'buyer_profile_received',
      next_disposition: 'active',
      notion_date_field: 'PROSP_email_3_date',
    };
  }

  // Email #4 — Qualified Buyer (manual trigger only — no checkbox gate)
  if (stage === 'buyer_profile_received') {
    return {
      can_advance: true,
      detail: 'Manual qualification trigger; advancing to Email #4 (Deal Workbook).',
      next_category: 'qualified',
      next_pipeline_stage: 'qualified_buyer',
      next_disposition: 'active',
      notion_date_field: 'QUALIF_email_4_date',
    };
  }

  // Email #5 — LOI Received
  if (stage === 'qualified_buyer') {
    if (!gate.completed_loi) {
      return {
        can_advance: false,
        error: 'gate_not_met',
        detail: 'Lead at "qualified_buyer"; Completed LOI checkbox is not set. Email #5 fires when LOI is received.',
      };
    }
    return {
      can_advance: true,
      detail: 'LOI received; advancing to Email #5 (Proposal counter).',
      next_category: 'loi_received',
      next_pipeline_stage: 'loi_ioi',
      next_disposition: 'active',
      notion_date_field: 'PROPSL_email_5_date',
    };
  }

  // Stages beyond LOI — no automated email
  return {
    can_advance: false,
    error: 'beyond_email_5',
    detail: `Lead at "${stage}"; no automated email beyond Stage 6 (LOI / IOI). Manage diligence and settlement manually.`,
  };
}

// Helper for forced-category mode (Notion button click overrides auto-detection)
function decideForced(gate: LeadGateState, category: TemplateCategory): AdvanceDecision {
  switch (category) {
    case 'nda_received':
      return {
        can_advance: true,
        detail: 'Forced advance to Email #2.',
        next_category: 'nda_received',
        next_pipeline_stage: 'nda_executed',
        next_disposition: 'active',
        notion_date_field: 'PROSP_email_2_date',
      };
    case 'buyer_profile_received':
      return {
        can_advance: true,
        detail: 'Forced advance to Email #3.',
        next_category: 'buyer_profile_received',
        next_pipeline_stage: 'buyer_profile_received',
        next_disposition: 'active',
        notion_date_field: 'PROSP_email_3_date',
      };
    case 'qualified':
      return {
        can_advance: true,
        detail: 'Forced advance to Email #4.',
        next_category: 'qualified',
        next_pipeline_stage: 'qualified_buyer',
        next_disposition: 'active',
        notion_date_field: 'QUALIF_email_4_date',
      };
    case 'loi_received':
      return {
        can_advance: true,
        detail: 'Forced advance to Email #5.',
        next_category: 'loi_received',
        next_pipeline_stage: 'loi_ioi',
        next_disposition: 'active',
        notion_date_field: 'PROPSL_email_5_date',
      };
    default:
      return {
        can_advance: false,
        error: 'invalid_state',
        detail: `forceCategory='${category}' is not supported by /api/router/advance.`,
      };
  }
}

// ---------------------------------------------------------------------------
// Convenience: read gate + decide in one call
// ---------------------------------------------------------------------------

export async function readAndDecide(opts: {
  notion_lead_page_id: string;
  forceCategory?: TemplateCategory;
}): Promise<{ gate: LeadGateState; decision: AdvanceDecision }> {
  const gate = await readLeadGateState(opts.notion_lead_page_id);
  const decision = decideNextStep(gate, opts.forceCategory);
  return { gate, decision };
}

// Re-export so consumers can fetch full lead context separately
export { fetchNotionLead };
