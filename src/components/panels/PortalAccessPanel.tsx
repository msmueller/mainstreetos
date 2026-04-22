'use client'

// ============================================================
// Portal Access Panel — Phase 12.11a
// Shows per-buyer portal URLs (OM / BP / DP) with copy-to-clipboard,
// NDA / stage badges, and one-click "open as buyer" preview.
// Self-sufficient: queries deal_access + contacts by dealId.
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PortalTier = 'om' | 'bp' | 'dp'

interface PortalAccessRow {
  contact_id: string
  contact_name: string
  contact_email: string
  current_stage: string
  portal: PortalTier
  nda_status: 'sent' | 'signed' | 'revoked' | string
  access_token: string | null
  last_activity: string | null
}

const PORTAL_LABEL: Record<PortalTier, string> = {
  om: 'Offering Memorandum',
  bp: 'Buyer Portal',
  dp: 'Due Diligence Portal',
}

const PORTAL_COLOR: Record<PortalTier, string> = {
  om: 'bg-amber-50 text-amber-800 border-amber-200',
  bp: 'bg-blue-50 text-blue-800 border-blue-200',
  dp: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

function buildPortalUrl(portal: PortalTier, token: string | null): string {
  if (!token) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/portal/${portal}/${token}`
}

export default function PortalAccessPanel({ dealId }: { dealId: string }) {
  const supabase = createClient()
  const [rows, setRows] = useState<PortalAccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!dealId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('deal_access')
        .select('contact_id, current_stage, portal, nda_status, access_token, last_activity, contacts(first_name, last_name, email)')
        .eq('deal_id', dealId)

      if (qErr) {
        setError(qErr.message)
        setRows([])
        return
      }

      const mapped: PortalAccessRow[] = (data || []).map((r: Record<string, unknown>) => {
        const c = (r.contacts as Record<string, unknown>) || {}
        const first = (c.first_name as string) || ''
        const last = (c.last_name as string) || ''
        return {
          contact_id: (r.contact_id as string) || '',
          contact_name: `${first} ${last}`.trim() || '—',
          contact_email: (c.email as string) || '',
          current_stage: (r.current_stage as string) || 'inquiry',
          portal: ((r.portal as string) || 'om') as PortalTier,
          nda_status: (r.nda_status as string) || 'sent',
          access_token: (r.access_token as string) || null,
          last_activity: (r.last_activity as string) || null,
        }
      })
      setRows(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portal access')
    } finally {
      setLoading(false)
    }
  }, [dealId, supabase])

  useEffect(() => { load() }, [load])

  async function copyUrl(row: PortalAccessRow) {
    const url = buildPortalUrl(row.portal, row.access_token)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(row.contact_id)
      setTimeout(() => setCopiedId(null), 1800)
    } catch {
      // clipboard denied — silent
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm text-slate-500">Loading portal access…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="text-sm text-amber-800">Portal access unavailable: {error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Portal Access</h3>
            <p className="text-sm text-slate-500 mt-1">No buyers have been granted portal access yet.</p>
          </div>
          <button
            onClick={load}
            className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">
          Portal Access <span className="text-slate-400 font-normal">({rows.length})</span>
        </h3>
        <button
          onClick={load}
          className="text-xs px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
        >
          Refresh
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => {
          const url = buildPortalUrl(row.portal, row.access_token)
          const copied = copiedId === row.contact_id
          return (
            <div key={row.contact_id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">{row.contact_name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${PORTAL_COLOR[row.portal]}`}>
                    {row.portal}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    row.nda_status === 'signed'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : row.nda_status === 'revoked'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    NDA {row.nda_status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {row.contact_email || '—'} · {PORTAL_LABEL[row.portal]}
                </p>
                {url && (
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{url}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {url ? (
                  <>
                    <button
                      onClick={() => copyUrl(row)}
                      className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        copied
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {copied ? 'Copied' : 'Copy URL'}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Preview
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">no token</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
