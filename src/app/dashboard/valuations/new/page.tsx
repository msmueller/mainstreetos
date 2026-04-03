'use client'

import { useState } from 'react'
import { createValuation } from '../actions'
import type { FinancialCategory } from '@/lib/types'

const CATEGORIES: { value: FinancialCategory; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'cogs', label: 'Cost of Goods Sold' },
  { value: 'operating_expense', label: 'Operating Expense' },
  { value: 'owner_compensation', label: 'Owner Compensation' },
  { value: 'depreciation', label: 'Depreciation' },
  { value: 'amortization', label: 'Amortization' },
  { value: 'interest', label: 'Interest' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'non_operating', label: 'Non-Operating' },
]

const DEFAULT_LINES = (year: number) => [
  { id: crypto.randomUUID(), fiscal_year: year, category: 'revenue' as FinancialCategory, line_item: 'Gross Revenue', amount: '' },
  { id: crypto.randomUUID(), fiscal_year: year, category: 'cogs' as FinancialCategory, line_item: 'Cost of Goods Sold', amount: '' },
  { id: crypto.randomUUID(), fiscal_year: year, category: 'owner_compensation' as FinancialCategory, line_item: 'Owner Salary', amount: '' },
  { id: crypto.randomUUID(), fiscal_year: year, category: 'operating_expense' as FinancialCategory, line_item: 'Total Operating Expenses', amount: '' },
  { id: crypto.randomUUID(), fiscal_year: year, category: 'depreciation' as FinancialCategory, line_item: 'Depreciation', amount: '' },
  { id: crypto.randomUUID(), fiscal_year: year, category: 'interest' as FinancialCategory, line_item: 'Interest Expense', amount: '' },
]

interface LineItem {
  id: string
  fiscal_year: number
  category: FinancialCategory
  line_item: string
  amount: string
}

export default function NewValuationPage() {
  const currentYear = new Date().getFullYear()

  // Multi-year state
  const [years, setYears] = useState<number[]>([currentYear - 1])
  const [activeYear, setActiveYear] = useState(currentYear - 1)
  const [lines, setLines] = useState<LineItem[]>(DEFAULT_LINES(currentYear - 1))
  const [weightingMethod, setWeightingMethod] = useState('linear_recent')
  const [ownerCompInOpex, setOwnerCompInOpex] = useState(false)

  function addYear() {
    const minYear = Math.min(...years)
    const newYear = minYear - 1
    setYears(prev => [...prev, newYear].sort())
    setLines(prev => [...prev, ...DEFAULT_LINES(newYear)])
    setActiveYear(newYear)
  }

  function removeYear(year: number) {
    if (years.length <= 1) return
    setYears(prev => prev.filter(y => y !== year))
    setLines(prev => prev.filter(l => l.fiscal_year !== year))
    if (activeYear === year) setActiveYear(years.filter(y => y !== year)[0])
  }

  function addLine() {
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      fiscal_year: activeYear,
      category: 'operating_expense',
      line_item: '',
      amount: '',
    }])
  }

  function removeLine(id: string) {
    setLines(prev => prev.filter(l => l.id !== id))
  }

  function updateLine(id: string, field: keyof LineItem, value: string | number) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const activeLines = lines.filter(l => l.fiscal_year === activeYear)

  // Standard weighting preview
  const schemes: Record<number, number[]> = {
    1: [100], 2: [60, 40], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [35, 25, 20, 12, 8],
  }
  const sortedYears = [...years].sort((a, b) => b - a)
  const scheme = schemes[Math.min(years.length, 5)] || schemes[5]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">New Valuation</h2>
        <p className="text-slate-500 mt-1">
          Enter business details and 1–5 years of historical financial data. Our AI agents will analyze trends and produce a multi-method valuation.
        </p>
      </div>

      <form action={createValuation}>
        {/* Business Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Business Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input name="business_name" required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., La Guardiola Pizzeria" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
              <input name="industry" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., Restaurant / Food Service" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input name="location" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., Bayonne, NJ" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SIC Code</label>
              <input name="sic_code" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., 5812" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NAICS Code</label>
              <input name="naics_code" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., 722511" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Annual Revenue (Most Recent Year)</label>
              <input name="annual_revenue" type="number" step="0.01"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., 750000" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Description</label>
              <textarea name="business_description" rows={3}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Brief description of the business, operations, and key characteristics..." />
            </div>
          </div>
        </div>

        {/* Valuation Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Valuation Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Year Weighting Method</label>
              <select name="weighting_method" value={weightingMethod} onChange={e => setWeightingMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="linear_recent">Linear Recent (recommended) — more weight to recent years</option>
                <option value="equal">Equal Weight — all years count the same</option>
              </select>
              {years.length > 1 && (
                <div className="mt-2 text-xs text-slate-400">
                  Weights: {sortedYears.map((y, i) => (
                    <span key={y}>FY{y}: {weightingMethod === 'equal' ? Math.round(100 / years.length) : scheme[i]}%{i < sortedYears.length - 1 ? ' · ' : ''}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-3 cursor-pointer mt-6">
                <input type="checkbox" name="owner_comp_in_opex" checked={ownerCompInOpex}
                  onChange={e => setOwnerCompInOpex(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <div>
                  <span className="text-sm font-medium text-slate-700">Owner compensation is included in Operating Expenses</span>
                  <p className="text-xs text-slate-400 mt-0.5">Check this if your OpEx already includes the owner&apos;s salary to prevent double-counting in SDE.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Multi-Year Financial Data */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Historical Financial Data</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Enter recast P&L data for each year. {years.length === 1 ? 'Add more years for a weighted average.' : `${years.length} years entered — agent will compute weighted average.`}
              </p>
            </div>
            {years.length < 5 && (
              <button type="button" onClick={addYear}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition">
                + Add Prior Year
              </button>
            )}
          </div>

          {/* Year Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
            {[...years].sort((a, b) => b - a).map(year => (
              <button key={year} type="button"
                onClick={() => setActiveYear(year)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeYear === year
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                FY {year}
                {years.length > 1 && (
                  <span className="ml-1 text-xs text-slate-400">
                    ({weightingMethod === 'equal' ? Math.round(100 / years.length) : scheme[sortedYears.indexOf(year)]}%)
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Line Items for Active Year */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 px-1">
              <div className="col-span-3 text-xs font-medium text-slate-500 uppercase">Category</div>
              <div className="col-span-5 text-xs font-medium text-slate-500 uppercase">Line Item</div>
              <div className="col-span-3 text-xs font-medium text-slate-500 uppercase">Amount ($)</div>
              <div className="col-span-1"></div>
            </div>

            {activeLines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                <input type="hidden" name="fiscal_year" value={line.fiscal_year} />
                <div className="col-span-3">
                  <select name="category" value={line.category}
                    onChange={e => updateLine(line.id, 'category', e.target.value)}
                    className="w-full px-2 py-2 rounded-md border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="col-span-5">
                  <input name="line_item" value={line.line_item}
                    onChange={e => updateLine(line.id, 'line_item', e.target.value)}
                    className="w-full px-2 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Description" />
                </div>
                <div className="col-span-3">
                  <input name="amount" type="number" step="0.01" value={line.amount}
                    onChange={e => updateLine(line.id, 'amount', e.target.value)}
                    className="w-full px-2 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0.00" />
                </div>
                <div className="col-span-1 text-center">
                  <button type="button" onClick={() => removeLine(line.id)}
                    className="text-slate-400 hover:text-red-500 transition text-sm">&times;</button>
                </div>
              </div>
            ))}

            <button type="button" onClick={addLine}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              + Add Line Item to FY {activeYear}
            </button>
          </div>

          {/* Year removal */}
          {years.length > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => removeYear(activeYear)}
                className="text-xs text-red-500 hover:text-red-600">
                Remove FY {activeYear}
              </button>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <a href="/dashboard/valuations" className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</a>
          <button type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            Create Valuation
          </button>
        </div>
      </form>
    </div>
  )
}
