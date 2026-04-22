'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// SELLER PORTAL VIEW — Phase 12.12a
// Calls fn_portal_seller_dashboard(p_listing_id) and renders:
//   - Listing header (name, industry, asking price, stage, DOM)
//   - Engagement stats grid (total buyers, NDAs signed, qualified, LOI, DD)
//   - Stage funnel (by_stage)
//   - Recent activity feed (top 20)
//   - Documents section (grouped by confidential_tier)
// ============================================================

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  nda_executed: 'NDA Signed',
  qualified: 'Qualified',
  loi_negotiation: 'LOI',
  under_contract: 'Under Contract',
  due_diligence: 'Due Diligence',
  financing: 'Financing',
  closing: 'Closing',
  terminated: 'Terminated',
}

const STAGE_ORDER = [
  'inquiry',
  'nda_executed',
  'qualified',
  'loi_negotiation',
  'under_contract',
  'due_diligence',
  'financing',
  'closing',
]

const DOC_ICONS: Record<string, string> = {
  om: '📋', cim: '📊', bvr: '📈', deal_workbook: '📓',
  financial: '💰', nda: '🔒', loi: '📝', disclosure: '📑',
  legal: '⚖️', other: '📄',
}

const TIER_LABELS: Record<string, string> = {
  level_1_basic: 'Basic (Pre-NDA)',
  level_2_nda_required: 'NDA Required',
  level_3_deal_room: 'Deal Room',
}

const TIER_BADGE: Record<string, { bg: string; text: string }> = {
  level_1_basic: { bg: '#D1FAE5', text: '#065F46' },
  level_2_nda_required: { bg: '#FEF3C7', text: '#92400E' },
  level_3_deal_room: { bg: '#FEE2E2', text: '#991B1B' },
}

interface ListingPayload {
  id: string
  listing_name: string | null
  industry: string | null
  asking_price: number | null
  annual_revenue: number | null
  ebitda: number | null
  sde: number | null
  stage: string | null
  days_on_market: number
  listed_on: string | null
  last_activity_at: string | null
  commission_pct: number | null
}

interface EngagementPayload {
  total_buyers: number
  ndas_signed: number
  qualified_buyers: number
  active_loi: number
  in_due_diligence: number
  by_stage: Record<string, number>
}

interface ActivityRow {
  id: string
  kind: string
  subject: string | null
  summary: string | null
  occurred_at: string
  from_stage: string | null
  to_stage: string | null
  actor_name: string | null
}

interface DocumentRow {
  id: string
  document_name: string
  document_type: string
  confidential_tier: string | null
  storage_path: string | null
  uploaded_at: string | null
  version: number | null
}

interface DashboardPayload {
  listing: ListingPayload
  engagement: EngagementPayload
  activity: ActivityRow[]
  documents: DocumentRow[]
  generated_at: string
}

// Phase 12.12c — per-document view telemetry
interface DocTelemetryRow {
  document_id: string
  document_name: string
  document_type: string
  confidential_tier: string | null
  views: number
  downloads: number
  unique_viewers: number
  last_viewed_at: string | null
  last_viewer_contact_id: string | null
  last_viewer_name: string | null
}

interface SellerViewProps {
  listingId: string
  contactName: string
  onSignOut: () => void
}

function formatUsd(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SellerView({ listingId, contactName, onSignOut }: SellerViewProps) {
  const supabase = createClient()

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [telemetry, setTelemetry] = useState<Record<string, DocTelemetryRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fire the dashboard + telemetry RPCs in parallel
      const [dashRes, telRes] = await Promise.all([
        supabase.rpc('fn_portal_seller_dashboard', { p_listing_id: listingId }),
        supabase.rpc('fn_portal_doc_telemetry', {
          p_parent_type: 'seller_listing',
          p_parent_id: listingId,
        }),
      ])

      if (dashRes.error) {
        setError(dashRes.error.message || 'Failed to load seller dashboard')
        return
      }
      if (!dashRes.data) {
        setError('No dashboard data returned')
        return
      }
      setDashboard(dashRes.data as unknown as DashboardPayload)

      // Telemetry failure is non-fatal — just log and render zeros
      if (telRes.error) {
        console.warn('[seller-portal] telemetry load failed:', telRes.error)
        setTelemetry({})
      } else if (Array.isArray(telRes.data)) {
        const map: Record<string, DocTelemetryRow> = {}
        for (const row of telRes.data as DocTelemetryRow[]) {
          map[row.document_id] = row
        }
        setTelemetry(map)
      } else {
        setTelemetry({})
      }
    } catch (err) {
      console.error('[seller-portal] load failed:', err)
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }, [supabase, listingId])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  async function handleDocument(doc: DocumentRow, mode: 'view' | 'download') {
    if (!doc.storage_path) return
    setDownloadingDoc(doc.id)
    try {
      const { data, error: urlErr } = await supabase.storage
        .from('deal-documents')
        .createSignedUrl(
          doc.storage_path,
          3600,
          mode === 'download' ? { download: true } : undefined,
        )
      if (!urlErr && data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener')
      }
    } finally {
      setTimeout(() => setDownloadingDoc(null), 800)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Loading your seller dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md w-full">
          <h1 className="text-xl font-bold text-red-900 mb-2">Unable to load your dashboard</h1>
          <p className="text-sm text-slate-600 mb-4">{error || 'Unknown error'}</p>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const { listing, engagement, activity, documents } = dashboard
  const stageKey = listing.stage || 'active'

  // Group documents by confidential tier
  const docsByTier: Record<string, DocumentRow[]> = {}
  documents.forEach((d) => {
    const tier = d.confidential_tier || 'level_1_basic'
    if (!docsByTier[tier]) docsByTier[tier] = []
    docsByTier[tier].push(d)
  })

  // Max funnel value for bar scaling
  const byStage = engagement.by_stage || {}
  const maxStageCount = Math.max(
    1,
    ...STAGE_ORDER.map((s) => byStage[s] || 0),
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">MS</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">MainStreetOS</h1>
              <p className="text-xs text-slate-500">Seller Progress Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{contactName}</span>
            <button
              onClick={onSignOut}
              className="text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Listing header card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {listing.listing_name || 'Your Listing'}
              </h2>
              <p className="text-slate-500 mt-1">
                {listing.industry || 'Industry pending'}
                {listing.listed_on ? ` • Listed ${formatDate(listing.listed_on)}` : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold bg-blue-50 text-blue-900 border border-blue-200">
                {listing.days_on_market} days on market
              </div>
              {listing.last_activity_at && (
                <p className="text-xs text-slate-400 mt-2">
                  Last activity: {formatDateTime(listing.last_activity_at)}
                </p>
              )}
            </div>
          </div>

          {/* Price + financial stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Asking Price</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatUsd(listing.asking_price)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Revenue (TTM)</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatUsd(listing.annual_revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">SDE (TTM)</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatUsd(listing.sde)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">EBITDA (TTM)</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatUsd(listing.ebitda)}
              </p>
            </div>
          </div>
        </div>

        {/* Engagement summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatTile label="Total Buyers" value={engagement.total_buyers} color="#3B82F6" />
          <StatTile label="NDAs Signed" value={engagement.ndas_signed} color="#10B981" />
          <StatTile label="Qualified" value={engagement.qualified_buyers} color="#8B5CF6" />
          <StatTile label="Active LOI" value={engagement.active_loi} color="#EC4899" />
          <StatTile label="In Due Diligence" value={engagement.in_due_diligence} color="#F97316" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — funnel + activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Buyer stage funnel */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                📊 Buyer Stage Funnel
              </h3>
              {engagement.total_buyers === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  No buyer engagements yet. Once prospects inquire, you&apos;ll see their
                  progression through NDA, qualification, LOI, due diligence, and closing here.
                </p>
              ) : (
                <div className="space-y-2">
                  {STAGE_ORDER.map((stage) => {
                    const count = byStage[stage] || 0
                    const pct = (count / maxStageCount) * 100
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <div className="w-32 text-sm text-slate-600 flex-shrink-0">
                          {STAGE_LABELS[stage]}
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-end pr-2">
                            <span className="text-xs font-semibold text-slate-700">{count}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  🕒 Recent Activity
                  <span className="text-sm font-normal text-slate-500">
                    ({activity.length})
                  </span>
                </h3>
              </div>
              {activity.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-slate-500 italic">
                    No activity recorded yet. Your broker&apos;s outreach, buyer inquiries,
                    and document events will appear here as they happen.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                  {activity.map((a) => (
                    <div key={a.id} className="px-6 py-3 hover:bg-blue-50/40 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {a.subject || a.kind.replace(/_/g, ' ')}
                          </p>
                          {a.summary && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {a.summary}
                            </p>
                          )}
                          {(a.from_stage || a.to_stage) && (
                            <p className="text-xs text-blue-700 mt-1">
                              {a.from_stage ? STAGE_LABELS[a.from_stage] || a.from_stage : '—'}
                              {' → '}
                              {a.to_stage ? STAGE_LABELS[a.to_stage] || a.to_stage : '—'}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-400 whitespace-nowrap">
                            {formatDateTime(a.occurred_at)}
                          </p>
                          {a.actor_name && (
                            <p className="text-xs text-slate-500 mt-0.5">{a.actor_name}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — documents + broker card */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  📁 Listing Documents
                  <span className="text-xs font-normal text-slate-500">
                    ({documents.length})
                  </span>
                </h4>
              </div>
              {documents.length === 0 ? (
                <p className="px-5 py-6 text-xs text-slate-500 italic">
                  No documents attached to this listing yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {Object.entries(docsByTier).map(([tier, docs]) => (
                    <div key={tier}>
                      <div className="px-5 py-2 bg-slate-50/50">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: TIER_BADGE[tier]?.bg || '#F3F4F6',
                            color: TIER_BADGE[tier]?.text || '#374151',
                          }}
                        >
                          {TIER_LABELS[tier] || tier}
                        </span>
                      </div>
                      {docs.map((doc) => {
                        const tel = telemetry[doc.id]
                        const hasViews = tel && tel.views > 0
                        return (
                          <div
                            key={doc.id}
                            className="px-5 py-3 hover:bg-blue-50/40 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-lg flex-shrink-0">
                                  {DOC_ICONS[doc.document_type] || '📄'}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {doc.document_name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {doc.document_type.replace(/_/g, ' ')}
                                    {doc.version ? ` • v${doc.version}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                <button
                                  onClick={() => handleDocument(doc, 'view')}
                                  disabled={downloadingDoc === doc.id || !doc.storage_path}
                                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 disabled:opacity-40"
                                >
                                  {downloadingDoc === doc.id ? '...' : 'View'}
                                </button>
                              </div>
                            </div>
                            {/* Phase 12.12c — per-document view telemetry */}
                            <div className="mt-2 ml-9 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              {hasViews ? (
                                <>
                                  <span title="Total view actions logged by buyers">
                                    👁 {tel.views} view{tel.views === 1 ? '' : 's'}
                                  </span>
                                  {tel.downloads > 0 && (
                                    <span title="Total download actions">
                                      ⬇ {tel.downloads} download{tel.downloads === 1 ? '' : 's'}
                                    </span>
                                  )}
                                  <span title="Distinct buyers who viewed this doc">
                                    · {tel.unique_viewers} unique
                                  </span>
                                  {tel.last_viewer_name && (
                                    <span className="text-slate-600">
                                      · Last: <span className="font-medium">{tel.last_viewer_name}</span>
                                      {' '}({formatRelative(tel.last_viewed_at)})
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="italic text-slate-400">No views yet</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Broker card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Your Broker</h4>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  MM
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Mark S. Mueller, CAIBVS™
                  </p>
                  <p className="text-xs text-slate-500">CRE Resources, LLC</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <a
                  href="tel:856-745-9706"
                  className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
                >
                  📞 856.745.9706
                </a>
                <a
                  href="mailto:markm@creresources.biz"
                  className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
                >
                  ✉️ markm@creresources.biz
                </a>
              </div>
            </div>

            {/* Current stage */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Current Listing Stage</h4>
              <p className="text-sm text-blue-800 capitalize">
                {stageKey.replace(/_/g, ' ')}
              </p>
              {listing.commission_pct != null && (
                <p className="text-xs text-blue-700 mt-2">
                  Commission: {Number(listing.commission_pct).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            © 2026 MainStreetOS™ — Powered by CRE Resources, LLC
          </p>
          <p className="text-xs text-slate-400">
            CONFIDENTIAL — Seller-scoped view
          </p>
        </div>
      </footer>
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
    </div>
  )
}
