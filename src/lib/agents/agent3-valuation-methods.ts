// Agent 3: Multi-Method Valuation Agent
// Runs 5 valuation methods: Market Multiple, Cap of Earnings, DCF, Asset-Based, Rule of Thumb
// Queries Open Brain for comparable deal context before analysis
// Includes CSRP (Company-Specific Risk Premium) 8-factor scoring

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// ═══════════════════════════════════════════════════════════════
// INDUSTRY BENCHMARK DATA
// ═══════════════════════════════════════════════════════════════

interface IndustryBenchmark {
  sde_multiple_low: number
  sde_multiple_mid: number
  sde_multiple_high: number
  ebitda_multiple_low: number
  ebitda_multiple_mid: number
  ebitda_multiple_high: number
  risk_free_rate: number
  equity_risk_premium: number
  size_premium: number
  industry_risk_premium: number
  typical_growth_rate: number
}

const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  'restaurant': {
    sde_multiple_low: 1.5, sde_multiple_mid: 2.2, sde_multiple_high: 3.0,
    ebitda_multiple_low: 2.5, ebitda_multiple_mid: 3.5, ebitda_multiple_high: 5.0,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.06,
    industry_risk_premium: 0.04, typical_growth_rate: 0.03,
  },
  'food service': {
    sde_multiple_low: 1.5, sde_multiple_mid: 2.2, sde_multiple_high: 3.0,
    ebitda_multiple_low: 2.5, ebitda_multiple_mid: 3.5, ebitda_multiple_high: 5.0,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.06,
    industry_risk_premium: 0.04, typical_growth_rate: 0.03,
  },
  'retail': {
    sde_multiple_low: 1.5, sde_multiple_mid: 2.5, sde_multiple_high: 3.5,
    ebitda_multiple_low: 3.0, ebitda_multiple_mid: 4.0, ebitda_multiple_high: 5.5,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.055,
    industry_risk_premium: 0.035, typical_growth_rate: 0.025,
  },
  'service': {
    sde_multiple_low: 1.8, sde_multiple_mid: 2.8, sde_multiple_high: 4.0,
    ebitda_multiple_low: 3.0, ebitda_multiple_mid: 4.5, ebitda_multiple_high: 6.0,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.05,
    industry_risk_premium: 0.03, typical_growth_rate: 0.035,
  },
  'construction': {
    sde_multiple_low: 1.5, sde_multiple_mid: 2.3, sde_multiple_high: 3.5,
    ebitda_multiple_low: 3.0, ebitda_multiple_mid: 4.0, ebitda_multiple_high: 5.5,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.055,
    industry_risk_premium: 0.04, typical_growth_rate: 0.03,
  },
  'manufacturing': {
    sde_multiple_low: 2.0, sde_multiple_mid: 3.0, sde_multiple_high: 4.5,
    ebitda_multiple_low: 3.5, ebitda_multiple_mid: 5.0, ebitda_multiple_high: 7.0,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.05,
    industry_risk_premium: 0.03, typical_growth_rate: 0.03,
  },
  'wholesale': {
    sde_multiple_low: 2.0, sde_multiple_mid: 3.0, sde_multiple_high: 4.0,
    ebitda_multiple_low: 3.5, ebitda_multiple_mid: 4.5, ebitda_multiple_high: 6.0,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.05,
    industry_risk_premium: 0.03, typical_growth_rate: 0.025,
  },
  'default': {
    sde_multiple_low: 1.5, sde_multiple_mid: 2.5, sde_multiple_high: 3.5,
    ebitda_multiple_low: 3.0, ebitda_multiple_mid: 4.0, ebitda_multiple_high: 5.5,
    risk_free_rate: 0.045, equity_risk_premium: 0.065, size_premium: 0.055,
    industry_risk_premium: 0.035, typical_growth_rate: 0.03,
  },
}

function getBenchmark(industry: string | null): IndustryBenchmark {
  if (!industry) return INDUSTRY_BENCHMARKS['default']
  const key = industry.toLowerCase()
  for (const [benchKey, bench] of Object.entries(INDUSTRY_BENCHMARKS)) {
    if (key.includes(benchKey)) return bench
  }
  return INDUSTRY_BENCHMARKS['default']
}

// ═══════════════════════════════════════════════════════════════
// CSRP 8-FACTOR SCORING
// ═══════════════════════════════════════════════════════════════

interface CSRPScore {
  management_depth: number        // 0-5% (higher = more risk)
  customer_concentration: number   // 0-5%
  revenue_stability: number        // 0-5%
  industry_risk: number           // 0-5%
  competitive_position: number    // 0-5%
  growth_trajectory: number       // 0-3%
  asset_quality: number           // 0-3%
  location_dependency: number     // 0-3%
  total: number                   // Sum of all factors
}

function calculateCSRP(
  annualRevenue: number,
  industry: string | null,
  metricType: 'sde' | 'ebitda',
): CSRPScore {
  // Default CSRP scoring based on available data
  // In production, this would be enhanced by LLM analysis of business description

  // Management depth: SDE businesses are owner-dependent = higher risk
  const management_depth = metricType === 'sde' ? 0.035 : 0.015

  // Customer concentration: unknown without more data, use moderate default
  const customer_concentration = 0.025

  // Revenue stability: smaller businesses = less stable
  const revenue_stability = annualRevenue < 500000 ? 0.035 :
    annualRevenue < 1000000 ? 0.025 : 0.015

  // Industry risk: from benchmark data
  const bench = getBenchmark(industry)
  const industry_risk = bench.industry_risk_premium

  // Competitive position: default moderate
  const competitive_position = 0.025

  // Growth trajectory: default moderate
  const growth_trajectory = 0.015

  // Asset quality: default moderate
  const asset_quality = 0.015

  // Location dependency: restaurants/retail = high location dependency
  const isLocationDependent = industry?.toLowerCase().includes('restaurant') ||
    industry?.toLowerCase().includes('retail') ||
    industry?.toLowerCase().includes('food')
  const location_dependency = isLocationDependent ? 0.025 : 0.01

  const total = management_depth + customer_concentration + revenue_stability +
    industry_risk + competitive_position + growth_trajectory + asset_quality + location_dependency

  return {
    management_depth, customer_concentration, revenue_stability,
    industry_risk, competitive_position, growth_trajectory,
    asset_quality, location_dependency, total,
  }
}

// ═══════════════════════════════════════════════════════════════
// OPEN BRAIN KNOWLEDGE BASE QUERY
// ═══════════════════════════════════════════════════════════════

async function queryOpenBrainForComparables(
  industry: string | null,
  revenue: number,
): Promise<string> {
  const supabase = getServiceClient()

  try {
    // Query Open Brain for comparable deals
    // We use the match_thoughts RPC with a text-based filter approach
    // For now, do a direct query on the thoughts table for relevant context
    const { data: thoughts } = await supabase
      .from('thoughts')
      .select('content, metadata')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!thoughts || thoughts.length === 0) return ''

    // Filter for valuation-related thoughts
    const relevantThoughts = thoughts.filter(t => {
      const content = t.content.toLowerCase()
      const hasValuation = content.includes('valuation') || content.includes('fmv') ||
        content.includes('sde') || content.includes('ebitda') || content.includes('multiple')
      const hasIndustry = !industry || content.includes(industry.toLowerCase()) ||
        content.includes('restaurant') || content.includes('deal')
      return hasValuation && hasIndustry
    }).slice(0, 5)

    if (relevantThoughts.length === 0) return ''

    return relevantThoughts.map(t => t.content).join('\n---\n')
  } catch (error) {
    console.error('Open Brain query error:', error)
    return ''
  }
}

// ═══════════════════════════════════════════════════════════════
// VALUATION METHODS
// ═══════════════════════════════════════════════════════════════

interface MethodResult {
  method: string
  result_value: number
  weight: number
  multiple_used: number | null
  cap_rate: number | null
  discount_rate: number | null
  csrp_score: CSRPScore | null
  reasoning: string
}

function runMarketMultiple(
  normalizedEarnings: number,
  metricType: 'sde' | 'ebitda',
  benchmark: IndustryBenchmark,
  industry: string | null,
): MethodResult {
  const multiple = metricType === 'sde'
    ? benchmark.sde_multiple_mid
    : benchmark.ebitda_multiple_mid

  const value = Math.round(normalizedEarnings * multiple)

  return {
    method: 'market_multiple',
    result_value: value,
    weight: 0.35, // Primary method for Main Street
    multiple_used: multiple,
    cap_rate: null,
    discount_rate: null,
    csrp_score: null,
    reasoning: `Applied ${multiple.toFixed(1)}x ${metricType.toUpperCase()} multiple based on ${industry || 'general'} industry benchmarks. ${metricType.toUpperCase()} of $${normalizedEarnings.toLocaleString()} yields FMV of $${value.toLocaleString()}. Multiple range for this industry: ${metricType === 'sde' ? `${benchmark.sde_multiple_low}x–${benchmark.sde_multiple_high}x` : `${benchmark.ebitda_multiple_low}x–${benchmark.ebitda_multiple_high}x`}.`,
  }
}

function runCapOfEarnings(
  normalizedEarnings: number,
  benchmark: IndustryBenchmark,
  csrp: CSRPScore,
  industry: string | null,
): MethodResult {
  // Build-up method for capitalization rate
  const capRate = benchmark.risk_free_rate +
    benchmark.equity_risk_premium +
    benchmark.size_premium +
    csrp.total

  const value = Math.round(normalizedEarnings / capRate)

  return {
    method: 'capitalization_of_earnings',
    result_value: value,
    weight: 0.25,
    multiple_used: null,
    cap_rate: Math.round(capRate * 10000) / 10000,
    discount_rate: null,
    csrp_score: csrp,
    reasoning: `Build-up capitalization rate: Risk-free ${(benchmark.risk_free_rate * 100).toFixed(1)}% + Equity premium ${(benchmark.equity_risk_premium * 100).toFixed(1)}% + Size premium ${(benchmark.size_premium * 100).toFixed(1)}% + CSRP ${(csrp.total * 100).toFixed(1)}% = ${(capRate * 100).toFixed(1)}% cap rate. Normalized earnings of $${normalizedEarnings.toLocaleString()} / ${(capRate * 100).toFixed(1)}% = $${value.toLocaleString()}. CSRP factors: management depth ${(csrp.management_depth * 100).toFixed(1)}%, customer concentration ${(csrp.customer_concentration * 100).toFixed(1)}%, revenue stability ${(csrp.revenue_stability * 100).toFixed(1)}%, industry risk ${(csrp.industry_risk * 100).toFixed(1)}%, competitive position ${(csrp.competitive_position * 100).toFixed(1)}%, growth ${(csrp.growth_trajectory * 100).toFixed(1)}%, asset quality ${(csrp.asset_quality * 100).toFixed(1)}%, location dependency ${(csrp.location_dependency * 100).toFixed(1)}%.`,
  }
}

function runDCF(
  normalizedEarnings: number,
  benchmark: IndustryBenchmark,
  csrp: CSRPScore,
): MethodResult {
  // 5-year DCF with terminal value
  const discountRate = benchmark.risk_free_rate +
    benchmark.equity_risk_premium +
    benchmark.size_premium +
    csrp.total
  const growthRate = benchmark.typical_growth_rate
  const terminalGrowthRate = 0.02 // Long-term GDP growth

  // Project 5 years of cash flows
  let totalPV = 0
  for (let year = 1; year <= 5; year++) {
    const cashFlow = normalizedEarnings * Math.pow(1 + growthRate, year)
    const pv = cashFlow / Math.pow(1 + discountRate, year)
    totalPV += pv
  }

  // Terminal value (Gordon Growth Model)
  const year5CashFlow = normalizedEarnings * Math.pow(1 + growthRate, 5)
  const terminalValue = (year5CashFlow * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate)
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, 5)

  const value = Math.round(totalPV + pvTerminal)

  return {
    method: 'dcf',
    result_value: value,
    weight: 0.20,
    multiple_used: null,
    cap_rate: null,
    discount_rate: Math.round(discountRate * 10000) / 10000,
    csrp_score: null,
    reasoning: `5-year DCF with ${(growthRate * 100).toFixed(1)}% annual growth, ${(discountRate * 100).toFixed(1)}% discount rate, and ${(terminalGrowthRate * 100).toFixed(1)}% terminal growth rate. PV of cash flows: $${Math.round(totalPV).toLocaleString()}. PV of terminal value: $${Math.round(pvTerminal).toLocaleString()}. Total enterprise value: $${value.toLocaleString()}.`,
  }
}

// Rate-aware versions that use broker-entered discount/cap rates from Risk Analysis
function runCapOfEarningsWithRates(
  normalizedEarnings: number,
  capRate: number,
  csrp: CSRPScore,
  industry: string | null,
  discountRate: number,
): MethodResult {
  const value = capRate > 0 ? Math.round(normalizedEarnings / capRate) : 0

  return {
    method: 'capitalization_of_earnings',
    result_value: value,
    weight: 0.25,
    multiple_used: null,
    cap_rate: Math.round(capRate * 10000) / 10000,
    discount_rate: Math.round(discountRate * 10000) / 10000,
    csrp_score: csrp,
    reasoning: `Capitalization rate of ${(capRate * 100).toFixed(1)}% (from Risk Analysis build-up: discount rate ${(discountRate * 100).toFixed(1)}% minus growth). Normalized earnings $${normalizedEarnings.toLocaleString()} / ${(capRate * 100).toFixed(1)}% = $${value.toLocaleString()}.`,
  }
}

function runDCFWithRates(
  normalizedEarnings: number,
  discountRate: number,
  growthRate: number,
  csrp: CSRPScore,
): MethodResult {
  const terminalGrowthRate = 0.02

  let totalPV = 0
  for (let year = 1; year <= 5; year++) {
    const cashFlow = normalizedEarnings * Math.pow(1 + growthRate, year)
    const pv = cashFlow / Math.pow(1 + discountRate, year)
    totalPV += pv
  }

  const year5CashFlow = normalizedEarnings * Math.pow(1 + growthRate, 5)
  const terminalValue = discountRate > terminalGrowthRate
    ? (year5CashFlow * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate)
    : 0
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, 5)

  const value = Math.round(totalPV + pvTerminal)

  return {
    method: 'dcf',
    result_value: value,
    weight: 0.20,
    multiple_used: null,
    cap_rate: null,
    discount_rate: Math.round(discountRate * 10000) / 10000,
    csrp_score: null,
    reasoning: `5-year DCF using Risk Analysis discount rate of ${(discountRate * 100).toFixed(1)}%, ${(growthRate * 100).toFixed(1)}% growth, ${(terminalGrowthRate * 100).toFixed(1)}% terminal growth. PV of cash flows: $${Math.round(totalPV).toLocaleString()}. PV of terminal value: $${Math.round(pvTerminal).toLocaleString()}. Total: $${value.toLocaleString()}.`,
  }
}

function runAssetBased(
  annualRevenue: number,
  industry: string | null,
): MethodResult {
  // Simplified asset-based approach
  // In production, this would use actual balance sheet data
  // For now, estimate based on revenue and industry asset intensity

  const isAssetHeavy = industry?.toLowerCase().includes('manufacturing') ||
    industry?.toLowerCase().includes('construction')
  const assetMultiplier = isAssetHeavy ? 0.35 : 0.15
  const value = Math.round(annualRevenue * assetMultiplier)

  return {
    method: 'asset_based',
    result_value: value,
    weight: 0.10, // Low weight without actual balance sheet data
    multiple_used: null,
    cap_rate: null,
    discount_rate: null,
    csrp_score: null,
    reasoning: `Estimated net asset value based on ${(assetMultiplier * 100).toFixed(0)}% of revenue ($${annualRevenue.toLocaleString()}) = $${value.toLocaleString()}. This is a floor value estimate. Weight reduced to 10% because actual balance sheet data was not provided. Asset-based method is more relevant for asset-intensive industries; this ${industry || 'business'} uses an estimated asset intensity ratio.`,
  }
}

function runRuleOfThumb(
  annualRevenue: number,
  normalizedEarnings: number,
  industry: string | null,
): MethodResult {
  // Industry-specific rules of thumb
  let revenueMultiple = 0.35 // Default
  let description = 'general business'

  const key = (industry || '').toLowerCase()
  if (key.includes('restaurant') || key.includes('food') || key.includes('pizza')) {
    revenueMultiple = 0.35
    description = 'restaurant/food service (typically 25-40% of annual revenue + inventory)'
  } else if (key.includes('retail')) {
    revenueMultiple = 0.30
    description = 'retail (typically 20-40% of annual revenue + inventory)'
  } else if (key.includes('service')) {
    revenueMultiple = 0.50
    description = 'service business (typically 40-60% of annual revenue)'
  } else if (key.includes('construction') || key.includes('hvac')) {
    revenueMultiple = 0.40
    description = 'construction/trades (typically 30-50% of annual revenue + equipment)'
  } else if (key.includes('wholesale') || key.includes('distribution')) {
    revenueMultiple = 0.30
    description = 'wholesale/distribution (typically 20-40% of annual revenue + inventory)'
  }

  const value = Math.round(annualRevenue * revenueMultiple)

  return {
    method: 'rule_of_thumb',
    result_value: value,
    weight: 0.10, // Reasonableness check, not primary method
    multiple_used: revenueMultiple,
    cap_rate: null,
    discount_rate: null,
    csrp_score: null,
    reasoning: `Industry rule of thumb for ${description}: ${(revenueMultiple * 100).toFixed(0)}% of annual revenue ($${annualRevenue.toLocaleString()}) = $${value.toLocaleString()}. This method is used as a reasonableness check against the primary income-based methods, weighted at 10%.`,
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN AGENT 3 RUNNER
// ═══════════════════════════════════════════════════════════════

export interface Agent3Result {
  methods: MethodResult[]
  open_brain_context: string
  weighted_value: number
}

export async function runAgent3(valuationId: string): Promise<Agent3Result> {
  const supabase = getServiceClient()

  // 1. Fetch the valuation
  const { data: valuation, error } = await supabase
    .from('valuations')
    .select('*')
    .eq('id', valuationId)
    .single()

  if (error || !valuation) throw new Error(`Valuation not found: ${valuationId}`)
  if (!valuation.normalized_earnings) throw new Error('Agent 2 must run first — no normalized earnings found')

  const normalizedEarnings = Number(valuation.normalized_earnings)
  const annualRevenue = Number(valuation.annual_revenue || 0)
  const metricType = valuation.metric_type as 'sde' | 'ebitda'
  const industry = valuation.industry as string | null

  // 2. Query Open Brain for comparable context
  const openBrainContext = await queryOpenBrainForComparables(industry, annualRevenue)

  // 3. Get industry benchmarks
  const benchmark = getBenchmark(industry)

  // 4. Check for broker-entered risk factors
  const { data: riskRow } = await supabase
    .from('risk_factors')
    .select('*')
    .eq('valuation_id', valuationId)
    .single()

  // Use broker-entered rates if available, otherwise fall back to defaults
  let csrp: CSRPScore
  let discountRate: number
  let capRate: number
  let growthRate: number

  if (riskRow && riskRow.discount_rate) {
    // Broker entered risk analysis — use their computed rates
    discountRate = Number(riskRow.discount_rate)
    capRate = Number(riskRow.capitalization_rate)
    growthRate = Number(riskRow.long_term_growth_rate) || 0.02
    csrp = {
      management_depth: Number(riskRow.owner_dependence_score || 3) * Number(riskRow.owner_dependence_weight || 0.10) * 0.01,
      customer_concentration: Number(riskRow.customer_concentration_score || 3) * Number(riskRow.customer_concentration_weight || 0.06) * 0.01,
      revenue_stability: Number(riskRow.revenue_trend_score || 3) * Number(riskRow.revenue_trend_weight || 0.08) * 0.01,
      industry_risk: Number(riskRow.industry_stability_score || 3) * Number(riskRow.industry_stability_weight || 0.08) * 0.01,
      competitive_position: Number(riskRow.competitive_position_score || 3) * Number(riskRow.competitive_position_weight || 0.08) * 0.01,
      growth_trajectory: 0,
      asset_quality: Number(riskRow.facility_equipment_score || 3) * Number(riskRow.facility_equipment_weight || 0.05) * 0.01,
      location_dependency: Number(riskRow.lease_position_score || 3) * Number(riskRow.lease_position_weight || 0.05) * 0.01,
      total: Number(riskRow.csrp_premium) || 0.10,
    }
  } else {
    // No risk factors entered — use default CSRP
    csrp = calculateCSRP(annualRevenue, industry, metricType)
    discountRate = benchmark.risk_free_rate + benchmark.equity_risk_premium + benchmark.size_premium + csrp.total
    capRate = discountRate - benchmark.typical_growth_rate
    growthRate = benchmark.typical_growth_rate
  }

  // 5. Run all 5 methods (pass real rates)
  const methods: MethodResult[] = [
    runMarketMultiple(normalizedEarnings, metricType, benchmark, industry),
    runCapOfEarningsWithRates(normalizedEarnings, capRate, csrp, industry, discountRate),
    runDCFWithRates(normalizedEarnings, discountRate, growthRate, csrp),
    runAssetBased(annualRevenue, industry),
    runRuleOfThumb(annualRevenue, normalizedEarnings, industry),
  ]

  // 6. Calculate weighted value
  const weightedValue = Math.round(
    methods.reduce((sum, m) => sum + (m.result_value * m.weight), 0)
  )

  // 7. Write methods to database
  const methodRows = methods.map(m => ({
    valuation_id: valuationId,
    method: m.method,
    result_value: m.result_value,
    weight: m.weight,
    multiple_used: m.multiple_used,
    cap_rate: m.cap_rate,
    discount_rate: m.discount_rate,
    csrp_score: m.csrp_score,
    reasoning: m.reasoning,
  }))

  await supabase.from('valuation_methods').insert(methodRows)

  // 8. Update valuation with agent log
  const existingLog = valuation.agent_log || []
  const agentLogEntry = {
    agent: 'agent_3_valuation_methods',
    timestamp: new Date().toISOString(),
    methods_count: methods.length,
    weighted_value: weightedValue,
    open_brain_thoughts_found: openBrainContext ? openBrainContext.split('---').length : 0,
    csrp_total: csrp.total,
  }

  await supabase
    .from('valuations')
    .update({
      agent_log: [...existingLog, agentLogEntry],
    })
    .eq('id', valuationId)

  return { methods, open_brain_context: openBrainContext, weighted_value: weightedValue }
}
