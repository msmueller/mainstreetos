'use client'

import { useMemo } from 'react'
import ListView, { type ColumnDef, type BulkAction } from '@/components/lists/ListView'
import { createClient } from '@/lib/supabase/client'
import type { SellerListingRow } from './page'

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  under_contract: 'bg-pink-50 text-pink-700 border-pink-200',
  closed: 'bg-slate-50 text-slate-600 border-slate-200',
  archived: 'bg-slate-50 text-slate-500 border-slate-200',
  on_hold: 'bg-amber-50 text-amber-700 border-amber-200',
}

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake',
  valuation: 'Valuation',
  packaging_marketing: 'Packaging & Marketing',
  active_listing: 'Active Listing',
  under_contract: 'Under Contract',
  due_diligence: 'Due Diligence',
  closing: 'Closing',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export default function ListingsListClient({ rows }: { rows: SellerListingRow[] }) {
  const supabase = createClient()

  const columns = useMemo<ColumnDef<SellerListingRow>[]>(() => [
    {
      key: 'listing_name',
      label: 'Listing',
      accessor: (r) => r.listing_name,
      sortable: true,
      render: (r) => (
        <span className="font-medium text-slate-900">{r.listing_name || '—'}</span>
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
      key: 'business_address',
      label: 'Location',
      accessor: (r) => r.business_address,
      defaultVisible: true,
    },
    {
      key: 'asking_price',
      label: 'Asking Price',
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
    },
    {
      key: 'listing_status',
      label: 'Status',
      accessor: (r) => r.listing_status,
      filterable: true,
      sortable: true,
      render: (r) => {
        const s = r.listing_status || 'active'
        const cls = STATUS_COLOR[s] || STATUS_COLOR.active
        return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls} capitalize`}>{s.replace(/_/g, ' ')}</span>
      },
    },
    {
      key: 'seller_stage',
      label: 'Stage',
      accessor: (r) => r.seller_stage,
      filterable: true,
      sortable: true,
      render: (r) => r.seller_stage ? (STAGE_LABELS[r.seller_stage] || r.seller_stage) : '—',
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
      label: 'Mark as archived',
      confirmText: 'Archive selected listings? (they stay in the database and can be restored)',
      onAction: async (selected) => {
        const ids = selected.map((r) => r.id)
        const { error } = await supabase
          .from('seller_listings')
          .update({ listing_status: 'archived' })
          .in('id', ids)
        if (error) {
          alert(`Failed to archive: ${error.message}`)
          return
        }
        // Refresh by reloading — server component re-fetches
        window.location.reload()
      },
    },
    {
      label: 'Export selected as CSV',
      onAction: (selected) => {
        const headers = ['listing_name', 'industry', 'asking_price', 'annual_revenue', 'sde', 'listing_status', 'seller_stage', 'business_address']
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
      searchPlaceholder="Search listings by name, industry, location…"
      emptyMessage="No listings match your filters."
    />
  )
}
