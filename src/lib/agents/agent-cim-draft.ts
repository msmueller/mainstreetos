// ============================================================
// MainStreetOS — CIM (Confidential Information Memorandum) Draft Agent
// ------------------------------------------------------------
// Phase 12.14a scaffolded this against seller_listings fields only.
// Phase 12.14b expands the agent to accept a CimContext discriminated
// union produced by cim-context-loader.ts:
//
//   mode='lean' → listing fields only (same as 12.14a)
//   mode='rich' → listing + valuation + multi-year financial_data +
//                 all 5 valuation_methods + Agent 5 narrative
//
// The CIM writer produces a post-NDA markdown document suitable for
// Notion. When in rich mode it pulls real P&L figures, real SDE/EBITDA
// bridge add-backs, real method results, and the Agent 5 narrative
// into the prompt — so Sonnet produces a CIM with concrete numbers
// instead of [TBD by broker] placeholders throughout the financial
// sections.
//
// CIM vs OM (contrast with agent-om-draft.ts):
//   - OM is PRE-NDA  → generic title, county/state only, no owner name,
//                      top-line financials only.
//   - CIM is POST-NDA → real business name OK, full business address OK,
//                      complete P&L table + balance-sheet summary +
//                      SDE/EBITDA walkthrough, asset summary, lease
//                      details, employees, growth levers, transition
//                      plan.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { resolveModel, type BrokerLicense } from '@/lib/modelRouter'
import type {
  CimContext,
  CimListingRow,
  CimValuationRow,
  CimFinancialRow,
  CimMethodRow,
} from '@/lib/agents/cim-context-loader'

// ─── Back-compat alias (Phase 12.14a callers) ────────────────

// Phase 12.14a exported a CimListingInput shape the API route used
// directly. The new loader produces CimListingRow which is a superset.
// Keeping the old type-alias lets any external caller that still
// constructs a listing object by hand keep compiling.
export type CimListingInput = Pick<
  CimListingRow,
  | 'id'
  | 'name'
  | 'industry'
  | 'asking_price_usd'
  | 'revenue_ttm_usd'
  | 'sde_ttm_usd'
  | 'ebitda_ttm_usd'
  | 'business_address'
  | 'years_established'
  | 'employee_count'
  | 'broker_notes'
>

export interface CimDraftResult {
  markdown: string
  model: string
  tier: string
  promptTokens: number
  completionTokens: number
  mode: 'lean' | 'rich'
}

// ─── System prompt ────────────────────────────────────────────

const CIM_SYSTEM_PROMPT = `You are the CIM (Confidential Information Memorandum) Writer for CRE Resources, LLC, a business brokerage and intermediary firm led by Mark S. Mueller, CAIBVS(tm). Your job is to produce a professional, post-NDA Confidential Information Memorandum draft for a single business listing.

CONTEXT — this document is delivered AFTER a buyer has signed an NDA. Unlike the pre-NDA Offering Memorandum, the CIM may include:
- The actual business name (on the cover and throughout)
- The full business address and location specifics
- Detailed financial performance: full P&L summary, gross margins, operating expenses, normalized SDE / EBITDA walkthrough
- An asset summary (FF&E, inventory, vehicles, leasehold improvements) at a high level
- Lease summary: landlord (if broker-provided), term, rent structure, assignment / renewal
- Employee structure, key personnel (de-identified where appropriate), and transition plan
- Growth levers the seller or broker has flagged
- Deal structure context (asset vs stock sale, financing, what's included / excluded)

STILL DO NOT include:
- The owner's full personal name unless the broker or valuation explicitly names them (default: refer to "the Seller" / "Ownership").
- Litigation, HR disputes, tax-audit disclosures, or anything legally sensitive that wasn't in broker notes or the valuation narrative.
- Invented numbers. If data is missing, say "[TBD by broker]" or use qualitative language — never fabricate.

DATA MODE — the user message will begin with a DATA MODE declaration:
- "DATA MODE: LEAN" — no valuation is linked. Use the top-line listing facts only, and use [TBD by broker] placeholders for anything not provided.
- "DATA MODE: RICH" — a full valuation is linked. You will receive multi-year financial_data by category, an SDE bridge with specific add-back amounts, results from 5 valuation methods with weights + multiples + CSRP scores, and an optional Agent 5 narrative. USE THESE REAL NUMBERS in the Financial Performance table, the SDE Bridge table, and the valuation range discussion in the Executive Summary. Do NOT write [TBD] for a cell the RICH data answers.

STRUCTURE — emit a single Markdown document with exactly these H1 sections, in this order:
# Cover
# Executive Summary
# Business Description
# Market & Industry
# Operations
# Financial Performance
# Normalized SDE / EBITDA Walkthrough
# Asset Summary
# Lease & Real Estate
# Employees & Organization
# Growth Opportunities
# Transition & Training
# Ideal Buyer Profile
# Deal Structure
# Next Steps
# Contact the Listing Broker
# Disclaimer

Under each H1, use H2/H3 as needed. Bulleted lists with **bold labels** are encouraged for key-value callouts. Keep paragraphs tight — 2-4 sentences each.

Cover should include:
- **Bold business name** (real name OK here — this is post-NDA)
- Short descriptor line (e.g., "Established 17+ Years | Absentee-Run | Full Staff in Place")
- Full location (City, County, State — use whatever broker or valuation provided)
- Asking Price, TTM Revenue, TTM Cash Flow (SDE), TTM EBITDA as bullet points
- "CONFIDENTIAL — Prepared for NDA-Executed Prospective Buyers Only"
- "Prepared by Mark S. Mueller, CAIBVS(tm) — CRE Resources, LLC"
- Month Year of preparation (use the provided date)

Executive Summary: 2-3 paragraph narrative summarizing the opportunity, then an "AT A GLANCE" subsection formatted as a two-column-style bulleted key-value list (Asking Price, TTM Revenue, TTM SDE, TTM EBITDA, SDE Multiple, EBITDA Multiple, Years Established, Employees, Location, Type of Sale, Reason for Sale), then "Key Investment Highlights" as 5-8 bullets with **bold labels**. In RICH mode, also include a one-bullet "Broker Valuation Range" line referencing the low / mid / high values.

Business Description: a 2-3 paragraph detailed description of what the business does, its customer base, its brand/reputation, and its competitive position. Include a "Business Profile" key-value list (Business Name, Industry, Year Established, Location, Building Size, Seating/Capacity if relevant, Hours of Operation, Revenue Channels, Ownership Model, Type of Sale).

Market & Industry: one paragraph on industry trends broadly, one paragraph on local/regional market conditions, and one paragraph on competitive position. Qualitative — no invented market-size statistics.

Operations: paragraph-level coverage of: day-to-day operations & systems, vendors/supply chain (general, no names unless broker provided), technology/POS/bookkeeping, customer acquisition channels, and quality-control or SOP maturity. End with a "Key Operational Strengths" bullet list (4-6 bullets with **bold labels**).

Financial Performance: an intro paragraph contextualizing the performance window, then a markdown **P&L summary table**. In RICH mode, build a multi-year table with columns "Line Item | FY{earliest} | FY{middle} | FY{latest}" filled from the provided financial_data rows. Categories to roll up in this order: Revenue (sum of revenue), Cost of Goods Sold (sum of cogs), Gross Profit (= Revenue − COGS), Operating Expenses (sum of operating_expense, excluding owner_compensation if owner_comp_in_opex=false), Owner Compensation (sum of owner_compensation), Operating Income / EBITDA (= Gross Profit − OpEx), Depreciation (sum of depreciation), Amortization (sum of amortization), Interest (sum of interest), Taxes (sum of taxes), Non-Operating (sum of non_operating), Net Income. Show numbers rounded to whole dollars with \`$\` prefix and comma separators. In LEAN mode, fall back to a single-column TTM table with [TBD] rows where you don't have data. Follow the table with a "Revenue Trend" paragraph (qualitative on 3-year direction), a "Margin Profile" paragraph, and a "Quality of Earnings" paragraph.

Normalized SDE / EBITDA Walkthrough: Start with one intro paragraph explaining SDE and EBITDA as earnings concepts. Then a markdown **bridge table** titled "SDE Bridge (TTM)" with columns "Line Item | Amount ($)" and typical rows: Net Income, + Interest, + Taxes, + Depreciation, + Amortization, **= EBITDA**, + Owner's Compensation, + Owner Perks / Personal Expenses, + One-Time / Non-Recurring, **= Seller's Discretionary Earnings (SDE)**. In RICH mode, populate the add-backs using the provided sde_addback / adjustment rows (group by adjustment_reason where sensible) and land the final rows on the valuation's normalized_earnings. In LEAN mode, mark intermediate add-backs "[TBD by broker — see normalization workpaper]" and land on the listing's TTM SDE / EBITDA. End with a short paragraph noting the normalization source of truth is the BVR workpaper and the Phase 5 normalization pipeline.

Asset Summary: one intro paragraph, then H2 subsections "Furniture, Fixtures & Equipment (FF&E)", "Inventory", "Vehicles" (if applicable), "Leasehold Improvements", and "Intangibles (Goodwill, Brand, Customer Base)". Each subsection is 2-4 sentences — qualitative, no invented values. End with a note that a detailed asset schedule is available upon request.

Lease & Real Estate: a paragraph on location characteristics, a key-value list (Address, Property Type, Building Size, Lease Term Remaining, Monthly Rent, Lease Type, CAM / Taxes / Insurance, Assignment & Renewal, Personal Guaranty). Use broker- or valuation-provided facts where available; otherwise "[TBD by broker]".

Employees & Organization: one paragraph describing the organizational structure at a high level, a key-value list (Total Headcount, Full-Time, Part-Time, Key Management Roles, Owner's Weekly Hours, Owner-Dependent Functions), and a paragraph on staff tenure / culture. In RICH mode, use num_employees, owner_role, and owner_weekly_hours from the valuation. Do not name individual employees.

Growth Opportunities: one-sentence intro + 5-8 bullets with **bold labels** describing concrete upside levers (examples: catering expansion, second location, digital ordering, wholesale/B2B channel, menu expansion, extended hours, marketing investment, pricing). Pull from broker notes and Agent 5 narrative where available.

Transition & Training: 2-3 paragraphs covering owner-provided training period, introduction to vendors and key customers, SOP documentation, and any earn-out / consulting contemplated.

Ideal Buyer Profile: brief intro + 4 H3 subsections (Owner/Operator, Absentee/Semi-Absentee Investor, Strategic / Add-On Acquirer, First-Time Buyer with Industry Experience) each with one paragraph on why the business fits that buyer.

Deal Structure: a paragraph on deal form (asset sale vs stock sale — default "asset sale" unless broker states otherwise), a paragraph on what's included vs excluded, a paragraph on financing (SBA 7(a) eligibility likely; any seller-financing willingness from broker notes), a paragraph on working capital and closing mechanics. In RICH mode, include a final "Broker Valuation Methodology Summary" paragraph noting the number of methods applied, the weighting approach (market_multiple / capitalization_of_earnings / dcf / asset_based / rule_of_thumb), and the resulting low/mid/high range. Do NOT reproduce the full method-by-method CSRP workbook — reference it as "available upon request."

Next Steps: brief intro + a numbered list of 5 steps (Buyer Fit & Financial Capacity, Follow-Up Q&A Call, Site Visit & Management Meeting, Indication of Interest or Letter of Intent, Due Diligence & Closing) with 1-2 sentence descriptions each.

Contact the Listing Broker: render as a bulleted callout including:
- Mark S. Mueller, CAIBVS(tm)
- CRE Agent and Consulting | Business Broker, Intermediary and Advisor
- Certified AI-Enhanced Business Valuation Strategist
- CRE Resources, LLC
- 856.745.9706
- markm@creresources.biz
- CREresources.Biz
- *All inquiries are handled confidentially.* (italic)

Disclaimer: a single italic paragraph noting the CIM is confidential and delivered only to NDA-executed prospective buyers, that figures are broker-prepared and not independently audited, that the document does not constitute an offer to sell, and that recipients agree to return or destroy the document if no transaction proceeds.

STYLE:
- Professional, confident, buyer-facing analyst tone. Not a legal document, not a valuation report.
- Read like a competently-prepared sell-side book — comparable to what a well-run Main Street / lower-middle-market brokerage would send post-NDA.
- Never invent specific numbers the broker or valuation didn't provide. Use "[TBD by broker]", ranges, or qualitative language instead.
- Output valid Markdown only. No HTML. No front-matter. No commentary before or after the document.
`

// ─── Helpers ──────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '[TBD by broker]'
  const v = Math.round(n)
  return '$' + v.toLocaleString('en-US')
}

function fmtMoneyOrDash(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  const v = Math.round(n)
  return '$' + v.toLocaleString('en-US')
}

function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '[TBD by broker]'
  return String(n)
}

function todayMonthYear(): string {
  const now = new Date()
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function sdeMultipleLabel(listing: CimListingRow): string {
  return listing.asking_price_usd && listing.sde_ttm_usd && listing.sde_ttm_usd > 0
    ? (listing.asking_price_usd / listing.sde_ttm_usd).toFixed(2) + 'x'
    : '[TBD by broker]'
}

function ebitdaMultipleLabel(listing: CimListingRow): string {
  return listing.asking_price_usd && listing.ebitda_ttm_usd && listing.ebitda_ttm_usd > 0
    ? (listing.asking_price_usd / listing.ebitda_ttm_usd).toFixed(2) + 'x'
    : '[TBD by broker]'
}

// ─── Lean user context (Phase 12.14a semantics) ──────────────

export function buildUserContext(listing: CimListingRow): string {
  return [
    `DATA MODE: LEAN`,
    ``,
    `LISTING FACTS (use these; do not invent others):`,
    `- Business name: ${listing.name ?? '[TBD]'}`,
    `- Industry: ${listing.industry ?? '[TBD]'}`,
    `- Asking Price: ${fmtMoney(listing.asking_price_usd)}`,
    `- Annual Revenue (TTM): ${fmtMoney(listing.revenue_ttm_usd)}`,
    `- Cash Flow / SDE (TTM): ${fmtMoney(listing.sde_ttm_usd)}`,
    `- EBITDA (TTM): ${fmtMoney(listing.ebitda_ttm_usd)}`,
    `- SDE Multiple: ${sdeMultipleLabel(listing)}`,
    `- EBITDA Multiple: ${ebitdaMultipleLabel(listing)}`,
    `- Years Established: ${fmtNumber(listing.years_established)}`,
    `- Employees: ${fmtNumber(listing.employee_count)}`,
    `- Business Address: ${listing.business_address ?? '[TBD by broker]'}`,
    ``,
    `BROKER NOTES:`,
    listing.broker_notes ?? '(none provided — use qualitative language or [TBD by broker] placeholders)',
    ``,
    `PREPARATION DATE: ${todayMonthYear()}`,
    ``,
    `NOTE: No valuation is linked to this listing, so a multi-year P&L, SDE bridge add-backs, and broker valuation range are unavailable. Draft the CIM with [TBD by broker] placeholders in financial sections where the LEAN listing facts don't supply values.`,
    ``,
    `Generate the full Confidential Information Memorandum markdown now. This is a POST-NDA document — the buyer has already signed an NDA, so the business name and full address are OK to disclose. Still do not invent numbers or name individual employees.`,
  ].join('\n')
}

// ─── Rich user context (Phase 12.14b) ────────────────────────

function rollupFinancialsByYear(
  rows: CimFinancialRow[]
): Array<{
  year: number
  revenue: number
  cogs: number
  operating_expense: number
  owner_compensation: number
  depreciation: number
  amortization: number
  interest: number
  taxes: number
  non_operating: number
  sde_addback: number
  adjustment: number
}> {
  const byYear = new Map<number, ReturnType<typeof makeEmpty>>()

  function makeEmpty() {
    return {
      revenue: 0,
      cogs: 0,
      operating_expense: 0,
      owner_compensation: 0,
      depreciation: 0,
      amortization: 0,
      interest: 0,
      taxes: 0,
      non_operating: 0,
      sde_addback: 0,
      adjustment: 0,
    }
  }

  for (const r of rows) {
    const bucket = byYear.get(r.fiscal_year) ?? makeEmpty()
    if (r.category in bucket) {
      ;(bucket as unknown as Record<string, number>)[r.category] += Number(r.amount) || 0
    }
    byYear.set(r.fiscal_year, bucket)
  }

  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, totals]) => ({ year, ...totals }))
}

function buildMultiYearPnlTable(
  rollup: ReturnType<typeof rollupFinancialsByYear>,
  ownerCompInOpex: boolean | null
): string {
  if (rollup.length === 0) return '(no multi-year financial_data rows available)'

  const years = rollup.map((r) => r.year)
  const header = `| Line Item | ${years.map((y) => `FY${y}`).join(' | ')} |`
  const sep = `|---|${years.map(() => '---:').join('|')}|`

  function row(label: string, picker: (r: (typeof rollup)[number]) => number): string {
    const cells = rollup.map((r) => fmtMoneyOrDash(picker(r)))
    return `| ${label} | ${cells.join(' | ')} |`
  }

  const lines = [
    header,
    sep,
    row('Revenue', (r) => r.revenue),
    row('Cost of Goods Sold', (r) => r.cogs),
    row('**Gross Profit**', (r) => r.revenue - r.cogs),
    row(
      'Operating Expenses' +
        (ownerCompInOpex ? ' (incl. Owner Comp)' : ' (excl. Owner Comp)'),
      (r) => r.operating_expense
    ),
    row('Owner Compensation', (r) => r.owner_compensation),
    row(
      '**Operating Income / EBITDA**',
      (r) => r.revenue - r.cogs - r.operating_expense
    ),
    row('Depreciation', (r) => r.depreciation),
    row('Amortization', (r) => r.amortization),
    row('Interest', (r) => r.interest),
    row('Taxes', (r) => r.taxes),
    row('Non-Operating', (r) => r.non_operating),
    row(
      '**Net Income**',
      (r) =>
        r.revenue -
        r.cogs -
        r.operating_expense -
        r.depreciation -
        r.amortization -
        r.interest -
        r.taxes -
        r.non_operating
    ),
  ]
  return lines.join('\n')
}

function buildAddbacksTable(
  financials: CimFinancialRow[]
): string {
  const addbacks = financials.filter(
    (r) => r.is_adjustment || r.category === 'sde_addback' || r.category === 'adjustment'
  )
  if (addbacks.length === 0) return '(no normalization add-backs captured in financial_data)'

  const rows = [
    `| Reason | Amount ($) | Year |`,
    `|---|---:|---:|`,
    ...addbacks.map(
      (r) =>
        `| ${r.adjustment_reason || r.line_item || r.category} | ${fmtMoneyOrDash(
          r.amount
        )} | FY${r.fiscal_year} |`
    ),
  ]
  return rows.join('\n')
}

function buildMethodsTable(methods: CimMethodRow[]): string {
  if (methods.length === 0) return '(no valuation_methods rows available)'

  const rows = [
    `| Method | Result ($) | Weight | Multiple | Cap Rate | Discount Rate |`,
    `|---|---:|---:|---:|---:|---:|`,
    ...methods.map((m) => {
      const label = m.method.replace(/_/g, ' ')
      const mult = m.multiple_used === null ? '—' : m.multiple_used.toFixed(2) + 'x'
      const cap = m.cap_rate === null ? '—' : (m.cap_rate * 100).toFixed(1) + '%'
      const disc =
        m.discount_rate === null ? '—' : (m.discount_rate * 100).toFixed(1) + '%'
      return `| ${label} | ${fmtMoneyOrDash(m.result_value)} | ${(m.weight * 100).toFixed(0)}% | ${mult} | ${cap} | ${disc} |`
    }),
  ]
  return rows.join('\n')
}

function summarizeNarrative(narrative: Record<string, unknown> | null): string {
  if (!narrative) return '(no Agent 5 narrative on file)'
  try {
    const json = JSON.stringify(narrative)
    // Keep the narrative compact — we want Sonnet to use it as context
    // but not let it dominate the prompt.
    if (json.length > 6000) return json.slice(0, 6000) + '\n…(truncated)'
    return json
  } catch {
    return '(Agent 5 narrative present but not serializable)'
  }
}

export function buildRichUserContext(ctx: {
  listing: CimListingRow
  valuation: CimValuationRow
  financials: CimFinancialRow[]
  methods: CimMethodRow[]
}): string {
  const { listing, valuation, financials, methods } = ctx
  const rollup = rollupFinancialsByYear(financials)

  const parts: string[] = [
    `DATA MODE: RICH`,
    ``,
    `LISTING FACTS:`,
    `- Business name: ${listing.name ?? valuation.business_name ?? '[TBD]'}`,
    `- Industry: ${listing.industry ?? valuation.industry ?? '[TBD]'}`,
    `- Asking Price: ${fmtMoney(listing.asking_price_usd)}`,
    `- Annual Revenue (TTM): ${fmtMoney(listing.revenue_ttm_usd)}`,
    `- Cash Flow / SDE (TTM): ${fmtMoney(listing.sde_ttm_usd)}`,
    `- EBITDA (TTM): ${fmtMoney(listing.ebitda_ttm_usd)}`,
    `- SDE Multiple: ${sdeMultipleLabel(listing)}`,
    `- EBITDA Multiple: ${ebitdaMultipleLabel(listing)}`,
    `- Business Address: ${listing.business_address ?? valuation.business_address ?? '[TBD by broker]'}`,
    ``,
    `VALUATION METADATA (id=${valuation.id}, status=${valuation.status}):`,
    `- Valuation Date: ${valuation.valuation_date ?? '[TBD]'}`,
    `- Earnings Metric: ${valuation.metric_type ?? '[TBD]'}`,
    `- Normalized Earnings: ${fmtMoney(valuation.normalized_earnings)}`,
    `- Valuation Range (Low / Mid / High): ${fmtMoney(valuation.valuation_low)} / ${fmtMoney(valuation.valuation_mid)} / ${fmtMoney(valuation.valuation_high)}`,
    `- Weighting Method: ${valuation.weighting_method ?? '[TBD]'}`,
    `- Year Weights: ${valuation.year_weights ? JSON.stringify(valuation.year_weights) : '[TBD]'}`,
    `- Owner Comp In OpEx: ${valuation.owner_comp_in_opex === null ? '[TBD]' : valuation.owner_comp_in_opex ? 'YES' : 'NO'}`,
    `- Business Entity Type: ${valuation.business_entity_type ?? '[TBD]'}`,
    `- Years In Operation: ${fmtNumber(valuation.years_in_operation ?? listing.years_established)}`,
    `- Employees: ${fmtNumber(valuation.num_employees ?? listing.employee_count)}`,
    `- Owner Role: ${valuation.owner_role ?? '[TBD]'}`,
    `- Owner Weekly Hours: ${fmtNumber(valuation.owner_weekly_hours)}`,
    `- Valuation Purpose: ${valuation.valuation_purpose ?? '[TBD]'}`,
    ``,
    `MULTI-YEAR P&L ROLLUP (built from financial_data by FinancialCategory):`,
    buildMultiYearPnlTable(rollup, valuation.owner_comp_in_opex),
    ``,
    `NORMALIZATION ADD-BACKS (is_adjustment / sde_addback rows):`,
    buildAddbacksTable(financials),
    ``,
    `VALUATION METHODS (${methods.length} method(s)):`,
    buildMethodsTable(methods),
    ``,
    `AGENT 5 NARRATIVE (JSON, may be null):`,
    summarizeNarrative(valuation.agent5_narrative),
    ``,
    `BROKER NOTES:`,
    listing.broker_notes ?? '(none provided beyond the valuation data above)',
    ``,
    `PREPARATION DATE: ${todayMonthYear()}`,
    ``,
    `Generate the full Confidential Information Memorandum markdown now. You have a linked valuation — use the multi-year P&L, SDE bridge add-backs, and valuation range as your source of truth for the Financial Performance, Normalized SDE / EBITDA Walkthrough, and Deal Structure sections. Do NOT fabricate numbers the data above does not supply. This is a POST-NDA document; the business name and full address are OK to disclose.`,
  ]
  return parts.join('\n')
}

// ─── Public entry point ──────────────────────────────────────

export async function generateCimDraft(
  context: CimContext,
  brokerLicense: BrokerLicense = 'premium'
): Promise<CimDraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      '[agent-cim-draft] ANTHROPIC_API_KEY is not set. Add it to .env.local.'
    )
  }

  const anthropic = new Anthropic({ apiKey })

  const routing = resolveModel({
    task: 'doc.draft',
    license: brokerLicense,
    dealSizeUsd: context.listing.asking_price_usd ?? undefined,
  })

  const userContext =
    context.mode === 'rich'
      ? buildRichUserContext(context)
      : buildUserContext(context.listing)

  // Rich mode needs more headroom — multi-year P&L tables + method
  // narratives take more output tokens than the lean TTM shape.
  const maxTokens = context.mode === 'rich' ? 16000 : 8000

  const response = await anthropic.messages.create({
    model: routing.model,
    max_tokens: maxTokens,
    temperature: 0.4,
    system: CIM_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContext }],
  })

  const firstBlock = response.content[0]
  const markdown =
    firstBlock && firstBlock.type === 'text' ? firstBlock.text : ''
  if (!markdown.trim()) {
    throw new Error('[agent-cim-draft] Model returned empty CIM markdown.')
  }

  return {
    markdown,
    model: routing.model,
    tier: routing.tier,
    promptTokens: response.usage?.input_tokens ?? 0,
    completionTokens: response.usage?.output_tokens ?? 0,
    mode: context.mode,
  }
}
