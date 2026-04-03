import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgent2 } from '@/lib/agents/agent2-normalization'

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
        { error: `Valuation is already in "${valuation.status}" status. Agent 2 can only run on draft valuations.` },
        { status: 400 }
      )
    }

    // Run Agent 2
    const result = await runAgent2(valuation_id)

    return NextResponse.json({
      success: true,
      metric_type: result.metric_type,
      normalized_earnings: result.normalized_earnings,
      adjustments_count: result.adjustments.length,
      reasoning: result.reasoning,
    })
  } catch (error) {
    console.error('Agent 2 error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent 2 failed' },
      { status: 500 }
    )
  }
}
