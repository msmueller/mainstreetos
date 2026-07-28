'use client'

import { useMemo } from 'react'
import ListView, { type ColumnDef, type BulkAction } from '@/components/lists/ListView'
import { createClient } from '@/lib/supabase/client'
import type { ContactRow } from './page'

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const notionUrl = (pageId: string) => `https://app.notion.com/p/${pageId.replace(/-/g, '')}`

export default function ContactsListClient({ rows }: { rows: ContactRow[] }) {
  const supabase = createClient()

  const columns = useMemo<ColumnDef<ContactRow>[]>(() => [
    {
      key: 'name',
      label: 'Name',
      accessor: (r) => `${r.first_name} ${r.last_name}`.trim(),
      sortable: true,
      render: (r) => (
        <span className="font-medium text-slate-900">{`${r.first_name} ${r.last_name}`.trim() || '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      accessor: (r) => r.email,
      sortable: true,
      render: (r) => <span className="text-slate-600">{r.email || '—'}</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      accessor: (r) => r.phone,
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{r.phone || '—'}</span>,
    },
    {
      key: 'company_name',
      label: 'Company',
      accessor: (r) => r.company_name,
      sortable: true,
      defaultVisible: false,
    },
    {
      key: 'source',
      label: 'Source',
      accessor: (r) => r.source,
      filterable: true,
      sortable: true,
    },
    {
      key: 'proof_of_funds_received',
      label: 'POF',
      accessor: (r) => (r.proof_of_funds_received ? 'Yes' : 'No'),
      filterable: true,
      align: 'right',
      render: (r) =>
        r.proof_of_funds_received ? (
          <span className="text-xs px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">POF ✓</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: 'liquid_cash',
      label: 'Liquidity',
      accessor: (r) => r.liquid_cash,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.liquid_cash)}</span>,
      defaultVisible: false,
    },
    {
      key: 'is_active',
      label: 'Status',
      accessor: (r) => (r.is_active ? 'Active' : 'Inactive'),
      filterable: true,
      render: (r) =>
        r.is_active ? (
          <span className="text-xs px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">Active</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200">Inactive</span>
        ),
    },
    {
      key: 'notion_page_id',
      label: 'Notion',
      accessor: (r) => (r.notion_page_id ? 'Linked' : ''),
      filterable: true,
      render: (r) =>
        r.notion_page_id ? (
          <a
            href={notionUrl(r.notion_page_id)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            Open ↗
          </a>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: 'last_activity_at',
      label: 'Last Activity',
      accessor: (r) => r.last_activity_at,
      sortable: true,
      render: (r) => <span className="text-slate-500">{fmtDate(r.last_activity_at)}</span>,
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

  const bulkActions = useMemo<BulkAction<ContactRow>[]>(() => [
    {
      label: 'Mark inactive',
      confirmText: 'Mark selected contacts inactive? (they stay in the database and can be restored)',
      onAction: async (selected) => {
        const ids = selected.map((r) => r.id)
        const { error } = await supabase
          .from('contacts')
          .update({ is_active: false })
          .in('id', ids)
        if (error) {
          alert(`Failed to update: ${error.message}`)
          return
        }
        window.location.reload()
      },
    },
    {
      label: 'Export selected as CSV',
      onAction: (selected) => {
        const headers = ['first_name', 'last_name', 'email', 'phone', 'company_name', 'source', 'is_active', 'proof_of_funds_received', 'liquid_cash']
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
        a.download = `contacts-selected-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ], [supabase])

  return (
    <ListView<ContactRow>
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      rowHref={(r) => `/dashboard/leads?contact=${r.id}`}
      bulkActions={bulkActions}
      entityName="contact"
      entity="contacts"
      searchPlaceholder="Search contacts by name, email, phone, company…"
      emptyMessage="No contacts match your filters."
    />
  )
}
