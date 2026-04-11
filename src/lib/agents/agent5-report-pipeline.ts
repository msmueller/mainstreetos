// Agent 5 — Business Valuation Report Generator (BVR Pipeline)
// Assembles all Supabase data, calls LLM for narrative sections, builds a
// USPAP/NACVA-aligned DOCX following the BVR skill's report-structure.md,
// and uploads the result to Supabase Storage bucket "reports".

import fs from 'fs'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, TabStopType, LeaderType,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  type ISectionOptions,
} from 'docx'
import { resolveModel } from '@/lib/modelRouter'
import type {
  Valuation, FinancialData, ValuationMethod, EarningsMetric, BrokerLicense,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// AGENT 5A SYSTEM PROMPT (from Agent 5 spec)
// ─────────────────────────────────────────────────────────────
export const AGENT_5A_SYSTEM_PROMPT = `You are Agent 5 of the MainStreetOS AI-Agentic Valuation Pipeline — the Report Generation Agent. Your role is to produce the narrative sections of a professional Business Valuation Report (BVR) that follows USPAP Standards 9 and 10, NACVA Professional Standards, and the CAIBVS™ methodology.

You will receive structured data from the prior agents:
- Agent 2 output: Normalized earnings (SDE or EBITDA), multi-year recast financials, addback details
- Agent 2.5 output: 15-factor CSRP risk scores, discount rate build-up, capitalization rate
- Agent 3 output: Five valuation method results (Market Multiple, Cap of Earnings, DCF, Asset-Based, Rule of Thumb)
- Agent 4 output: Weighted FMV synthesis with reconciliation reasoning and value range
- Business profile: Operational details, customer data, facility info, competitive position
- Industry multiples: Matched SDE/EBITDA/Revenue multiples with sample sizes

Generate the following narrative sections as a JSON object. Each section should be professional, substantive, and specific to the subject business — no boilerplate or placeholder text.

OUTPUT FORMAT: Return a JSON object with these keys:

{
  "transmittal_letter": "2-3 paragraphs: engagement scope, approaches used, final opinion, effective date",
  "executive_summary": "4-6 paragraphs: business ID, purpose, normalized earnings summary, each approach result, reconciliation, final opinion with range",
  "scope_of_work": "3-4 paragraphs: what was done, data reviewed, standards followed, limitations",
  "business_description": "5-8 paragraphs: company overview, ownership, history, management, products/services, customers, suppliers, facilities",
  "industry_analysis": "4-6 paragraphs: industry overview, outlook, competitive landscape, economic conditions",
  "financial_analysis_narrative": "3-5 paragraphs: revenue trends, expense analysis, earnings quality assessment",
  "earnings_normalization_narrative": "2-3 paragraphs: methodology for recasting, key addbacks explained, weighted average rationale",
  "income_approach_narrative": "4-6 paragraphs: cap of earnings methodology and result, DCF methodology and result, income approach conclusion",
  "market_approach_narrative": "3-4 paragraphs: comparable transactions, rule of thumb application, market approach conclusion",
  "asset_approach_narrative": "2-3 paragraphs: ANAV methodology, asset adjustments, asset approach conclusion",
  "risk_analysis_narrative": "4-6 paragraphs: 15-factor analysis with scores and reasoning for each category (Business & Industry, Financial, Operational), CSRP derivation, discount rate build-up explanation",
  "reconciliation_narrative": "3-4 paragraphs: why each approach received its weight, quality of data, relevance to business type, final opinion statement",
  "analyst_qualifications": "2-3 paragraphs: CRE Resources, LLC background, CAIBVS™ credential, experience"
}

IMPORTANT GUIDELINES:
- Use precise financial language: "opinion of value" not "the value is"
- Reference specific numbers from the data (e.g., "$412,000 in normalized SDE")
- Explain WHY each approach is relevant or less relevant to this specific business
- For the risk analysis, reference each factor's score and explain the rationale
- The final opinion statement must follow this format: "Based upon our analysis of the Company's financial performance, risk characteristics, and market position, it is our opinion that the Fair Market Value of [Business Name] as a going concern, as of [Date], is approximately $X, within a range of $X to $X."
- Do not include any disclaimers about being an AI. Write as CRE Resources, LLC.
`

// ─────────────────────────────────────────────────────────────
// CONSTANTS — from template-code-patterns.md
// ─────────────────────────────────────────────────────────────
const NAVY = '1B3A5C'
const LIGHT_GRAY = 'F2F2F2'
const WHITE = 'FFFFFF'
const TABLE_WIDTH = 9360

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const borders = { top: border, bottom: border, left: border, right: border }
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 }

const LOGO_PATH = path.join(process.cwd(), 'src/lib/bvr-assets/company-logo.png')

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface Agent5Narratives {
  transmittal_letter: string
  executive_summary: string
  scope_of_work: string
  business_description: string
  industry_analysis: string
  financial_analysis_narrative: string
  earnings_normalization_narrative: string
  income_approach_narrative: string
  market_approach_narrative: string
  asset_approach_narrative: string
  risk_analysis_narrative: string
  reconciliation_narrative: string
  analyst_qualifications: string
}

export interface Agent5Payload {
  valuation: Valuation
  financials: FinancialData[]
  financialsByYear: Record<number, FinancialData[]>
  years: number[]
  methods: ValuationMethod[]
  methodResults: Record<string, ValuationMethod>
  riskFactors: Record<string, unknown> | null
  profile: Record<string, unknown> | null
  industryMultiples: Record<string, unknown> | null
}

export interface Agent5Result {
  report_url: string
  storage_path: string
  filename: string
  narratives: Agent5Narratives
}

// ─────────────────────────────────────────────────────────────
// SERVICE CLIENT
// ─────────────────────────────────────────────────────────────
function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─────────────────────────────────────────────────────────────
// 1. DATA ASSEMBLY — assembleAgent5Payload
// ─────────────────────────────────────────────────────────────
export async function assembleAgent5Payload(
  supabase: SupabaseClient,
  valuationId: string,
): Promise<Agent5Payload> {
  const { data: valuation, error: vErr } = await supabase
    .from('valuations').select('*').eq('id', valuationId).single()
  if (vErr || !valuation) throw new Error(`Valuation not found: ${valuationId}`)

  const { data: financialsRows } = await supabase
    .from('financial_data').select('*').eq('valuation_id', valuationId)
    .order('fiscal_year', { ascending: true })
  const financials = (financialsRows || []) as FinancialData[]

  const { data: methodRows } = await supabase
    .from('valuation_methods').select('*').eq('valuation_id', valuationId)
  const methods = (methodRows || []) as ValuationMethod[]

  const { data: riskFactors } = await supabase
    .from('risk_factors').select('*').eq('valuation_id', valuationId).maybeSingle()

  const { data: profile } = await supabase
    .from('business_profile').select('*').eq('valuation_id', valuationId).maybeSingle()

  // Industry multiples — try RPC first, fall back to table query
  let industryMultiples: Record<string, unknown> | null = null
  const industryKey = (valuation as Valuation).industry || (valuation as Valuation).naics_code
  if (industryKey) {
    const { data: rpcRows } = await supabase
      .rpc('search_industry', { search_term: industryKey })
    if (Array.isArray(rpcRows) && rpcRows.length > 0) {
      industryMultiples = rpcRows[0] as Record<string, unknown>
    } else {
      const { data: tableRows } = await supabase
        .from('industry_multiples').select('*').limit(1)
      industryMultiples = (tableRows?.[0] as Record<string, unknown>) || null
    }
  }

  // Group financials by year
  const years = [...new Set(financials.map(f => f.fiscal_year))].sort()
  const financialsByYear: Record<number, FinancialData[]> = {}
  for (const year of years) {
    financialsByYear[year] = financials.filter(f => f.fiscal_year === year)
  }

  const methodResults: Record<string, ValuationMethod> = {}
  for (const m of methods) methodResults[m.method] = m

  return {
    valuation: valuation as Valuation,
    financials,
    financialsByYear,
    years,
    methods,
    methodResults,
    riskFactors: (riskFactors as Record<string, unknown>) || null,
    profile: (profile as Record<string, unknown>) || null,
    industryMultiples,
  }
}

// ─────────────────────────────────────────────────────────────
// 2. NARRATIVE GENERATION — Agent 5A
// ─────────────────────────────────────────────────────────────
export async function generateNarratives(
  payload: Agent5Payload,
  brokerLicense: BrokerLicense = 'standard',
): Promise<Agent5Narratives> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const dealSizeUsd = Number(payload.valuation.annual_revenue) || undefined
  const { model } = resolveModel({
    task: 'val.formatReport',
    license: brokerLicense,
    dealSizeUsd,
  })

  const userContext = JSON.stringify({
    valuation: payload.valuation,
    years: payload.years,
    financialsByYear: payload.financialsByYear,
    methodResults: payload.methodResults,
    riskFactors: payload.riskFactors,
    profile: payload.profile,
    industryMultiples: payload.industryMultiples,
  }, null, 2)

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8000,
      system: AGENT_5A_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Here is the structured data for ${payload.valuation.business_name}. Generate the narrative sections as specified.\n\n${userContext}`,
      }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
    return { ...fallbackNarratives(payload), ...parsed }
  } catch (err) {
    console.error('[Agent 5A] Narrative generation failed, using fallback:', err)
    return fallbackNarratives(payload)
  }
}

function fallbackNarratives(p: Agent5Payload): Agent5Narratives {
  const v = p.valuation
  const name = v.business_name
  const fmv = v.valuation_mid ? `$${v.valuation_mid.toLocaleString()}` : 'the indicated value'
  const range = v.valuation_low && v.valuation_high
    ? `$${v.valuation_low.toLocaleString()} to $${v.valuation_high.toLocaleString()}`
    : 'the stated range'
  const earnings = v.normalized_earnings
    ? `$${v.normalized_earnings.toLocaleString()} in normalized ${(v.metric_type || 'sde').toUpperCase()}`
    : 'the normalized earnings stream'
  const opinion = `Based upon our analysis of the Company's financial performance, risk characteristics, and market position, it is our opinion that the Fair Market Value of ${name} as a going concern is approximately ${fmv}, within a range of ${range}.`

  return {
    transmittal_letter: `CRE Resources, LLC has completed a comprehensive business valuation of ${name} and is pleased to present this report. Our engagement applied the Income, Market, and Asset-Based approaches to value under the Fair Market Value standard and Going Concern premise. ${opinion}`,
    executive_summary: `This report presents the opinion of value for ${name}, supported by ${earnings}. We applied and reconciled the three generally accepted approaches to value: the Income Approach (Capitalization of Earnings and Discounted Cash Flow), the Market Approach, and the Asset-Based Approach. ${opinion}`,
    scope_of_work: `Our scope included review of historical financial statements, normalization of earnings, industry and economic analysis, application of the three approaches to value, and reconciliation to a final opinion. The engagement was conducted in accordance with USPAP and NACVA professional standards.`,
    business_description: v.business_description || `${name} operates in the ${v.industry || 'subject'} industry. Additional operational details were considered in developing this opinion of value.`,
    industry_analysis: `Industry conditions, competitive landscape, and macroeconomic factors were assessed as part of this engagement. The ${v.industry || 'subject'} sector was evaluated against current market data to contextualize the Company's performance.`,
    financial_analysis_narrative: `The Company's historical financial performance across ${p.years.join(', ')} was analyzed, including revenue trends, expense composition, and margin behavior. Earnings quality was assessed for purposes of normalization.`,
    earnings_normalization_narrative: `Reported earnings were recast to reflect normalized ${(v.metric_type || 'sde').toUpperCase()}. Owner compensation, discretionary items, and non-recurring expenses were adjusted per CAIBVS™ methodology, with a weighted average applied across the analysis period.`,
    income_approach_narrative: `The Income Approach was applied via the Capitalization of Earnings method and the Discounted Cash Flow method. The capitalization rate was derived using the Build-Up Method, reflecting the risk-free rate, equity risk premium, size premium, and Company-Specific Risk Premium.`,
    market_approach_narrative: `The Market Approach was applied using industry transaction multiples and applicable rules of thumb. Comparable transaction data was referenced to triangulate market-indicated value.`,
    asset_approach_narrative: `The Asset-Based Approach was considered via the Adjusted Net Asset Value method. This approach serves as a floor value and is generally less determinative for going-concern operating businesses.`,
    risk_analysis_narrative: `A 15-factor Company-Specific Risk Premium (CSRP) analysis was performed across Business & Industry, Financial, and Operational risk categories. Each factor was scored with supporting rationale and aggregated into the Build-Up Method.`,
    reconciliation_narrative: `The indicated values from each approach were reconciled based on data quality, relevance, and the Company's operating characteristics. ${opinion}`,
    analyst_qualifications: `CRE Resources, LLC is a professional business brokerage, M&A advisory, and valuation services firm. Principal Analyst Mark S. Mueller holds the CAIBVS™ credential and has extensive experience in Main Street and Mid-Market business transactions.`,
  }
}

// ─────────────────────────────────────────────────────────────
// 3. DOCX BUILDER (Agent 5B)
// ─────────────────────────────────────────────────────────────

function para(text: string, opts: {
  bold?: boolean; size?: number; color?: string;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacing?: number; italic?: boolean;
} = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacing ?? 120 },
    children: [new TextRun({
      text,
      bold: opts.bold,
      italics: opts.italic,
      size: opts.size ?? 22,
      font: 'Arial',
      color: opts.color ?? '333333',
    })],
  })
}

function h1(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 360, after: 200 },
    pageBreakBefore: true,
    children: [new TextRun({ text, bold: true, size: 32, font: 'Arial', color: NAVY })],
  })
}
function h2(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Arial', color: NAVY })],
  })
}
function h3(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Arial', color: '333333' })],
  })
}

function narrativeParagraphs(text: string): Paragraph[] {
  return text.split(/\n\n+/).filter(Boolean).map(t => para(t.trim(), { spacing: 160 }))
}

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' },
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 20, font: 'Arial', color: WHITE })],
    })],
  })
}

function dataCell(text: string, width: number, opts: {
  shading?: string; bold?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  color?: string;
} = {}): TableCell {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text),
        size: 20,
        font: 'Arial',
        bold: opts.bold || false,
        color: opts.color || '333333',
      })],
    })],
  })
}

const METHOD_LABELS: Record<string, string> = {
  capitalization_of_earnings: 'Income Approach — Capitalization of Earnings',
  dcf: 'Income Approach — DCF',
  market_multiple: 'Market Approach — Market Multiple',
  rule_of_thumb: 'Market Approach — Rule of Thumb',
  asset_based: 'Asset-Based Approach',
}

function valuationSummaryTable(p: Agent5Payload): Table {
  const widths = [3360, 2000, 1500, 2500]
  const fmt = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`)
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`

  const rows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Approach', widths[0]),
        headerCell('Indicated Value', widths[1]),
        headerCell('Weight', widths[2]),
        headerCell('Weighted Value', widths[3]),
      ],
    }),
  ]

  p.methods.forEach((m, i) => {
    const shade = i % 2 === 0 ? LIGHT_GRAY : undefined
    const weighted = (m.result_value || 0) * (m.weight || 0)
    rows.push(new TableRow({
      children: [
        dataCell(METHOD_LABELS[m.method] || m.method, widths[0], { shading: shade }),
        dataCell(fmt(m.result_value), widths[1], { shading: shade, align: AlignmentType.RIGHT }),
        dataCell(pct(m.weight), widths[2], { shading: shade, align: AlignmentType.CENTER }),
        dataCell(fmt(weighted), widths[3], { shading: shade, align: AlignmentType.RIGHT }),
      ],
    }))
  })

  const v = p.valuation
  rows.push(new TableRow({
    children: [
      dataCell('Reconciled Opinion of Value', widths[0], { bold: true, shading: NAVY, color: WHITE }),
      dataCell('', widths[1], { shading: NAVY }),
      dataCell('', widths[2], { shading: NAVY }),
      dataCell(fmt(v.valuation_mid), widths[3], { bold: true, shading: NAVY, color: WHITE, align: AlignmentType.RIGHT }),
    ],
  }))
  rows.push(new TableRow({
    children: [
      dataCell('Value Range', widths[0], { bold: true, shading: LIGHT_GRAY }),
      dataCell('', widths[1], { shading: LIGHT_GRAY }),
      dataCell('', widths[2], { shading: LIGHT_GRAY }),
      dataCell(
        v.valuation_low && v.valuation_high
          ? `${fmt(v.valuation_low)} — ${fmt(v.valuation_high)}`
          : '—',
        widths[3],
        { bold: true, shading: LIGHT_GRAY, align: AlignmentType.RIGHT },
      ),
    ],
  }))

  return new Table({
    columnWidths: widths,
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    rows,
  })
}

function financialRecastTable(p: Agent5Payload): Table {
  const years = p.years
  const nYears = Math.max(years.length, 1)
  const labelW = 3360
  const yearW = Math.floor((TABLE_WIDTH - labelW) / nYears)
  const widths = [labelW, ...years.map(() => yearW)]

  const sumByCategory = (year: number, cats: string[]) =>
    (p.financialsByYear[year] || [])
      .filter(f => cats.includes(f.category))
      .reduce((sum, f) => sum + Number(f.amount || 0), 0)

  const rowsSpec: Array<{ label: string; cats: string[]; bold?: boolean }> = [
    { label: 'Revenue', cats: ['revenue'], bold: true },
    { label: 'Cost of Goods Sold', cats: ['cogs'] },
    { label: 'Operating Expenses', cats: ['operating_expense'] },
    { label: 'Owner Compensation', cats: ['owner_compensation'] },
    { label: 'Depreciation & Amortization', cats: ['depreciation', 'amortization'] },
    { label: 'Interest Expense', cats: ['interest'] },
    { label: 'Addbacks & Adjustments', cats: ['adjustment', 'sde_addback'] },
  ]

  const rows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Line Item', widths[0]),
        ...years.map((y, i) => headerCell(`FY${y}`, widths[i + 1])),
      ],
    }),
  ]

  rowsSpec.forEach((spec, i) => {
    const shade = i % 2 === 0 ? LIGHT_GRAY : undefined
    rows.push(new TableRow({
      children: [
        dataCell(spec.label, widths[0], { shading: shade, bold: spec.bold }),
        ...years.map((y, j) => {
          const v = sumByCategory(y, spec.cats)
          return dataCell(v ? `$${Math.round(v).toLocaleString()}` : '—', widths[j + 1], {
            shading: shade, align: AlignmentType.RIGHT, bold: spec.bold,
          })
        }),
      ],
    }))
  })

  return new Table({
    columnWidths: widths,
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    rows,
  })
}

function csrpMatrixTable(p: Agent5Payload): Table | null {
  const rf = p.riskFactors
  if (!rf) return null
  // risk_factors may store per-factor scores as JSON; support either a
  // top-level "factors" array or a flat object of factor_X keys.
  type Factor = { name: string; score?: number | string; rationale?: string }
  const factors: Factor[] = []
  const raw = rf as Record<string, unknown>
  if (Array.isArray(raw.factors)) {
    for (const f of raw.factors as Array<Record<string, unknown>>) {
      factors.push({
        name: String(f.name || f.factor || 'Factor'),
        score: (f.score as number | string | undefined),
        rationale: f.rationale as string | undefined,
      })
    }
  } else {
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('factor_') || k.endsWith('_score')) {
        factors.push({ name: k, score: v as number | string })
      }
    }
  }
  if (factors.length === 0) return null

  const widths = [3600, 1400, 4360]
  const rows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Risk Factor', widths[0]),
        headerCell('Score', widths[1]),
        headerCell('Rationale', widths[2]),
      ],
    }),
  ]
  factors.forEach((f, i) => {
    const shade = i % 2 === 0 ? LIGHT_GRAY : undefined
    rows.push(new TableRow({
      children: [
        dataCell(f.name, widths[0], { shading: shade }),
        dataCell(String(f.score ?? '—'), widths[1], { shading: shade, align: AlignmentType.CENTER }),
        dataCell(f.rationale || '—', widths[2], { shading: shade }),
      ],
    }))
  })

  return new Table({
    columnWidths: widths,
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    rows,
  })
}

function buildCoverPage(p: Agent5Payload, effectiveDate: string): ISectionOptions {
  let logoBuffer: Buffer | null = null
  try { logoBuffer = fs.readFileSync(LOGO_PATH) } catch { logoBuffer = null }

  const children: Paragraph[] = [
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
  ]
  if (logoBuffer) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new ImageRun({
        data: new Uint8Array(logoBuffer),
        transformation: { width: 144, height: 144 },
        type: 'png',
      })],
    }))
  }
  children.push(
    para('CRE Resources, LLC', { bold: true, size: 40, color: NAVY, align: AlignmentType.CENTER, spacing: 40 }),
    para('Strategic, Intelligence & Data-Driven', { size: 20, color: '666666', align: AlignmentType.CENTER, spacing: 200 }),
    para('________________________________________', { size: 22, color: NAVY, align: AlignmentType.CENTER, spacing: 160 }),
    para('BUSINESS VALUATION REPORT', { bold: true, size: 44, color: NAVY, align: AlignmentType.CENTER, spacing: 60 }),
    para('Opinion of Value', { italic: true, size: 26, color: '666666', align: AlignmentType.CENTER, spacing: 60 }),
    para('________________________________________', { size: 22, color: NAVY, align: AlignmentType.CENTER, spacing: 160 }),
    para(p.valuation.business_name, { bold: true, size: 34, color: '333333', align: AlignmentType.CENTER, spacing: 60 }),
    para(p.valuation.location || '', { size: 22, color: '666666', align: AlignmentType.CENTER, spacing: 120 }),
    new Paragraph({ text: '' }),
    para(`Effective Date of Valuation: ${effectiveDate}`, { bold: true, size: 22, align: AlignmentType.CENTER, spacing: 40 }),
    para(`Report Date: ${effectiveDate}`, { size: 20, color: '666666', align: AlignmentType.CENTER, spacing: 120 }),
    new Paragraph({ text: '' }),
    para('Prepared by:', { size: 20, color: '666666', align: AlignmentType.CENTER, spacing: 40 }),
    para('Mark S. Mueller, CAIBVS\u2122', { bold: true, size: 24, color: NAVY, align: AlignmentType.CENTER, spacing: 30 }),
    para('CRE Agent and Consulting | Business Broker, Intermediary and Advisor', { size: 18, color: '666666', align: AlignmentType.CENTER, spacing: 20 }),
    para('Certified AI-Enhanced Business Valuation Strategist', { size: 18, color: '666666', align: AlignmentType.CENTER, spacing: 20 }),
    para('CRE Resources, LLC | CREresources.Biz', { size: 18, color: '666666', align: AlignmentType.CENTER, spacing: 20 }),
    para('856.745.9706 | markm@creresources.biz', { size: 18, color: '666666', align: AlignmentType.CENTER, spacing: 160 }),
    para('CONFIDENTIAL', { bold: true, size: 28, color: 'CC0000', align: AlignmentType.CENTER }),
  )

  return {
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children,
  }
}

function buildTocSection(businessName: string): ISectionOptions {
  const entries: Array<{ level: 0 | 1; title: string; page: string }> = [
    { level: 0, title: 'Letter of Transmittal', page: '3' },
    { level: 0, title: '1. Executive Summary', page: '4' },
    { level: 0, title: '2. Introduction & Scope of Engagement', page: '6' },
    { level: 0, title: '3. Business Description & History', page: '8' },
    { level: 0, title: '4. Industry & Economic Analysis', page: '11' },
    { level: 0, title: '5. Financial Analysis', page: '13' },
    { level: 0, title: '6. Valuation Methodology', page: '16' },
    { level: 0, title: '7. Income Approach', page: '17' },
    { level: 0, title: '8. Market Approach', page: '19' },
    { level: 0, title: '9. Asset-Based Approach', page: '20' },
    { level: 0, title: '10. Valuation Reconciliation & Final Opinion', page: '21' },
    { level: 0, title: '11. Assumptions & Limiting Conditions', page: '22' },
    { level: 0, title: '12. Certification Statement', page: '23' },
    { level: 0, title: '13. Analyst Qualifications', page: '24' },
    { level: 0, title: 'Appendix A: Financial Recast Tables', page: '25' },
    { level: 0, title: 'Appendix B: CSRP Scoring Matrix', page: '26' },
    { level: 0, title: 'Appendix G: Glossary of Valuation Terms', page: '27' },
  ]

  const tocParagraphs: Paragraph[] = entries.map(e => new Paragraph({
    spacing: { after: e.level === 0 ? 80 : 40 },
    indent: { left: e.level === 0 ? 0 : 480 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9360, leader: LeaderType.DOT }],
    children: [
      new TextRun({ text: e.title, bold: e.level === 0, size: e.level === 0 ? 22 : 20, font: 'Arial', color: e.level === 0 ? NAVY : '444444' }),
      new TextRun({ text: '\t', size: 22, font: 'Arial' }),
      new TextRun({ text: e.page, bold: e.level === 0, size: e.level === 0 ? 22 : 20, font: 'Arial', color: e.level === 0 ? NAVY : '444444' }),
    ],
  }))

  return {
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'CRE Resources, LLC', size: 18, font: 'Arial', color: NAVY, bold: true }),
            new TextRun({ text: `  |  Business Valuation Report  |  ${businessName}`, size: 16, font: 'Arial', color: '999999' }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'CRE Resources, LLC  |  CREresources.Biz  |  856.745.9706  |  CONFIDENTIAL  |  Page ', size: 14, font: 'Arial', color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 14, font: 'Arial', color: '999999' }),
          ],
        })],
      }),
    },
    children: [
      new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'Table of Contents', bold: true, size: 36, font: 'Arial', color: NAVY })] }),
      ...tocParagraphs,
    ],
  }
}

function signatureBlock(): Paragraph[] {
  return [
    para('Mark S. Mueller, CAIBVS\u2122', { bold: true }),
    para('CRE Agent and Consulting | Business Broker, Intermediary and Advisor'),
    para('Certified AI-Enhanced Business Valuation Strategist'),
    para('CRE Resources, LLC | CREresources.Biz'),
    para('856.745.9706 | markm@creresources.biz'),
  ]
}

const ASSUMPTIONS_AND_LIMITS: string[] = [
  'Information Furnished by Others. The financial statements, tax returns, and other information provided to CRE Resources, LLC by the Company, its officers, its representatives, or obtained from public and industry sources are assumed to be accurate and reliable. CRE Resources, LLC has not audited, reviewed, or compiled the financial information provided and assumes no responsibility for its accuracy or completeness.',
  'Financial Projections. Any financial projections or forward-looking statements contained herein are based on assumptions believed to be reasonable at the time of this writing. Actual results may differ materially from projections. CRE Resources, LLC makes no warranty or representation regarding the achievability of projected results.',
  'Going Concern Assumption. This valuation assumes the Company will continue to operate as a going concern. No consideration has been given to a forced sale, liquidation, or any other disposition other than as a going concern, unless otherwise stated.',
  'Fair Market Value Standard. Unless otherwise stated, the standard of value applied in this report is Fair Market Value, defined as: "The price at which property would change hands between a willing buyer and a willing seller, neither being under any compulsion to buy or sell, and both having reasonable knowledge of all relevant facts."',
  'No Hidden or Undisclosed Conditions. CRE Resources, LLC assumes there are no hidden or undisclosed conditions of the property, business, or its assets that would render it more or less valuable.',
  'Legal and Regulatory Compliance. It is assumed the Company operates in compliance with all applicable federal, state, and local laws, regulations, and ordinances, unless otherwise stated in this report.',
  'Environmental Matters. No environmental assessment or audit was performed as part of this engagement. CRE Resources, LLC assumes no responsibility for environmental liabilities, contamination, or remediation obligations.',
  'Tax Considerations. This valuation does not consider the tax consequences of any potential transaction. Tax implications should be analyzed by qualified tax professionals.',
  'Litigation and Contingencies. Unless specifically disclosed and addressed in this report, it is assumed that there are no pending or threatened legal actions, claims, or contingent liabilities that would materially affect the value of the Company.',
  'Single Point in Time. This opinion of value is rendered as of the effective date stated herein. Changes in market conditions, economic factors, or the Company\u2019s operations after this date could materially alter the opinion of value.',
  'Intended Use and Users. This report is prepared solely for the purpose stated herein and is not intended for any other purpose or use by any other party without the prior written consent of CRE Resources, LLC.',
  'No Guarantee of Value Realization. This opinion of value is an estimate based on available information and professional judgment. It is not a guarantee that the Company will sell for the stated value.',
  'Professional Fees. Professional fees for this engagement are not contingent upon the reported value or upon the outcome of any potential transaction.',
  'Confidentiality. The contents of this report are confidential between CRE Resources, LLC and the intended user(s). No part of this report may be reproduced or disclosed to third parties without the prior written consent of CRE Resources, LLC, except as required by law.',
]

const CERTIFICATION_STATEMENTS: string[] = [
  'The statements of fact contained in this report are true and correct.',
  'The reported analyses, opinions, and conclusions are limited only by the reported assumptions and limiting conditions and are my personal, impartial, and unbiased professional analyses, opinions, and conclusions.',
  'I have no present or prospective interest in the property that is the subject of this report, and no personal interest with respect to the parties involved.',
  'I have no bias with respect to the property that is the subject of this report or to the parties involved with this assignment.',
  'My engagement in this assignment was not contingent upon developing or reporting predetermined results.',
  'My compensation for completing this assignment is not contingent upon the development or reporting of a predetermined value or direction in value that favors the cause of the client.',
  'My analyses, opinions, and conclusions were developed, and this report has been prepared, in conformity with the Uniform Standards of Professional Appraisal Practice (USPAP) and the professional standards of the National Association of Certified Valuators and Analysts (NACVA).',
]

const GLOSSARY_TERMS: Array<[string, string]> = [
  ['Adjusted Net Asset Value (ANAV)', 'The value of a business based on the fair market value of its assets less liabilities, with each line item adjusted from book to market value.'],
  ['Capitalization Rate', 'A divisor used to convert a single period of expected economic benefits into value. Typically derived via the Build-Up Method.'],
  ['CAIBVS\u2122', 'Certified AI-Enhanced Business Valuation Strategist — a credential reflecting AI-augmented valuation methodology.'],
  ['Company-Specific Risk Premium (CSRP)', 'A premium added to the discount rate to reflect the unique risks of the subject company not captured in broader equity market premiums.'],
  ['Discount Rate', 'The required rate of return used to convert future cash flows to present value.'],
  ['Discounted Cash Flow (DCF)', 'A valuation method that projects future cash flows and discounts them to present value.'],
  ['EBITDA', 'Earnings Before Interest, Taxes, Depreciation, and Amortization.'],
  ['Fair Market Value (FMV)', 'The price at which property would change hands between a willing buyer and seller, neither under compulsion, both reasonably informed.'],
  ['Going Concern', 'A premise of value assuming the business will continue to operate indefinitely.'],
  ['Rule of Thumb', 'A general-market valuation shortcut expressed as a multiple of revenue or earnings, typically used for sanity-checking more rigorous approaches.'],
  ['SDE', 'Seller\u2019s Discretionary Earnings — normalized earnings before a single owner-operator\u2019s compensation.'],
  ['USPAP', 'Uniform Standards of Professional Appraisal Practice, promulgated by The Appraisal Foundation.'],
]

// Main body section — uses header/footer inherited from TOC section via separate pages
function buildMainSection(p: Agent5Payload, n: Agent5Narratives, effectiveDate: string): ISectionOptions {
  const v = p.valuation
  const fmv = v.valuation_mid ? `$${v.valuation_mid.toLocaleString()}` : '—'
  const range = v.valuation_low && v.valuation_high
    ? `$${v.valuation_low.toLocaleString()} — $${v.valuation_high.toLocaleString()}`
    : '—'

  const children: Array<Paragraph | Table> = []

  // Transmittal Letter
  children.push(
    h1('Letter of Transmittal'),
    para(effectiveDate, { spacing: 200 }),
    ...narrativeParagraphs(n.transmittal_letter),
    para('Respectfully submitted,', { spacing: 160 }),
    ...signatureBlock(),
  )

  // Section 1: Executive Summary
  children.push(
    h1('1. Executive Summary'),
    ...narrativeParagraphs(n.executive_summary),
    h3('Valuation Summary'),
    valuationSummaryTable(p),
  )

  // Section 2: Introduction & Scope
  children.push(h1('2. Introduction & Scope of Engagement'))
  children.push(h2('2.1 Purpose and Scope of Work'))
  children.push(...narrativeParagraphs(n.scope_of_work))
  children.push(h2('2.2 Standard and Premise of Value'))
  children.push(para('Standard: Fair Market Value. Premise: Going Concern.'))
  children.push(h2('2.3 Effective Date'))
  children.push(para(effectiveDate))

  // Section 3: Business Description
  children.push(h1('3. Business Description & History'))
  children.push(...narrativeParagraphs(n.business_description))

  // Section 4: Industry & Economic Analysis
  children.push(h1('4. Industry & Economic Analysis'))
  children.push(...narrativeParagraphs(n.industry_analysis))

  // Section 5: Financial Analysis
  children.push(h1('5. Financial Analysis'))
  children.push(...narrativeParagraphs(n.financial_analysis_narrative))
  children.push(h3('5.1 Historical Financial Summary'))
  children.push(financialRecastTable(p))
  children.push(h3('5.4 Earnings Normalization'))
  children.push(...narrativeParagraphs(n.earnings_normalization_narrative))
  if (v.normalized_earnings) {
    children.push(para(
      `Normalized ${(v.metric_type || 'sde').toUpperCase()}: $${v.normalized_earnings.toLocaleString()}`,
      { bold: true, spacing: 160 },
    ))
  }

  // Section 6: Methodology
  children.push(h1('6. Valuation Methodology'))
  children.push(para('This report applies the three generally accepted approaches to value: the Income Approach, the Market Approach, and the Asset-Based Approach, in accordance with USPAP and NACVA professional standards.'))

  // Section 7: Income Approach
  children.push(h1('7. Income Approach'))
  children.push(...narrativeParagraphs(n.income_approach_narrative))

  // Section 8: Market Approach
  children.push(h1('8. Market Approach'))
  children.push(...narrativeParagraphs(n.market_approach_narrative))

  // Section 9: Asset Approach
  children.push(h1('9. Asset-Based Approach'))
  children.push(...narrativeParagraphs(n.asset_approach_narrative))

  // Section 10: Reconciliation
  children.push(h1('10. Valuation Reconciliation & Final Opinion'))
  children.push(...narrativeParagraphs(n.reconciliation_narrative))
  children.push(para(`Final Opinion of Value: ${fmv}`, { bold: true, size: 26, color: NAVY, spacing: 160 }))
  children.push(para(`Value Range: ${range}`, { bold: true, size: 22, color: NAVY }))

  // Section 11: Assumptions & Limiting Conditions
  children.push(h1('11. Assumptions & Limiting Conditions'))
  ASSUMPTIONS_AND_LIMITS.forEach((text, i) => {
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `${i + 1}. ${text}`, size: 22, font: 'Arial', color: '333333' })],
    }))
  })

  // Section 12: Certification
  children.push(h1('12. Certification Statement'))
  children.push(para('I certify that, to the best of my knowledge and belief:'))
  CERTIFICATION_STATEMENTS.forEach((text, i) => {
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `${i + 1}. ${text}`, size: 22, font: 'Arial', color: '333333' })],
    }))
  })
  children.push(para('CRE Resources, LLC', { bold: true, spacing: 200 }))
  children.push(...signatureBlock())
  children.push(para(`Date: ${effectiveDate}`))

  // Section 13: Analyst Qualifications
  children.push(h1('13. Analyst Qualifications'))
  children.push(...narrativeParagraphs(n.analyst_qualifications))

  // Appendix A: Financial Recast (detail)
  children.push(h1('Appendix A: Financial Recast Tables'))
  children.push(financialRecastTable(p))

  // Appendix B: CSRP Matrix
  children.push(h1('Appendix B: CSRP Scoring Matrix'))
  children.push(...narrativeParagraphs(n.risk_analysis_narrative))
  const csrp = csrpMatrixTable(p)
  if (csrp) children.push(csrp)
  else children.push(para('CSRP factor detail not available for this valuation.', { italic: true, color: '666666' }))

  // Appendix G: Glossary
  children.push(h1('Appendix G: Glossary of Valuation Terms'))
  GLOSSARY_TERMS.forEach(([term, def]) => {
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: `${term}: `, bold: true, size: 22, font: 'Arial', color: NAVY }),
        new TextRun({ text: def, size: 22, font: 'Arial', color: '333333' }),
      ],
    }))
  })

  return {
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'CRE Resources, LLC', size: 18, font: 'Arial', color: NAVY, bold: true }),
            new TextRun({ text: `  |  Business Valuation Report  |  ${v.business_name}`, size: 16, font: 'Arial', color: '999999' }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'CRE Resources, LLC  |  CREresources.Biz  |  856.745.9706  |  CONFIDENTIAL  |  Page ', size: 14, font: 'Arial', color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 14, font: 'Arial', color: '999999' }),
          ],
        })],
      }),
    },
    children,
  }
}

export async function buildBvrDocx(
  p: Agent5Payload,
  n: Agent5Narratives,
  effectiveDate: string,
): Promise<Buffer> {
  const doc = new Document({
    creator: 'CRE Resources, LLC',
    title: `Business Valuation Report — ${p.valuation.business_name}`,
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
    },
    sections: [
      buildCoverPage(p, effectiveDate),
      buildTocSection(p.valuation.business_name),
      buildMainSection(p, n, effectiveDate),
    ],
  })
  return await Packer.toBuffer(doc)
}

// ─────────────────────────────────────────────────────────────
// 4. STORAGE UPLOAD
// ─────────────────────────────────────────────────────────────
export async function uploadReport(
  supabase: SupabaseClient,
  valuationId: string,
  userId: string,
  businessName: string,
  buffer: Buffer,
): Promise<{ storage_path: string; public_url: string; filename: string }> {
  const safeName = businessName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'valuation'
  const stamp = new Date().toISOString().split('T')[0]
  const filename = `${safeName}-bvr-${stamp}.docx`
  const storagePath = `${userId}/${valuationId}/${filename}`

  const { error: uploadErr } = await supabase.storage
    .from('reports')
    .upload(storagePath, new Uint8Array(buffer), {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    })
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

  // Prefer signed URL (bucket is private by default); fall back to public URL.
  const { data: signed } = await supabase.storage
    .from('reports')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7) // 7 days

  const publicUrl = signed?.signedUrl
    || supabase.storage.from('reports').getPublicUrl(storagePath).data.publicUrl

  return { storage_path: storagePath, public_url: publicUrl, filename }
}

// ─────────────────────────────────────────────────────────────
// 5. ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
export async function runAgent5Pipeline(
  valuationId: string,
  brokerLicense: BrokerLicense = 'standard',
): Promise<Agent5Result> {
  const supabase = getServiceClient()

  const payload = await assembleAgent5Payload(supabase, valuationId)
  const narratives = await generateNarratives(payload, brokerLicense)

  const effectiveDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const buffer = await buildBvrDocx(payload, narratives, effectiveDate)

  const { storage_path, public_url, filename } = await uploadReport(
    supabase,
    valuationId,
    payload.valuation.user_id,
    payload.valuation.business_name,
    buffer,
  )

  await supabase
    .from('valuations')
    .update({
      report_url: public_url,
      status: 'complete',
      agent_log: [
        ...(payload.valuation.agent_log || []),
        {
          agent: 'agent_5_report_generation',
          timestamp: new Date().toISOString(),
          storage_path,
          filename,
        },
      ],
    })
    .eq('id', valuationId)

  return { report_url: public_url, storage_path, filename, narratives }
}

// Satisfy unused-import lint for types referenced only in JSDoc/narrative shape
export type { EarningsMetric }
export const __PAGE_BREAK_MARKER__ = PageBreak
