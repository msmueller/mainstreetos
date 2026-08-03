'use client'

// ============================================================
// Project Portal Access Panel — Phase 14.4
// ------------------------------------------------------------
// Projects equivalent of PortalAccessPanel.tsx (deal_access ->
// project_access). Same schema shape as deal_access minus the
// buyer-stage/NDA-gating concepts, which don't apply to a
// consulting engagement: is_active / granted_at / role / portal.
// Clients reach the same /portal route; ProjectView.tsx resolves
// which engagement(s) they see via fn_portal_list_my_projects.
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ContactRole, PortalCode } from '@/lib/types'

interface ProjectAccessRow {
  access_id: string
  contact_id: string
  contact_name: string
  contact_email: string
  role: ContactRole
  portal: PortalCode
  is_active: boolean
  granted_at: string | null
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

export default function ProjectPortalAccessPanel({ projectId }: { projectId: string }) {
  const supabase = createClient()
  const [rows, setRows] = useState<ProjectAccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [showGrantForm, setShowGrantForm] = useState(false)
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantEmail, setGrantEmail] = useState('')

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('project_access')
        .select('id, contact_id, role, portal, is_active, granted_at, contacts(first_name, last_name, email)')
        .eq('project_id', projectId)
        .order('granted_at', { ascending: false })

      if (qErr) {
        setError(qErr.message)
        setRows([])
        return
      }

      const mapped: ProjectAccessRow[] = (data || []).map((r: Record<string, unknown>) => {
        const c = (r.contacts as Record<string, unknown>) || {}
        const first = (c.first_name as string) || ''
        const last = (c.last_name as string) || ''
        return {
          access_id: (r.id as string) || '',
          contact_id: (r.contact_id as string) || '',
          contact_name: `${first} ${last}`.trim() || '—',
          contact_email: (c.email as string) || '',
          role: (r.role as ContactRole) || 'other',
          portal: (r.portal as PortalCode) || 'cp',
          is_active: r.is_active === null || r.is_active === undefined ? true : Boolean(r.is_active),
          granted_at: (r.granted_at as string) || null,
        }
      })
      setRows(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portal access')
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase])

  useEffect(() => { load() }, [load])

  async function copyPortalUrl(row: ProjectAccessRow) {
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

  // Grants access directly against project_access — there is no dedicated RPC for
  // adding a secondary contact to an *existing* project (create_project_for_contact
  // creates a new project + its first grant together). A contact must already exist
  // in `contacts`; this does not create one.
  async function handleGrantAccess() {
    const email = grantEmail.trim()
    if (!email) return
    setGranting(true)
    setGrantError(null)
    try {
      const { data: contact, error: findErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (findErr) throw new Error(findErr.message)
      if (!contact) throw new Error(`No contact found with email ${email}. Add them as a contact first.`)

      const { data: auth } = await supabase.auth.getUser()
      const { error: insErr } = await supabase.from('project_access').insert({
        project_id: projectId,
        contact_id: contact.id,
        role: 'other',
        portal: 'cp',
        is_active: true,
        granted_by: auth?.user?.id ?? null,
        granted_at: new Date().toISOString(),
      })
      if (insErr) throw new Error(insErr.message)

      setGrantEmail('')
      setShowGrantForm(false)
      await load()
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Failed to grant access')
    } finally {
      setGranting(false)
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

  const portalUrl = portalHref()

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Client Portal Access <span className="text-slate-400 font-normal">({rows.length})</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Clients sign in at <span className="font-mono">/portal</span> via magic link — access is resolved from their contact record.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrantForm((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            + Grant access
          </button>
          <button
            onClick={load}
            className="text-xs px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {showGrantForm && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <input
            type="email"
            placeholder="Contact's email (must already exist in Contacts)"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-md"
          />
          <button
            onClick={handleGrantAccess}
            disabled={granting || !grantEmail.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md"
          >
            {granting ? 'Granting…' : 'Grant'}
          </button>
          {grantError && <p className="text-xs text-red-600 ml-2">{grantError}</p>}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">No one has been granted client portal access yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const copied = copiedId === row.access_id
            return (
              <div key={row.access_id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 truncate">{row.contact_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200 uppercase tracking-wide">
                      client portal
                    </span>
                    {!row.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {row.contact_email || '—'} · granted {fmtDate(row.granted_at)}
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
