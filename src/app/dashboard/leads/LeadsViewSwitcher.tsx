'use client'

import { useMemo, useState } from 'react'
import type { Communication } from '@/lib/types'
import LeadsTable from './leads-table'
import ListView, { type ColumnDef, type BulkAction } from '@/components/lists/ListView'
import { createClient } from '@/lib/supabase/client'

export interface LeadRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  source: string | null
  liquid_cash: number | null
  is_active: boolean
  proof_of_funds_received: boolean
  created_at: string
  deal_count: number
  nda_count: number
  deal_names: string[]
}

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export default function LeadsViewSwitcher({
  leads,
  communications,
}: {
  leads: LeadRow[]
  communications: Communication[]
}) {
  const [mode, setMode] = useState<'default' | 'table'>('default')
  const supabase = createClient()

  const columns = useMemo<ColumnDef<LeadRow>[]>(() => [
    {
      key: 'full_name',
      label: 'Name',
      accessor: (r) => `${r.first_name} ${r.last_name}`.trim(),
      sortable: true,
      render: (r) => (
        <span className="font-medium text-slate-900">
          {`${r.first_name} ${r.last_name}`.trim() || '—'}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      accessor: (r) => r.email,
      sortable: true,
      render: (r) => (
        <span className="text-slate-600 font-mono text-xs">{r.email || '—'}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      accessor: (r) => r.phone,
      render: (r) => <span className="text-slate-600">{r.phone || '—'}</span>,
      defaultVisible: false,
    },
    {
      key: 'company_name',
      label: 'Company',
      accessor: (r) => r.company_name,
      sortable: true,
      filterable: true,
    },
    {
      key: 'source',
      label: 'Source',
      accessor: (r) => r.source,
      filterable: true,
      sortable: true,
      render: (r) => r.source ? (
        <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200 capitalize">
          {r.source.replace(/_/g, ' ')}
        </span>
      ) : '—',
    },
    {
      key: 'liquid_cash',
      label: 'Liquid Cash',
      accessor: (r) => r.liquid_cash,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.liquid_cash)}</span>,
    },
    {
      key: 'is_active',
      label: 'Active',
      accessor: (r) => (r.is_active ? 'Active' : 'Inactive'),
      filterable: true,
      sortable: true,
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full border ${
          r.is_active
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'proof_of_funds_received',
      label: 'POF',
      accessor: (r) => (r.proof_of_funds_received ? 'Yes' : 'No'),
      filterable: true,
      sortable: true,
      render: (r) => r.proof_of_funds_received ? (
        <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Yes</span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
    },
    {
      key: 'deal_count',
      label: 'Deals',
      accessor: (r) => r.deal_count,
      sortable: true,
      align: 'right',
    },
    {
      key: 'nda_count',
      label: 'NDAs',
      accessor: (r) => r.nda_count,
      sortable: true,
      align: 'right',
    },
    {
      key: 'created_at',
      label: 'Created',
      accessor: (r) => r.created_at,
      sortable: true,
      render: (r) => <span className="text-slate-500">{fmtDate(r.created_at)}</span>,
      defaultVisible: false,
    },
  ], [])

  const bulkActions = useMemo<BulkAction<LeadRow>[]>(() => [
    {
      label: 'Mark as inactive',
      confirmText: 'Mark selected leads as inactive?',
      onAction: async (selected) => {
        const ids = selected.map((r) => r.id)
        const { error } = await supabase
          .from('contacts')
          .update({ is_active: false })
          .in('id', ids)
        if (error) { alert(`Failed: ${error.message}`); return }
        window.location.reload()
      },
    },
    {
      label: 'Export selected as CSV',
      onAction: (selected) => {
        const headers = ['first_name', 'last_name', 'email', 'phone', 'company_name', 'source', 'liquid_cash', 'is_active', 'proof_of_funds_received', 'deal_count', 'nda_count']
        const lines = [
          headers.join(','),
          ...selected.map((r) => headers.map((h) => {
            const v = (r as unknown as Record<string, unknown>)[h]
            if (v == null) return ''
            const s = String(v)
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          }).join(',')),
        ]
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leads-selected-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ], [supabase])

  return (
    <div>
      <div className="mb-4 inline-flex items-center bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setMode('default')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === 'default' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Default
        </button>
        <button
          onClick={() => setMode('table')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Table
        </button>
      </div>

      {mode === 'default' ? (
        <LeadsTable leads={leads} communications={communications} />
      ) : (
        <ListView<LeadRow>
          rows={leads}
          columns={columns}
          getRowId={(r) => r.id}
          bulkActions={bulkActions}
          entityName="lead"
          entity="buyer_leads"
          searchPlaceholder="Search leads by name, email, company, source…"
        />
      )}
    </div>
  )
}
