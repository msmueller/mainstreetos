import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgent5Pipeline } from '@/lib/agents/agent5-report-pipeline'
import { toBrokerLicense } from '@/lib/types'
import type { SubscriptionTier } from '@/lib/types'

// Starter tier and above may generate BVR reports.
const ALLOWED_TIERS: SubscriptionTier[] = ['starter', 'professional', 'enterprise']

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { valuation_id } = await request.json()
    if (!valuation_id) {
      return NextResponse.json({ error: 'valuation_id is required' }, { status: 400 })
    }

    // Ownership check + minimal valuation metadata
    const { data: valuation } = await supabase
      .from('valuations')
      .select('id, user_id, status, annual_revenue')
      .eq('id', valuation_id)
      .eq('user_id', user.id)
      .single()

    if (!valuation) {
      return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    }
    if (valuation.status !== 'review' && valuation.status !== 'complete') {
      return NextResponse.json(
        { error: `Report generation requires status "review" (or re-generation from "complete"). Current: "${valuation.status}".` },
        { status: 400 },
      )
    }

    // Subscription tier gate — Starter+
    const { data: profile } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
    const tier = (profile?.subscription_tier as SubscriptionTier) || 'free'
    if (!ALLOWED_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: 'BVR Report generation requires a Starter or higher subscription.', tier },
        { status: 403 },
      )
    }

    const brokerLicense = toBrokerLicense(tier)
    const result = await runAgent5Pipeline(valuation_id, brokerLicense)

    return NextResponse.json({
      success: true,
      report_url: result.report_url,
      filename: result.filename,
      storage_path: result.storage_path,
    })
  } catch (error) {
    console.error('[generate-report] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Report generation failed' },
      { status: 500 },
    )
  }
}
