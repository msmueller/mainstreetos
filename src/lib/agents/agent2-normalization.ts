// Agent 2: Normalization & Metric Selection Agent
// The CAIBVS™ core — determines SDE vs EBITDA, calculates normalizing adjustments,
// and computes the final normalized earnings figure.
//
// This is the agent that no competitor has.

import { createClient } from '@supabase/supabase-js'
import type { FinancialData } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role client for agent operations (bypasses RLS)
function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

interface AgentResult {
  metric_type: 'sde' | 'ebitda'
  normalized_earnings: number
  adjustments: {
    line_item: string
    category: string
    amount: number
    reason: string
  }[]
  reasoning: string
  agent_log_entry: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════
// CORE AGENT LOGIC
// ═══════════════════════════════════════════════════════════════

export async function runAgent2(valuationId: string): Promise<AgentResult> {
  const supabase = getServiceClient()

  // 1. Fetch the valuation record
  const { data: valuation, error: valError } = await supabase
    .from('valuations')
    .select('*')
    .eq('id', valuationId)
    .single()

  if (valError || !valuation) {
    throw new Error(`Valuation not found: ${valuationId}`)
  }

  // 2. Fetch all financial data for this valuation
  const { data: financials, error: finError } = await supabase
    .from('financial_data')
    .select('*')
    .eq('valuation_id', valuationId)
    .order('fiscal_year', { ascending: true })
    .order('category', { ascending: true })

  if (finError || !financials || financials.length === 0) {
    throw new Error('No financial data found for this valuation')
  }

  const finData = financials as FinancialData[]

  // 3. Calculate base financial metrics (deterministic — not LLM)
  const metrics = calculateBaseMetrics(finData)

  // 4. Determine SDE vs EBITDA (deterministic rules + LLM reasoning)
  const metricSelection = selectEarningsMetric(
    valuation.annual_revenue || metrics.totalRevenue,
    valuation.industry,
    finData
  )

  // 5. Call LLM for normalizing adjustments analysis
  const llmAnalysis = await analyzeFoNormalizingAdjustments(
    valuation,
    finData,
    metrics,
    metricSelection.metric_type
  )

  // 6. Calculate normalized earnings
  const normalizedEarnings = calculateNormalizedEarnings(
    metrics,
    metricSelection.metric_type,
    llmAnalysis.adjustments
  )

  // 7. Write adjustments back to financial_data table
  if (llmAnalysis.adjustments.length > 0) {
    const adjustmentRows = llmAnalysis.adjustments.map(adj => ({
      valuation_id: valuationId,
      fiscal_year: finData[0].fiscal_year, // Use the primary fiscal year
      category: 'adjustment' as const,
      line_item: adj.line_item,
      amount: adj.amount,
      is_adjustment: true,
      adjustment_reason: adj.reason,
    }))

    await supabase.from('financial_data').insert(adjustmentRows)
  }

  // 8. Update the valuation record
  const agentLogEntry = {
    agent: 'agent_2_normalization',
    timestamp: new Date().toISOString(),
    metric_type: metricSelection.metric_type,
    metric_reasoning: metricSelection.reasoning,
    normalized_earnings: normalizedEarnings,
    adjustments_count: llmAnalysis.adjustments.length,
    llm_reasoning: llmAnalysis.reasoning,
  }

  const existingLog = valuation.agent_log || []

  await supabase
    .from('valuations')
    .update({
      metric_type: metricSelection.metric_type,
      normalized_earnings: normalizedEarnings,
      status: 'processing',
      agent_log: [...existingLog, agentLogEntry],
    })
    .eq('id', valuationId)

  return {
    metric_type: metricSelection.metric_type,
    normalized_earnings: normalizedEarnings,
    adjustments: llmAnalysis.adjustments,
    reasoning: llmAnalysis.reasoning,
    agent_log_entry: agentLogEntry,
  }
}

// ═══════════════════════════════════════════════════════════════
// DETERMINISTIC CALCULATIONS (No LLM — pure math)
// ═══════════════════════════════════════════════════════════════

interface BaseMetrics {
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

function calculateBaseMetrics(financials: FinancialData[]): BaseMetrics {
  // Sum by category across all line items
  const sumByCategory = (cat: string) =>
    financials
      .filter(f => f.category === cat && !f.is_adjustment)
      .reduce((sum, f) => sum + Number(f.amount), 0)

  const totalRevenue = sumByCategory('revenue')
  const totalCOGS = sumByCategory('cogs')
  const grossProfit = totalRevenue - totalCOGS
  const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0

  const totalOperatingExpenses = sumByCategory('operating_expense')
  const ownerCompensation = sumByCategory('owner_compensation')
  const depreciation = sumByCategory('depreciation')
  const amortization = sumByCategory('amortization')
  const interest = sumByCategory('interest')
  const taxes = sumByCategory('taxes')

  // Net Income = Revenue - COGS - OpEx - Owner Comp - D&A - Interest - Taxes
  const netIncome = totalRevenue - totalCOGS - totalOperatingExpenses -
    ownerCompensation - depreciation - amortization - interest - taxes

  // EBITDA = Net Income + D&A + Interest + Taxes
  const ebitda = netIncome + depreciation + amortization + interest + taxes

  // SDE = EBITDA + Owner Compensation
  const sde = ebitda + ownerCompensation

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    grossMargin,
    totalOperatingExpenses,
    ownerCompensation,
    depreciation,
    amortization,
    interest,
    taxes,
    netIncome,
    ebitda,
    sde,
  }
}

// ═══════════════════════════════════════════════════════════════
// SDE vs EBITDA AUTO-SELECTION (CAIBVS™ Methodology)
// ═══════════════════════════════════════════════════════════════

function selectEarningsMetric(
  annualRevenue: number,
  industry: string | null,
  financials: FinancialData[]
): { metric_type: 'sde' | 'ebitda'; reasoning: string } {
  // CAIBVS™ Rule Set:
  // 1. Revenue < $1M → SDE (owner-operated Main Street business)
  // 2. Revenue $1M-$5M → SDE unless clear management structure
  // 3. Revenue > $5M → EBITDA (mid-market, likely absentee ownership)
  // 4. If owner compensation is >30% of revenue → SDE (owner-dependent)
  // 5. If multiple owner compensation entries → may indicate management team → EBITDA

  const ownerCompItems = financials.filter(f => f.category === 'owner_compensation')
  const totalOwnerComp = ownerCompItems.reduce((sum, f) => sum + Number(f.amount), 0)
  const ownerCompRatio = annualRevenue > 0 ? totalOwnerComp / annualRevenue : 0

  // Decision logic
  if (annualRevenue < 1_000_000) {
    return {
      metric_type: 'sde',
      reasoning: `Revenue of $${annualRevenue.toLocaleString()} is below $1M threshold. This is a Main Street, owner-operated business. SDE is the appropriate metric as it captures the total economic benefit available to a single owner-operator, including owner compensation add-backs.`,
    }
  }

  if (annualRevenue < 5_000_000) {
    if (ownerCompRatio > 0.15) {
      return {
        metric_type: 'sde',
        reasoning: `Revenue of $${annualRevenue.toLocaleString()} is in the $1M-$5M range. Owner compensation represents ${(ownerCompRatio * 100).toFixed(1)}% of revenue, indicating significant owner-dependency. SDE is the appropriate metric.`,
      }
    }
    return {
      metric_type: 'ebitda',
      reasoning: `Revenue of $${annualRevenue.toLocaleString()} is in the $1M-$5M range. Owner compensation is only ${(ownerCompRatio * 100).toFixed(1)}% of revenue, suggesting a management structure that could operate without the owner. EBITDA is the appropriate metric.`,
    }
  }

  // Revenue > $5M
  return {
    metric_type: 'ebitda',
    reasoning: `Revenue of $${annualRevenue.toLocaleString()} exceeds $5M. This is a mid-market business where EBITDA is the standard metric, reflecting earnings available to the enterprise independent of capital structure, tax strategy, and depreciation policy.`,
  }
}

// ═══════════════════════════════════════════════════════════════
// LLM-POWERED NORMALIZING ADJUSTMENT ANALYSIS
// ═══════════════════════════════════════════════════════════════

interface AdjustmentAnalysis {
  adjustments: {
    line_item: string
    category: string
    amount: number
    reason: string
  }[]
  reasoning: string
}

async function analyzeFoNormalizingAdjustments(
  valuation: Record<string, unknown>,
  financials: FinancialData[],
  metrics: BaseMetrics,
  metricType: 'sde' | 'ebitda'
): Promise<AdjustmentAnalysis> {
  const openrouterKey = process.env.OPENROUTER_API_KEY

  if (!openrouterKey) {
    // Fallback: return standard adjustments without LLM
    return generateDefaultAdjustments(metrics, metricType)
  }

  const financialSummary = financials.map(f =>
    `- ${f.line_item} (${f.category}, FY${f.fiscal_year}): $${Number(f.amount).toLocaleString()}`
  ).join('\n')

  const prompt = `You are a USPAP-aligned business valuation analyst implementing the CAIBVS™ (Certified AI-Enhanced Business Valuation Strategist) methodology. Analyze the following financial data and identify normalizing adjustments.

BUSINESS: ${valuation.business_name}
INDUSTRY: ${valuation.industry || 'Not specified'}
ANNUAL REVENUE: $${Number(valuation.annual_revenue || metrics.totalRevenue).toLocaleString()}
SELECTED METRIC: ${metricType.toUpperCase()}

FINANCIAL DATA:
${financialSummary}

CALCULATED METRICS:
- Gross Revenue: $${metrics.totalRevenue.toLocaleString()}
- COGS: $${metrics.totalCOGS.toLocaleString()}
- Gross Profit: $${metrics.grossProfit.toLocaleString()} (${(metrics.grossMargin * 100).toFixed(1)}% margin)
- Operating Expenses: $${metrics.totalOperatingExpenses.toLocaleString()}
- Owner Compensation: $${metrics.ownerCompensation.toLocaleString()}
- Depreciation: $${metrics.depreciation.toLocaleString()}
- Amortization: $${metrics.amortization.toLocaleString()}
- Interest: $${metrics.interest.toLocaleString()}
- Taxes: $${metrics.taxes.toLocaleString()}
- Net Income: $${metrics.netIncome.toLocaleString()}
- EBITDA: $${metrics.ebitda.toLocaleString()}
- SDE: $${metrics.sde.toLocaleString()}

INSTRUCTIONS:
1. Identify any normalizing adjustments needed. Common adjustments include:
   - Owner compensation above/below market rate (market rate for this industry is typically $50,000-$80,000 for a restaurant, $60,000-$100,000 for service businesses, $80,000-$120,000 for professional services)
   - One-time or non-recurring expenses
   - Personal expenses run through the business
   - Above-market rent (if owner owns the property)
   - Non-arm's-length transactions
2. For each adjustment, provide the line item name, the dollar amount (positive = add-back to earnings, negative = deduction), and a clear explanation.
3. Provide overall reasoning about the financial health and normalization approach.

RESPOND IN THIS EXACT JSON FORMAT AND NOTHING ELSE:
{
  "adjustments": [
    {
      "line_item": "Owner Compensation Add-Back",
      "category": "adjustment",
      "amount": 12000,
      "reason": "Owner salary of $58,300 is below market rate of $65,000-$75,000 for restaurant managers in NJ. No add-back warranted; compensation is within market range."
    }
  ],
  "reasoning": "Overall assessment of the normalization approach..."
}`

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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('OpenRouter API error:', response.status)
      return generateDefaultAdjustments(metrics, metricType)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parse JSON from response (strip markdown fences if present)
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      adjustments: parsed.adjustments || [],
      reasoning: parsed.reasoning || 'LLM analysis completed.',
    }
  } catch (error) {
    console.error('LLM analysis error:', error)
    return generateDefaultAdjustments(metrics, metricType)
  }
}

// ═══════════════════════════════════════════════════════════════
// FALLBACK: DEFAULT ADJUSTMENTS (No LLM Available)
// ═══════════════════════════════════════════════════════════════

function generateDefaultAdjustments(
  metrics: BaseMetrics,
  metricType: 'sde' | 'ebitda'
): AdjustmentAnalysis {
  const adjustments: AdjustmentAnalysis['adjustments'] = []

  // Standard owner compensation analysis
  if (metricType === 'sde' && metrics.ownerCompensation > 0) {
    const marketRate = 65000 // Conservative market rate for restaurant/retail
    const excess = metrics.ownerCompensation - marketRate
    if (Math.abs(excess) > 5000) {
      adjustments.push({
        line_item: excess > 0 ? 'Excess Owner Compensation Add-Back' : 'Below-Market Owner Comp Deduction',
        category: 'adjustment',
        amount: excess > 0 ? excess : excess, // Positive = add-back
        reason: `Owner compensation of $${metrics.ownerCompensation.toLocaleString()} compared to estimated market rate of $${marketRate.toLocaleString()}. Difference of $${Math.abs(excess).toLocaleString()} ${excess > 0 ? 'added back' : 'deducted'}.`,
      })
    }
  }

  return {
    adjustments,
    reasoning: `Standard normalization applied. ${metricType.toUpperCase()} selected based on revenue level and owner-dependency analysis. ${adjustments.length} adjustment(s) identified using default market comparables. LLM analysis was not available for enhanced adjustment identification.`,
  }
}

// ═══════════════════════════════════════════════════════════════
// FINAL NORMALIZED EARNINGS CALCULATION
// ═══════════════════════════════════════════════════════════════

function calculateNormalizedEarnings(
  metrics: BaseMetrics,
  metricType: 'sde' | 'ebitda',
  adjustments: AdjustmentAnalysis['adjustments']
): number {
  const baseEarnings = metricType === 'sde' ? metrics.sde : metrics.ebitda
  const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0)
  return Math.round((baseEarnings + totalAdjustments) * 100) / 100
}
