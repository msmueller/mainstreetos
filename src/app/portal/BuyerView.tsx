'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import NdaAcceptanceModal from './NdaAcceptanceModal'

// pdf.js is heavy and browser-only — dynamic-import with ssr:false so
// it never runs on the server and doesn't bloat the initial bundle.
const PdfViewerModal = dynamic(() => import('./PdfViewerModal'), { ssr: false })

// ============================================================
// BUYER PORTAL VIEW — extracted in Phase 12.12a
// Phase 12.12b: click-accept NDA gating for level_2+ documents.
// Uses get_portal_view(p_contact_id) RPC. Public demo fallback
// is kept for unauthenticated visitors so /portal still renders.
// ============================================================

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  nda_executed: 'NDA Signed',
  qualified: 'Qualified Buyer',
  loi_negotiation: 'LOI Negotiation',
  under_contract: 'Under Contract',
  due_diligence: 'Due Diligence',
  financing: 'Financing & Approvals',
  closing: 'Closing',
  terminated: 'Terminated',
}
const STAGE_ORDER = Object.keys(STAGE_LABELS)

const PORTAL_LABELS: Record<string, string> = {
  om: 'Offering Memorandum',
  cim: 'Confidential Information',
  bp: 'Buyer Portal',
  dp: 'Deal Room',
  cp: 'Client Portal',
  pp: 'Property Portal',
  bvr: 'Valuation Report',
}

const DOC_ICONS: Record<string, string> = {
  om: '📋', cim: '📊', bvr: '📈', deal_workbook: '📓',
  financial: '💰', nda: '🔒', loi: '📝', disclosure: '📑',
  legal: '⚖️', other: '📄',
}

// Document types that remain viewable before NDA signature.
// Everything else is locked when NDA is required.
const PRE_NDA_VISIBLE_TYPES = new Set(['om', 'nda', 'other'])

type StageColor = { bg: string; text: string; border: string }
const STAGE_COLORS: Record<string, StageColor> = {
  inquiry: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  nda_executed: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  qualified: { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  loi_negotiation: { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
  under_contract: { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
  due_diligence: { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  financing: { bg: '#FFEDD5', text: '#9A3412', border: '#F97316' },
  closing: { bg: '#ECFDF5', text: '#047857', border: '#059669' },
  terminated: { bg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF' },
}

interface PortalDoc {
  id: string
  document_name: string
  document_type: string
  storage_path?: string | null
  mime_type?: string | null
}
interface PortalDeal {
  deal_id: string
  listing_name: string
  current_stage: string
  portal: string
  documents: PortalDoc[]
}

interface DealContext {
  parentType: string   // 'seller_listing' | 'buyer_engagement'
  parentId: string
}

interface NdaStatus {
  required: boolean
  accepted: boolean
  accepted_at: string | null
  acceptance_method: string | null
  current_tier: string | null
  current_stage: string | null
}

const SEEDED_DEAL: PortalDeal = {
  deal_id: 'd1000001',
  listing_name: 'La Guardiola Pizzeria',
  current_stage: 'qualified',
  portal: 'bp',
  documents: [
    { id: 'doc1', document_name: 'La Guardiola Pizzeria — Offering Memorandum', document_type: 'om' },
    { id: 'doc2', document_name: 'Buyer Profile Questionnaire (BPQ)', document_type: 'other' },
    { id: 'doc3', document_name: 'Non-Disclosure Agreement (NDA)', document_type: 'nda' },
    { id: 'doc4', document_name: 'La Guardiola Pizzeria — Confidential Information Memorandum', document_type: 'cim' },
    { id: 'doc5', document_name: 'Financial Summary — 3 Year Historical', document_type: 'financial' },
    { id: 'doc6', document_name: 'Business Valuation Report (BVR)', document_type: 'bvr' },
    { id: 'doc7', document_name: 'Deal Workbook — Recast P&L', document_type: 'deal_workbook' },
  ],
}

interface BuyerViewProps {
  contactId: string | null
  contactName: string
  isAuthenticated: boolean
  viewerEmail?: string | null
  onSignOut: () => void
}

interface PdfViewerState {
  open: boolean
  signedUrl: string | null
  documentName: string
}

const PDF_VIEWER_CLOSED: PdfViewerState = {
  open: false,
  signedUrl: null,
  documentName: '',
}

export default function BuyerView({
  contactId,
  contactName,
  isAuthenticated,
  viewerEmail,
  onSignOut,
}: BuyerViewProps) {
  const supabase = createClient()

  const [selectedDeal, setSelectedDeal] = useState<PortalDeal | null>(null)
  const [dealContext, setDealContext] = useState<DealContext | null>(null)
  const [ndaStatus, setNdaStatus] = useState<NdaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null)
  const [usingDemo, setUsingDemo] = useState(false)
  const [ndaModalOpen, setNdaModalOpen] = useState(false)
  const [pdfViewer, setPdfViewer] = useState<PdfViewerState>(PDF_VIEWER_CLOSED)

  const loadNdaStatus = useCallback(
    async (ctx: DealContext) => {
      try {
        const { data, error } = await supabase.rpc('fn_portal_nda_status', {
          p_parent_type: ctx.parentType,
          p_parent_id: ctx.parentId,
        })
        if (error) {
          console.error('[buyer-portal] fn_portal_nda_status failed:', error.message)
          return
        }
        const payload = data as {
          required?: boolean
          accepted?: boolean
          accepted_at?: string | null
          acceptance_method?: string | null
          current_tier?: string | null
          current_stage?: string | null
        } | null
        setNdaStatus({
          required: payload?.required ?? true,
          accepted: payload?.accepted ?? false,
          accepted_at: payload?.accepted_at ?? null,
          acceptance_method: payload?.acceptance_method ?? null,
          current_tier: payload?.current_tier ?? null,
          current_stage: payload?.current_stage ?? null,
        })
      } catch (err) {
        console.error('[buyer-portal] loadNdaStatus failed:', err)
      }
    },
    [supabase],
  )

  const loadPortalView = useCallback(async () => {
    setLoading(true)
    try {
      if (!contactId) {
        setSelectedDeal(SEEDED_DEAL)
        setDealContext(null)
        setNdaStatus(null)
        setUsingDemo(true)
        return
      }

      // 1) Resolve canonical (parent_type, parent_id) from deal_access
      const { data: accessRow } = await supabase
        .from('deal_access')
        .select('parent_type, parent_id')
        .eq('contact_id', contactId)
        .eq('is_active', true)
        .neq('role', 'seller')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const ctx: DealContext | null =
        accessRow?.parent_type && accessRow?.parent_id
          ? {
              parentType: accessRow.parent_type as string,
              parentId: accessRow.parent_id as string,
            }
          : null
      setDealContext(ctx)

      // 2) Pull the portal view (deal + documents)
      const { data: rpcData, error: rpcErr } = await supabase
        .rpc('get_portal_view', { p_contact_id: contactId })

      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        const liveDeals = rpcData as PortalDeal[]
        setSelectedDeal(liveDeals[0])
        setUsingDemo(false)
      } else {
        setSelectedDeal(SEEDED_DEAL)
        setUsingDemo(true)
      }

      // 3) Load NDA status (only when we have a real binding)
      if (ctx) {
        await loadNdaStatus(ctx)
      } else {
        setNdaStatus(null)
      }
    } catch (err) {
      console.error('[buyer-portal] loadPortalView failed:', err)
      setSelectedDeal(SEEDED_DEAL)
      setDealContext(null)
      setNdaStatus(null)
      setUsingDemo(true)
    } finally {
      setLoading(false)
    }
  }, [supabase, contactId, loadNdaStatus])

  useEffect(() => { loadPortalView() }, [loadPortalView])

  async function logActivity(
    action: 'view_document' | 'download_document',
    doc: PortalDoc,
  ) {
    if (!contactId || !selectedDeal || usingDemo) return
    await supabase.from('portal_sessions').insert({
      contact_id: contactId,
      deal_id: selectedDeal.deal_id,
      action,
      document_id: doc.id,
      portal: selectedDeal.portal,
    }).then(({ error }) => {
      if (error) console.error('[buyer-portal] activity log failed:', error.message)
    })
  }

  function isPdf(doc: PortalDoc): boolean {
    if (doc.mime_type && doc.mime_type.toLowerCase() === 'application/pdf') return true
    return /\.pdf(\?|$)/i.test(doc.document_name) || /\.pdf(\?|$)/i.test(doc.storage_path || '')
  }

  async function handleDocument(doc: PortalDoc, mode: 'view' | 'download') {
    // Guard: if NDA is required and doc is gated, launch modal instead
    if (isDocLocked(doc)) {
      setNdaModalOpen(true)
      return
    }

    setDownloadingDoc(doc.id)
    try {
      await logActivity(mode === 'download' ? 'download_document' : 'view_document', doc)

      if (usingDemo || !doc.storage_path) return

      const { data, error } = await supabase.storage
        .from('deal-documents')
        .createSignedUrl(
          doc.storage_path,
          3600,
          mode === 'download' ? { download: true } : undefined,
        )

      if (error || !data?.signedUrl) return

      // Inline viewer for PDF views; everything else (downloads, non-PDFs)
      // opens in a new tab as before.
      if (mode === 'view' && isPdf(doc)) {
        setPdfViewer({
          open: true,
          signedUrl: data.signedUrl,
          documentName: doc.document_name,
        })
      } else {
        window.open(data.signedUrl, '_blank', 'noopener')
      }
    } finally {
      setTimeout(() => setDownloadingDoc(null), 800)
    }
  }

  // Watermark label for the PDF viewer. Prefer email (most auditable),
  // fall back to contact name.
  const watermarkLabel = (() => {
    const who = viewerEmail || contactName || 'portal viewer'
    const today = new Date().toISOString().slice(0, 10)
    return `${who} · ${today}`
  })()

  // NDA gating: documents beyond level_1 are locked until NDA is accepted.
  // Demo mode never locks (marketing surface). Live view locks unless
  // ndaStatus.accepted === true.
  const ndaRequired = !usingDemo && ndaStatus?.required === true && ndaStatus?.accepted !== true

  function isDocLocked(doc: PortalDoc): boolean {
    if (!ndaRequired) return false
    return !PRE_NDA_VISIBLE_TYPES.has(doc.document_type)
  }

  async function handleNdaAccepted() {
    setNdaModalOpen(false)
    // Reload everything so newly unlocked docs + stage badge appear.
    await loadPortalView()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Loading your portal...</p>
        </div>
      </div>
    )
  }

  const deal = selectedDeal!
  const stageColor = STAGE_COLORS[deal.current_stage] || STAGE_COLORS.inquiry
  const stageIndex = STAGE_ORDER.indexOf(deal.current_stage)
  const lockedCount = deal.documents.filter(isDocLocked).length

  const docGroups: Record<string, PortalDoc[]> = {}
  deal.documents.forEach((doc) => {
    const group =
      doc.document_type === 'om' || doc.document_type === 'cim' || doc.document_type === 'bvr'
        ? 'Key Documents'
        : doc.document_type === 'financial' || doc.document_type === 'deal_workbook'
          ? 'Financial & Analysis'
          : doc.document_type === 'nda' || doc.document_type === 'loi' || doc.document_type === 'legal'
            ? 'Legal & Agreements'
            : doc.document_type === 'disclosure'
              ? 'Disclosures'
              : 'Other Documents'
    if (!docGroups[group]) docGroups[group] = []
    docGroups[group].push(doc)
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">MS</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">MainStreetOS</h1>
              <p className="text-xs text-slate-500">Secure Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{contactName}</span>
            {isAuthenticated ? (
              <button
                onClick={onSignOut}
                className="text-sm text-slate-500 hover:text-red-600 transition-colors"
              >
                Sign Out
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {usingDemo && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-6 py-2 text-xs text-amber-800">
            Demo mode — showing seeded test data. Sign in with your email to view your real deal portal.
          </div>
        </div>
      )}

      {/* NDA required banner */}
      {ndaRequired && dealContext && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0" aria-hidden="true">🔒</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  Sign the Confidentiality Agreement to unlock confidential documents
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {lockedCount > 0
                    ? `${lockedCount} confidential ${lockedCount === 1 ? 'document is' : 'documents are'} currently locked. `
                    : ''}
                  Acceptance is recorded with a timestamp and cryptographic hash for your records.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNdaModalOpen(true)}
              className="flex-shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              Review &amp; Sign NDA
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{deal.listing_name}</h2>
              <p className="text-slate-500 mt-1">Bayonne, NJ • Restaurant (Full-Service)</p>
            </div>
            <div
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: stageColor.bg,
                color: stageColor.text,
                border: `1px solid ${stageColor.border}`,
              }}
            >
              {STAGE_LABELS[deal.current_stage]}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-1">
              {STAGE_ORDER.filter((s) => s !== 'terminated').map((stage, i) => {
                const isComplete = i <= stageIndex
                const isCurrent = i === stageIndex
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center">
                    <div
                      className={`h-2 w-full rounded-full transition-all ${isComplete ? 'bg-blue-600' : 'bg-slate-200'} ${isCurrent ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
                    />
                    <span
                      className={`text-xs mt-2 ${isCurrent ? 'font-semibold text-blue-700' : 'text-slate-400'} ${i > 3 ? 'hidden lg:block' : ''}`}
                    >
                      {STAGE_LABELS[stage].split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              📁 Available Documents
              <span className="text-sm font-normal text-slate-500">
                ({deal.documents.length} files{lockedCount > 0 ? ` • ${lockedCount} locked` : ''})
              </span>
            </h3>

            {Object.entries(docGroups).map(([groupName, docs]) => (
              <div
                key={groupName}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700">{groupName}</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {docs.map((doc) => {
                    const locked = isDocLocked(doc)
                    return (
                      <div
                        key={doc.id}
                        className={`px-5 py-4 flex items-center justify-between transition-colors ${
                          locked ? 'bg-slate-50/60' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span
                            className={`text-xl flex-shrink-0 ${locked ? 'grayscale opacity-50' : ''}`}
                          >
                            {locked ? '🔒' : DOC_ICONS[doc.document_type] || '📄'}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                locked ? 'text-slate-500' : 'text-slate-900'
                              }`}
                            >
                              {doc.document_name}
                            </p>
                            <p className="text-xs text-slate-500 capitalize">
                              {doc.document_type.replace(/_/g, ' ')}
                              {locked ? ' • NDA required' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          {locked ? (
                            <button
                              onClick={() => setNdaModalOpen(true)}
                              className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                            >
                              Sign NDA to Unlock
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleDocument(doc, 'view')}
                                disabled={downloadingDoc === doc.id}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                              >
                                {downloadingDoc === doc.id ? 'Opening...' : 'View'}
                              </button>
                              <button
                                onClick={() => handleDocument(doc, 'download')}
                                disabled={downloadingDoc === doc.id}
                                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
                              >
                                ↓
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Your Access Level</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Portal</span>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                    {PORTAL_LABELS[deal.portal] || deal.portal}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Stage</span>
                  <span className="text-xs font-semibold" style={{ color: stageColor.text }}>
                    {STAGE_LABELS[deal.current_stage]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">NDA Status</span>
                  {usingDemo ? (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                      ✓ Signed
                    </span>
                  ) : ndaStatus?.accepted ? (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                      ✓ Signed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNdaModalOpen(true)}
                      className="text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded flex items-center gap-1 border border-amber-200 transition-colors"
                    >
                      ⚠ Required
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Your Broker</h4>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  MM
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Mark S. Mueller, CAIBVS™</p>
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

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Next Steps</h4>
              <ul className="space-y-2">
                {ndaRequired ? (
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">▸</span>
                    <span className="text-sm text-blue-800">
                      Review and sign the Confidentiality Agreement to unlock confidential documents
                    </span>
                  </li>
                ) : (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">▸</span>
                    <span className="text-sm text-blue-800">
                      Review the Business Valuation Report
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">▸</span>
                  <span className="text-sm text-blue-800">
                    Schedule a site visit with your broker
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">▸</span>
                  <span className="text-sm text-blue-800">
                    Prepare your Letter of Intent if interested
                  </span>
                </li>
              </ul>
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
            CONFIDENTIAL — All documents are protected under NDA
          </p>
        </div>
      </footer>

      {/* NDA click-accept modal */}
      {dealContext && (
        <NdaAcceptanceModal
          open={ndaModalOpen}
          parentType={dealContext.parentType}
          parentId={dealContext.parentId}
          listingName={deal.listing_name}
          onClose={() => setNdaModalOpen(false)}
          onAccepted={handleNdaAccepted}
        />
      )}

      {/* Inline PDF viewer with watermark overlay */}
      <PdfViewerModal
        open={pdfViewer.open}
        signedUrl={pdfViewer.signedUrl}
        documentName={pdfViewer.documentName}
        watermarkLabel={watermarkLabel}
        onClose={() => setPdfViewer(PDF_VIEWER_CLOSED)}
      />
    </div>
  )
}
