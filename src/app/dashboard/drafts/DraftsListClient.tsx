'use client'

// ============================================================
// MainStreetOS — DraftsListClient (Phase 13.2)
// ------------------------------------------------------------
// Client wrapper around the drafts table that adds the new
// Attio-style ListControls bar: filter by kind (CIM/OM/BVR/BLC),
// filter by status (pending/approved/rejected), and sort by
// newest/oldest/kind. Server fetch stays in page.tsx; this
// component owns the filter/sort UI state.
// ============================================================

import Link from 'next/link'
import { useMemo, useState } from 'react'
import ListControls from '@/components/layout/ListControls'

export type DraftsListRow = {
  id: string
  kind: string
  status: string
  created_at: string
  model_used: string | null
  notion_page_url: string | null
  record_id: string | null
  mode: string | null
  listing_name: string | null
  listing_industry: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function kindLabel(kind: string): { label: string; cls: string } {
  if (kind === 'writer.cim_draft') return { label: 'CIM', cls: 'bg-violet-100 text-violet-700' }
  if (kind === 'writer.om_draft') return { label: 'OM', cls: 'bg-blue-100 text-blue-700' }
  if (kind === 'writer.bvr_draft') return { label: 'BVR', cls: 'bg-emerald-100 text-emerald-700' }
  if (kind === 'writer.blc_draft') return { label: 'BLC', cls: 'bg-amber-100 text-amber-700' }
  return { label: kind.replace('writer.', '').toUpperCase(), cls: 'bg-slate-100 text-slate-700' }
}

function statusLabel(status: string): { label: string; cls: string } {
  if (status === 'pending_review') return { label: 'pending review', cls: 'bg-amber-100 text-amber-800' }
  if (status === 'approved') return { label: 'approved', cls: 'bg-emerald-100 text-emerald-800' }
  if (status === 'rejected') return { label: 'rejected', cls: 'bg-red-100 text-red-800' }
  return { label: status, cls: 'bg-slate-100 text-slate-700' }
}

const FILTER_OPTIONS = [
  { key: 'kind:writer.cim_draft', label: 'Kind: CIM' },
  { key: 'kind:writer.om_draft', label: 'Kind: OM' },
  { key: 'kind:writer.bvr_draft', label: 'Kind: BVR' },
  { key: 'kind:writer.blc_draft', label: 'Kind: BLC' },
  { key: 'status:pending_review', label: 'Status: Pending Review' },
  { key: 'status:approved', label: 'Status: Approved' },
  { key: 'status:rejected', label: 'Status: Rejected' },
]

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'kind', label: 'Kind (A–Z)' },
  { key: 'listing', label: 'Listing (A–Z)' },
]

export default function DraftsListClient({ rows }: { rows: DraftsListRow[] }) {
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [activeSort, setActiveSort] = useState<string>('newest')

  const filtered = useMemo(() => {
    const kindFilters = activeFilters
      .filter((f) => f.startsWith('kind:'))
      .map((f) => f.slice('kind:'.length))
    const statusFilters = activeFilters
      .filter((f) => f.startsWith('status:'))
      .map((f) => f.slice('status:'.length))

    let out = rows.slice()
    if (kindFilters.length > 0) out = out.filter((r) => kindFilters.includes(r.kind))
    if (statusFilters.length > 0) out = out.filter((r) => statusFilters.includes(r.status))

    switch (activeSort) {
      case 'oldest':
        out.sort((a, b) => a.created_at.localeCompare(b.created_at))
        break
      case 'kind':
        out.sort((a, b) => a.kind.localeCompare(b.kind))
        break
      case 'listing':
        out.sort((a, b) => (a.listing_name || '').localeCompare(b.listing_name || ''))
        break
      case 'newest':
      default:
        out.sort((a, b) => b.created_at.localeCompare(a.created_at))
    }
    return out
  }, [rows, activeFilters, activeSort])

  return (
    <>
      <ListControls
        filters={FILTER_OPTIONS}
        activeFilters={activeFilters}
        onFilterToggle={(k) =>
          setActiveFilters((prev) =>
            prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
          )
        }
        sorts={SORT_OPTIONS}
        activeSort={activeSort}
        onSortChange={setActiveSort}
        totalCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-slate-500">No drafts match the current filters.</p>
          <p className="text-sm text-slate-400 mt-1">
            Clear filters or generate a CIM / OM from any deal page to see drafts land here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Kind</th>
                <th className="text-left font-medium px-4 py-2.5">Listing</th>
                <th className="text-left font-medium px-4 py-2.5">Mode</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-left font-medium px-4 py-2.5">Created</th>
                <th className="text-left font-medium px-4 py-2.5">Model</th>
                <th className="text-left font-medium px-4 py-2.5">Notion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const k = kindLabel(r.kind)
                const s = statusLabel(r.status)
                const dealHref = r.record_id ? `/dashboard/deals/${r.record_id}` : null
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${k.cls}`}>
                        {k.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {dealHref ? (
                        <Link
                          href={dealHref}
                          className="text-slate-900 hover:text-blue-700 hover:underline font-medium"
                        >
                          {r.listing_name || '—'}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {r.listing_industry && (
                        <div className="text-xs text-slate-400 mt-0.5">{r.listing_industry}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.mode ? (
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            r.mode === 'rich'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-400 text-slate-900'
                          }`}
                        >
                          {r.mode.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 text-[11px] rounded ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                      {r.model_used || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.notion_page_url ? (
                        <a
                          href={r.notion_page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                        >
                          Open ↗
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
