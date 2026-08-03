'use client'

import { useMemo, useState } from 'react'
import type { ProjectWithCounts } from '@/lib/types'
import ProjectsPipelineView from './pipeline-view'
import ListView, { type ColumnDef, type BulkAction } from '@/components/lists/ListView'

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export const STATUS_COLOR: Record<string, string> = {
  inquiry: 'bg-slate-50 text-slate-600 border-slate-200',
  proposal_sent: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

export default function ProjectsViewSwitcher({ projects }: { projects: ProjectWithCounts[] }) {
  const [mode, setMode] = useState<'pipeline' | 'table'>('pipeline')

  const columns = useMemo<ColumnDef<ProjectWithCounts>[]>(() => [
    {
      key: 'project_name',
      label: 'Engagement',
      accessor: (r) => r.project_name,
      sortable: true,
      render: (r) => <span className="font-medium text-slate-900">{r.project_name || '—'}</span>,
    },
    {
      key: 'client_name',
      label: 'Client',
      accessor: (r) => r.client_name,
      filterable: true,
      sortable: true,
      render: (r) => r.client_name || '—',
    },
    {
      key: 'service_type',
      label: 'Service',
      accessor: (r) => r.service_type,
      filterable: true,
      sortable: true,
      render: (r) => (r.service_type || '').replace(/_/g, ' '),
    },
    {
      key: 'project_status',
      label: 'Status',
      accessor: (r) => r.project_status,
      filterable: true,
      sortable: true,
      render: (r) => {
        const s = r.project_status || 'inquiry'
        const cls = STATUS_COLOR[s] || STATUS_COLOR.inquiry
        return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls} capitalize`}>{s.replace(/_/g, ' ')}</span>
      },
    },
    {
      key: 'proposal_amount',
      label: 'Proposal',
      accessor: (r) => r.proposal_amount,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums">{fmtCurrency(r.proposal_amount)}</span>,
    },
    {
      key: 'actual_fee',
      label: 'Actual Fee',
      accessor: (r) => r.actual_fee,
      sortable: true,
      align: 'right',
      render: (r) => <span className="font-mono tabular-nums text-slate-600">{fmtCurrency(r.actual_fee)}</span>,
      defaultVisible: false,
    },
    {
      key: 'deliverable_count',
      label: 'Deliverables',
      accessor: (r) => r.deliverable_count,
      sortable: true,
      align: 'right',
      render: (r) => `${r.delivered_count} / ${r.deliverable_count}`,
    },
    {
      key: 'access_count',
      label: 'Client Access',
      accessor: (r) => r.access_count,
      sortable: true,
      align: 'right',
      defaultVisible: false,
    },
    {
      key: 'due_date',
      label: 'Due',
      accessor: (r) => r.due_date,
      sortable: true,
      render: (r) => <span className="text-slate-500">{fmtDate(r.due_date)}</span>,
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

  const bulkActions = useMemo<BulkAction<ProjectWithCounts>[]>(() => [
    {
      label: 'Export selected as CSV',
      onAction: (selected) => {
        const headers = ['project_name', 'client_name', 'service_type', 'project_status', 'proposal_amount', 'actual_fee', 'deliverable_count', 'access_count']
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
        a.download = `projects-selected-${new Date().toISOString().slice(0, 10)}.csv`
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
        <ProjectsPipelineView projects={projects} />
      ) : (
        <ListView<ProjectWithCounts>
          rows={projects}
          columns={columns}
          getRowId={(r) => r.id}
          rowHref={(r) => `/dashboard/projects/${r.id}`}
          bulkActions={bulkActions}
          entityName="project"
          entity="projects"
          searchPlaceholder="Search projects by name, client, service type…"
        />
      )}
    </div>
  )
}
