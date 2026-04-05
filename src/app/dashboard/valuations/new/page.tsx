'use client'

import { useState, useMemo } from 'react'
import { createValuation } from '../actions'
import type { FinancialCategory } from '@/lib/types'

// ═══════════════════════════════════════════════════════════════
// P&L LINE ITEM STRUCTURE (mirrors Deal Workbook)
// ═══════════════════════════════════════════════════════════════

interface LineItem {
  id: string
  fiscal_year: number
  category: FinancialCategory
  line_item: string
  amount: string
  section: 'revenue' | 'cogs' | 'opex' | 'other' | 'sde_addback'
}

const OPEX_DEFAULTS = [
  'Salaries & Wages',
  'Rent & Occupancy',
  'Utilities',
  'Employee Benefits',
  'Insurance',
  'Payroll Taxes',
  'Professional Fees',
  'Advertising & Promotion',
  'Repairs & Maintenance',
  'Credit Card Fees',
  'Telephone/Internet',
  'Delivery/Vehicle',
  'Licenses & Permits',
  'Office/Supplies/Other',
]

const SDE_ADDBACK_DEFAULTS = [
  { item: 'Owner Compensation', hint: 'Salary, draws, management fees' },
  { item: 'Owner Benefits/Perks', hint: 'Health insurance, auto, phone, meals' },
  { item: 'Depreciation & Amortization', hint: 'Non-cash expense add-back' },
  { item: 'Interest Expense', hint: 'Debt service add-back' },
  { item: 'Non-Recurring Expenses', hint: 'One-time costs, legal settlements, ERC fees' },
  { item: 'Above-Market Rent Add-Back', hint: 'If owner owns property, difference vs. market' },
]

function defaultLines(year: number): LineItem[] {
  return [
    { id: crypto.randomUUID(), fiscal_year: year, category: 'revenue', line_item: 'Gross Revenue', amount: '', section: 'revenue' },
    { id: crypto.randomUUID(), fiscal_year: year, category: 'cogs', line_item: 'Cost of Goods Sold', amount: '', section: 'cogs' },
    ...OPEX_DEFAULTS.map(item => ({
      id: crypto.randomUUID(), fiscal_year: year, category: 'operating_expense' as FinancialCategory,
      line_item: item, amount: '', section: 'opex' as const,
    })),
    { id: crypto.randomUUID(), fiscal_year: year, category: 'non_operating', line_item: 'Other Income (Non-Operating)', amount: '', section: 'other' },
    ...SDE_ADDBACK_DEFAULTS.map(({ item }) => ({
      id: crypto.randomUUID(), fiscal_year: year, category: 'sde_addback' as FinancialCategory,
      line_item: item, amount: '', section: 'sde_addback' as const,
    })),
  ]
}

// ═══════════════════════════════════════════════════════════════
// RISK FACTOR DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface RiskFactor {
  key: string
  label: string
  group: string
  weight: number
  score: number
  low_label: string
  high_label: string
}

const DEFAULT_RISK_FACTORS: RiskFactor[] = [
  { key: 'industry_stability', label: 'Industry Stability', group: 'Business & Industry', weight: 0.08, score: 3, low_label: 'Stable/Essential', high_label: 'Volatile/Declining' },
  { key: 'competitive_position', label: 'Competitive Position', group: 'Business & Industry', weight: 0.08, score: 3, low_label: 'Strong moat', high_label: 'Highly competitive' },
  { key: 'customer_concentration', label: 'Customer Concentration', group: 'Business & Industry', weight: 0.06, score: 3, low_label: 'Diversified', high_label: 'Few customers' },
  { key: 'supplier_dependence', label: 'Supplier Dependence', group: 'Business & Industry', weight: 0.05, score: 3, low_label: 'Multiple options', high_label: 'Single source' },
  { key: 'regulatory_environment', label: 'Regulatory Environment', group: 'Business & Industry', weight: 0.04, score: 3, low_label: 'Minimal regulation', high_label: 'Heavy regulation' },
  { key: 'revenue_trend', label: 'Revenue Trend (3-Year)', group: 'Financial', weight: 0.08, score: 3, low_label: 'Strong growth', high_label: 'Declining' },
  { key: 'profit_margin_stability', label: 'Profit Margin Stability', group: 'Financial', weight: 0.08, score: 3, low_label: 'Consistent', high_label: 'Highly variable' },
  { key: 'working_capital', label: 'Working Capital Position', group: 'Financial', weight: 0.05, score: 3, low_label: 'Strong', high_label: 'Weak/Negative' },
  { key: 'debt_level', label: 'Debt Level', group: 'Financial', weight: 0.04, score: 3, low_label: 'Debt-free', high_label: 'Highly leveraged' },
  { key: 'financial_records_quality', label: 'Financial Records Quality', group: 'Financial', weight: 0.05, score: 3, low_label: 'Audited', high_label: 'Poor records' },
  { key: 'owner_dependence', label: 'Owner Dependence', group: 'Operational', weight: 0.10, score: 3, low_label: 'Not dependent', high_label: 'Owner IS the business' },
  { key: 'key_employee_risk', label: 'Key Employee Risk', group: 'Operational', weight: 0.06, score: 3, low_label: 'Deep bench', high_label: 'Critical people risk' },
  { key: 'systems_processes', label: 'Systems & Processes', group: 'Operational', weight: 0.05, score: 3, low_label: 'Well documented', high_label: 'Tribal knowledge' },
  { key: 'facility_equipment', label: 'Facility/Equipment Condition', group: 'Operational', weight: 0.05, score: 3, low_label: 'Excellent', high_label: 'Needs major CapEx' },
  { key: 'lease_position', label: 'Lease Position', group: 'Operational', weight: 0.05, score: 3, low_label: 'Long-term/favorable', high_label: 'Expiring/unfavorable' },
]

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function NewValuationPage() {
  const currentYear = new Date().getFullYear()
  const [years, setYears] = useState<number[]>([currentYear - 1])
  const [activeYear, setActiveYear] = useState(currentYear - 1)
  const [lines, setLines] = useState<LineItem[]>(defaultLines(currentYear - 1))
  const [weightingMethod, setWeightingMethod] = useState('linear_recent')
  const [ownerCompInOpex, setOwnerCompInOpex] = useState(false)
  const [activeTab, setActiveTab] = useState<'financials' | 'risk'>('financials')

  // Risk factors state
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>(DEFAULT_RISK_FACTORS)
  const [riskFreeRate, setRiskFreeRate] = useState(0.045)
  const [equityRiskPremium, setEquityRiskPremium] = useState(0.065)
  const [sizePremium, setSizePremium] = useState(0.055)
  const [growthRate, setGrowthRate] = useState(0.02)

  // ── Year management ──
  function addYear() {
    const minYear = Math.min(...years)
    const newYear = minYear - 1
    setYears(prev => [...prev, newYear].sort())
    setLines(prev => [...prev, ...defaultLines(newYear)])
    setActiveYear(newYear)
  }
  function removeYear(year: number) {
    if (years.length <= 1) return
    setYears(prev => prev.filter(y => y !== year))
    setLines(prev => prev.filter(l => l.fiscal_year !== year))
    if (activeYear === year) setActiveYear(years.filter(y => y !== year)[0])
  }
  function addLine(section: LineItem['section'], category: FinancialCategory) {
    setLines(prev => [...prev, {
      id: crypto.randomUUID(), fiscal_year: activeYear, category,
      line_item: '', amount: '', section,
    }])
  }
  function removeLine(id: string) { setLines(prev => prev.filter(l => l.id !== id)) }
  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }
  function updateRiskScore(key: string, score: number) {
    setRiskFactors(prev => prev.map(f => f.key === key ? { ...f, score } : f))
  }

  const activeLines = lines.filter(l => l.fiscal_year === activeYear)

  // ── Auto-computed subtotals ──
  const subtotals = useMemo(() => {
    const amt = (section: string) => activeLines
      .filter(l => l.section === section)
      .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
    const revenue = amt('revenue')
    const cogs = amt('cogs')
    const grossProfit = revenue - cogs
    const opex = amt('opex')
    const noi = grossProfit - opex
    const addbacks = amt('sde_addback')
    const sde = noi + addbacks
    return { revenue, cogs, grossProfit, opex, noi, addbacks, sde }
  }, [activeLines])

  // ── Risk computation ──
  const riskComputed = useMemo(() => {
    const weightedScore = riskFactors.reduce((s, f) => s + (f.score * f.weight), 0)
    const csrp = weightedScore * 0.05 // Convert 1-5 score to risk premium %
    const discountRate = riskFreeRate + equityRiskPremium + sizePremium + csrp
    const capRate = discountRate - growthRate
    return { weightedScore, csrp, discountRate, capRate }
  }, [riskFactors, riskFreeRate, equityRiskPremium, sizePremium, growthRate])

  // ── Weighting scheme ──
  const schemes: Record<number, number[]> = {
    1: [100], 2: [60, 40], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [35, 25, 20, 12, 8],
  }
  const sortedYears = [...years].sort((a, b) => b - a)
  const scheme = schemes[Math.min(years.length, 5)] || schemes[5]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">New Valuation</h2>
        <p className="text-slate-500 mt-1">Full recast P&L with SDE normalization, multi-year weighted averages, and risk-adjusted discount rates.</p>
      </div>

      <form action={createValuation}>
        {/* Business Info (compact) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Business Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <input name="business_name" required placeholder="Business Name *" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <input name="industry" placeholder="Industry" className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input name="location" placeholder="Location" className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input name="sic_code" placeholder="SIC Code" className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input name="naics_code" placeholder="NAICS Code" className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input name="annual_revenue" type="number" step="0.01" placeholder="Annual Revenue ($)" className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <div className="flex items-center gap-2">
              <select name="weighting_method" value={weightingMethod} onChange={e => setWeightingMethod(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="linear_recent">Linear Recent Weight</option>
                <option value="equal">Equal Weight</option>
              </select>
            </div>
            <div className="col-span-2 md:col-span-4">
              <textarea name="business_description" rows={2} placeholder="Business description (optional)" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3">
            <input type="checkbox" name="owner_comp_in_opex" checked={ownerCompInOpex} onChange={e => setOwnerCompInOpex(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600" />
            <span className="text-sm text-slate-600">Owner comp is included in Operating Expenses (prevents double-count)</span>
          </label>
        </div>

        {/* Tab selector: Financials vs Risk Analysis */}
        <div className="flex gap-1 mb-4">
          <button type="button" onClick={() => setActiveTab('financials')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'financials' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            📊 Historical Financials
          </button>
          <button type="button" onClick={() => setActiveTab('risk')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'risk' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            ⚠️ Risk Analysis
          </button>
        </div>

        {/* ═══════════════ FINANCIALS TAB ═══════════════ */}
        {activeTab === 'financials' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
            {/* Year tabs */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1">
                {sortedYears.map((year, i) => (
                  <button key={year} type="button" onClick={() => setActiveYear(year)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${activeYear === year ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                    FY{year}
                    {years.length > 1 && <span className="text-xs ml-1 opacity-60">{weightingMethod === 'equal' ? Math.round(100 / years.length) : scheme[i]}%</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {years.length > 1 && (
                  <button type="button" onClick={() => removeYear(activeYear)} className="text-xs text-red-500 hover:text-red-600">Remove FY{activeYear}</button>
                )}
                {years.length < 5 && (
                  <button type="button" onClick={addYear} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Year</button>
                )}
              </div>
            </div>

            {/* ── REVENUE & COGS ── */}
            <SectionHeader title="Revenue & Cost of Goods Sold" />
            {activeLines.filter(l => l.section === 'revenue' || l.section === 'cogs').map(line => (
              <LineRow key={line.id} line={line} onUpdate={updateLine} onRemove={removeLine} />
            ))}
            <SubtotalRow label="Gross Profit" value={subtotals.grossProfit} color={subtotals.grossProfit >= 0 ? 'green' : 'red'} />

            {/* ── OPERATING EXPENSES ── */}
            <SectionHeader title="Operating Expenses" />
            {activeLines.filter(l => l.section === 'opex').map(line => (
              <LineRow key={line.id} line={line} onUpdate={updateLine} onRemove={removeLine} />
            ))}
            <button type="button" onClick={() => addLine('opex', 'operating_expense')} className="text-xs text-blue-600 hover:text-blue-700 mt-1">+ Add OpEx Line</button>
            <SubtotalRow label="Total Operating Expenses" value={subtotals.opex} color="slate" />
            <SubtotalRow label="Net Operating Income" value={subtotals.noi} color={subtotals.noi >= 0 ? 'green' : 'red'} bold />

            {/* ── SDE NORMALIZATION ADD-BACKS ── */}
            <SectionHeader title="SDE Normalization Add-Backs" subtitle="Items added back to NOI to calculate Seller's Discretionary Earnings" />
            {activeLines.filter(l => l.section === 'sde_addback').map(line => (
              <LineRow key={line.id} line={line} onUpdate={updateLine} onRemove={removeLine} />
            ))}
            <button type="button" onClick={() => addLine('sde_addback', 'sde_addback')} className="text-xs text-blue-600 hover:text-blue-700 mt-1">+ Add SDE Add-Back</button>
            <SubtotalRow label="Total Add-Backs" value={subtotals.addbacks} color="blue" />

            <div className="mt-3 pt-3 border-t-2 border-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">Normalized SDE</span>
                <span className={`text-base font-bold ${subtotals.sde >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  ${subtotals.sde.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Hidden inputs for non-active years */}
            {lines.filter(l => l.fiscal_year !== activeYear && l.amount !== '').map(line => (
              <div key={line.id} style={{ display: 'none' }}>
                <input type="hidden" name="fiscal_year" value={line.fiscal_year} />
                <input type="hidden" name="category" value={line.category} />
                <input type="hidden" name="line_item" value={line.line_item} />
                <input type="hidden" name="amount" value={line.amount} />
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════ RISK ANALYSIS TAB ═══════════════ */}
        {activeTab === 'risk' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Risk Analysis & Discount Rate Build-Up</h3>
            <p className="text-sm text-slate-500 mb-4">Score each factor 1 (lowest risk) to 5 (highest risk). The weighted score feeds directly into the discount rate for DCF and Cap of Earnings methods.</p>

            {/* Build-up base rates */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-3 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Risk-Free Rate</label>
                <input type="number" step="0.001" value={riskFreeRate} onChange={e => setRiskFreeRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="hidden" name="risk_free_rate" value={riskFreeRate} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Equity Risk Premium</label>
                <input type="number" step="0.001" value={equityRiskPremium} onChange={e => setEquityRiskPremium(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="hidden" name="equity_risk_premium" value={equityRiskPremium} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Size Premium</label>
                <input type="number" step="0.001" value={sizePremium} onChange={e => setSizePremium(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="hidden" name="size_premium" value={sizePremium} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Long-Term Growth Rate</label>
                <input type="number" step="0.001" value={growthRate} onChange={e => setGrowthRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="hidden" name="long_term_growth_rate" value={growthRate} />
              </div>
            </div>

            {/* Risk factor scoring */}
            {['Business & Industry', 'Financial', 'Operational'].map(group => (
              <div key={group} className="mb-4">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">{group} Risk</h4>
                {riskFactors.filter(f => f.group === group).map(factor => (
                  <div key={factor.key} className="flex items-center gap-3 py-2 border-b border-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">{factor.label}</p>
                      <p className="text-xs text-slate-400">{factor.low_label} → {factor.high_label}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(score => (
                        <button key={score} type="button" onClick={() => updateRiskScore(factor.key, score)}
                          className={`w-8 h-8 rounded text-xs font-medium transition ${
                            factor.score === score
                              ? score <= 2 ? 'bg-green-500 text-white' : score === 3 ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                          {score}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{(factor.weight * 100).toFixed(0)}%</span>
                    <input type="hidden" name={`risk_${factor.key}_score`} value={factor.score} />
                    <input type="hidden" name={`risk_${factor.key}_weight`} value={factor.weight} />
                  </div>
                ))}
              </div>
            ))}

            {/* Computed rates */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">Weighted Risk Score</p>
                  <p className="text-lg font-bold text-slate-900">{riskComputed.weightedScore.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">CSRP Premium</p>
                  <p className="text-lg font-bold text-slate-900">{(riskComputed.csrp * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Discount Rate</p>
                  <p className="text-lg font-bold text-blue-700">{(riskComputed.discountRate * 100).toFixed(1)}%</p>
                  <input type="hidden" name="computed_discount_rate" value={riskComputed.discountRate} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Capitalization Rate</p>
                  <p className="text-lg font-bold text-blue-700">{(riskComputed.capRate * 100).toFixed(1)}%</p>
                  <input type="hidden" name="computed_cap_rate" value={riskComputed.capRate} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between">
          <a href="/dashboard/valuations" className="px-4 py-2.5 text-sm text-slate-600">Cancel</a>
          <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            Create Valuation
          </button>
        </div>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mt-4 mb-2 pt-3 border-t border-slate-200 first:border-0 first:pt-0 first:mt-0">
      <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{title}</h4>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  )
}

function LineRow({ line, onUpdate, onRemove }: {
  line: LineItem
  onUpdate: (id: string, field: keyof LineItem, value: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <input type="hidden" name="fiscal_year" value={line.fiscal_year} />
      <input type="hidden" name="category" value={line.category} />
      <input name="line_item" value={line.line_item} onChange={e => onUpdate(line.id, 'line_item', e.target.value)}
        className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder="Line item description" />
      <input name="amount" type="number" step="0.01" value={line.amount} onChange={e => onUpdate(line.id, 'amount', e.target.value)}
        className="w-32 px-2 py-1.5 rounded border border-slate-200 text-sm text-right focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder="0" />
      <button type="button" onClick={() => onRemove(line.id)} className="text-slate-300 hover:text-red-500 text-sm px-1">&times;</button>
    </div>
  )
}

function SubtotalRow({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  const colorClass = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-600' : color === 'blue' ? 'text-blue-700' : 'text-slate-700'
  return (
    <div className={`flex items-center justify-between py-1.5 px-2 ${bold ? 'bg-slate-50 rounded mt-1' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold' : ''} text-slate-600`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold' : 'font-medium'} ${colorClass}`}>
        ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </span>
    </div>
  )
}
