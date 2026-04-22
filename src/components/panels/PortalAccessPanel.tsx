'use client'

// ============================================================
// Portal Access Panel — Phase 12.13.3 (schema-drift cleanup)
// ------------------------------------------------------------
// Shows per-buyer portal tier (OM / BP / DP) + NDA + stage, plus
// a shared /portal link that buyers reach via magic-link auth.
//
// Phase 12.12a collapsed the old per-buyer token model into the
// unified /portal route. This panel no longer reads
// access_token / last_activity / nda_status from deal_access —
// those columns never existed after the refactor. Current schema:
//   deal_access.nda_signed       (boolean)
//   deal_access.nda_signed_date  (timestamptz)
//   deal_access.is_active        (boolean)
//   deal_access.granted_at       (timestamptz)
// Status is derived client-side:
//   !is_active         → revoked
//    nda_signed        → signed
//    else              → sent
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type PortalTier = 'om' | 'bp' | 'dp'
type NdaStatus = 'sent' | 'signed' | 'revoked'

interface PortalAccessRow {
  access_id: string
  contact_id: string
  contact_name: string
  contact_email: string
  current_stage: string
  portal: PortalTier
  nda_status: NdaStatus
  nda_signed_date: string | null
  granted_at: string | null
  is_active: boolean
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

function deriveNdaStatus(ndaSigned: boolean | null | undefined, isActive: boolean | null | undefined): NdaStatus {
  if (isActive === false) return 'revoked'
  if (ndaSigned === true) return 'signed'
  return 'sent'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

function portalHref(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/portal`
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
        .select('id, contact_id, current_stage, portal, nda_signed, nda_signed_date, is_active, granted_at, contacts(first_name, last_name, email)')
        .eq('deal_id', dealId)
        .order('granted_at', { ascending: false })

      if (qErr) {
        setError(qErr.message)
        setRows([])
        return
      }

      const mapped: PortalAccessRow[] = (data || []).map((r: Record<string, unknown>) => {
        const c = (r.contacts as Record<string, unknown>) || {}
        const first = (c.first_name as string) || ''
        const last = (c.last_name as string) || ''
        const isActive = r.is_active === null || r.is_active === undefined ? true : Boolean(r.is_active)
        return {
          access_id: (r.id as string) || '',
          contact_id: (r.contact_id as string) || '',
          contact_name: `${first} ${last}`.trim() || '—',
          contact_email: (c.email as string) || '',
          current_stage: (r.current_stage as string) || 'inquiry',
          portal: ((r.portal as string) || 'om') as PortalTier,
          nda_status: deriveNdaStatus(r.nda_signed as boolean | null, r.is_active as boolean | null),
          nda_signed_date: (r.nda_signed_date as string) || null,
          granted_at: (r.granted_at as string) || null,
          is_active: isActive,
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

  async function copyPortalUrl(row: PortalAccessRow) {
    const url = portalHref()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(row.access_id)
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

  const portalUrl = portalHref()

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Portal Access <span className="text-slate-400 font-normal">({rows.length})</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Buyers sign in at <span className="font-mono">/portal</span> via magic link — access is resolved from their contact record.
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
        >
          Refresh
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => {
          const copied = copiedId === row.access_id
          const ndaLabel =
            row.nda_status === 'signed'
              ? `NDA signed${row.nda_signed_date ? ' · ' + fmtDate(row.nda_signed_date) : ''}`
              : row.nda_status === 'revoked'
              ? 'NDA revoked'
              : 'NDA sent'
          return (
            <div key={row.access_id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
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
                    {ndaLabel}
                  </span>
                  {!row.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200">
                      inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {row.contact_email || '—'} · {PORTAL_LABEL[row.portal]} · granted {fmtDate(row.granted_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyPortalUrl(row)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    copied
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={portalUrl}
                >
                  {copied ? 'Copied' : 'Copy portal link'}
                </button>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800"
                >
                  Open /portal
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
