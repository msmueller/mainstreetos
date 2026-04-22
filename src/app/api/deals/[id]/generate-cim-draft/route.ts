// ============================================================
// MainStreetOS — POST /api/deals/[id]/generate-cim-draft
// ------------------------------------------------------------
// Phase 12.14a bootstrapped this route with top-line listing fields
// only. Phase 12.14b upgrades the data path:
//
//   1. Verifies auth + broker access to the seller_listing (RLS gate)
//   2. Delegates to loadCimContext() which returns either:
//        mode='rich' → listing + valuation + financial_data +
//                      valuation_methods + Agent 5 narrative
//        mode='lean' → listing top-line fields only (12.14a fallback)
//   3. Calls Claude Sonnet via agent-cim-draft with the full context
//   4. Creates a child page under the "MSOS AI Drafts" Notion root
//   5. Inserts an ai_agent_runs row (tracks spend/latency/model/mode)
//   6. Inserts an ai_drafts row in pending_review status
//   7. Fire-and-forgets an Open Brain capture
//   8. Returns { draft_id, notion_page_id, notion_page_url, model, mode }
//
// total_tokens is omitted from the ai_agent_runs INSERT — Phase 12.13.2
// fixed this as a GENERATED ALWAYS column and any value breaks the write.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createClient as createJsClient } from '@supabase/supabase-js'
import { generateCimDraft } from '@/lib/agents/agent-cim-draft'
import { loadCimContext } from '@/lib/agents/cim-context-loader'
import { createDraftPage, getAiDraftsRootPageId } from '@/lib/notion/client'
import { toBrokerLicense } from '@/lib/types'
import type { SubscriptionTier } from '@/lib/types'

function getServiceClient() {
  return createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function todayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startedAt = new Date()
  const t0 = Date.now()

  try {
    const { id: dealId } = await context.params
    if (!dealId) {
      return NextResponse.json({ error: 'deal id is required' }, { status: 400 })
    }

    // 1. Auth — must be a signed-in user
    const authClient = await createSsrClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Load CIM context via the shared loader. The loader enforces
    //    RLS for both the listing and the linked valuation, and
    //    gracefully degrades to lean mode when no valuation is linked
    //    or the broker can't read it.
    let cimContext
    try {
      cimContext = await loadCimContext(authClient, dealId)
    } catch {
      return NextResponse.json(
        { error: 'Listing not found or access denied' },
        { status: 404 }
      )
    }

    // 3. Resolve broker license for model routing
    const { data: profile } = await authClient
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
    const brokerLicense = toBrokerLicense(
      (profile?.subscription_tier as SubscriptionTier) || 'free'
    )

    // 4. Generate the CIM markdown via Claude
    const draft = await generateCimDraft(cimContext, brokerLicense)

    // 5. Create the Notion child page under the AI Drafts root
    const rootPageId = getAiDraftsRootPageId()
    const businessDisplay = cimContext.listing.name || 'Unnamed Business'
    const modeSuffix = cimContext.mode === 'rich' ? '' : ' [LEAN]'
    const pageTitle = `${businessDisplay} — Confidential Information Memorandum — ${todayYmd()}${modeSuffix}`

    const notionResult = await createDraftPage({
      rootPageId,
      title: pageTitle,
      bodyMarkdown: draft.markdown,
      icon: '🔒',
    })

    // 6. Record ai_agent_runs + ai_drafts using the service-role client
    //    (ai_agent_runs and ai_drafts have admin-only write RLS)
    const admin = getServiceClient()

    const { data: agentRow, error: agentErr } = await admin
      .from('ai_agents')
      .select('id')
      .eq('api_name', 'agent_cim_writer')
      .single()
    if (agentErr || !agentRow) {
      throw new Error(`agent_cim_writer not found in ai_agents: ${agentErr?.message ?? 'missing row'}`)
    }

    const completedAt = new Date()
    const durationMs = Date.now() - t0

    const valuationIdForRun =
      cimContext.mode === 'rich' ? cimContext.valuation.id : null

    const { data: runRow, error: runErr } = await admin
      .from('ai_agent_runs')
      .insert({
        agent_id: agentRow.id,
        object_type: 'seller_listing',
        record_id: dealId,
        initiated_by: user.id,
        status: 'completed',
        input_payload: {
          listing_id: dealId,
          task: 'doc.draft',
          tier: draft.tier,
          mode: cimContext.mode,
          valuation_id: valuationIdForRun,
        },
        output_payload: {
          notion_page_id: notionResult.pageId,
          notion_page_url: notionResult.pageUrl,
          blocks_written: notionResult.blocksWritten,
          markdown_length: draft.markdown.length,
          mode: draft.mode,
        },
        tool_calls: [],
        model: draft.model,
        input_tokens: draft.promptTokens,
        output_tokens: draft.completionTokens,
        // total_tokens is a GENERATED ALWAYS column — do NOT insert a value.
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
      })
      .select('id')
      .single()

    if (runErr || !runRow) {
      throw new Error(`failed to record ai_agent_runs row: ${runErr?.message}`)
    }

    const draftPayload: Record<string, unknown> = {
      title: pageTitle,
      markdown: draft.markdown,
      mode: cimContext.mode,
      listing_name: cimContext.listing.name,
      industry: cimContext.listing.industry,
      asking_price_usd: cimContext.listing.asking_price_usd,
      revenue_ttm_usd: cimContext.listing.revenue_ttm_usd,
      sde_ttm_usd: cimContext.listing.sde_ttm_usd,
      ebitda_ttm_usd: cimContext.listing.ebitda_ttm_usd,
    }
    if (cimContext.mode === 'rich') {
      draftPayload.valuation_id = cimContext.valuation.id
      draftPayload.valuation_status = cimContext.valuation.status
      draftPayload.valuation_low = cimContext.valuation.valuation_low
      draftPayload.valuation_mid = cimContext.valuation.valuation_mid
      draftPayload.valuation_high = cimContext.valuation.valuation_high
      draftPayload.financial_rows = cimContext.financials.length
      draftPayload.methods_count = cimContext.methods.length
    }

    const { data: draftRow, error: draftErr } = await admin
      .from('ai_drafts')
      .insert({
        agent_run_id: runRow.id,
        kind: 'writer.cim_draft',
        object_type: 'seller_listing',
        record_id: dealId,
        payload: draftPayload,
        rationale: `Generated by agent_cim_writer (${draft.tier} → ${draft.model}, mode=${cimContext.mode}) on ${todayYmd()}.`,
        status: 'pending_review',
        notion_page_id: notionResult.pageId,
        notion_page_url: notionResult.pageUrl,
        model_used: draft.model,
        prompt_tokens: draft.promptTokens,
        completion_tokens: draft.completionTokens,
      })
      .select('id')
      .single()

    if (draftErr || !draftRow) {
      throw new Error(`failed to record ai_drafts row: ${draftErr?.message}`)
    }

    // 7. Open Brain capture (non-blocking — failure does not fail the route)
    try {
      await admin.from('thoughts').insert({
        content: `Generated CIM Draft (${cimContext.mode}) for ${businessDisplay} (${cimContext.listing.industry ?? 'unknown industry'}). Asking ${cimContext.listing.asking_price_usd ? '$' + Number(cimContext.listing.asking_price_usd).toLocaleString() : 'TBD'}. Notion: ${notionResult.pageUrl}`,
        metadata: {
          type: 'reference',
          source: 'cim_writer_agent',
          topics: [
            'cim',
            'confidential information memorandum',
            cimContext.listing.industry?.toLowerCase() || 'business',
            'ai draft',
            cimContext.mode === 'rich' ? 'rich-mode' : 'lean-mode',
          ],
          people: [],
          listing_id: dealId,
          valuation_id: valuationIdForRun,
          mode: cimContext.mode,
          notion_page_id: notionResult.pageId,
          notion_page_url: notionResult.pageUrl,
          draft_id: draftRow.id,
          model: draft.model,
        },
      })
    } catch (obErr) {
      console.error('[cim-draft] Open Brain capture failed (non-blocking):', obErr)
    }

    return NextResponse.json({
      success: true,
      draft_id: draftRow.id,
      agent_run_id: runRow.id,
      notion_page_id: notionResult.pageId,
      notion_page_url: notionResult.pageUrl,
      model_used: draft.model,
      tier: draft.tier,
      mode: draft.mode,
      valuation_id: valuationIdForRun,
      prompt_tokens: draft.promptTokens,
      completion_tokens: draft.completionTokens,
      duration_ms: durationMs,
    })
  } catch (err) {
    console.error('[cim-draft] pipeline error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'CIM draft generation failed' },
      { status: 500 }
    )
  }
}
