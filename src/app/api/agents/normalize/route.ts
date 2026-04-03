import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgent2 } from '@/lib/agents/agent2-normalization'
import { runAgent3 } from '@/lib/agents/agent3-valuation-methods'
import { runAgent4 } from '@/lib/agents/agent4-synthesis'

export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { valuation_id } = body

    if (!valuation_id) {
      return NextResponse.json({ error: 'valuation_id is required' }, { status: 400 })
    }

    // Verify the user owns this valuation
    const { data: valuation } = await supabase
      .from('valuations')
      .select('id, user_id, status')
      .eq('id', valuation_id)
      .eq('user_id', user.id)
      .single()

    if (!valuation) {
      return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    }

    if (valuation.status !== 'draft') {
      return NextResponse.json(
        { error: `Valuation is already in "${valuation.status}" status. Pipeline can only run on draft valuations.` },
        { status: 400 }
      )
    }

    // Run Agent Pipeline: 2 → 3 → 4
    // Agent 2: Normalization & Metric Selection
    const agent2Result = await runAgent2(valuation_id)

    // Agent 3: Multi-Method Valuation (with Open Brain queries)
    const agent3Result = await runAgent3(valuation_id)

    // Agent 4: Synthesis & Range (auto-captures to Open Brain)
    const agent4Result = await runAgent4(valuation_id)

    return NextResponse.json({
      success: true,
      pipeline: 'complete',
      agent_2: {
        metric_type: agent2Result.metric_type,
        normalized_earnings: agent2Result.normalized_earnings,
        adjustments_count: agent2Result.adjustments.length,
      },
      agent_3: {
        methods_count: agent3Result.methods.length,
        weighted_value: agent3Result.weighted_value,
        open_brain_context_found: agent3Result.open_brain_context.length > 0,
      },
      agent_4: {
        valuation_low: agent4Result.valuation_low,
        valuation_mid: agent4Result.valuation_mid,
        valuation_high: agent4Result.valuation_high,
      },
    })
  } catch (error) {
    console.error('Agent pipeline error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent pipeline failed' },
      { status: 500 }
    )
  }
}
