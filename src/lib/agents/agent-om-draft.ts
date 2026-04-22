// ============================================================
// MainStreetOS — OM (Offering Memorandum) Draft Agent
// ------------------------------------------------------------
// Phase 12.13 scaffolded this against seller_listings fields only.
// Phase 12.14c extends it to accept a CimContext discriminated union
// (from cim-context-loader.ts — shared with the CIM writer) so the
// OM can use a linked valuation's data when available WITHOUT
// violating pre-NDA confidentiality rules.
//
//   mode='lean' → listing fields only (same as 12.13 behavior)
//   mode='rich' → derive PRE-NDA-SAFE summary shapes from the
//                 linked valuation: multi-year revenue range,
//                 broker valuation range (low/mid/high), revenue
//                 trend direction, gross margin qualitative band,
//                 and the Agent 5 narrative. The rich prompt NEVER
//                 dumps the full P&L table, the SDE recast bridge,
//                 or the CSRP method-by-method workbook — those
//                 stay confidential until the NDA is signed.
//
// OM vs CIM (contrast with agent-cim-draft.ts):
//   - OM is PRE-NDA   → generic title, county/state, no owner name,
//                       no P&L table, no SDE recast, no CSRP detail.
//                       Rich data informs RANGES and QUALITATIVE
//                       statements only.
//   - CIM is POST-NDA → real business name, full address, full P&L
//                       by category, SDE bridge add-backs, method
//                       results with CSRP scores, Agent 5 narrative.
//
// A rich OM should read tighter and more confident than the lean
// OM — specific revenue ranges, real multi-year trend direction,
// and a broker valuation range callout in "AT A GLANCE" — without
// ever revealing a line item a buyer would otherwise have to sign
// the NDA to see.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { resolveModel, type BrokerLicense } from '@/lib/modelRouter'
import type {
  CimContext,
  CimListingRow,
  CimValuationRow,
  CimFinancialRow,
} from '@/lib/agents/cim-context-loader'

// ─── Back-compat (Phase 12.13 callers) ──────────────────────
// The old API route built an OmListingInput by hand. Keep the type
// exported so any caller that still constructs one by hand can
// compile, but the new route builds a CimContext instead.

export interface OmListingInput {
  id: string
  name: string | null
  industry: string | null
  asking_price_usd: number | null
  revenue_ttm_usd: number | null
  sde_ttm_usd: number | null
  ebitda_ttm_usd: number | null
  business_address?: string | null
  years_established?: number | null
  employee_count?: number | null
  broker_notes?: string | null
  generic_title?: string | null
}

export interface OmDraftResult {
  markdown: string
  model: string
  tier: string
  promptTokens: number
  completionTokens: number
  mode: 'lean' | 'rich'
}

// ─── System prompt ────────────────────────────────────────────

const OM_SYSTEM_PROMPT = `You are the OM (Offering Memorandum) Writer for CRE Resources, LLC, a business brokerage and intermediary firm led by Mark S. Mueller, CAIBVS(tm). Your job is to produce a professional, pre-NDA Offering Memorandum draft for a single business listing.

CONFIDENTIALITY RULES — follow strictly. These apply regardless of DATA MODE:
- Do NOT reveal the exact business name on the cover or in headings. Use a generic descriptive title (e.g., "Turnkey Italian Pizzeria & Bistro"). You may reference the business name internally in the "Business Description" section if the broker has flagged it appropriate, but default to the generic title.
- Do NOT include the specific street address. Use county/state only.
- Do NOT include the owner's full name.
- Do NOT include detailed P&L tables, SDE recast tables, weighted SDE calculations, CSRP scores, or method-by-method valuation methodology. Those live in the CIM and BVR.
- Do NOT include specific landlord name, detailed lease clauses (assignment, cancellation), or vendor/supplier specifics.

DATA MODE — the user message will begin with a DATA MODE declaration:
- "DATA MODE: LEAN" — no valuation is linked. Use the top-line listing facts only, and use [TBD by broker] placeholders or qualitative ranges where data is missing.
- "DATA MODE: RICH" — a valuation is linked. You will receive DERIVED, PRE-NDA-SAFE shapes: a 3-year revenue range (min–max across the period), revenue trend direction, a broker valuation range (low/mid/high), and optionally a gross margin qualitative band and Agent 5 narrative excerpts. USE THESE to produce concrete ranges and confident qualitative claims. Do NOT reproduce the underlying multi-year P&L table, do NOT list line items by category, and do NOT break out methods — those are post-NDA material.

STRUCTURE — emit a single Markdown document with exactly these H1 sections, in this order:
# Cover
# Opportunity Overview
# Business Description
# Financial Highlights
# Lease & Location Overview
# Growth Opportunities
# Ideal Buyer Profile
# Next Steps
# Contact the Listing Broker
# Disclaimer

Under each H1, use H2/H3 as needed. Bulleted lists with **bold labels** are encouraged for key-value callouts and buyer profiles. Keep paragraphs tight — 2-4 sentences.

Cover section content should include:
- A bold generic business title (NOT the real name)
- Key descriptors line (e.g., "Established 17+ Years | Absentee-Run | Full Staff in Place")
- General location (County, State)
- Asking Price, Annual Revenue, Cash Flow (SDE) as bullet points
- "Prepared by Mark S. Mueller, CAIBVS(tm) — CRE Resources, LLC"
- Month Year of preparation (use the provided date)

Opportunity Overview: 2-3 paragraph narrative, then an "AT A GLANCE" subsection with a two-column-style key-value list (Asking Price, Annual Revenue, Cash Flow/SDE, Type of Sale, Financing | Years Established, Employees, Ownership Model, Location, Lease Term), then "Key Investment Highlights" as 5-7 bullets with bold labels. In RICH mode, the "AT A GLANCE" list should also include a "**Broker Valuation Range**" bullet showing the low–high range (not mid), framed as "Broker opinion of value: $X.XM–$Y.YM (independent workpaper available post-NDA)".

Business Description: 2-paragraph general description, a key-value profile list (Business Type, Industry, Year Established, Location, Size, Employees, Hours, Revenue Channels, Type of Sale), then "Operational Strengths" as 2 paragraphs.

Financial Highlights: one intro paragraph noting detailed financials available after NDA, a "FINANCIAL SNAPSHOT" callout rendered as a bulleted list. In RICH mode, the snapshot bullets must use the provided ranges — "Annual Revenue (3-Year Range): $X.XM–$Y.YM", "Revenue Trend: {direction}", "SDE (TTM)", "SDE Multiple", "Asking Price", "What's Included". Follow with a "Revenue Trend" paragraph (use the provided trend direction and magnitude qualitatively), a "Cash Flow & Earnings" paragraph (explain SDE concept generally and reference the broker valuation range if rich), and an italic note directing readers to BVR availability after NDA. In LEAN mode, use a single-year TTM snapshot with [TBD by broker] where data is missing. NEVER produce a multi-year P&L table in this section regardless of mode.

Lease & Location Overview: one paragraph general location description, a key-value list (Location/General, Property Type, Size, Lease Term, Monthly Rent range, Lease Type, Assignment), and a brief note about Lease Abstract availability.

Growth Opportunities: one-sentence intro + 5-7 bullets with bold labels describing upside. In RICH mode, if the Agent 5 narrative supplies growth levers, pull 2-3 of them into bullets (qualitatively, not as quoted verbatim text).

Ideal Buyer Profile: brief intro + 3-4 H3 subsections (Absentee/Semi-Absentee Investor, Experienced Operator, First-Time Buyer, Strategic/Add-On Buyer) each with one paragraph.

Next Steps: brief intro + a numbered list of 4 steps (Review & Inquire, Execute NDA, Request CIM, Schedule Conversation) with short descriptions.

Contact the Listing Broker: render as a bulleted callout including:
- Mark S. Mueller, CAIBVS(tm)
- CRE Agent and Consulting | Business Broker, Intermediary and Advisor
- Certified AI-Enhanced Business Valuation Strategist
- CRE Resources, LLC
- 856.745.9706
- markm@creresources.biz
- CREresources.Biz
- *All inquiries are handled confidentially.* (italic)

Disclaimer: a single italic paragraph noting the OM is informational only, not independently verified, not an offer to sell, and detailed financials require an executed NDA.

STYLE:
- Professional, confident, buyer-facing marketing tone. Not a legal document.
- Write in a way that makes a qualified buyer want to sign the NDA.
- In RICH mode, USE the real ranges and trend direction — do not fall back to [TBD by broker] when you have the data.
- In LEAN mode, never invent specific numbers the broker didn't provide — use ranges, qualitative language, or the placeholder "[TBD by broker]" if data is missing.
- Output valid Markdown only. No HTML. No front-matter. No commentary.
`

// ─── Helpers ──────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '[TBD by broker]'
  const v = Math.round(n)
  return '$' + v.toLocaleString('en-US')
}

function fmtMoneyCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '[TBD]'
  const v = Math.round(n)
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K'
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

// ─── Rich-mode derivations (PRE-NDA-SAFE only) ────────────────

interface RichDerivations {
  revenueLow: number | null
  revenueHigh: number | null
  revenueYears: number[]
  trendDirection: 'up' | 'down' | 'flat' | 'mixed' | 'unknown'
  trendMagnitudePct: number | null // average YoY growth %
  grossMarginBand: string | null // qualitative label (e.g., "high-30s%")
  narrativeExcerpt: string | null
}

function deriveRichShapes(
  financials: CimFinancialRow[],
  valuation: CimValuationRow
): RichDerivations {
  // Revenue by year
  const revenueByYear = new Map<number, number>()
  const cogsByYear = new Map<number, number>()
  for (const r of financials) {
    if (r.category === 'revenue') {
      revenueByYear.set(
        r.fiscal_year,
        (revenueByYear.get(r.fiscal_year) ?? 0) + Number(r.amount || 0)
      )
    } else if (r.category === 'cogs') {
      cogsByYear.set(
        r.fiscal_year,
        (cogsByYear.get(r.fiscal_year) ?? 0) + Number(r.amount || 0)
      )
    }
  }

  const years = Array.from(revenueByYear.keys()).sort((a, b) => a - b)
  const revs = years.map((y) => revenueByYear.get(y) ?? 0)

  let revenueLow: number | null = null
  let revenueHigh: number | null = null
  if (revs.length > 0) {
    revenueLow = Math.min(...revs)
    revenueHigh = Math.max(...revs)
  }

  // Trend direction: look at first-to-last YoY + average YoY growth
  let trendDirection: RichDerivations['trendDirection'] = 'unknown'
  let trendMagnitudePct: number | null = null
  if (revs.length >= 2) {
    const yoyGrowths: number[] = []
    for (let i = 1; i < revs.length; i++) {
      if (revs[i - 1] > 0) {
        yoyGrowths.push((revs[i] - revs[i - 1]) / revs[i - 1])
      }
    }
    if (yoyGrowths.length > 0) {
      const avg = yoyGrowths.reduce((a, b) => a + b, 0) / yoyGrowths.length
      trendMagnitudePct = Math.round(avg * 1000) / 10 // one decimal
      // Direction: require >3% movement to call "up" or "down"
      if (avg > 0.03) trendDirection = 'up'
      else if (avg < -0.03) trendDirection = 'down'
      else trendDirection = 'flat'
      // Override to "mixed" if signs disagree materially
      const anyUp = yoyGrowths.some((g) => g > 0.03)
      const anyDown = yoyGrowths.some((g) => g < -0.03)
      if (anyUp && anyDown) trendDirection = 'mixed'
    }
  }

  // Gross margin band (qualitative). Use latest year where we have both revenue + cogs.
  let grossMarginBand: string | null = null
  for (let i = years.length - 1; i >= 0; i--) {
    const y = years[i]
    const rev = revenueByYear.get(y) ?? 0
    const cogs = cogsByYear.get(y) ?? 0
    if (rev > 0 && cogs >= 0) {
      const gm = (rev - cogs) / rev
      if (!Number.isFinite(gm)) break
      const pct = Math.round(gm * 100)
      // Produce a qualitative band, NOT the exact percentage — this is pre-NDA.
      if (pct >= 70) grossMarginBand = 'very strong (70%+)'
      else if (pct >= 60) grossMarginBand = 'strong (60s%)'
      else if (pct >= 50) grossMarginBand = 'healthy (50s%)'
      else if (pct >= 40) grossMarginBand = 'healthy (40s%)'
      else if (pct >= 30) grossMarginBand = 'moderate (30s%)'
      else if (pct >= 20) grossMarginBand = 'moderate (20s%)'
      else if (pct > 0) grossMarginBand = 'thin (<20%)'
      break
    }
  }

  // Narrative excerpt — compact teaser, not the whole JSON
  let narrativeExcerpt: string | null = null
  const n = valuation.agent5_narrative
  if (n && typeof n === 'object') {
    const candidates = ['executive_summary', 'highlights', 'growth_opportunities', 'summary']
    const pick = candidates
      .map((k) => (n as Record<string, unknown>)[k])
      .find((v) => typeof v === 'string' && v.length > 0) as string | undefined
    if (pick) {
      narrativeExcerpt = pick.length > 1200 ? pick.slice(0, 1200) + '…' : pick
    }
  }

  return {
    revenueLow,
    revenueHigh,
    revenueYears: years,
    trendDirection,
    trendMagnitudePct,
    grossMarginBand,
    narrativeExcerpt,
  }
}

function trendLabel(d: RichDerivations): string {
  const { trendDirection, trendMagnitudePct } = d
  const pctLabel =
    trendMagnitudePct === null
      ? ''
      : ` (avg ${trendMagnitudePct >= 0 ? '+' : ''}${trendMagnitudePct.toFixed(1)}% YoY)`
  switch (trendDirection) {
    case 'up':
      return 'growing' + pctLabel
    case 'down':
      return 'declining' + pctLabel
    case 'flat':
      return 'stable' + pctLabel
    case 'mixed':
      return 'mixed year-over-year' + pctLabel
    default:
      return '[TBD]'
  }
}

// ─── User-context builders ───────────────────────────────────

export function buildLeanUserContext(listing: CimListingRow): string {
  return [
    `DATA MODE: LEAN`,
    ``,
    `LISTING FACTS (use these; do not invent others):`,
    `- Internal business name (DO NOT publish verbatim): ${listing.name ?? '[TBD]'}`,
    `- Industry: ${listing.industry ?? '[TBD]'}`,
    `- Asking Price: ${fmtMoney(listing.asking_price_usd)}`,
    `- Annual Revenue (TTM): ${fmtMoney(listing.revenue_ttm_usd)}`,
    `- Cash Flow / SDE (TTM): ${fmtMoney(listing.sde_ttm_usd)}`,
    `- EBITDA (TTM): ${fmtMoney(listing.ebitda_ttm_usd)}`,
    `- SDE Multiple: ${sdeMultipleLabel(listing)}`,
    `- Years Established: ${fmtNumber(listing.years_established)}`,
    `- Employees: ${fmtNumber(listing.employee_count)}`,
    `- General Location (DO NOT publish street address — infer county/state): ${listing.business_address ?? '[TBD by broker]'}`,
    ``,
    `BROKER NOTES:`,
    listing.broker_notes ?? '(none provided)',
    ``,
    `PREPARATION DATE: ${todayMonthYear()}`,
    ``,
    `NOTE: No valuation is linked to this listing. Produce the OM using the top-line TTM facts above. Use qualitative ranges and [TBD by broker] for anything the listing facts don't supply. Do NOT produce a multi-year P&L table — the OM is pre-NDA.`,
    ``,
    `Generate the full Offering Memorandum markdown now.`,
  ].join('\n')
}

export function buildRichUserContext(ctx: {
  listing: CimListingRow
  valuation: CimValuationRow
  financials: CimFinancialRow[]
}): string {
  const { listing, valuation, financials } = ctx
  const derived = deriveRichShapes(financials, valuation)

  const revenueRangeLine =
    derived.revenueLow !== null && derived.revenueHigh !== null && derived.revenueYears.length > 0
      ? `${fmtMoneyCompact(derived.revenueLow)}–${fmtMoneyCompact(derived.revenueHigh)} across FY${derived.revenueYears[0]}–FY${derived.revenueYears[derived.revenueYears.length - 1]}`
      : '[TBD by broker]'

  const valuationRangeLine =
    valuation.valuation_low && valuation.valuation_high
      ? `${fmtMoneyCompact(valuation.valuation_low)}–${fmtMoneyCompact(valuation.valuation_high)} (mid: ${fmtMoneyCompact(valuation.valuation_mid)})`
      : '[TBD]'

  return [
    `DATA MODE: RICH`,
    ``,
    `LISTING FACTS (headline figures — safe to reference on cover & AT A GLANCE):`,
    `- Internal business name (DO NOT publish verbatim — use a generic descriptor): ${listing.name ?? valuation.business_name ?? '[TBD]'}`,
    `- Industry: ${listing.industry ?? valuation.industry ?? '[TBD]'}`,
    `- Asking Price: ${fmtMoney(listing.asking_price_usd)}`,
    `- Annual Revenue (TTM): ${fmtMoney(listing.revenue_ttm_usd)}`,
    `- Cash Flow / SDE (TTM): ${fmtMoney(listing.sde_ttm_usd)}`,
    `- EBITDA (TTM): ${fmtMoney(listing.ebitda_ttm_usd)}`,
    `- SDE Multiple: ${sdeMultipleLabel(listing)}`,
    `- Years Established: ${fmtNumber(listing.years_established ?? valuation.years_in_operation)}`,
    `- Employees: ${fmtNumber(listing.employee_count ?? valuation.num_employees)}`,
    `- General Location (DO NOT publish street address — infer county/state): ${listing.business_address ?? valuation.business_address ?? '[TBD by broker]'}`,
    ``,
    `DERIVED PRE-NDA-SAFE RICH SHAPES (use these for the OM — do NOT reproduce the underlying P&L):`,
    `- 3-Year Revenue Range: ${revenueRangeLine}`,
    `- Revenue Trend: ${trendLabel(derived)}`,
    `- Gross Margin Band (qualitative): ${derived.grossMarginBand ?? '[TBD]'}`,
    `- Broker Valuation Range (low–high, mid): ${valuationRangeLine}`,
    `- Valuation Date: ${valuation.valuation_date ?? '[TBD]'}`,
    `- Valuation Status: ${valuation.status}`,
    ``,
    `AGENT 5 NARRATIVE EXCERPT (optional context — quote qualitatively, not verbatim):`,
    derived.narrativeExcerpt ?? '(no narrative excerpt available)',
    ``,
    `BROKER NOTES:`,
    listing.broker_notes ?? '(none provided beyond the valuation context)',
    ``,
    `PREPARATION DATE: ${todayMonthYear()}`,
    ``,
    `CONFIDENTIALITY REMINDER: this is a PRE-NDA document. You have a linked valuation, so you have real ranges and a trend direction to work with — USE them. But DO NOT reproduce the multi-year P&L table, the SDE bridge / recast, the method-by-method valuation methodology, or any CSRP scoring. Those stay in the CIM/BVR which is post-NDA material. The "Broker Valuation Range" bullet in AT A GLANCE is the only valuation figure allowed in the OM.`,
    ``,
    `Generate the full Offering Memorandum markdown now.`,
  ].join('\n')
}

// ─── Public entry point ──────────────────────────────────────

export async function generateOmDraft(
  context: CimContext,
  brokerLicense: BrokerLicense = 'premium'
): Promise<OmDraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      '[agent-om-draft] ANTHROPIC_API_KEY is not set. Add it to .env.local.'
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
      ? buildRichUserContext({
          listing: context.listing,
          valuation: context.valuation,
          financials: context.financials,
        })
      : buildLeanUserContext(context.listing)

  // OM is a shorter document than the CIM — but rich mode still benefits
  // from a bit more headroom for the extended Growth Opportunities section
  // and AT A GLANCE callout.
  const maxTokens = context.mode === 'rich' ? 10000 : 8000

  const response = await anthropic.messages.create({
    model: routing.model,
    max_tokens: maxTokens,
    temperature: 0.4,
    system: OM_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContext }],
  })

  const firstBlock = response.content[0]
  const markdown =
    firstBlock && firstBlock.type === 'text' ? firstBlock.text : ''
  if (!markdown.trim()) {
    throw new Error('[agent-om-draft] Model returned empty OM markdown.')
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
