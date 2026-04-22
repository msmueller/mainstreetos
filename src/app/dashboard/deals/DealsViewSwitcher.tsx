'use client'

import { useMemo, useState } from 'react'
import type { DealWithCounts } from '@/lib/types'
import PipelineView from './pipeline-view'
import ListView, { type ColumnDef, type BulkAction } from '@/components/lists/ListView'

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  under_contract: 'bg-pink-50 text-pink-700 border-pink-200',
  closed: 'bg-slate-50 text-slate-600 border-slate-200',
  expired: 'bg-slate-50 text-slate-500 border-slate-200',
  withdrawn: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function DealsViewSwitcher({ deals }: { deals: DealWithCounts[] }) {
  const [mode, setMode] = useState<'pipeline' | 'table'>('pipeline')

  const columns = useMemo<ColumnDef<DealWithCounts>[]>(() => [
    {
      key: 'listing_name',
      label: 'Deal',
      accessor: (r) => r.listing_name,
      sortable: true,
      render: (r) => <span className="font-medium text-slate-900">{r.listing_name || '—'}</span>,
    },
    {
      key: 'industry',
      label: 'Industry',
      accessor: (r) => r.industry,
      filterable: true,
      sortable: true,
    },
    {
      key: 'business_address',
      label: 'Location',
      accessor: (r) => r.business_address,
    },
    {
      key: 'asking_price',
      label: 'Asking',
      accessor: (r) => r.asking_price,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums">{fmtCurrency(r.asking_price)}</span>,
    },
    {
      key: 'annual_revenue',
      label: 'Revenue',
      accessor: (r) => r.annual_revenue,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.annual_revenue)}</span>,
    },
    {
      key: 'sde',
      label: 'SDE',
      accessor: (r) => r.sde,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.sde)}</span>,
      defaultVisible: false,
    },
    {
      key: 'deal_status',
      label: 'Status',
      accessor: (r) => r.deal_status,
      filterable: true,
      sortable: true,
      render: (r) => {
        const s = r.deal_status || 'active'
        const cls = STATUS_COLOR[s] || STATUS_COLOR.active
        return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls} capitalize`}>{s.replace(/_/g, ' ')}</span>
      },
    },
    {
      key: 'deal_type',
      label: 'Type',
      accessor: (r) => r.deal_type,
      filterable: true,
      sortable: true,
      render: (r) => r.deal_type ? r.deal_type.replace(/_/g, ' ') : '—',
      defaultVisible: false,
    },
    {
      key: 'buyer_count',
      label: 'Buyers',
      accessor: (r) => r.buyer_count,
      sortable: true,
      align: 'right',
    },
    {
      key: 'nda_signed_count',
      label: 'NDAs',
      accessor: (r) => r.nda_signed_count,
      sortable: true,
      align: 'right',
    },
    {
      key: 'active_buyers',
      label: 'Active',
      accessor: (r) => r.active_buyers,
      sortable: true,
      align: 'right',
      defaultVisible: false,
    },
    {
      key: 'listing_date',
      label: 'Listed',
      accessor: (r) => r.listing_date,
      sortable: true,
      render: (r) => <span className="text-slate-500">{fmtDate(r.listing_date)}</span>,
      defaultVisible: false,
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

  const bulkActions = useMemo<BulkAction<DealWithCounts>[]>(() => [
    {
      label: 'Export selected as CSV',
      onAction: (selected) => {
        const headers = ['listing_name', 'industry', 'asking_price', 'annual_revenue', 'sde', 'deal_status', 'deal_type', 'buyer_count', 'nda_signed_count']
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
        a.download = `deals-selected-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ], [])

  return (
    <div>
      <div className="mb-4 inline-flex items-center bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setMode('pipeline')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === 'pipeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pipeline
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

      {mode === 'pipeline' ? (
        <PipelineView deals={deals} />
      ) : (
        <ListView<DealWithCounts>
          rows={deals}
          columns={columns}
          getRowId={(r) => r.id}
          rowHref={(r) => `/dashboard/deals/${r.id}`}
          bulkActions={bulkActions}
          entityName="deal"
          entity="deals"
          searchPlaceholder="Search deals by name, industry, location, status…"
        />
      )}
    </div>
  )
}
