// Agent 5: Report Generation Agent
// Generates a professional USPAP-style DOCX Business Valuation Report
// Reads completed valuation data and produces a downloadable document

import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, PageBreak,
  TableOfContents, StyleLevel, type FileChild,
} from 'docx'
import type { FinancialData, ValuationMethod } from '@/lib/types'

// Shared border definitions
const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
}
const HEADER_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '1e3a5f' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: '1e3a5f' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export interface Agent5Result {
  report_buffer: Buffer
  filename: string
  report_url: string | null
}

export async function runAgent5(valuationId: string): Promise<Agent5Result> {
  const supabase = getServiceClient()

  // 1. Fetch all data
  const { data: valuation, error } = await supabase
    .from('valuations').select('*').eq('id', valuationId).single()
  if (error || !valuation) throw new Error(`Valuation not found: ${valuationId}`)
  if (valuation.status !== 'review') throw new Error(`Valuation must be in "review" status to generate a report. Current: "${valuation.status}"`)

  const { data: financials } = await supabase
    .from('financial_data').select('*').eq('valuation_id', valuationId)
    .order('fiscal_year', { ascending: true }).order('category', { ascending: true })

  const { data: methods } = await supabase
    .from('valuation_methods').select('*').eq('valuation_id', valuationId)
    .order('weight', { ascending: false })

  const { data: riskRow } = await supabase
    .from('risk_factors').select('*').eq('valuation_id', valuationId).single()

  const finData = (financials || []) as FinancialData[]
  const methodData = (methods || []) as ValuationMethod[]
  const effectiveDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Extract agent log data
  const agentLog = (valuation.agent_log || []) as Record<string, unknown>[]
  const agent2Log = agentLog.find((l) => (l.agent as string)?.includes('agent_2'))
  const metricReasoning = (agent2Log?.metric_reasoning as string) || ''

  // 2. Build the document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
          paragraph: { spacing: { after: 120, line: 276 } },
        },
        heading1: {
          run: { font: 'Calibri', size: 32, bold: true, color: '1e3a5f' },
          paragraph: { spacing: { before: 360, after: 200 } },
        },
        heading2: {
          run: { font: 'Calibri', size: 26, bold: true, color: '2563eb' },
          paragraph: { spacing: { before: 280, after: 160 } },
        },
        heading3: {
          run: { font: 'Calibri', size: 24, bold: true, color: '334155' },
          paragraph: { spacing: { before: 200, after: 120 } },
        },
      },
    },
    features: { updateFields: true },
    sections: [
      // ═══════════════════════════════════════════════════════════
      // COVER PAGE
      // ═══════════════════════════════════════════════════════════
      {
        properties: {},
        children: [
          ...Array(6).fill(null).map(() => new Paragraph({ text: '' })),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'BUSINESS VALUATION REPORT', size: 52, bold: true, color: '1e3a5f', font: 'Calibri' })],
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: valuation.business_name, size: 40, bold: true, color: '2563eb', font: 'Calibri' })],
          }),
          new Paragraph({ text: '', spacing: { after: 100 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: [valuation.industry, valuation.location].filter(Boolean).join(' \u2022 '), size: 24, color: '64748b' })],
          }),
          ...(valuation.sic_code || valuation.naics_code ? [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: [valuation.sic_code ? `SIC ${valuation.sic_code}` : '', valuation.naics_code ? `NAICS ${valuation.naics_code}` : ''].filter(Boolean).join(' \u2022 '),
              size: 22, color: '94a3b8',
            })],
          })] : []),
          ...Array(4).fill(null).map(() => new Paragraph({ text: '' })),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Effective Date: ${effectiveDate}`, size: 24, color: '475569' })],
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Prepared by', size: 22, color: '94a3b8', italics: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'CRE Resources, LLC', size: 28, bold: true, color: '1e3a5f' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'CAIBVS\u2122 Methodology', size: 22, color: '64748b', italics: true })],
          }),
          ...Array(6).fill(null).map(() => new Paragraph({ text: '' })),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'CONFIDENTIAL', size: 20, bold: true, color: 'dc2626' })],
          }),
        ],
      },

      // ═══════════════════════════════════════════════════════════
      // TABLE OF CONTENTS + ALL SECTIONS
      // ═══════════════════════════════════════════════════════════
      {
        properties: {},
        children: ([
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Table of Contents' })],
          }),
          new TableOfContents('Table of Contents', {
            hyperlink: true,
            headingStyleRange: '1-3',
            stylesWithLevels: [
              new StyleLevel('Heading1', 1),
              new StyleLevel('Heading2', 2),
            ],
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 1: EXECUTIVE SUMMARY ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '1. Executive Summary' }),
          new Paragraph({
            children: [new TextRun({
              text: `This Business Valuation Report presents a conclusion of Fair Market Value for ${valuation.business_name}, prepared using the CAIBVS\u2122 (Computer-Assisted Integrated Business Valuation System) methodology. The valuation incorporates multi-method analysis with risk-adjusted discount rates and is intended for transaction advisory purposes.`,
            })],
          }),
          new Paragraph({ text: '' }),
          ...buildKeyValuePairs([
            ['Subject Entity', valuation.business_name],
            ['Industry', valuation.industry || 'Not specified'],
            ['Location', valuation.location || 'Not specified'],
            ['SIC Code', valuation.sic_code || 'N/A'],
            ['NAICS Code', valuation.naics_code || 'N/A'],
            ['Purpose of Valuation', 'Determination of Fair Market Value for transaction advisory'],
            ['Effective Date', effectiveDate],
            ['Earnings Metric', (valuation.metric_type || 'SDE').toUpperCase()],
            ['Normalized Earnings', `$${Number(valuation.normalized_earnings || 0).toLocaleString()}`],
            ['Annual Revenue', `$${Number(valuation.annual_revenue || 0).toLocaleString()}`],
          ]),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Conclusion of Value' }),
          new Paragraph({
            children: [new TextRun({
              text: `Based on the analysis presented herein, it is the conclusion of this report that the Fair Market Value of ${valuation.business_name}, as of ${effectiveDate}, falls within the following range:`,
            })],
          }),
          new Paragraph({ text: '' }),
          buildValueTable(valuation.valuation_low, valuation.valuation_mid, valuation.valuation_high),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 2: BUSINESS DESCRIPTION ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '2. Business Description' }),
          new Paragraph({
            children: [new TextRun({
              text: valuation.business_description || 'No business description was provided for this valuation. The analysis is based on financial data and industry benchmarks.',
            })],
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 3: FINANCIAL ANALYSIS ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '3. Financial Analysis' }),
          new Paragraph({
            children: [new TextRun({
              text: `The following financial analysis is based on ${new Set(finData.map(f => f.fiscal_year)).size} year(s) of historical financial data provided by the business owner. All figures have been organized into a standardized profit and loss format.`,
            })],
          }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: '3.1 Multi-Year P&L Summary' }),
          ...buildFinancialSummaryTable(finData),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: '3.2 SDE Normalization Waterfall' }),
          new Paragraph({
            children: [new TextRun({
              text: 'The following add-backs were applied to Net Operating Income to arrive at Seller\'s Discretionary Earnings (SDE):',
            })],
          }),
          ...buildSDEWaterfall(finData),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 4: VALUATION METHODOLOGY ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '4. Valuation Methodology' }),
          new Paragraph({
            children: [new TextRun({
              text: `This valuation employs the CAIBVS\u2122 multi-agent pipeline, which automates the normalization, multi-method valuation, and synthesis process. The system selected ${(valuation.metric_type || 'SDE').toUpperCase()} as the primary earnings metric for this analysis.`,
            })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Earnings Metric Selection' }),
          new Paragraph({
            children: [new TextRun({ text: metricReasoning || `${(valuation.metric_type || 'SDE').toUpperCase()} was selected as the appropriate earnings metric based on the size, industry, and ownership structure of the business.` })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({
              text: `Weighting Method: ${(valuation.weighting_method || 'linear_recent').replace('_', ' ')}. ${valuation.weighting_method === 'equal' ? 'All years are weighted equally.' : 'More recent years receive higher weight to reflect current operating performance.'}`,
            })],
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 5: VALUATION METHODS APPLIED ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '5. Valuation Methods Applied' }),
          new Paragraph({
            children: [new TextRun({
              text: `Five valuation methods were applied to the normalized earnings of $${Number(valuation.normalized_earnings || 0).toLocaleString()}. Each method is weighted based on its relevance to the subject entity.`,
            })],
          }),
          ...buildMethodSections(methodData),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 6: RISK ANALYSIS ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '6. Risk Analysis' }),
          ...buildRiskSection(riskRow),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 7: RECONCILIATION & CONCLUSION ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '7. Reconciliation & Conclusion' }),
          new Paragraph({
            children: [new TextRun({
              text: `The five valuation methods produced a range of indicated values. The weighted Fair Market Value was determined by applying the assigned weights to each method's indicated value:`,
            })],
          }),
          new Paragraph({ text: '' }),
          buildReconciliationTable(methodData, valuation.valuation_mid),
          new Paragraph({ text: '' }),
          ...buildMethodAgreementAnalysis(methodData, valuation.valuation_mid),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({
              text: `Based on the reconciliation of all methods, the concluded Fair Market Value of ${valuation.business_name} is $${Number(valuation.valuation_mid).toLocaleString()}, with a defensible range of $${Number(valuation.valuation_low).toLocaleString()} to $${Number(valuation.valuation_high).toLocaleString()}.`,
              bold: true,
            })],
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 8: ASSUMPTIONS & LIMITING CONDITIONS ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '8. Assumptions & Limiting Conditions' }),
          ...ASSUMPTIONS.map(text => new Paragraph({
            children: [new TextRun({ text: `\u2022 ${text}`, size: 20 })],
            spacing: { after: 80 },
          })),
          new Paragraph({ children: [new PageBreak()] }),

          // ── SECTION 9: CERTIFICATION ──
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: '9. Certification' }),
          ...CERTIFICATION.map(text => new Paragraph({
            children: [new TextRun({ text, size: 20 })],
            spacing: { after: 100 },
          })),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: 'CRE Resources, LLC', bold: true, size: 24 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: effectiveDate, size: 20, color: '64748b' })],
          }),
        ] as FileChild[]),
      },
    ],
  })

  // 3. Generate the DOCX buffer
  const buffer = await Packer.toBuffer(doc)

  // 4. Upload to Supabase Storage
  const filename = `${valuation.business_name.replace(/[^a-zA-Z0-9]/g, '_')}_BVR_${new Date().toISOString().split('T')[0]}.docx`
  let reportUrl: string | null = null

  try {
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(`${valuationId}/${filename}`, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      })

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from('reports')
        .getPublicUrl(`${valuationId}/${filename}`)
      reportUrl = urlData?.publicUrl || null
    } else {
      console.error('Supabase Storage upload error (non-blocking):', uploadError.message)
    }
  } catch (e) {
    console.error('Storage upload failed (non-blocking):', e)
  }

  // 5. Update valuation record
  const existingLog = valuation.agent_log || []
  const agentLogEntry = {
    agent: 'agent_5_report_generation',
    timestamp: new Date().toISOString(),
    filename,
    report_url: reportUrl,
    sections: 9,
  }

  await supabase.from('valuations').update({
    report_url: reportUrl || `local://${filename}`,
    status: 'complete',
    agent_log: [...existingLog, agentLogEntry],
  }).eq('id', valuationId)

  return {
    report_buffer: Buffer.from(buffer),
    filename,
    report_url: reportUrl,
  }
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT BUILDER HELPERS
// ═══════════════════════════════════════════════════════════════

function buildKeyValuePairs(pairs: [string, string][]): Paragraph[] {
  return pairs.map(([key, value]) => new Paragraph({
    children: [
      new TextRun({ text: `${key}: `, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
    spacing: { after: 60 },
  }))
}

function buildValueTable(low: number, mid: number, high: number): Table {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: ['Low Estimate', 'Mid-Point (Concluded)', 'High Estimate'].map(label =>
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 3000, type: WidthType.DXA },
            shading: { fill: '1e3a5f' },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: label, bold: true, color: 'ffffff', size: 20 })],
            })],
          })
        ),
      }),
      new TableRow({
        children: [
          { val: low, bold: false },
          { val: mid, bold: true },
          { val: high, bold: false },
        ].map(({ val, bold }) =>
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 3000, type: WidthType.DXA },
            shading: bold ? { fill: 'eff6ff' } : undefined,
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `$${Number(val).toLocaleString()}`, bold, size: 26 })],
            })],
          })
        ),
      }),
    ],
  })
}

function buildFinancialSummaryTable(finData: FinancialData[]): FileChild[] {
  const years = [...new Set(finData.map(f => f.fiscal_year))].sort()
  if (years.length === 0) return [new Paragraph({ text: 'No financial data available.' })]

  const sumByYearCat = (year: number, cat: string) =>
    finData.filter(f => f.fiscal_year === year && f.category === cat)
      .reduce((s, f) => s + Number(f.amount), 0)

  const rows: { label: string; values: number[]; bold?: boolean; shading?: string }[] = []

  for (const year of years) {
    const rev = sumByYearCat(year, 'revenue')
    const cogs = sumByYearCat(year, 'cogs')
    const opex = sumByYearCat(year, 'operating_expense')
    const addbacks = sumByYearCat(year, 'sde_addback')
    const noi = rev - Math.abs(cogs) - Math.abs(opex)
    const sde = noi + addbacks

    if (rows.length === 0) {
      rows.push({ label: 'Revenue', values: [rev] })
      rows.push({ label: 'Cost of Goods Sold', values: [Math.abs(cogs)] })
      rows.push({ label: 'Gross Profit', values: [rev - Math.abs(cogs)], bold: true, shading: 'f8fafc' })
      rows.push({ label: 'Total Operating Expenses', values: [Math.abs(opex)] })
      rows.push({ label: 'Net Operating Income', values: [noi], bold: true, shading: 'f8fafc' })
      rows.push({ label: 'Total SDE Add-Backs', values: [addbacks] })
      rows.push({ label: 'Seller\'s Discretionary Earnings', values: [sde], bold: true, shading: 'eff6ff' })
    } else {
      rows[0].values.push(rev)
      rows[1].values.push(Math.abs(cogs))
      rows[2].values.push(rev - Math.abs(cogs))
      rows[3].values.push(Math.abs(opex))
      rows[4].values.push(noi)
      rows[5].values.push(addbacks)
      rows[6].values.push(sde)
    }
  }

  const colWidth = Math.floor(6000 / years.length)
  const table = new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: HEADER_BORDER,
            shading: { fill: '1e3a5f' },
            width: { size: 3000, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: '', size: 20 })] })],
          }),
          ...years.map(year => new TableCell({
            borders: HEADER_BORDER,
            shading: { fill: '1e3a5f' },
            width: { size: colWidth, type: WidthType.DXA },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `FY ${year}`, bold: true, color: 'ffffff', size: 20 })],
            })],
          })),
        ],
      }),
      ...rows.map(row => new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            shading: row.shading ? { fill: row.shading } : undefined,
            width: { size: 3000, type: WidthType.DXA },
            children: [new Paragraph({
              children: [new TextRun({ text: row.label, bold: row.bold, size: 20 })],
            })],
          }),
          ...row.values.map(val => new TableCell({
            borders: CELL_BORDER,
            shading: row.shading ? { fill: row.shading } : undefined,
            width: { size: colWidth, type: WidthType.DXA },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `$${Math.abs(val).toLocaleString()}`, bold: row.bold, size: 20 })],
            })],
          })),
        ],
      })),
    ],
  })

  return [table]
}

function buildSDEWaterfall(finData: FinancialData[]): FileChild[] {
  const years = [...new Set(finData.map(f => f.fiscal_year))].sort()
  const results: Paragraph[] = []

  for (const year of years) {
    const yearData = finData.filter(f => f.fiscal_year === year)
    const rev = yearData.filter(f => f.category === 'revenue').reduce((s, f) => s + Number(f.amount), 0)
    const cogs = yearData.filter(f => f.category === 'cogs').reduce((s, f) => s + Number(f.amount), 0)
    const opex = yearData.filter(f => f.category === 'operating_expense').reduce((s, f) => s + Number(f.amount), 0)
    const noi = rev - Math.abs(cogs) - Math.abs(opex)

    results.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      text: `FY ${year} SDE Waterfall`,
    }))

    results.push(new Paragraph({
      children: [
        new TextRun({ text: 'Net Operating Income: ', bold: true, size: 20 }),
        new TextRun({ text: `$${noi.toLocaleString()}`, size: 20 }),
      ],
    }))

    const addbacks = yearData.filter(f => f.category === 'sde_addback')
    let runningTotal = noi
    for (const ab of addbacks) {
      runningTotal += Number(ab.amount)
      results.push(new Paragraph({
        children: [
          new TextRun({ text: `  + ${ab.line_item}: `, size: 20 }),
          new TextRun({ text: `$${Number(ab.amount).toLocaleString()}`, size: 20 }),
        ],
        spacing: { after: 40 },
      }))
    }

    results.push(new Paragraph({
      children: [
        new TextRun({ text: 'Seller\'s Discretionary Earnings: ', bold: true, size: 22 }),
        new TextRun({ text: `$${runningTotal.toLocaleString()}`, bold: true, size: 22, color: '2563eb' }),
      ],
      spacing: { after: 200 },
    }))
  }

  return results
}

function buildMethodSections(methods: ValuationMethod[]): FileChild[] {
  const names: Record<string, string> = {
    market_multiple: 'Market Multiple',
    capitalization_of_earnings: 'Capitalization of Earnings',
    dcf: 'Discounted Cash Flow (DCF)',
    asset_based: 'Asset-Based',
    rule_of_thumb: 'Rule of Thumb',
  }

  const paragraphs: FileChild[] = []
  methods.forEach((m, i) => {
    paragraphs.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      text: `5.${i + 1} ${names[m.method] || m.method}`,
    }))

    const details: [string, string][] = [
      ['Indicated Value', `$${Number(m.result_value || 0).toLocaleString()}`],
      ['Weight', `${(Number(m.weight) * 100).toFixed(0)}%`],
    ]
    if (m.multiple_used) details.push(['Multiple Used', `${m.multiple_used}x`])
    if (m.cap_rate) details.push(['Capitalization Rate', `${(Number(m.cap_rate) * 100).toFixed(1)}%`])
    if (m.discount_rate) details.push(['Discount Rate', `${(Number(m.discount_rate) * 100).toFixed(1)}%`])

    paragraphs.push(...details.map(([k, v]) => new Paragraph({
      children: [
        new TextRun({ text: `${k}: `, bold: true, size: 20 }),
        new TextRun({ text: v, size: 20 }),
      ],
      spacing: { after: 40 },
    })))

    if (m.reasoning) {
      paragraphs.push(new Paragraph({ text: '' }))
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: m.reasoning, size: 20, italics: true, color: '475569' })],
      }))
    }
  })

  return paragraphs
}

function buildRiskSection(riskRow: Record<string, unknown> | null): FileChild[] {
  if (!riskRow) {
    return [new Paragraph({
      children: [new TextRun({
        text: 'No broker-entered risk analysis was provided. Default CSRP (Company-Specific Risk Premium) factors were applied based on industry benchmarks and business characteristics.',
      })],
    })]
  }

  const factors = [
    { key: 'industry_stability', label: 'Industry Stability', group: 'Business & Industry' },
    { key: 'competitive_position', label: 'Competitive Position', group: 'Business & Industry' },
    { key: 'customer_concentration', label: 'Customer Concentration', group: 'Business & Industry' },
    { key: 'supplier_dependence', label: 'Supplier Dependence', group: 'Business & Industry' },
    { key: 'regulatory_environment', label: 'Regulatory Environment', group: 'Business & Industry' },
    { key: 'revenue_trend', label: 'Revenue Trend (3-Year)', group: 'Financial' },
    { key: 'profit_margin_stability', label: 'Profit Margin Stability', group: 'Financial' },
    { key: 'working_capital', label: 'Working Capital Position', group: 'Financial' },
    { key: 'debt_level', label: 'Debt Level', group: 'Financial' },
    { key: 'financial_records_quality', label: 'Financial Records Quality', group: 'Financial' },
    { key: 'owner_dependence', label: 'Owner Dependence', group: 'Operational' },
    { key: 'key_employee_risk', label: 'Key Employee Risk', group: 'Operational' },
    { key: 'systems_processes', label: 'Systems & Processes', group: 'Operational' },
    { key: 'facility_equipment', label: 'Facility/Equipment Condition', group: 'Operational' },
    { key: 'lease_position', label: 'Lease Position', group: 'Operational' },
  ]

  const paragraphs: FileChild[] = []

  paragraphs.push(new Paragraph({
    children: [new TextRun({
      text: 'A 15-factor Company-Specific Risk Premium (CSRP) analysis was conducted. Each factor is scored 1 (lowest risk) to 5 (highest risk) and weighted by significance:',
    })],
  }))
  paragraphs.push(new Paragraph({ text: '' }))

  const table = new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: ['Risk Factor', 'Group', 'Score', 'Weight'].map(h =>
          new TableCell({
            borders: HEADER_BORDER,
            shading: { fill: '1e3a5f' },
            children: [new Paragraph({
              alignment: h === 'Score' || h === 'Weight' ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: [new TextRun({ text: h, bold: true, color: 'ffffff', size: 18 })],
            })],
          })
        ),
      }),
      ...factors.map(f => {
        const score = Number(riskRow[`${f.key}_score`] || 3)
        const weight = Number(riskRow[`${f.key}_weight`] || 0.05)
        return new TableRow({
          children: [
            new TableCell({ borders: CELL_BORDER, children: [new Paragraph({ children: [new TextRun({ text: f.label, size: 18 })] })] }),
            new TableCell({ borders: CELL_BORDER, children: [new Paragraph({ children: [new TextRun({ text: f.group, size: 18, color: '64748b' })] })] }),
            new TableCell({
              borders: CELL_BORDER,
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: score.toString(), size: 18, bold: true, color: score <= 2 ? '16a34a' : score === 3 ? 'ca8a04' : 'dc2626' })],
              })],
            }),
            new TableCell({
              borders: CELL_BORDER,
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${(weight * 100).toFixed(0)}%`, size: 18 })],
              })],
            }),
          ],
        })
      }),
    ],
  })

  paragraphs.push(table)
  paragraphs.push(new Paragraph({ text: '' }))

  paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Discount Rate Build-Up' }))
  const buildUpItems: [string, string][] = [
    ['Risk-Free Rate', `${(Number(riskRow.risk_free_rate || 0.045) * 100).toFixed(1)}%`],
    ['Equity Risk Premium', `${(Number(riskRow.equity_risk_premium || 0.065) * 100).toFixed(1)}%`],
    ['Size Premium', `${(Number(riskRow.size_premium || 0.055) * 100).toFixed(1)}%`],
    ['CSRP Premium', `${(Number(riskRow.csrp_premium || 0) * 100).toFixed(1)}%`],
    ['Total Discount Rate', `${(Number(riskRow.discount_rate || 0) * 100).toFixed(1)}%`],
    ['Less: Long-Term Growth Rate', `(${(Number(riskRow.long_term_growth_rate || 0.02) * 100).toFixed(1)}%)`],
    ['Capitalization Rate', `${(Number(riskRow.capitalization_rate || 0) * 100).toFixed(1)}%`],
  ]

  paragraphs.push(...buildUpItems.map(([k, v]) => new Paragraph({
    children: [
      new TextRun({ text: `${k}: `, bold: k.includes('Total') || k.includes('Capitalization'), size: 20 }),
      new TextRun({ text: v, bold: k.includes('Total') || k.includes('Capitalization'), size: 20, color: k.includes('Total') || k.includes('Capitalization') ? '2563eb' : '000000' }),
    ],
    spacing: { after: 40 },
  })))

  return paragraphs
}

function buildReconciliationTable(methods: ValuationMethod[], midValue: number): Table {
  const names: Record<string, string> = {
    market_multiple: 'Market Multiple',
    capitalization_of_earnings: 'Cap of Earnings',
    dcf: 'DCF',
    asset_based: 'Asset-Based',
    rule_of_thumb: 'Rule of Thumb',
  }

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: ['Method', 'Indicated Value', 'Weight', 'Weighted Value'].map(h =>
          new TableCell({
            borders: HEADER_BORDER,
            shading: { fill: '1e3a5f' },
            children: [new Paragraph({
              alignment: h === 'Method' ? AlignmentType.LEFT : AlignmentType.RIGHT,
              children: [new TextRun({ text: h, bold: true, color: 'ffffff', size: 18 })],
            })],
          })
        ),
      }),
      ...methods.map(m => {
        const val = Number(m.result_value || 0)
        const wt = Number(m.weight)
        return new TableRow({
          children: [
            new TableCell({ borders: CELL_BORDER, children: [new Paragraph({ children: [new TextRun({ text: names[m.method] || m.method, size: 18 })] })] }),
            new TableCell({ borders: CELL_BORDER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `$${val.toLocaleString()}`, size: 18 })] })] }),
            new TableCell({ borders: CELL_BORDER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${(wt * 100).toFixed(0)}%`, size: 18 })] })] }),
            new TableCell({ borders: CELL_BORDER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `$${Math.round(val * wt).toLocaleString()}`, size: 18 })] })] }),
          ],
        })
      }),
      new TableRow({
        children: [
          new TableCell({ borders: CELL_BORDER, shading: { fill: 'eff6ff' }, children: [new Paragraph({ children: [new TextRun({ text: 'Weighted Fair Market Value', bold: true, size: 18 })] })] }),
          new TableCell({ borders: CELL_BORDER, shading: { fill: 'eff6ff' }, children: [new Paragraph({ text: '' })] }),
          new TableCell({ borders: CELL_BORDER, shading: { fill: 'eff6ff' }, children: [new Paragraph({ text: '' })] }),
          new TableCell({
            borders: CELL_BORDER,
            shading: { fill: 'eff6ff' },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: `$${Number(midValue).toLocaleString()}`, bold: true, size: 20, color: '2563eb' })],
            })],
          }),
        ],
      }),
    ],
  })
}

function buildMethodAgreementAnalysis(methods: ValuationMethod[], midValue: number): FileChild[] {
  const values = methods.map(m => Number(m.result_value || 0)).filter(v => v > 0)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min
  const mid = Number(midValue)
  const coefficient = mid > 0 ? spread / mid : 0

  let agreement: string
  if (coefficient < 0.3) agreement = 'strong agreement among the valuation methods, indicating high confidence in the concluded value'
  else if (coefficient < 0.6) agreement = 'moderate agreement among the valuation methods, suggesting reasonable confidence with some variance driven by differing assumptions'
  else agreement = 'wide dispersion among the valuation methods, reflecting the inherent uncertainty in valuing this type of business. The range accounts for this dispersion'

  return [
    new Paragraph({
      children: [new TextRun({
        text: `Method Agreement Analysis: The indicated values range from $${min.toLocaleString()} to $${max.toLocaleString()}, a spread of $${spread.toLocaleString()} (dispersion coefficient: ${(coefficient * 100).toFixed(1)}%). This represents ${agreement}.`,
      })],
    }),
  ]
}

// ═══════════════════════════════════════════════════════════════
// STANDARD CONTENT
// ═══════════════════════════════════════════════════════════════

const ASSUMPTIONS = [
  'This valuation assumes the business will continue as a going concern.',
  'The financial information provided by the business owner is assumed to be accurate and complete. No audit or independent verification of the financial statements has been performed.',
  'The valuation is based on the economic and industry conditions existing as of the effective date.',
  'No investigation of the legal title to the business assets has been made, and the appraiser assumes clear and marketable title.',
  'The concluded value represents Fair Market Value as defined by IRS Revenue Ruling 59-60: "The price at which the property would change hands between a willing buyer and a willing seller, neither being under any compulsion to buy or to sell and both having reasonable knowledge of relevant facts."',
  'This valuation does not include the value of real estate, unless specifically stated. Real property, if any, should be appraised separately.',
  'The appraiser has no present or prospective interest in the subject business and has no personal interest or bias with respect to the parties involved.',
  'Goodwill and intangible assets are included in the valuation conclusion unless otherwise stated.',
  'The valuation assumes that the business operates in compliance with all applicable federal, state, and local regulations.',
  'Future earnings projections, if used, are based on historical trends and do not guarantee future performance.',
]

const CERTIFICATION = [
  'I certify that, to the best of my knowledge and belief:',
  '',
  'The statements of fact contained in this report are true and correct.',
  '',
  'The reported analyses, opinions, and conclusions are limited only by the reported assumptions and limiting conditions and are the personal, impartial, and unbiased professional analyses, opinions, and conclusions of the appraiser.',
  '',
  'The appraiser has no present or prospective interest in the property that is the subject of this report and no personal interest with respect to the parties involved.',
  '',
  'The appraiser has performed no services, as an appraiser or in any other capacity, regarding the property that is the subject of this report within the three-year period immediately preceding acceptance of this assignment.',
  '',
  'The reported analyses, opinions, and conclusions were developed, and this report has been prepared, in conformity with the Uniform Standards of Professional Appraisal Practice (USPAP).',
  '',
  'This valuation was prepared using the CAIBVS\u2122 (Computer-Assisted Integrated Business Valuation System) methodology, which employs a multi-agent pipeline for normalization, multi-method valuation, risk analysis, and synthesis.',
]
