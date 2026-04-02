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

interface LineItem {
  id: string
  fiscal_year: number
  category: FinancialCategory
  line_item: string
  amount: string
}

export default function NewValuationPage() {
  const currentYear = new Date().getFullYear()
  const [lines, setLines] = useState<LineItem[]>([
    { id: crypto.randomUUID(), fiscal_year: currentYear - 1, category: 'revenue', line_item: 'Gross Revenue', amount: '' },
    { id: crypto.randomUUID(), fiscal_year: currentYear - 1, category: 'cogs', line_item: 'Cost of Goods Sold', amount: '' },
    { id: crypto.randomUUID(), fiscal_year: currentYear - 1, category: 'owner_compensation', line_item: 'Owner Salary', amount: '' },
    { id: crypto.randomUUID(), fiscal_year: currentYear - 1, category: 'operating_expense', line_item: 'Total Operating Expenses', amount: '' },
  ])

  function addLine() {
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      fiscal_year: currentYear - 1,
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

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">New Valuation</h2>
        <p className="text-slate-500 mt-1">
          Enter business details and financial data. Our AI agents will analyze and produce a multi-method valuation.
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
              <input
                name="business_name"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., La Guardiola Pizzeria"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
              <input
                name="industry"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., Restaurant / Food Service"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                name="location"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., Bayonne, NJ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SIC Code</label>
              <input
                name="sic_code"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., 5812"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NAICS Code</label>
              <input
                name="naics_code"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., 722511"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Annual Revenue ($)</label>
              <input
                name="annual_revenue"
                type="number"
                step="0.01"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="e.g., 750000"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Description</label>
              <textarea
                name="business_description"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Brief description of the business, operations, and key characteristics..."
              />
            </div>
          </div>
        </div>

        {/* Financial Data */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Financial Data</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Enter P&L line items. The AI agents will normalize and calculate SDE/EBITDA automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
            >
              + Add Line
            </button>
          </div>

          <div className="space-y-3">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 px-1">
              <div className="col-span-2 text-xs font-medium text-slate-500 uppercase">Year</div>
              <div className="col-span-3 text-xs font-medium text-slate-500 uppercase">Category</div>
              <div className="col-span-4 text-xs font-medium text-slate-500 uppercase">Line Item</div>
              <div className="col-span-2 text-xs font-medium text-slate-500 uppercase">Amount ($)</div>
              <div className="col-span-1"></div>
            </div>

            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <input
                    name="fiscal_year"
                    type="number"
                    value={line.fiscal_year}
                    onChange={e => updateLine(line.id, 'fiscal_year', parseInt(e.target.value))}
                    className="w-full px-2 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <select
                    name="category"
                    value={line.category}
                    onChange={e => updateLine(line.id, 'category', e.target.value)}
                    className="w-full px-2 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <input
                    name="line_item"
                    value={line.line_item}
                    onChange={e => updateLine(line.id, 'line_item', e.target.value)}
                    className="w-full px-2 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Description"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    value={line.amount}
                    onChange={e => updateLine(line.id, 'amount', e.target.value)}
                    className="w-full px-2 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="text-slate-400 hover:text-red-500 transition text-sm"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <a
            href="/dashboard/valuations"
            className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create Valuation
          </button>
        </div>
      </form>
    </div>
  )
}
