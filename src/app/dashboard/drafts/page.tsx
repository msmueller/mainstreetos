// ============================================================
// MainStreetOS — /dashboard/drafts (Phase 13.1)
// ------------------------------------------------------------
// Records:Drafts destination from the new Basepoint-style
// sidebar. Surfaces all ai_drafts rows the broker can read
// (RLS-enforced) with the listing name joined in, so brokers
// have one place to sweep their pending_review queue across
// every deal.
// ============================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type DraftRow = {
  id: string
  kind: string
  status: string
  created_at: string
  model_used: string | null
  notion_page_url: string | null
  record_id: string | null
  payload: Record<string, unknown> | null
}

type ListingStub = {
  id: string
  name: string | null
  industry: string | null
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

export default async function DraftsPage() {
  const supabase = await createClient()

  const { data: drafts } = await supabase
    .from('ai_drafts')
    .select(
      'id, kind, status, created_at, model_used, notion_page_url, record_id, payload',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (drafts || []) as DraftRow[]

  // Join listing names for any rows tied to seller_listings
  const listingIds = Array.from(
    new Set(
      rows
        .filter((r) => r.record_id)
        .map((r) => r.record_id as string),
    ),
  )
  let listings: ListingStub[] = []
  if (listingIds.length > 0) {
    const { data } = await supabase
      .from('seller_listings')
      .select('id, name, industry')
      .in('id', listingIds)
    listings = (data || []) as ListingStub[]
  }
  const listingMap = new Map(listings.map((l) => [l.id, l]))

  const pendingCount = rows.filter((r) => r.status === 'pending_review').length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI Drafts</h2>
          <p className="text-slate-500 mt-1">
            Every CIM, OM, BVR, and BLC the writer agents have produced. Review queue for pending drafts lives here.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-600">{pendingCount} pending review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="text-slate-500">{rows.length} total</span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-slate-500">No drafts yet.</p>
          <p className="text-sm text-slate-400 mt-1">
            Generate a CIM or OM from any deal page to see drafts land here.
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
              {rows.map((r) => {
                const k = kindLabel(r.kind)
                const s = statusLabel(r.status)
                const listing = r.record_id ? listingMap.get(r.record_id) : null
                const mode = (r.payload?.mode as string | undefined) ?? null
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
                          {listing?.name || '—'}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {listing?.industry && (
                        <div className="text-xs text-slate-400 mt-0.5">{listing.industry}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {mode ? (
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            mode === 'rich'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-400 text-slate-900'
                          }`}
                        >
                          {mode.toUpperCase()}
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
    </div>
  )
}
