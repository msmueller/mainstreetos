// ============================================================
// MainStreetOS — POST /api/deals/[id]/generate-cim-draft
// ------------------------------------------------------------
// Phase 12.14a — AI Draft pipeline (Confidential Information Memorandum, post-NDA)
// Broker clicks "Generate CIM Draft" on a deal page. This route:
//   1. Verifies auth + broker access to the seller_listing (RLS gate)
//   2. Calls Claude Sonnet via agent-cim-draft to produce markdown
//   3. Creates a child page under the "MSOS AI Drafts" Notion root
//   4. Inserts an ai_agent_runs row (tracks spend/latency/model)
//   5. Inserts an ai_drafts row in pending_review status
//   6. Fire-and-forgets an Open Brain capture
//   7. Returns { draft_id, notion_page_id, notion_page_url, model }
//
// Mirrors POST /api/deals/[id]/generate-om-draft (Phase 12.13).
// The CIM differs only in:
//   - agent api_name:  'agent_cim_writer'
//   - ai_drafts.kind:  'writer.cim_draft'
//   - Notion page title suffix: "Confidential Information Memorandum"
//   - input listing shape: no `generic_title` (CIM uses real name)
//
// total_tokens is omitted from the ai_agent_runs INSERT — Phase 12.13.2
// fixed this as a GENERATED ALWAYS column and any value breaks the write.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createClient as createJsClient } from '@supabase/supabase-js'
import { generateCimDraft, type CimListingInput } from '@/lib/agents/agent-cim-draft'
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

    // 2. Fetch seller_listing via RLS-scoped client. If the caller can read
    //    the row, they have broker-or-listing scope on this deal — the same
    //    gate as the OM route.
    const { data: listingRow, error: listingErr } = await authClient
      .from('seller_listings')
      .select('id, name, industry, asking_price_usd, revenue_ttm_usd, sde_ttm_usd, ebitda_ttm_usd, owner_user_id, custom_fields')
      .eq('id', dealId)
      .single()

    if (listingErr || !listingRow) {
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

    // 4. Build the CIM input from the listing row
    const custom = (listingRow.custom_fields ?? {}) as Record<string, unknown>
    const cimInput: CimListingInput = {
      id: listingRow.id as string,
      name: (listingRow.name as string) ?? null,
      industry: (listingRow.industry as string) ?? null,
      asking_price_usd: Number(listingRow.asking_price_usd ?? 0) || null,
      revenue_ttm_usd: Number(listingRow.revenue_ttm_usd ?? 0) || null,
      sde_ttm_usd: Number(listingRow.sde_ttm_usd ?? 0) || null,
      ebitda_ttm_usd: Number(listingRow.ebitda_ttm_usd ?? 0) || null,
      business_address: typeof custom.business_address === 'string' ? custom.business_address as string : null,
      years_established: typeof custom.years_established === 'number' ? custom.years_established as number : null,
      employee_count: typeof custom.employee_count === 'number' ? custom.employee_count as number : null,
      broker_notes: typeof custom.broker_notes === 'string' ? custom.broker_notes as string : null,
    }

    // 5. Generate the CIM markdown via Claude
    const draft = await generateCimDraft(cimInput, brokerLicense)

    // 6. Create the Notion child page under the AI Drafts root
    const rootPageId = getAiDraftsRootPageId()
    const businessDisplay = (listingRow.name as string) || 'Unnamed Business'
    const pageTitle = `${businessDisplay} — Confidential Information Memorandum — ${todayYmd()}`

    const notionResult = await createDraftPage({
      rootPageId,
      title: pageTitle,
      bodyMarkdown: draft.markdown,
      icon: '🔒',
    })

    // 7. Record ai_agent_runs + ai_drafts using the service-role client
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
        },
        output_payload: {
          notion_page_id: notionResult.pageId,
          notion_page_url: notionResult.pageUrl,
          blocks_written: notionResult.blocksWritten,
          markdown_length: draft.markdown.length,
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

    const { data: draftRow, error: draftErr } = await admin
      .from('ai_drafts')
      .insert({
        agent_run_id: runRow.id,
        kind: 'writer.cim_draft',
        object_type: 'seller_listing',
        record_id: dealId,
        payload: {
          title: pageTitle,
          markdown: draft.markdown,
          listing_name: listingRow.name,
          industry: listingRow.industry,
          asking_price_usd: listingRow.asking_price_usd,
          revenue_ttm_usd: listingRow.revenue_ttm_usd,
          sde_ttm_usd: listingRow.sde_ttm_usd,
          ebitda_ttm_usd: listingRow.ebitda_ttm_usd,
        },
        rationale: `Generated by agent_cim_writer (${draft.tier} → ${draft.model}) on ${todayYmd()}.`,
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

    // 8. Open Brain capture (non-blocking — failure does not fail the route)
    try {
      await admin.from('thoughts').insert({
        content: `Generated CIM Draft for ${businessDisplay} (${listingRow.industry ?? 'unknown industry'}). Asking ${listingRow.asking_price_usd ? '$' + Number(listingRow.asking_price_usd).toLocaleString() : 'TBD'}. Notion: ${notionResult.pageUrl}`,
        metadata: {
          type: 'reference',
          source: 'cim_writer_agent',
          topics: ['cim', 'confidential information memorandum', listingRow.industry?.toLowerCase() || 'business', 'ai draft'],
          people: [],
          listing_id: dealId,
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
