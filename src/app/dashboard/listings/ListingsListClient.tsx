'use client'

import { useMemo } from 'react'
import ListView, { type ColumnDef, type BulkAction } from '@/components/lists/ListView'
import { createClient } from '@/lib/supabase/client'
import type { SellerListingRow } from './page'

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

// Aligned with public.seller_listing_stage enum values
const STAGE_COLOR: Record<string, string> = {
  sourcing: 'bg-slate-50 text-slate-600 border-slate-200',
  qualifying: 'bg-blue-50 text-blue-700 border-blue-200',
  valuation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  mandate: 'bg-violet-50 text-violet-700 border-violet-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  under_loi: 'bg-pink-50 text-pink-700 border-pink-200',
  under_contract: 'bg-pink-50 text-pink-700 border-pink-200',
  closing: 'bg-amber-50 text-amber-700 border-amber-200',
  closed_won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed_lost: 'bg-slate-50 text-slate-500 border-slate-200',
  on_hold: 'bg-amber-50 text-amber-700 border-amber-200',
}

const STAGE_LABELS: Record<string, string> = {
  sourcing: 'Sourcing',
  qualifying: 'Qualifying',
  valuation: 'Valuation',
  mandate: 'Mandate',
  active: 'Active',
  under_loi: 'Under LOI',
  under_contract: 'Under Contract',
  closing: 'Closing',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
  on_hold: 'On Hold',
}

export default function ListingsListClient({ rows }: { rows: SellerListingRow[] }) {
  const supabase = createClient()

  const columns = useMemo<ColumnDef<SellerListingRow>[]>(() => [
    {
      key: 'name',
      label: 'Listing',
      accessor: (r) => r.name,
      sortable: true,
      render: (r) => (
        <span className="font-medium text-slate-900">{r.name || '—'}</span>
      ),
    },
    {
      key: 'industry',
      label: 'Industry',
      accessor: (r) => r.industry,
      filterable: true,
      sortable: true,
    },
    {
      key: 'asking_price_usd',
      label: 'Asking Price',
      accessor: (r) => r.asking_price_usd,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums">{fmtCurrency(r.asking_price_usd)}</span>,
    },
    {
      key: 'revenue_ttm_usd',
      label: 'Revenue (TTM)',
      accessor: (r) => r.revenue_ttm_usd,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.revenue_ttm_usd)}</span>,
    },
    {
      key: 'sde_ttm_usd',
      label: 'SDE (TTM)',
      accessor: (r) => r.sde_ttm_usd,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.sde_ttm_usd)}</span>,
    },
    {
      key: 'ebitda_ttm_usd',
      label: 'EBITDA (TTM)',
      accessor: (r) => r.ebitda_ttm_usd,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.ebitda_ttm_usd)}</span>,
      defaultVisible: false,
    },
    {
      key: 'stage',
      label: 'Stage',
      accessor: (r) => r.stage,
      filterable: true,
      sortable: true,
      render: (r) => {
        const s = r.stage || 'sourcing'
        const cls = STAGE_COLOR[s] || STAGE_COLOR.sourcing
        const label = STAGE_LABELS[s] || s
        return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
      },
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

  const bulkActions = useMemo<BulkAction<SellerListingRow>[]>(() => [
    {
      label: 'Mark on hold',
      confirmText: 'Move selected listings to On Hold stage? (they stay in the database and can be restored)',
      onAction: async (selected) => {
        const ids = selected.map((r) => r.id)
        const { error } = await supabase
          .from('seller_listings')
          .update({ stage: 'on_hold' })
          .in('id', ids)
        if (error) {
          alert(`Failed to update stage: ${error.message}`)
          return
        }
        // Refresh by reloading — server component re-fetches
        window.location.reload()
      },
    },
    {
      label: 'Export selected as CSV',
      onAction: (selected) => {
        const headers = ['name', 'industry', 'asking_price_usd', 'revenue_ttm_usd', 'sde_ttm_usd', 'ebitda_ttm_usd', 'stage']
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
        a.download = `seller-listings-selected-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ], [supabase])

  return (
    <ListView<SellerListingRow>
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      rowHref={(r) => `/dashboard/deals/${r.id}`}
      bulkActions={bulkActions}
      entityName="listing"
      entity="seller_listings"
      searchPlaceholder="Search listings by name, industry…"
      emptyMessage="No listings match your filters."
    />
  )
}
