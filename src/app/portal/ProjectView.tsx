'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// CONSULTING CLIENT PORTAL VIEW — Phase 12.12-C
// Third portal surface (Roadmap v4.0): PROJECTS persona.
// Calls fn_portal_project_dashboard(p_project_id) and renders:
//   - Engagement header (project name, service type, status)
//   - Progress: completion %, kickoff → target dates
//   - Deliverables shelf (visible_to_client only), grouped by status
//   - Scope of engagement
//   - Broker contact card
// Canonicality: Notion PROJECTS remains source-of-record; this
// view renders the MSOS transactional mirror.
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  scoping: 'Scoping',
  proposal: 'Proposal',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  invoiced: 'Invoiced',
  paid: 'Complete',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  in_progress: { bg: '#DBEAFE', text: '#1E40AF' },
  delivered: { bg: '#D1FAE5', text: '#065F46' },
  paid: { bg: '#D1FAE5', text: '#065F46' },
  invoiced: { bg: '#FEF3C7', text: '#92400E' },
  on_hold: { bg: '#FEF3C7', text: '#92400E' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
}

const DELIVERABLE_ICONS: Record<string, string> = {
  valuation_report: '📈',
  financial_model: '💰',
  memo_opinion_letter: '📝',
  market_study: '🗺️',
  presentation: '📊',
  spreadsheet: '📓',
  document: '📄',
  other: '📄',
}

const DELIVERABLE_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  delivered: { label: 'Delivered', bg: '#D1FAE5', text: '#065F46' },
  completed: { label: 'Completed', bg: '#D1FAE5', text: '#065F46' },
  in_progress: { label: 'In Progress', bg: '#DBEAFE', text: '#1E40AF' },
  in_review: { label: 'In Review', bg: '#EDE9FE', text: '#5B21B6' },
  not_started: { label: 'Upcoming', bg: '#F1F5F9', text: '#475569' },
}

interface ProjectPayload {
  id: string
  project_name: string | null
  service_type: string | null
  scope_description: string | null
  scope_statement: string | null
  project_status: string | null
  completion_percent: number | null
  date_started: string | null
  due_date: string | null
  kickoff_at: string | null
  target_completion_at: string | null
  date_completed: string | null
  engagement_type: string | null
  billing_model: string | null
  payment_terms: string | null
  created_at: string
}

interface DeliverableRow {
  id: string
  deliverable_name: string
  deliverable_type: string | null
  description: string | null
  status: string | null
  due_date: string | null
  date_completed: string | null
  date_delivered: string | null
  external_url: string | null
  has_file: boolean
  storage_path: string | null
  created_at: string
}

interface DashboardPayload {
  project: ProjectPayload
  deliverables: DeliverableRow[]
  broker: { name: string | null; company: string | null } | null
  generated_at: string
}

interface ProjectViewProps {
  projectId: string
  contactName: string
  onSignOut: () => void
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function titleCase(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ProjectView({ projectId, contactName, onSignOut }: ProjectViewProps) {
  const supabase = createClient()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: payload, error: rpcErr } = await supabase.rpc('fn_portal_project_dashboard', {
        p_project_id: projectId,
      })
      if (rpcErr) throw rpcErr
      setData(payload as DashboardPayload)
    } catch (err) {
      console.error('[project-portal] load failed:', err)
      setError('We could not load your engagement. Please try again or contact your advisor.')
    } finally {
      setLoading(false)
    }
  }, [supabase, projectId])

  useEffect(() => { load() }, [load])

  async function openDeliverable(d: DeliverableRow) {
    if (d.external_url) {
      window.open(d.external_url, '_blank', 'noopener')
      return
    }
    if (d.has_file && d.storage_path) {
      const { data: signed, error: signErr } = await supabase.storage
        .from('consulting-project-documents')
        .createSignedUrl(d.storage_path, 3600)
      if (!signErr && signed?.signedUrl) {
        window.open(signed.signedUrl, '_blank', 'noopener')
        return
      }
    }
    alert('This deliverable is not yet available for download — please contact your advisor.')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Loading your engagement...</p>
        </div>
      </div>
    )
  }

  if (error || !data?.project) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
          <p className="text-slate-700 mb-4">{error || 'Engagement not found.'}</p>
          <button onClick={onSignOut} className="text-sm text-blue-600 hover:underline">Sign out</button>
        </div>
      </div>
    )
  }

  const p = data.project
  const statusKey = p.project_status || 'in_progress'
  const badge = STATUS_BADGE[statusKey] || { bg: '#F1F5F9', text: '#475569' }
  const pct = Math.max(0, Math.min(100, Number(p.completion_percent ?? 0)))
  const delivered = data.deliverables.filter((d) => d.status === 'delivered' || d.status === 'completed')
  const upcoming = data.deliverables.filter((d) => d.status !== 'delivered' && d.status !== 'completed')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              CRE Resources — Client Portal
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{p.project_name || 'Consulting Engagement'}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {titleCase(p.service_type)}{p.engagement_type ? ` · ${titleCase(p.engagement_type)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              {STATUS_LABELS[statusKey] || titleCase(statusKey)}
            </span>
            <button onClick={onSignOut} className="text-sm text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Progress */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Engagement Progress</h2>
            <span className="text-sm font-semibold text-slate-900">{pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">Kickoff</p>
              <p className="font-medium text-slate-900">{fmtDate(p.kickoff_at || p.date_started)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Target Completion</p>
              <p className="font-medium text-slate-900">{fmtDate(p.target_completion_at || p.due_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Deliverables Released</p>
              <p className="font-medium text-slate-900">{delivered.length} of {data.deliverables.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{p.date_completed ? 'Completed' : 'Status'}</p>
              <p className="font-medium text-slate-900">
                {p.date_completed ? fmtDate(p.date_completed) : (STATUS_LABELS[statusKey] || titleCase(statusKey))}
              </p>
            </div>
          </div>
        </div>

        {/* Deliverables shelf */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Deliverables</h2>
          {data.deliverables.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No deliverables have been released yet — they will appear here as your advisor publishes them.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...delivered, ...upcoming].map((d) => {
                const st = DELIVERABLE_STATUS[d.status || 'not_started'] || DELIVERABLE_STATUS.not_started
                const openable = Boolean(d.external_url || d.has_file)
                return (
                  <div key={d.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-xl leading-none mt-0.5">
                        {DELIVERABLE_ICONS[d.deliverable_type || 'other'] || '📄'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{d.deliverable_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {titleCase(d.deliverable_type)}
                          {d.due_date ? ` · Due ${fmtDate(d.due_date)}` : ''}
                          {d.date_delivered ? ` · Delivered ${fmtDate(d.date_delivered)}` : ''}
                        </p>
                        {d.description && <p className="text-xs text-slate-500 mt-1">{d.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: st.bg, color: st.text }}
                      >
                        {st.label}
                      </span>
                      {openable && (
                        <button
                          onClick={() => openDeliverable(d)}
                          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Scope */}
        {(p.scope_statement || p.scope_description) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Scope of Engagement</h2>
            <p className="text-sm text-slate-600 whitespace-pre-line">
              {p.scope_statement || p.scope_description}
            </p>
            {p.payment_terms && (
              <p className="text-xs text-slate-400 mt-3">Payment terms: {p.payment_terms}</p>
            )}
          </div>
        )}

        {/* Broker card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Your Advisor</p>
            <p className="font-semibold text-slate-900">{data.broker?.name || 'Mark Mueller, CAIBVS™'}</p>
            <p className="text-sm text-slate-500">{data.broker?.company || 'CRE Resources, LLC'}</p>
          </div>
          <p className="text-xs text-slate-400">Signed in as {contactName}</p>
        </div>
      </div>
    </div>
  )
}
