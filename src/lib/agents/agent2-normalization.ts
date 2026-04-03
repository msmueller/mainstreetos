// Agent 2: Normalization & Metric Selection Agent (v2 — Multi-Year Weighted)
// The CAIBVS™ core — now supports 3-5 year historical recast with weighted averages
//
// Weighting methods:
//   - linear_recent: Most recent year gets highest weight (e.g., 5yr: 35/25/20/12/8)
//   - equal: All years weighted equally
//   - custom: User-defined weights from year_weights JSONB field

import { createClient } from '@supabase/supabase-js'
import type { FinancialData } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

interface YearMetrics {
  fiscal_year: number
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  grossMargin: number
  totalOperatingExpenses: number
  ownerCompensation: number
  depreciation: number
  amortization: number
  interest: number
  taxes: number
  netIncome: number
  ebitda: number
  sde: number
}

interface AgentResult {
  metric_type: 'sde' | 'ebitda'
  normalized_earnings: number
  weighted_earnings_by_year: { fiscal_year: number; earnings: number; weight: number }[]
  adjustments: { line_item: string; category: string; amount: number; reason: string }[]
  reasoning: string
  agent_log_entry: Record<string, unknown>
}

export async function runAgent2(valuationId: string): Promise<AgentResult> {
  const supabase = getServiceClient()

  const { data: valuation, error: valError } = await supabase
    .from('valuations').select('*').eq('id', valuationId).single()
  if (valError || !valuation) throw new Error(`Valuation not found: ${valuationId}`)

  const { data: financials, error: finError } = await supabase
    .from('financial_data').select('*').eq('valuation_id', valuationId)
    .eq('is_adjustment', false).order('fiscal_year', { ascending: true })
  if (finError || !financials || financials.length === 0) throw new Error('No financial data found')

  const finData = financials as FinancialData[]
  const ownerCompInOpex = valuation.owner_comp_in_opex || false
  const years = [...new Set(finData.map(f => f.fiscal_year))].sort()

  const yearMetrics: YearMetrics[] = years.map(year => {
    const yearData = finData.filter(f => f.fiscal_year === year)
    return calculateYearMetrics(yearData, year, ownerCompInOpex)
  })

  const mostRecentYear = yearMetrics[yearMetrics.length - 1]
  const annualRevenue = valuation.annual_revenue || mostRecentYear.totalRevenue
  const metricSelection = selectEarningsMetric(annualRevenue, valuation.industry, finData)

  const weights = calculateYearWeights(
    years, valuation.weighting_method || 'linear_recent', valuation.year_weights || {}
  )

  const earningsByYear = yearMetrics.map(ym => ({
    fiscal_year: ym.fiscal_year,
    earnings: metricSelection.metric_type === 'sde' ? ym.sde : ym.ebitda,
    weight: weights[ym.fiscal_year] || 0,
  }))

  const weightedEarnings = Math.round(
    earningsByYear.reduce((sum, y) => sum + (y.earnings * y.weight), 0) * 100
  ) / 100

  const llmAnalysis = await analyzeNormalizingAdjustments(
    valuation, yearMetrics, metricSelection.metric_type, weightedEarnings
  )

  const totalAdjustments = llmAnalysis.adjustments.reduce((sum, a) => sum + a.amount, 0)
  const normalizedEarnings = Math.round((weightedEarnings + totalAdjustments) * 100) / 100

  if (llmAnalysis.adjustments.length > 0) {
    const adjustmentRows = llmAnalysis.adjustments.map(adj => ({
      valuation_id: valuationId,
      fiscal_year: mostRecentYear.fiscal_year,
      category: 'adjustment' as const,
      line_item: adj.line_item,
      amount: adj.amount,
      is_adjustment: true,
      adjustment_reason: adj.reason,
    }))
    await supabase.from('financial_data').insert(adjustmentRows)
  }

  const agentLogEntry = {
    agent: 'agent_2_normalization_v2',
    timestamp: new Date().toISOString(),
    metric_type: metricSelection.metric_type,
    metric_reasoning: metricSelection.reasoning,
    years_analyzed: years,
    weighting_method: valuation.weighting_method || 'linear_recent',
    weights_applied: weights,
    earnings_by_year: earningsByYear,
    weighted_earnings_pre_adjustments: weightedEarnings,
    adjustments_count: llmAnalysis.adjustments.length,
    total_adjustments: totalAdjustments,
    normalized_earnings: normalizedEarnings,
    owner_comp_in_opex: ownerCompInOpex,
  }

  const existingLog = valuation.agent_log || []
  await supabase.from('valuations').update({
    metric_type: metricSelection.metric_type,
    normalized_earnings: normalizedEarnings,
    status: 'processing',
    agent_log: [...existingLog, agentLogEntry],
  }).eq('id', valuationId)

  return {
    metric_type: metricSelection.metric_type,
    normalized_earnings: normalizedEarnings,
    weighted_earnings_by_year: earningsByYear,
    adjustments: llmAnalysis.adjustments,
    reasoning: `${years.length}-year weighted analysis (${valuation.weighting_method || 'linear_recent'}). ${llmAnalysis.reasoning}`,
    agent_log_entry: agentLogEntry,
  }
}

function calculateYearMetrics(
  financials: FinancialData[], year: number, ownerCompInOpex: boolean
): YearMetrics {
  const sum = (cat: string) =>
    financials.filter(f => f.category === cat).reduce((s, f) => s + Number(f.amount), 0)

  const totalRevenue = sum('revenue')
  const totalCOGS = sum('cogs')
  const grossProfit = totalRevenue - totalCOGS
  const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0
  const totalOperatingExpenses = sum('operating_expense')
  const ownerCompensation = sum('owner_compensation')
  const depreciation = sum('depreciation')
  const amortization = sum('amortization')
  const interest = sum('interest')
  const taxes = sum('taxes')

  let netIncome: number
  if (ownerCompInOpex) {
    netIncome = totalRevenue - totalCOGS - totalOperatingExpenses -
      depreciation - amortization - interest - taxes
  } else {
    netIncome = totalRevenue - totalCOGS - totalOperatingExpenses -
      ownerCompensation - depreciation - amortization - interest - taxes
  }

  const ebitda = netIncome + depreciation + amortization + interest + taxes
  const sde = ebitda + ownerCompensation

  return {
    fiscal_year: year, totalRevenue, totalCOGS, grossProfit, grossMargin,
    totalOperatingExpenses, ownerCompensation, depreciation, amortization,
    interest, taxes, netIncome, ebitda, sde,
  }
}

function calculateYearWeights(
  years: number[], method: string, customWeights: Record<string, number>
): Record<number, number> {
  const n = years.length

  if (method === 'custom' && Object.keys(customWeights).length > 0) {
    const total = Object.values(customWeights).reduce((s, w) => s + w, 0)
    const weights: Record<number, number> = {}
    for (const year of years) {
      weights[year] = (customWeights[year.toString()] || 0) / (total || 1)
    }
    return weights
  }

  if (method === 'equal') {
    const weights: Record<number, number> = {}
    for (const year of years) { weights[year] = Math.round((1 / n) * 1000) / 1000 }
    return weights
  }

  // linear_recent: most recent year gets highest weight
  const schemes: Record<number, number[]> = {
    1: [1.0],
    2: [0.60, 0.40],
    3: [0.50, 0.30, 0.20],
    4: [0.40, 0.30, 0.20, 0.10],
    5: [0.35, 0.25, 0.20, 0.12, 0.08],
  }

  const scheme = schemes[Math.min(n, 5)]
  const sortedYears = [...years].sort((a, b) => b - a)
  const weights: Record<number, number> = {}
  sortedYears.forEach((year, i) => {
    weights[year] = scheme[Math.min(i, scheme.length - 1)]
  })
  return weights
}

function selectEarningsMetric(
  annualRevenue: number, industry: string | null, financials: FinancialData[]
): { metric_type: 'sde' | 'ebitda'; reasoning: string } {
  const ownerCompItems = financials.filter(f => f.category === 'owner_compensation')
  const totalOwnerComp = ownerCompItems.reduce((sum, f) => sum + Number(f.amount), 0)
  const uniqueYears = new Set(ownerCompItems.map(f => f.fiscal_year)).size
  const avgOwnerComp = uniqueYears > 0 ? totalOwnerComp / uniqueYears : 0
  const ownerCompRatio = annualRevenue > 0 ? avgOwnerComp / annualRevenue : 0

  if (annualRevenue < 1_000_000) {
    return {
      metric_type: 'sde',
      reasoning: `Revenue of $${annualRevenue.toLocaleString()} is below $1M. Main Street owner-operated business. SDE selected.`,
    }
  }
  if (annualRevenue < 5_000_000) {
    if (ownerCompRatio > 0.15) {
      return { metric_type: 'sde',
        reasoning: `Revenue $${annualRevenue.toLocaleString()} in $1M–$5M range. Owner comp ${(ownerCompRatio * 100).toFixed(1)}% of revenue = owner-dependent. SDE selected.` }
    }
    return { metric_type: 'ebitda',
      reasoning: `Revenue $${annualRevenue.toLocaleString()} in $1M–$5M range. Owner comp only ${(ownerCompRatio * 100).toFixed(1)}% = management structure. EBITDA selected.` }
  }
  return { metric_type: 'ebitda',
    reasoning: `Revenue $${annualRevenue.toLocaleString()} exceeds $5M. Mid-market. EBITDA selected.` }
}

interface AdjustmentAnalysis {
  adjustments: { line_item: string; category: string; amount: number; reason: string }[]
  reasoning: string
}

async function analyzeNormalizingAdjustments(
  valuation: Record<string, unknown>, yearMetrics: YearMetrics[],
  metricType: 'sde' | 'ebitda', weightedEarnings: number,
): Promise<AdjustmentAnalysis> {
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (!openrouterKey) return generateDefaultAdjustments(yearMetrics, metricType)

  const yearSummary = yearMetrics.map(ym =>
    `FY${ym.fiscal_year}: Revenue $${ym.totalRevenue.toLocaleString()}, COGS $${ym.totalCOGS.toLocaleString()}, OpEx $${ym.totalOperatingExpenses.toLocaleString()}, Owner Comp $${ym.ownerCompensation.toLocaleString()}, D&A $${(ym.depreciation + ym.amortization).toLocaleString()}, EBITDA $${ym.ebitda.toLocaleString()}, SDE $${ym.sde.toLocaleString()}`
  ).join('\n')

  const prompt = `You are a USPAP-aligned business valuation analyst (CAIBVS™). Analyze ${yearMetrics.length} years of recast financials and identify normalizing adjustments.

BUSINESS: ${valuation.business_name}
INDUSTRY: ${valuation.industry || 'Not specified'}
METRIC: ${metricType.toUpperCase()}
WEIGHTED ${metricType.toUpperCase()}: $${weightedEarnings.toLocaleString()}

YEAR-BY-YEAR:
${yearSummary}

TRENDS:
- Revenue: $${yearMetrics[0].totalRevenue.toLocaleString()} → $${yearMetrics[yearMetrics.length - 1].totalRevenue.toLocaleString()} (${yearMetrics.length > 1 ? ((yearMetrics[yearMetrics.length - 1].totalRevenue / yearMetrics[0].totalRevenue - 1) * 100).toFixed(1) + '% change' : 'single year'})
- Avg owner comp: $${Math.round(yearMetrics.reduce((s, y) => s + y.ownerCompensation, 0) / yearMetrics.length).toLocaleString()}/yr

Identify normalizing adjustments. Market owner comp: $50K–$80K restaurants, $60K–$100K services, $80K–$120K professional.

RESPOND IN THIS EXACT JSON FORMAT ONLY:
{"adjustments":[{"line_item":"desc","category":"adjustment","amount":12000,"reason":"explanation"}],"reasoning":"Overall assessment..."}`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mainstreetos.vercel.app',
        'X-Title': 'MainStreetOS Agent 2',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) return generateDefaultAdjustments(yearMetrics, metricType)
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return { adjustments: parsed.adjustments || [], reasoning: parsed.reasoning || 'LLM analysis completed.' }
  } catch {
    return generateDefaultAdjustments(yearMetrics, metricType)
  }
}

function generateDefaultAdjustments(
  yearMetrics: YearMetrics[], metricType: 'sde' | 'ebitda'
): AdjustmentAnalysis {
  const adjustments: AdjustmentAnalysis['adjustments'] = []
  const avgOwnerComp = yearMetrics.reduce((s, y) => s + y.ownerCompensation, 0) / yearMetrics.length

  if (metricType === 'sde' && avgOwnerComp > 0) {
    const marketRate = 65000
    const excess = avgOwnerComp - marketRate
    if (Math.abs(excess) > 5000) {
      adjustments.push({
        line_item: excess > 0 ? 'Excess Owner Comp Add-Back' : 'Below-Market Owner Comp Deduction',
        category: 'adjustment', amount: Math.round(excess),
        reason: `Avg owner comp $${Math.round(avgOwnerComp).toLocaleString()} vs. market $${marketRate.toLocaleString()}. Difference $${Math.abs(Math.round(excess)).toLocaleString()} ${excess > 0 ? 'added back' : 'deducted'}.`,
      })
    }
  }

  return {
    adjustments,
    reasoning: `Standard normalization with ${yearMetrics.length}-year weighted average. ${adjustments.length} adjustment(s) using default market comparables.`,
  }
}
