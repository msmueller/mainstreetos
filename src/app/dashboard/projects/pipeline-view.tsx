'use client'

import Link from 'next/link'
import type { ProjectWithCounts } from '@/lib/types'
import { PROJECT_STATUSES } from '@/lib/types'
import { STATUS_COLOR } from './ProjectsViewSwitcher'

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ============================================================
// Phase 14.4 — simple status-lane board for Projects, mirroring
// the spirit of deals/pipeline-view.tsx (lane-per-stage, card per
// record) at a scope appropriate to Projects' current volume.
// ============================================================
export default function ProjectsPipelineView({ projects }: { projects: ProjectWithCounts[] }) {
  const lanes = PROJECT_STATUSES.filter((s) => s.key !== 'cancelled')
  const cancelled = projects.filter((p) => p.project_status === 'cancelled')

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500 text-sm">No consulting projects yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {lanes.map((lane) => {
          const laneProjects = projects.filter((p) => p.project_status === lane.key)
          return (
            <div key={lane.key} className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{lane.label}</h3>
                <span className="text-xs text-slate-400">{laneProjects.length}</span>
              </div>
              <div className="space-y-2">
                {laneProjects.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    Empty
                  </div>
                ) : (
                  laneProjects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/projects/${p.id}`}
                      className={`block bg-white rounded-lg border p-3 hover:shadow-sm transition-all ${
                        (STATUS_COLOR[p.project_status] || STATUS_COLOR.inquiry).split(' ').find((c) => c.startsWith('border-')) || 'border-slate-200'
                      } hover:border-blue-300`}
                    >
                      <p className="text-sm font-medium text-slate-900 truncate">{p.project_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{p.client_name || 'No client linked'}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500 capitalize">{(p.service_type || '').replace(/_/g, ' ')}</span>
                        <span className="text-xs font-mono text-slate-700">{fmtCurrency(p.proposal_amount || p.actual_fee)}</span>
                      </div>
                      {p.deliverable_count > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {p.delivered_count} / {p.deliverable_count} deliverables
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {cancelled.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
            Cancelled ({cancelled.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {cancelled.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="block bg-slate-50 rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-all opacity-75"
              >
                <p className="text-sm font-medium text-slate-700 truncate">{p.project_name}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{p.client_name || 'No client linked'}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
