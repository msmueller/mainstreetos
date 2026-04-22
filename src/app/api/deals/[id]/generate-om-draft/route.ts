// ============================================================
// MainStreetOS — POST /api/deals/[id]/generate-om-draft
// ------------------------------------------------------------
// Phase 12.14c — OM writer rich/lean parity
//
// Phase 12.13 bootstrapped this route with top-line listing fields
// only. Phase 12.14c brings the OM writer into parity with the CIM
// writer (12.14b) by routing through the shared cim-context-loader
// and a discriminated CimContext union:
//
//   mode='rich' → listing + valuation + financial_data +
//                 valuation_methods + Agent 5 narrative
//                 The OM agent derives PRE-NDA-SAFE summary shapes
//                 (ranges, trends, qualitative margin bands,
//                 valuation range) — it never reproduces the P&L,
//                 SDE bridge, or CSRP detail from the CIM.
//   mode='lean' → listing top-line fields only (12.13 fallback)
//
// Flow:
//   1. Verifies auth + broker access to the seller_listing (RLS gate)
//   2. Delegates to loadCimContext() (shared with the CIM pipeline)
//   3. Calls Claude Sonnet via agent-om-draft with the CimContext
//   4. Creates a child page under the "MSOS AI Drafts" Notion root
//      (appends " [LEAN]" to the title when no valuation is linked)
//   5. Inserts an ai_agent_runs row (tracks spend/latency/model/mode)
//   6. Inserts an ai_drafts row in pending_review status with
//      mode / valuation_id / financial_rows / methods_count stamps
//   7. Fire-and-forgets an Open Brain capture
//   8. Returns { draft_id, notion_page_id, notion_page_url, model, mode }
//
// total_tokens is omitted from the ai_agent_runs INSERT — Phase 12.13.2
// fixed this as a GENERATED ALWAYS column and any value breaks the write.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createClient as createJsClient } from '@supabase/supabase-js'
import { generateOmDraft } from '@/lib/agents/agent-om-draft'
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

    // 2. Load listing + (optionally) valuation context via the shared
    //    loader. The loader enforces RLS for both the listing and any
    //    linked valuation, and gracefully degrades to lean mode when no
    //    valuation is linked or the broker can't read it.
    let omContext
    try {
      omContext = await loadCimContext(authClient, dealId)
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

    // 4. Generate the OM markdown via Claude
    const draft = await generateOmDraft(omContext, brokerLicense)

    // 5. Create the Notion child page under the AI Drafts root.
    //    Pre-NDA document — do NOT expose the real business name in
    //    the Notion page title. Use a generic descriptive slug plus
    //    a mode suffix so lean drafts are easy to spot in the tree.
    const rootPageId = getAiDraftsRootPageId()
    const genericSlug =
      omContext.listing.industry
        ? `${omContext.listing.industry} Business Opportunity`
        : 'Confidential Business Opportunity'
    const modeSuffix = omContext.mode === 'rich' ? '' : ' [LEAN]'
    const pageTitle = `${genericSlug} — Offering Memorandum — ${todayYmd()}${modeSuffix}`

    const notionResult = await createDraftPage({
      rootPageId,
      title: pageTitle,
      bodyMarkdown: draft.markdown,
      icon: '📄',
    })

    // 6. Record ai_agent_runs + ai_drafts using the service-role client
    //    (ai_agent_runs and ai_drafts have admin-only write RLS)
    const admin = getServiceClient()

    const { data: agentRow, error: agentErr } = await admin
      .from('ai_agents')
      .select('id')
      .eq('api_name', 'agent_om_writer')
      .single()
    if (agentErr || !agentRow) {
      throw new Error(`agent_om_writer not found in ai_agents: ${agentErr?.message ?? 'missing row'}`)
    }

    const completedAt = new Date()
    const durationMs = Date.now() - t0

    const valuationIdForRun =
      omContext.mode === 'rich' ? omContext.valuation.id : null

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
          mode: omContext.mode,
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

    // Build the ai_drafts payload. We keep the real listing_name in the
    // DB row (brokers need to identify the deal internally) but the
    // Notion title uses a generic slug above to preserve pre-NDA
    // confidentiality for anyone with link-only access.
    const draftPayload: Record<string, unknown> = {
      title: pageTitle,
      markdown: draft.markdown,
      mode: omContext.mode,
      listing_name: omContext.listing.name,
      industry: omContext.listing.industry,
      asking_price_usd: omContext.listing.asking_price_usd,
      revenue_ttm_usd: omContext.listing.revenue_ttm_usd,
      sde_ttm_usd: omContext.listing.sde_ttm_usd,
      ebitda_ttm_usd: omContext.listing.ebitda_ttm_usd,
    }
    if (omContext.mode === 'rich') {
      draftPayload.valuation_id = omContext.valuation.id
      draftPayload.valuation_status = omContext.valuation.status
      draftPayload.valuation_low = omContext.valuation.valuation_low
      draftPayload.valuation_mid = omContext.valuation.valuation_mid
      draftPayload.valuation_high = omContext.valuation.valuation_high
      draftPayload.financial_rows = omContext.financials.length
      draftPayload.methods_count = omContext.methods.length
    }

    const { data: draftRow, error: draftErr } = await admin
      .from('ai_drafts')
      .insert({
        agent_run_id: runRow.id,
        kind: 'writer.om_draft',
        object_type: 'seller_listing',
        record_id: dealId,
        payload: draftPayload,
        rationale: `Generated by agent_om_writer (${draft.tier} → ${draft.model}, mode=${omContext.mode}) on ${todayYmd()}.`,
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
    //    Internal memory keeps the real listing name so the broker can find
    //    the thread again — Open Brain is broker-private.
    try {
      const businessDisplay = omContext.listing.name || 'Unnamed Business'
      await admin.from('thoughts').insert({
        content: `Generated OM Draft (${omContext.mode}) for ${businessDisplay} (${omContext.listing.industry ?? 'unknown industry'}). Asking ${omContext.listing.asking_price_usd ? '$' + Number(omContext.listing.asking_price_usd).toLocaleString() : 'TBD'}. Notion: ${notionResult.pageUrl}`,
        metadata: {
          type: 'reference',
          source: 'om_writer_agent',
          topics: [
            'om',
            'offering memorandum',
            omContext.listing.industry?.toLowerCase() || 'business',
            'ai draft',
            omContext.mode === 'rich' ? 'rich-mode' : 'lean-mode',
          ],
          people: [],
          listing_id: dealId,
          valuation_id: valuationIdForRun,
          mode: omContext.mode,
          notion_page_id: notionResult.pageId,
          notion_page_url: notionResult.pageUrl,
          draft_id: draftRow.id,
          model: draft.model,
        },
      })
    } catch (obErr) {
      console.error('[om-draft] Open Brain capture failed (non-blocking):', obErr)
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
    console.error('[om-draft] pipeline error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OM draft generation failed' },
      { status: 500 }
    )
  }
}
