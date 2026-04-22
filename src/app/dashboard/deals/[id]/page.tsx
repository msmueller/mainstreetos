'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PortalAccessPanel from '@/components/panels/PortalAccessPanel'
import DraftReviewDrawer from '@/components/panels/DraftReviewDrawer'

// ============================================================
// BROKER DEAL DASHBOARD
// Live queries:
//   - deals.select('*').eq('id', id)
//   - deal_access.select('*, contacts(*)').eq('deal_id', id)
//   - deal_documents.select('*').eq('deal_id', id)
//   - portal_sessions.select('*, contacts(first_name, last_name)').eq('deal_id', id)
// Live mutations:
//   - rpc('advance_buyer_stage', { p_deal_id, p_contact_id, p_new_stage })
//   - storage.from('deal-documents').upload()  +  deal_documents insert
// Seeded fallback data is preserved for demo.
// ============================================================

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  nda_executed: 'NDA Signed',
  qualified: 'Qualified',
  loi_negotiation: 'LOI Negotiation',
  under_contract: 'Under Contract',
  due_diligence: 'Due Diligence',
  financing: 'Financing',
  closing: 'Closing',
  terminated: 'Terminated',
}
const STAGE_ORDER = [
  'inquiry', 'nda_executed', 'qualified', 'loi_negotiation',
  'under_contract', 'due_diligence', 'financing', 'closing',
]
const STAGE_COLORS: Record<string, string> = {
  inquiry: 'bg-amber-100 text-amber-800 border-amber-300',
  nda_executed: 'bg-blue-100 text-blue-800 border-blue-300',
  qualified: 'bg-green-100 text-green-800 border-green-300',
  loi_negotiation: 'bg-purple-100 text-purple-800 border-purple-300',
  under_contract: 'bg-pink-100 text-pink-800 border-pink-300',
  due_diligence: 'bg-red-100 text-red-800 border-red-300',
  financing: 'bg-orange-100 text-orange-800 border-orange-300',
  closing: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  terminated: 'bg-gray-100 text-gray-500 border-gray-300',
}
const MIN_STAGE_LABELS: Record<string, string> = {
  inquiry: 'All Buyers',
  nda_executed: 'Post-NDA',
  qualified: 'Qualified+',
  loi_negotiation: 'LOI+',
  under_contract: 'Contract+',
  due_diligence: 'DD+',
}

interface Deal {
  id: string
  listing_name: string
  business_address: string | null
  asking_price: number | null
  annual_revenue: number | null
  sde: number | null
  seller_stage: string | null
  deal_status: string | null
}
interface Buyer {
  id: string
  name: string
  company?: string | null
  email: string
  phone: string | null
  current_stage: string
  portal: string
  nda_status: string
  docs_visible: number
  last_activity: string | null
  activity_count: number
  liquid_cash: number | null
  notes: string | null
}
interface DealDocument {
  id: string | number
  name: string
  type: string
  min_stage: string
  tier: string
  uploaded: string
  storage_path?: string | null
}
interface ActivityEntry {
  contact: string
  action: string
  doc: string | null
  time: string
  portal: string
}

const SEEDED_DEAL: Deal = {
  id: 'd1000001',
  listing_name: 'La Guardiola Pizzeria',
  business_address: 'Bayonne, NJ',
  asking_price: 275000,
  annual_revenue: 712798,
  sde: 146630,
  seller_stage: 'packaging_marketing',
  deal_status: 'active',
}
const SEEDED_BUYERS: Buyer[] = [
  { id: 'b1000001', name: 'James Rivera', email: 'jrivera@email.com', phone: '201-555-2001', current_stage: 'inquiry', portal: 'om', nda_status: 'sent', docs_visible: 3, last_activity: '2026-04-10', activity_count: 2, liquid_cash: 150000, notes: 'BBS lead. Initial inquiry, no NDA yet.' },
  { id: 'b1000002', name: 'Sarah Chen', company: 'Chen Family Holdings LLC', email: 'schen@email.com', phone: '732-555-3002', current_stage: 'qualified', portal: 'bp', nda_status: 'signed', docs_visible: 7, last_activity: '2026-04-11', activity_count: 5, liquid_cash: 300000, notes: 'NDA signed. CIM reviewed. Qualified buyer with restaurant experience.' },
  { id: 'b1000003', name: 'Michael Thompson', company: 'Thompson Restaurant Group', email: 'mthompson@email.com', phone: '856-555-4003', current_stage: 'loi_negotiation', portal: 'dp', nda_status: 'signed', docs_visible: 10, last_activity: '2026-04-11', activity_count: 9, liquid_cash: 500000, notes: 'LOI submitted. In negotiation. Has SBA pre-approval.' },
]
const SEEDED_DOCS: DealDocument[] = [
  { id: 1, name: 'Offering Memorandum', type: 'om', min_stage: 'inquiry', tier: 'L1', uploaded: '2026-03-01' },
  { id: 2, name: 'Buyer Profile Questionnaire', type: 'other', min_stage: 'inquiry', tier: 'L1', uploaded: '2026-03-01' },
  { id: 3, name: 'Non-Disclosure Agreement', type: 'nda', min_stage: 'inquiry', tier: 'L1', uploaded: '2026-03-01' },
  { id: 4, name: 'Confidential Information Memorandum', type: 'cim', min_stage: 'nda_executed', tier: 'L2', uploaded: '2026-03-10' },
  { id: 5, name: 'Financial Summary — 3 Year', type: 'financial', min_stage: 'nda_executed', tier: 'L2', uploaded: '2026-03-10' },
  { id: 6, name: 'Business Valuation Report (BVR)', type: 'bvr', min_stage: 'qualified', tier: 'L2', uploaded: '2026-03-20' },
  { id: 7, name: 'Deal Workbook — Recast P&L', type: 'deal_workbook', min_stage: 'qualified', tier: 'L2', uploaded: '2026-03-20' },
  { id: 8, name: 'Letter of Intent Template', type: 'loi', min_stage: 'loi_negotiation', tier: 'L3', uploaded: '2026-04-01' },
  { id: 9, name: 'Lease Abstract', type: 'disclosure', min_stage: 'loi_negotiation', tier: 'L3', uploaded: '2026-04-01' },
  { id: 10, name: 'Equipment Schedule', type: 'disclosure', min_stage: 'loi_negotiation', tier: 'L3', uploaded: '2026-04-01' },
  { id: 11, name: 'Purchase & Sale Agreement', type: 'legal', min_stage: 'under_contract', tier: 'L3', uploaded: '2026-04-05' },
  { id: 12, name: 'Tax Returns 2023-2025', type: 'financial', min_stage: 'due_diligence', tier: 'L3', uploaded: '2026-04-08' },
]
const SEEDED_ACTIVITY: ActivityEntry[] = [
  { contact: 'Michael Thompson', action: 'download_document', doc: 'Lease Abstract', time: '2 hours ago', portal: 'dp' },
  { contact: 'Michael Thompson', action: 'download_document', doc: 'Equipment Schedule', time: '2 hours ago', portal: 'dp' },
  { contact: 'Michael Thompson', action: 'download_document', doc: 'LOI Template', time: '3 hours ago', portal: 'dp' },
  { contact: 'Sarah Chen', action: 'download_document', doc: 'BVR', time: '5 hours ago', portal: 'bp' },
  { contact: 'Sarah Chen', action: 'download_document', doc: 'CIM', time: '5 hours ago', portal: 'bp' },
  { contact: 'James Rivera', action: 'view_document', doc: 'Offering Memorandum', time: '1 day ago', portal: 'om' },
  { contact: 'James Rivera', action: 'view_deal', doc: null, time: '1 day ago', portal: 'om' },
]

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function BrokerDealDashboard() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [deal, setDeal] = useState<Deal>(SEEDED_DEAL)
  const [buyers, setBuyers] = useState<Buyer[]>(SEEDED_BUYERS)
  const [documents, setDocuments] = useState<DealDocument[]>(SEEDED_DOCS)
  const [activity, setActivity] = useState<ActivityEntry[]>(SEEDED_ACTIVITY)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(true)

  const [activeTab, setActiveTab] = useState<'pipeline' | 'documents' | 'activity'>('pipeline')
  const [showAdvanceModal, setShowAdvanceModal] = useState<{ buyer: Buyer; nextStage: string } | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDraftDrawer, setShowDraftDrawer] = useState(false)
  const [pendingDraftCount, setPendingDraftCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadForm, setUploadForm] = useState({ name: '', type: 'other', min_stage: 'inquiry', tier: 'L1' })

  // Phase 12.13 / 12.14a — AI draft state (OM + CIM)
  type AiDraftHistoryItem = {
    id: string
    created_at: string
    status: string
    kind: string
    notion_page_url: string | null
    model_used: string | null
  }
  const [generatingOm, setGeneratingOm] = useState(false)
  const [omError, setOmError] = useState<string | null>(null)
  const [generatingCim, setGeneratingCim] = useState(false)
  const [cimError, setCimError] = useState<string | null>(null)
  const [aiDrafts, setAiDrafts] = useState<AiDraftHistoryItem[]>([])
  const [showAiHistory, setShowAiHistory] = useState(false)

  // Phase 12.14b — Linked valuation picker
  type AvailableValuation = {
    id: string
    business_name: string | null
    status: string
    valuation_mid: number | null
    updated_at: string | null
  }
  const [linkedValuationId, setLinkedValuationId] = useState<string | null>(null)
  const [availableValuations, setAvailableValuations] = useState<AvailableValuation[]>([])
  const [loadingValuations, setLoadingValuations] = useState(false)
  const [savingValuationLink, setSavingValuationLink] = useState(false)
  const [valuationLinkError, setValuationLinkError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    let live = true
    try {
      // Deal — try `deals` first; fall back to `seller_listings` so clicks
      // coming from /dashboard/listings land on a live record and enable
      // Generate OM Draft. Phase 12.13.1 fallback.
      const { data: dealRow, error: dealErr } = await supabase
        .from('deals').select('*').eq('id', id).maybeSingle()
      if (!dealErr && dealRow) {
        setDeal(dealRow as Deal)
      } else {
        const { data: listingRow, error: listingErr } = await supabase
          .from('seller_listings')
          .select('id, name, industry, asking_price_usd, revenue_ttm_usd, sde_ttm_usd, stage, custom_fields, valuation_id')
          .eq('id', id)
          .maybeSingle()
        if (!listingErr && listingRow) {
          const custom = (listingRow.custom_fields as Record<string, unknown>) || {}
          setDeal({
            id: listingRow.id as string,
            listing_name: (listingRow.name as string) || 'Unnamed Listing',
            business_address: typeof custom.business_address === 'string' ? (custom.business_address as string) : null,
            asking_price: listingRow.asking_price_usd != null ? Number(listingRow.asking_price_usd) : null,
            annual_revenue: listingRow.revenue_ttm_usd != null ? Number(listingRow.revenue_ttm_usd) : null,
            sde: listingRow.sde_ttm_usd != null ? Number(listingRow.sde_ttm_usd) : null,
            seller_stage: (listingRow.stage as string) || null,
            deal_status: 'active',
          })
          setLinkedValuationId((listingRow.valuation_id as string) ?? null)
          // Live listing — keep live=true so the OM draft button is enabled
        } else {
          live = false
        }
      }

      // Buyers via deal_access + contacts join
      const { data: accessRows, error: accessErr } = await supabase
        .from('deal_access')
        .select('*, contacts(*)')
        .eq('deal_id', id)
      if (!accessErr && Array.isArray(accessRows) && accessRows.length > 0) {
        const mapped: Buyer[] = accessRows.map((r: Record<string, unknown>) => {
          const c = (r.contacts as Record<string, unknown>) || {}
          const first = (c.first_name as string) || ''
          const last = (c.last_name as string) || ''
          return {
            id: (c.id as string) || (r.contact_id as string),
            name: `${first} ${last}`.trim() || 'Unknown',
            company: (c.company as string) || null,
            email: (c.email as string) || '',
            phone: (c.phone as string) || null,
            current_stage: (r.current_stage as string) || 'inquiry',
            portal: (r.portal as string) || 'om',
            nda_status: (r.nda_status as string) || 'sent',
            docs_visible: (r.docs_visible as number) || 0,
            last_activity: (r.last_activity as string) || null,
            activity_count: (r.activity_count as number) || 0,
            liquid_cash: (c.liquid_cash as number) || null,
            notes: (r.notes as string) || null,
          }
        })
        setBuyers(mapped)
      } else if (accessErr) {
        live = false
      }

      // Documents
      const { data: docRows, error: docErr } = await supabase
        .from('deal_documents').select('*').eq('deal_id', id)
      if (!docErr && Array.isArray(docRows) && docRows.length > 0) {
        setDocuments(docRows.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          name: (d.document_name as string) || (d.name as string) || 'Document',
          type: (d.document_type as string) || 'other',
          min_stage: (d.min_stage as string) || 'inquiry',
          tier: (d.tier as string) || 'L1',
          uploaded: ((d.created_at as string) || '').split('T')[0] || '—',
          storage_path: (d.storage_path as string) || null,
        })))
      } else if (docErr) {
        live = false
      }

      // Activity
      const { data: actRows, error: actErr } = await supabase
        .from('portal_sessions')
        .select('*, contacts(first_name, last_name)')
        .eq('deal_id', id)
        .order('created_at', { ascending: false })
        .limit(25)
      if (!actErr && Array.isArray(actRows) && actRows.length > 0) {
        setActivity(actRows.map((r: Record<string, unknown>) => {
          const c = (r.contacts as Record<string, unknown>) || {}
          return {
            contact: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
            action: (r.action as string) || 'view_deal',
            doc: (r.document_name as string) || null,
            time: relativeTime((r.created_at as string) || null),
            portal: (r.portal as string) || 'om',
          }
        }))
      } else if (actErr) {
        live = false
      }

      setUsingDemo(!live)
    } catch (err) {
      console.error('[deal-dashboard] load failed:', err)
      setUsingDemo(true)
    } finally {
      setLoading(false)
    }
  }, [id, supabase])

  useEffect(() => { loadAll() }, [loadAll])

  // Poll pending draft count for this deal (broker badge on "Review Drafts" button)
  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function loadDraftCount() {
      const { count } = await supabase
        .from('ai_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('deal_id', id)
        .in('status', ['pending_review', 'draft'])
      if (!cancelled && typeof count === 'number') setPendingDraftCount(count)
    }
    loadDraftCount()
    const interval = setInterval(loadDraftCount, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [id, supabase])

  // Phase 12.13 / 12.14a — Load AI draft history for this listing (OM + CIM)
  const loadAiDrafts = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('ai_drafts')
      .select('id, created_at, status, kind, notion_page_url, model_used')
      .eq('object_type', 'seller_listing')
      .eq('record_id', id)
      .in('kind', ['writer.om_draft', 'writer.cim_draft'])
      .order('created_at', { ascending: false })
      .limit(20)
    if (Array.isArray(data)) {
      setAiDrafts(data as AiDraftHistoryItem[])
    }
  }, [id, supabase])

  useEffect(() => { loadAiDrafts() }, [loadAiDrafts])

  // Phase 12.14b — Load broker's own valuations (RLS-scoped) for the picker.
  // Only shows valuations in review / complete status — draft/processing
  // wouldn't produce a usable CIM anyway.
  const loadValuations = useCallback(async () => {
    setLoadingValuations(true)
    try {
      const { data, error } = await supabase
        .from('valuations')
        .select('id, business_name, status, valuation_mid, updated_at')
        .in('status', ['review', 'complete'])
        .order('updated_at', { ascending: false })
        .limit(50)
      if (!error && Array.isArray(data)) {
        setAvailableValuations(data as AvailableValuation[])
      }
    } catch (err) {
      console.error('[deal-dashboard] loadValuations failed:', err)
    } finally {
      setLoadingValuations(false)
    }
  }, [supabase])

  useEffect(() => { loadValuations() }, [loadValuations])

  // Phase 12.14b — Link/unlink valuation to this listing. RLS on
  // seller_listings restricts writes to the owning broker, so no
  // explicit auth check is needed here.
  async function handleLinkValuation(newValuationId: string | null) {
    if (!id) return
    setSavingValuationLink(true)
    setValuationLinkError(null)
    try {
      const { error } = await supabase
        .from('seller_listings')
        .update({ valuation_id: newValuationId })
        .eq('id', id)
      if (error) throw new Error(error.message)
      setLinkedValuationId(newValuationId)
    } catch (err) {
      setValuationLinkError(err instanceof Error ? err.message : 'Failed to update linked valuation')
    } finally {
      setSavingValuationLink(false)
    }
  }

  async function handleGenerateOmDraft() {
    if (!id || generatingOm) return
    setGeneratingOm(true)
    setOmError(null)
    try {
      const res = await fetch(`/api/deals/${id}/generate-om-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      await loadAiDrafts()
      setShowAiHistory(true)
    } catch (err) {
      setOmError(err instanceof Error ? err.message : 'OM draft generation failed')
    } finally {
      setGeneratingOm(false)
    }
  }

  async function handleGenerateCimDraft() {
    if (!id || generatingCim) return
    setGeneratingCim(true)
    setCimError(null)
    try {
      const res = await fetch(`/api/deals/${id}/generate-cim-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      await loadAiDrafts()
      setShowAiHistory(true)
    } catch (err) {
      setCimError(err instanceof Error ? err.message : 'CIM draft generation failed')
    } finally {
      setGeneratingCim(false)
    }
  }

  async function handleAdvanceStage(buyer: Buyer, newStage: string) {
    try {
      const { error } = await supabase.rpc('advance_buyer_stage', {
        p_deal_id: deal.id,
        p_contact_id: buyer.id,
        p_new_stage: newStage,
      })
      if (error) console.error('[advance_buyer_stage]', error.message)
      // Optimistic update regardless of whether RPC exists (demo-friendly)
      setBuyers((prev) => prev.map((b) => b.id === buyer.id ? { ...b, current_stage: newStage } : b))
    } finally {
      setShowAdvanceModal(null)
      if (!usingDemo) loadAll()
    }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]+/g, '-').toLowerCase()
      const storagePath = `${deal.id}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage
        .from('deal-documents')
        .upload(storagePath, file, { upsert: false, contentType: file.type })
      if (upErr) throw new Error(upErr.message)

      const { error: insErr } = await supabase.from('deal_documents').insert({
        deal_id: deal.id,
        document_name: uploadForm.name || file.name,
        document_type: uploadForm.type,
        min_stage: uploadForm.min_stage,
        tier: uploadForm.tier,
        storage_path: storagePath,
      })
      if (insErr) throw new Error(insErr.message)

      setShowUploadModal(false)
      setUploadForm({ name: '', type: 'other', min_stage: 'inquiry', tier: 'L1' })
      if (!usingDemo) loadAll()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading deal…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 -mx-6 -my-6">
      {usingDemo && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800">
          Demo mode — showing seeded test data. Live tables not populated for this deal yet.
        </div>
      )}

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{deal.listing_name}</h1>
                <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full border border-green-300">
                  {(deal.deal_status || 'active').replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-gray-500 mt-1">{deal.business_address || '—'} • Restaurant</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{fmt(deal.asking_price)}</p>
              <p className="text-sm text-gray-500">Rev {fmt(deal.annual_revenue)} • SDE {fmt(deal.sde)}</p>
              <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={handleGenerateOmDraft}
                  disabled={generatingOm || usingDemo}
                  title={usingDemo ? 'Connect live deal data to generate OM drafts.' : 'Generate a pre-NDA Offering Memorandum draft to Notion.'}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {generatingOm ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>Generate OM Draft</>
                  )}
                </button>
                <button
                  onClick={handleGenerateCimDraft}
                  disabled={generatingCim || usingDemo}
                  title={
                    usingDemo
                      ? 'Connect live deal data to generate CIM drafts.'
                      : linkedValuationId
                        ? 'Generate a post-NDA CIM — RICH mode (full valuation + multi-year P&L + narrative).'
                        : 'Generate a post-NDA CIM — LEAN mode (top-line listing fields only). Link a valuation above for RICH mode.'
                  }
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {generatingCim ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      Generate CIM Draft
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          linkedValuationId ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'
                        }`}
                      >
                        {linkedValuationId ? 'RICH' : 'LEAN'}
                      </span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAiHistory((v) => !v)}
                  className="relative inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
                >
                  AI Drafts History
                  {aiDrafts.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded-full">
                      {aiDrafts.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowDraftDrawer(true)}
                  className="relative inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                >
                  Review AI Drafts
                  {pendingDraftCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-amber-400 text-slate-900 rounded-full">
                      {pendingDraftCount}
                    </span>
                  )}
                </button>
              </div>
              {omError && (
                <p className="mt-2 text-xs text-red-600 max-w-xs ml-auto">
                  OM: {omError}
                </p>
              )}
              {cimError && (
                <p className="mt-2 text-xs text-red-600 max-w-xs ml-auto">
                  CIM: {cimError}
                </p>
              )}
            </div>
          </div>

          {/* Phase 12.14b — Linked Valuation picker. Drives CIM rich/lean mode. */}
          {!usingDemo && (
            <div className="mt-4 border border-slate-200 rounded-lg bg-white px-4 py-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">
                    Linked Valuation
                    <span
                      className={`ml-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        linkedValuationId
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {linkedValuationId ? 'RICH' : 'LEAN'}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {linkedValuationId
                      ? 'CIM will include multi-year P&L, add-backs, valuation methods, and narrative.'
                      : 'No valuation linked — CIM will use top-line listing fields only. Link a valuation for RICH mode.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={linkedValuationId ?? ''}
                    onChange={(e) => handleLinkValuation(e.target.value === '' ? null : e.target.value)}
                    disabled={savingValuationLink || loadingValuations}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 disabled:opacity-60 min-w-[260px]"
                  >
                    <option value="">— No valuation (LEAN) —</option>
                    {availableValuations.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.business_name || 'Unnamed'}
                        {v.valuation_mid ? ` • ${fmt(v.valuation_mid)}` : ''}
                        {` • ${v.status}`}
                      </option>
                    ))}
                  </select>
                  {savingValuationLink && (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>
              {valuationLinkError && (
                <p className="mt-2 text-xs text-red-600">
                  {valuationLinkError}
                </p>
              )}
              {!loadingValuations && availableValuations.length === 0 && (
                <p className="mt-2 text-[11px] text-slate-500 italic">
                  No completed or in-review valuations found under your account. Create one from the Valuations workspace to enable RICH-mode CIMs.
                </p>
              )}
            </div>
          )}

          {showAiHistory && (
            <div className="mt-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-700">
                  AI Drafts History
                </h3>
                <button
                  onClick={() => setShowAiHistory(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              {aiDrafts.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500">
                  No AI drafts yet. Click &quot;Generate OM Draft&quot; or &quot;Generate CIM Draft&quot; to create the first one.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {aiDrafts.map((d) => {
                    const isCim = d.kind === 'writer.cim_draft'
                    const kindLabel = isCim ? 'CIM' : 'OM'
                    const kindClasses = isCim
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                    return (
                      <li key={d.id} className="flex items-center justify-between px-4 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            <span className={`mr-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${kindClasses}`}>
                              {kindLabel}
                            </span>
                            {new Date(d.created_at).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-slate-300 bg-white text-slate-600">
                              {d.status.replace(/_/g, ' ')}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {d.model_used || '—'}
                          </p>
                        </div>
                        {d.notion_page_url ? (
                          <a
                            href={d.notion_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2 shrink-0"
                          >
                            Open in Notion ↗
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">No link</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-8 mt-5 pt-4 border-t border-gray-100">
            <div><span className="text-2xl font-bold text-blue-600">{buyers.length}</span><span className="text-sm text-gray-500 ml-1.5">Active Buyers</span></div>
            <div><span className="text-2xl font-bold text-purple-600">{documents.length}</span><span className="text-sm text-gray-500 ml-1.5">Documents</span></div>
            <div><span className="text-2xl font-bold text-amber-600">{buyers.reduce((s, b) => s + b.activity_count, 0)}</span><span className="text-sm text-gray-500 ml-1.5">Portal Views</span></div>
            <div><span className="text-2xl font-bold text-green-600">{buyers.filter((b) => b.nda_status === 'signed').length}</span><span className="text-sm text-gray-500 ml-1.5">NDAs Signed</span></div>
          </div>

          <div className="flex gap-1 mt-5">
            {([['pipeline', 'Buyer Pipeline'], ['documents', 'Documents'], ['activity', 'Activity Log']] as const).map(([key, label]) => (
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

      <div className="max-w-7xl mx-auto px-6 pt-6">
        {deal.id && !usingDemo && (
          <div className="mb-5">
            <PortalAccessPanel dealId={deal.id} />
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            {buyers.map((buyer) => {
              const stageIdx = STAGE_ORDER.indexOf(buyer.current_stage)
              const nextStage = stageIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIdx + 1] : null
              return (
                <div key={buyer.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-lg font-bold text-gray-600">
                          {buyer.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{buyer.name}</h3>
                          {buyer.company && <p className="text-sm text-gray-500">{buyer.company}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500">{buyer.email}</span>
                            <span className="text-xs text-gray-500">{buyer.phone}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${STAGE_COLORS[buyer.current_stage]}`}>
                          {STAGE_LABELS[buyer.current_stage]}
                        </span>
                        {nextStage && (
                          <button
                            onClick={() => setShowAdvanceModal({ buyer, nextStage })}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            Advance → {STAGE_LABELS[nextStage]}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div><p className="text-xs text-gray-400">Liquidity</p><p className="text-sm font-semibold text-gray-900">{fmt(buyer.liquid_cash)}</p></div>
                      <div><p className="text-xs text-gray-400">NDA</p><p className={`text-sm font-semibold ${buyer.nda_status === 'signed' ? 'text-green-600' : 'text-amber-600'}`}>{buyer.nda_status === 'signed' ? '✓ Signed' : '⏳ Sent'}</p></div>
                      <div><p className="text-xs text-gray-400">Portal</p><p className="text-sm font-semibold text-blue-700">{buyer.portal.toUpperCase()}</p></div>
                      <div><p className="text-xs text-gray-400">Docs Visible</p><p className="text-sm font-semibold text-gray-900">{buyer.docs_visible} / {documents.length}</p></div>
                      <div><p className="text-xs text-gray-400">Activity</p><p className="text-sm font-semibold text-gray-900">{buyer.activity_count} views</p></div>
                      <div><p className="text-xs text-gray-400">Last Active</p><p className="text-sm font-semibold text-gray-900">{buyer.last_activity || '—'}</p></div>
                    </div>

                    {buyer.notes && <p className="text-sm text-gray-500 mt-3 italic">{buyer.notes}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Deal Documents ({documents.length})</h3>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Upload Document
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Document</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Min Stage</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tier</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Visible To</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => {
                    const visibleTo = buyers.filter((b) => STAGE_ORDER.indexOf(b.current_stage) >= STAGE_ORDER.indexOf(doc.min_stage))
                    return (
                      <tr key={doc.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{doc.name}</td>
                        <td className="px-5 py-3 text-xs text-gray-500 capitalize">{doc.type.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full border ${STAGE_COLORS[doc.min_stage]}`}>
                            {MIN_STAGE_LABELS[doc.min_stage] || STAGE_LABELS[doc.min_stage]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-gray-500">{doc.tier}</td>
                        <td className="px-5 py-3">
                          <div className="flex -space-x-2">
                            {visibleTo.map((b) => (
                              <div key={b.id} title={b.name} className="w-7 h-7 bg-blue-100 border-2 border-white rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                                {b.name.split(' ').map((n) => n[0]).join('')}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{doc.uploaded}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Portal Activity</h3>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {activity.map((act, i) => (
                  <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${act.action.includes('download') ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className="text-sm text-gray-900">
                          <span className="font-semibold">{act.contact}</span>{' '}
                          {act.action === 'download_document' ? 'downloaded' : act.action === 'view_document' ? 'viewed' : 'accessed'}{' '}
                          {act.doc ? <span className="font-medium">{act.doc}</span> : 'the deal'}
                        </p>
                        <p className="text-xs text-gray-400">Portal: {act.portal.toUpperCase()} • {act.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAdvanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Advance Buyer Stage</h3>
            <p className="text-sm text-gray-600 mt-2">
              Advance <span className="font-semibold">{showAdvanceModal.buyer.name}</span> from{' '}
              <span className="font-semibold">{STAGE_LABELS[showAdvanceModal.buyer.current_stage]}</span> to{' '}
              <span className="font-semibold text-blue-700">{STAGE_LABELS[showAdvanceModal.nextStage]}</span>?
            </p>
            <p className="text-xs text-gray-500 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              ⚠️ This will automatically upgrade their portal access and make additional documents visible.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdvanceModal(null)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button
                onClick={() => handleAdvanceStage(showAdvanceModal.buyer, showAdvanceModal.nextStage)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Advance Stage
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Upload Document</h3>
            <div className="space-y-3 mt-4">
              <input
                type="text"
                placeholder="Document name (optional — defaults to filename)"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {['om', 'cim', 'bvr', 'deal_workbook', 'financial', 'nda', 'loi', 'disclosure', 'legal', 'other'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={uploadForm.min_stage}
                  onChange={(e) => setUploadForm({ ...uploadForm, min_stage: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                }}
                className="w-full text-sm"
              />
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(null) }}
                disabled={uploading}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
            </div>
            {uploading && <p className="text-xs text-slate-500 mt-2">Uploading…</p>}
          </div>
        </div>
      )}

      <DraftReviewDrawer
        dealId={deal.id}
        open={showDraftDrawer}
        onClose={() => setShowDraftDrawer(false)}
      />
    </div>
  )
}
