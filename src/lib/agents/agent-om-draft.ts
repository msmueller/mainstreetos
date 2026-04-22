// ============================================================
// MainStreetOS — OM (Offering Memorandum) Draft Agent (Phase 12.13)
// ------------------------------------------------------------
// Produces a pre-NDA OM markdown draft for a seller_listing using
// Claude (Sonnet via resolveModel({task: 'doc.draft'})).
// Output is markdown text suitable for Notion. No PDF, no DOCX.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { resolveModel, type BrokerLicense } from '@/lib/modelRouter'

// ─── Input shape ──────────────────────────────────────────────

export interface OmListingInput {
  id: string
  name: string | null                // e.g. "Bella's Italian Kitchen" (used for prompt context, NOT cover page)
  industry: string | null            // e.g. "Restaurant"
  asking_price_usd: number | null
  revenue_ttm_usd: number | null
  sde_ttm_usd: number | null
  ebitda_ttm_usd: number | null
  business_address?: string | null   // NOT rendered — used only for general location
  years_established?: number | null
  employee_count?: number | null
  // Optional free-form broker notes: growth levers, reason for sale, staffing, etc.
  broker_notes?: string | null
  // Optional generic title override (e.g., "Turnkey Italian Pizzeria & Bistro")
  generic_title?: string | null
}

export interface OmDraftResult {
  markdown: string
  model: string
  tier: string
  promptTokens: number
  completionTokens: number
}

// ─── System prompt ────────────────────────────────────────────

const OM_SYSTEM_PROMPT = `You are the OM (Offering Memorandum) Writer for CRE Resources, LLC, a business brokerage and intermediary firm led by Mark S. Mueller, CAIBVS(tm). Your job is to produce a professional, pre-NDA Offering Memorandum draft for a single business listing.

CONFIDENTIALITY RULES — follow strictly:
- Do NOT reveal the exact business name on the cover or in headings. Use a generic descriptive title (e.g., "Turnkey Italian Pizzeria & Bistro"). You may reference the business name internally in the "Business Description" section if the broker has flagged it appropriate, but default to the generic title.
- Do NOT include the specific street address. Use county/state only.
- Do NOT include the owner's full name.
- Do NOT include detailed P&L tables, SDE recast tables, weighted SDE calculations, or valuation methodology (Cap Rate, CSRP, DCF). Those live in the CIM and BVR.
- Do NOT include specific landlord name, detailed lease clauses (assignment, cancellation), or vendor/supplier specifics.

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

Opportunity Overview: 2-3 paragraph narrative, then an "AT A GLANCE" subsection with a two-column-style key-value list (Asking Price, Annual Revenue, Cash Flow/SDE, Type of Sale, Financing | Years Established, Employees, Ownership Model, Location, Lease Term), then "Key Investment Highlights" as 5-7 bullets with bold labels.

Business Description: 2-paragraph general description, a key-value profile list (Business Type, Industry, Year Established, Location, Size, Employees, Hours, Revenue Channels, Type of Sale), then "Operational Strengths" as 2 paragraphs.

Financial Highlights: one intro paragraph noting detailed financials available after NDA, a "FINANCIAL SNAPSHOT" callout rendered as a bulleted list (Annual Revenue range 3-year, Gross Margin range, SDE, SDE Multiple, Asking Price, What's Included), a "Revenue Trend" paragraph (general), a "Cash Flow & Earnings" paragraph (explain SDE concept generally), and an italic note directing readers to BVR availability after NDA.

Lease & Location Overview: one paragraph general location description, a key-value list (Location/General, Property Type, Size, Lease Term, Monthly Rent range, Lease Type, Assignment), and a brief note about Lease Abstract availability.

Growth Opportunities: one-sentence intro + 5-7 bullets with bold labels describing upside.

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
- Never invent specific numbers the broker didn't provide — use ranges, qualitative language, or the placeholder "[TBD by broker]" if data is missing.
- Output valid Markdown only. No HTML. No front-matter. No commentary.
`

// ─── Helpers ──────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '[TBD by broker]'
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

export function buildUserContext(listing: OmListingInput): string {
  const sdeMultiple =
    listing.asking_price_usd && listing.sde_ttm_usd && listing.sde_ttm_usd > 0
      ? (listing.asking_price_usd / listing.sde_ttm_usd).toFixed(2) + 'x'
      : '[TBD by broker]'

  return [
    `LISTING FACTS (use these; do not invent others):`,
    `- Internal business name: ${listing.name ?? '[TBD]'}`,
    `- Generic title to use on cover: ${listing.generic_title ?? `(broker did not provide — coin a suitable one from industry="${listing.industry ?? 'Business'}")`}`,
    `- Industry: ${listing.industry ?? '[TBD]'}`,
    `- Asking Price: ${fmtMoney(listing.asking_price_usd)}`,
    `- Annual Revenue (TTM): ${fmtMoney(listing.revenue_ttm_usd)}`,
    `- Cash Flow / SDE (TTM): ${fmtMoney(listing.sde_ttm_usd)}`,
    `- EBITDA (TTM): ${fmtMoney(listing.ebitda_ttm_usd)}`,
    `- SDE Multiple: ${sdeMultiple}`,
    `- Years Established: ${fmtNumber(listing.years_established)}`,
    `- Employees: ${fmtNumber(listing.employee_count)}`,
    `- General Location: ${listing.business_address ? '(broker will redact to county/state — infer county/state if possible from: "' + listing.business_address + '")' : '[TBD by broker]'}`,
    ``,
    `BROKER NOTES:`,
    listing.broker_notes ?? '(none provided)',
    ``,
    `PREPARATION DATE: ${todayMonthYear()}`,
    ``,
    `Generate the full Offering Memorandum markdown now.`,
  ].join('\n')
}

// ─── Public entry point ──────────────────────────────────────

export async function generateOmDraft(
  listing: OmListingInput,
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
    dealSizeUsd: listing.asking_price_usd ?? undefined,
  })

  const userContext = buildUserContext(listing)

  const response = await anthropic.messages.create({
    model: routing.model,
    max_tokens: 8000,
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
  }
}
