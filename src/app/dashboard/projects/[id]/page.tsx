'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DealStageStepper from '@/components/deals/DealStageStepper'
import ProjectPortalAccessPanel from '@/components/panels/ProjectPortalAccessPanel'
import { PROJECT_STATUSES } from '@/lib/types'
import type { Project, ProjectDeliverable, ProjectStatus, DeliverableStatus, DeliverableType } from '@/lib/types'

// ============================================================
// BROKER PROJECT DASHBOARD — Phase 14.4
// ------------------------------------------------------------
// Broker-side counterpart to src/app/portal/ProjectView.tsx (the
// already-live client portal). Live queries/mutations:
//   - projects.select('*').eq('id', id) / .update({ project_status })
//   - project_deliverables.select('*').eq('project_id', id) / insert / update
//   - data_rooms + data_room_folders where parent_type='project'
//   - portal_sessions.select('*').eq('project_id', id) — column added this
//     phase; will read real rows once/if portal-visit logging is added,
//     honestly empty until then rather than fabricated.
// Uses the canonical Project/ProjectDeliverable types from lib/types.ts
// directly (no local override) — unlike deals/[id]/page.tsx, there's no
// deals->seller_listings fallback-mapping complexity here to work around.
// ============================================================

interface DataRoomFolder {
  id: string
  name: string
  url: string | null
}
interface DataRoomInfo {
  name: string
  drive_root_url: string | null
  folders: DataRoomFolder[]
}
interface ActivityEntry {
  id: string
  contact: string
  action: string
  time: string
  portal: string
}

const SEEDED_PROJECT: Project = {
  id: 'p1000001',
  broker_id: '',
  project_name: 'Riverside Bakery — Valuation Engagement',
  service_type: 'business_valuation',
  scope_description: 'Full USPAP-style business valuation ahead of a possible sale.',
  client_contact_id: null,
  project_status: 'in_progress',
  proposal_amount: 3500,
  actual_fee: null,
  payment_terms: '50% retainer, balance on delivery',
  date_started: '2026-07-15',
  due_date: '2026-08-15',
  date_completed: null,
  date_invoiced: null,
  date_paid: null,
  hours_estimated: 20,
  hours_actual: 8,
  lead_source: 'Referral',
  conversion_opportunity: null,
  related_deal_id: null,
  valuation_id: null,
  proposal_url: null,
  invoice_url: null,
  notes: 'Owner considering a sale in 12-18 months; valuation will inform pricing strategy.',
  scope_statement: null,
  engagement_type: null,
  billing_model: 'fixed_fee',
  hourly_rate: null,
  retainer_amount: 1750,
  completion_percent: 35,
  kickoff_at: '2026-07-15T00:00:00Z',
  target_completion_at: '2026-08-15T00:00:00Z',
  actual_completion_at: null,
  consulting_category: null,
  engagement_tags: null,
  notion_page_id: null,
  source_opportunity_id: null,
  source_lead_id: null,
  primary_business_id: null,
  primary_property_id: null,
  resulting_listing_id: null,
  created_at: '2026-07-15T00:00:00Z',
  updated_at: '2026-07-15T00:00:00Z',
}
const SEEDED_DELIVERABLES: ProjectDeliverable[] = [
  { id: 'd1', project_id: 'p1000001', deliverable_name: 'Business Valuation Report', deliverable_type: 'valuation_report', description: null, status: 'in_progress', due_date: '2026-08-15', date_completed: null, date_delivered: null, storage_path: null, external_url: null, visible_to_client: true, notes: null, created_at: '2026-07-15T00:00:00Z' },
  { id: 'd2', project_id: 'p1000001', deliverable_name: 'Financial Model', deliverable_type: 'financial_model', description: null, status: 'not_started', due_date: '2026-08-10', date_completed: null, date_delivered: null, storage_path: null, external_url: null, visible_to_client: false, notes: null, created_at: '2026-07-15T00:00:00Z' },
]

const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  valuation_report: 'Valuation Report',
  financial_model: 'Financial Model',
  business_plan: 'Business Plan',
  market_study: 'Market Study',
  lease_abstract: 'Lease Abstract',
  memo_opinion_letter: 'Memo / Opinion Letter',
  presentation: 'Presentation',
  cim_document: 'CIM',
  om_document: 'OM',
  other: 'Other',
}
const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  under_review: 'Under Review',
  completed: 'Completed',
  delivered: 'Delivered',
}
const DELIVERABLE_STATUS_COLOR: Record<DeliverableStatus, string> = {
  not_started: 'bg-slate-50 text-slate-500 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export default function BrokerProjectDashboard() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [project, setProject] = useState<Project>(SEEDED_PROJECT)
  const [clientName, setClientName] = useState<string | null>(null)
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>(SEEDED_DELIVERABLES)
  const [dataRoom, setDataRoom] = useState<DataRoomInfo | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(true)

  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'deliverables' | 'dataroom' | 'activity'>('deliverables')

  const [showAddDeliverable, setShowAddDeliverable] = useState(false)
  const [addingDeliverable, setAddingDeliverable] = useState(false)
  const [addDeliverableError, setAddDeliverableError] = useState<string | null>(null)
  const [deliverableForm, setDeliverableForm] = useState({
    deliverable_name: '', deliverable_type: 'other' as DeliverableType, due_date: '', visible_to_client: false,
  })
  const [updatingDeliverableId, setUpdatingDeliverableId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    let live = true
    try {
      const { data: projectRow, error: projectErr } = await supabase
        .from('projects').select('*').eq('id', id).maybeSingle()
      if (!projectErr && projectRow) {
        setProject(projectRow as Project)
        if (projectRow.client_contact_id) {
          const { data: contact } = await supabase
            .from('contacts').select('first_name, last_name, company_name')
            .eq('id', projectRow.client_contact_id as string).maybeSingle()
          if (contact) {
            const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
            setClientName(name || (contact.company_name as string) || null)
          }
        }
      } else {
        live = false
      }

      const { data: delivRows, error: delivErr } = await supabase
        .from('project_deliverables').select('*').eq('project_id', id).order('created_at', { ascending: true })
      if (!delivErr) {
        if (Array.isArray(delivRows) && delivRows.length > 0) setDeliverables(delivRows as ProjectDeliverable[])
        else if (live) setDeliverables([])
      } else {
        live = false
      }

      const { data: roomRows, error: roomErr } = await supabase
        .from('data_rooms')
        .select('id, name, drive_root_url')
        .eq('parent_type', 'project')
        .eq('parent_id', id)
        .eq('is_active', true)
        .maybeSingle()
      if (!roomErr && roomRows) {
        const { data: folderRows } = await supabase
          .from('data_room_folders')
          .select('id, name, url')
          .eq('data_room_id', roomRows.id as string)
        setDataRoom({
          name: (roomRows.name as string) || 'Engagement Data Room',
          drive_root_url: (roomRows.drive_root_url as string) || null,
          folders: (folderRows || []) as DataRoomFolder[],
        })
      } else {
        setDataRoom(null)
      }

      const { data: actRows, error: actErr } = await supabase
        .from('portal_sessions')
        .select('*, contacts(first_name, last_name)')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(25)
      if (!actErr && Array.isArray(actRows)) {
        setActivity(actRows.map((r: Record<string, unknown>) => {
          const c = (r.contacts as Record<string, unknown>) || {}
          return {
            id: (r.id as string) || '',
            contact: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
            action: (r.action as string) || 'view_project',
            time: fmtDate((r.created_at as string) || null),
            portal: (r.portal as string) || 'cp',
          }
        }))
      }

      setUsingDemo(!live)
    } catch (err) {
      console.error('[project-dashboard] load failed:', err)
      setUsingDemo(true)
    } finally {
      setLoading(false)
    }
  }, [id, supabase])

  useEffect(() => { loadAll() }, [loadAll])

  // No advance_project_status RPC exists (unlike advance_buyer_stage for Deals) — Projects
  // has no gate condition today, so this writes directly to projects.project_status.
  async function handleAdvanceStatus(newStatus: string) {
    if (!id || usingDemo || updatingStatus) return
    setUpdatingStatus(true)
    setStatusError(null)
    try {
      const { error } = await supabase
        .from('projects')
        .update({ project_status: newStatus })
        .eq('id', id)
      if (error) throw new Error(error.message)
      setProject((prev) => ({ ...prev, project_status: newStatus as ProjectStatus }))
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update project status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleAddDeliverable() {
    if (!deliverableForm.deliverable_name.trim()) return
    setAddingDeliverable(true)
    setAddDeliverableError(null)
    try {
      if (usingDemo) {
        setDeliverables((prev) => [...prev, {
          id: `demo-${Date.now()}`,
          project_id: project.id,
          deliverable_name: deliverableForm.deliverable_name,
          deliverable_type: deliverableForm.deliverable_type,
          description: null,
          status: 'not_started',
          due_date: deliverableForm.due_date || null,
          date_completed: null,
          date_delivered: null,
          storage_path: null,
          external_url: null,
          visible_to_client: deliverableForm.visible_to_client,
          notes: null,
          created_at: new Date().toISOString(),
        }])
      } else {
        const { error } = await supabase.from('project_deliverables').insert({
          project_id: id,
          deliverable_name: deliverableForm.deliverable_name,
          deliverable_type: deliverableForm.deliverable_type,
          status: 'not_started',
          due_date: deliverableForm.due_date || null,
          visible_to_client: deliverableForm.visible_to_client,
        })
        if (error) throw new Error(error.message)
        await loadAll()
      }
      setShowAddDeliverable(false)
      setDeliverableForm({ deliverable_name: '', deliverable_type: 'other', due_date: '', visible_to_client: false })
    } catch (err) {
      setAddDeliverableError(err instanceof Error ? err.message : 'Failed to add deliverable')
    } finally {
      setAddingDeliverable(false)
    }
  }

  async function handleUpdateDeliverableStatus(deliverable: ProjectDeliverable, newStatus: DeliverableStatus) {
    setUpdatingDeliverableId(deliverable.id)
    try {
      const stamps: Record<string, string> = {}
      if (newStatus === 'completed') stamps.date_completed = new Date().toISOString().slice(0, 10)
      if (newStatus === 'delivered') stamps.date_delivered = new Date().toISOString().slice(0, 10)
      if (usingDemo) {
        setDeliverables((prev) => prev.map((d) => d.id === deliverable.id ? { ...d, status: newStatus, ...stamps } : d))
        return
      }
      const { error } = await supabase
        .from('project_deliverables')
        .update({ status: newStatus, ...stamps })
        .eq('id', deliverable.id)
      if (error) throw error
      setDeliverables((prev) => prev.map((d) => d.id === deliverable.id ? { ...d, status: newStatus, ...stamps } : d))
    } catch (err) {
      console.error('[project-dashboard] deliverable status update failed:', err)
    } finally {
      setUpdatingDeliverableId(null)
    }
  }

  async function handleToggleVisible(deliverable: ProjectDeliverable) {
    setUpdatingDeliverableId(deliverable.id)
    try {
      const next = !deliverable.visible_to_client
      if (usingDemo) {
        setDeliverables((prev) => prev.map((d) => d.id === deliverable.id ? { ...d, visible_to_client: next } : d))
        return
      }
      const { error } = await supabase
        .from('project_deliverables')
        .update({ visible_to_client: next })
        .eq('id', deliverable.id)
      if (error) throw error
      setDeliverables((prev) => prev.map((d) => d.id === deliverable.id ? { ...d, visible_to_client: next } : d))
    } catch (err) {
      console.error('[project-dashboard] visibility toggle failed:', err)
    } finally {
      setUpdatingDeliverableId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading project…</p>
        </div>
      </div>
    )
  }

  const delivered = deliverables.filter((d) => d.status === 'delivered' || d.status === 'completed').length

  return (
    <div className="min-h-screen bg-gray-50 -mx-6 -my-6">
      {usingDemo && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800">
          Demo mode — showing seeded test data. Live tables not populated for this project yet.
        </div>
      )}

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <nav className="mb-2 text-xs text-slate-500 flex items-center gap-1 flex-wrap">
            <Link href="/dashboard" className="hover:text-slate-900 hover:underline transition">Records</Link>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-slate-300"><path d="M7 5l5 5-5 5" /></svg>
            <Link href="/dashboard/projects" className="hover:text-slate-900 hover:underline transition">Projects</Link>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-slate-300"><path d="M7 5l5 5-5 5" /></svg>
            <span className="text-slate-700 font-medium truncate">{project.project_name}</span>
          </nav>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{project.project_name}</h1>
              </div>
              <p className="text-gray-500 mt-1">
                {clientName || 'No client linked'} · {(project.service_type || '').replace(/_/g, ' ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{fmt(project.actual_fee ?? project.proposal_amount)}</p>
              <p className="text-sm text-gray-500">
                {project.actual_fee != null ? 'Actual fee' : 'Proposed fee'} · Due {fmtDate(project.due_date || project.target_completion_at)}
              </p>
            </div>
          </div>

          <DealStageStepper
            stages={PROJECT_STATUSES}
            currentKey={project.project_status}
            onSelectStage={handleAdvanceStatus}
            disabled={usingDemo}
            updating={updatingStatus}
            error={statusError}
          />

          <div className="mt-4">
            <ProjectPortalAccessPanel projectId={project.id} />
          </div>

          <div className="flex gap-8 mt-5 pt-4 border-t border-gray-100">
            <div><span className="text-2xl font-bold text-blue-600">{deliverables.length}</span><span className="text-sm text-gray-500 ml-1.5">Deliverables</span></div>
            <div><span className="text-2xl font-bold text-green-600">{delivered}</span><span className="text-sm text-gray-500 ml-1.5">Delivered</span></div>
            <div><span className="text-2xl font-bold text-purple-600">{project.completion_percent ?? 0}%</span><span className="text-sm text-gray-500 ml-1.5">Complete</span></div>
            <div><span className="text-2xl font-bold text-amber-600">{project.hours_actual ?? 0}</span><span className="text-sm text-gray-500 ml-1.5">Hours logged{project.hours_estimated ? ` / ${project.hours_estimated} est.` : ''}</span></div>
          </div>

          <div className="flex gap-1 mt-5">
            {([['deliverables', 'Deliverables'], ['dataroom', 'Data Room'], ['activity', 'Activity Log']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'deliverables' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Deliverables ({deliverables.length})</h3>
              <button
                onClick={() => setShowAddDeliverable(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Add Deliverable
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deliverable</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Visible to Client</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliverables.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">No deliverables yet.</td></tr>
                  ) : deliverables.map((d) => (
                    <tr key={d.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{d.deliverable_name}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{DELIVERABLE_TYPE_LABELS[d.deliverable_type] || d.deliverable_type}</td>
                      <td className="px-5 py-3">
                        <select
                          value={d.status}
                          disabled={updatingDeliverableId === d.id}
                          onChange={(e) => handleUpdateDeliverableStatus(d, e.target.value as DeliverableStatus)}
                          className={`text-xs px-2 py-1 rounded-full border disabled:opacity-50 ${DELIVERABLE_STATUS_COLOR[d.status]}`}
                        >
                          {(Object.keys(DELIVERABLE_STATUS_LABELS) as DeliverableStatus[]).map((s) => (
                            <option key={s} value={s}>{DELIVERABLE_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{fmtDate(d.due_date)}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleVisible(d)}
                          disabled={updatingDeliverableId === d.id}
                          className={`text-xs px-2 py-1 rounded-full border disabled:opacity-50 ${
                            d.visible_to_client
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {d.visible_to_client ? '✓ Visible' : 'Hidden'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'dataroom' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Data Room</h3>
            {!dataRoom ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                <p className="text-sm text-gray-500">No data room has been provisioned for this engagement yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">{dataRoom.name}</h4>
                  {dataRoom.drive_root_url && (
                    <a href={dataRoom.drive_root_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                      Open in Google Drive ↗
                    </a>
                  )}
                </div>
                {dataRoom.folders.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No folders yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dataRoom.folders.map((f) => (
                      <a
                        key={f.id}
                        href={f.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-lg leading-none">📁</span>
                        <span className="text-sm font-medium text-slate-800">{f.name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Portal Activity</h3>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No portal activity recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {activity.map((act) => (
                    <div key={act.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <div>
                          <p className="text-sm text-gray-900">
                            <span className="font-semibold">{act.contact}</span> {act.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-400">Portal: {act.portal.toUpperCase()} · {act.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showAddDeliverable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Add Deliverable</h3>
            <div className="space-y-3 mt-4">
              <input
                type="text"
                placeholder="Deliverable name"
                value={deliverableForm.deliverable_name}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, deliverable_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={deliverableForm.deliverable_type}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, deliverable_type: e.target.value as DeliverableType })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {(Object.keys(DELIVERABLE_TYPE_LABELS) as DeliverableType[]).map((t) => (
                    <option key={t} value={t}>{DELIVERABLE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={deliverableForm.due_date}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, due_date: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={deliverableForm.visible_to_client}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, visible_to_client: e.target.checked })}
                />
                Visible to client immediately
              </label>
              {addDeliverableError && <p className="text-sm text-red-600">{addDeliverableError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowAddDeliverable(false); setAddDeliverableError(null) }}
                disabled={addingDeliverable}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDeliverable}
                disabled={addingDeliverable || !deliverableForm.deliverable_name.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
              >
                {addingDeliverable ? 'Adding…' : 'Add Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
