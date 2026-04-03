// Agent 4: Synthesis & Range Agent
// Takes all valuation method results, calculates weighted FMV,
// determines defensible range, and auto-captures to Open Brain

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export interface Agent4Result {
  valuation_low: number
  valuation_mid: number
  valuation_high: number
  reasoning: string
}

export async function runAgent4(valuationId: string): Promise<Agent4Result> {
  const supabase = getServiceClient()

  // 1. Fetch valuation
  const { data: valuation, error } = await supabase
    .from('valuations')
    .select('*')
    .eq('id', valuationId)
    .single()

  if (error || !valuation) throw new Error(`Valuation not found: ${valuationId}`)

  // 2. Fetch all method results
  const { data: methods } = await supabase
    .from('valuation_methods')
    .select('*')
    .eq('valuation_id', valuationId)

  if (!methods || methods.length === 0) throw new Error('Agent 3 must run first — no valuation methods found')

  // 3. Calculate weighted midpoint
  const weightedMid = Math.round(
    methods.reduce((sum, m) => sum + (Number(m.result_value) * Number(m.weight)), 0)
  )

  // 4. Determine range based on method dispersion
  const values = methods.map(m => Number(m.result_value)).filter(v => v > 0)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const spread = maxValue - minValue
  const coefficient = weightedMid > 0 ? spread / weightedMid : 0

  // Range width based on dispersion — more agreement = tighter range
  let rangeFactor: number
  if (coefficient < 0.3) {
    rangeFactor = 0.10 // Methods agree closely — tight 10% range
  } else if (coefficient < 0.6) {
    rangeFactor = 0.15 // Moderate disagreement — 15% range
  } else {
    rangeFactor = 0.20 // Wide disagreement — 20% range
  }

  const valuation_low = Math.round(weightedMid * (1 - rangeFactor))
  const valuation_mid = weightedMid
  const valuation_high = Math.round(weightedMid * (1 + rangeFactor))

  // 5. Generate reasoning
  const methodSummary = methods.map(m => {
    const name = formatMethod(m.method)
    return `${name}: $${Number(m.result_value).toLocaleString()} (${(Number(m.weight) * 100).toFixed(0)}% weight)`
  }).join('; ')

  const reasoning = `Weighted Fair Market Value of $${valuation_mid.toLocaleString()} based on ${methods.length} methods: ${methodSummary}. ` +
    `Method dispersion coefficient: ${(coefficient * 100).toFixed(1)}% — ${coefficient < 0.3 ? 'strong agreement' : coefficient < 0.6 ? 'moderate agreement' : 'wide dispersion'}, ` +
    `resulting in a ${(rangeFactor * 100).toFixed(0)}% range band. ` +
    `Defensible FMV range: $${valuation_low.toLocaleString()} – $${valuation_high.toLocaleString()}.`

  // 6. Update valuation record
  const existingLog = valuation.agent_log || []
  const agentLogEntry = {
    agent: 'agent_4_synthesis',
    timestamp: new Date().toISOString(),
    valuation_low, valuation_mid, valuation_high,
    range_factor: rangeFactor,
    dispersion_coefficient: coefficient,
  }

  await supabase
    .from('valuations')
    .update({
      valuation_low,
      valuation_mid,
      valuation_high,
      status: 'review',
      agent_log: [...existingLog, agentLogEntry],
    })
    .eq('id', valuationId)

  // 7. Auto-capture to Open Brain knowledge base
  try {
    const metricType = (valuation.metric_type || 'sde').toUpperCase()
    const thoughtContent = `Completed valuation for ${valuation.business_name} (${valuation.industry || 'unknown industry'}, SIC ${valuation.sic_code || 'N/A'}). ${metricType} of $${Number(valuation.normalized_earnings).toLocaleString()} with weighted FMV of $${valuation_mid.toLocaleString()} (range $${valuation_low.toLocaleString()}–$${valuation_high.toLocaleString()}). ${methods.length} methods applied. Revenue: $${Number(valuation.annual_revenue || 0).toLocaleString()}.`

    await supabase.from('thoughts').insert({
      content: thoughtContent,
      metadata: {
        type: 'reference',
        source: 'valuation_agent',
        topics: ['valuation', valuation.industry?.toLowerCase() || 'business', 'deal outcome'],
        people: [],
        valuation_id: valuationId,
        business_name: valuation.business_name,
      },
    })
  } catch (e) {
    console.error('Open Brain auto-capture failed (non-blocking):', e)
  }

  return { valuation_low, valuation_mid, valuation_high, reasoning }
}

function formatMethod(method: string): string {
  const names: Record<string, string> = {
    market_multiple: 'Market Multiple',
    capitalization_of_earnings: 'Cap of Earnings',
    dcf: 'DCF',
    asset_based: 'Asset-Based',
    rule_of_thumb: 'Rule of Thumb',
  }
  return names[method] || method
}
