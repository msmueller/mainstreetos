'use client'

// ============================================================
// Draft Review Drawer — Phase 12.11a
// Slide-out panel for broker review of pending AI drafts on a deal.
// Queries ai_drafts by deal_id, supports approve / reject / edit
// via fn_draft_approve / fn_draft_reject RPCs (Phase 12.8b).
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type DraftStatus = 'pending_review' | 'approved' | 'rejected' | 'draft' | string

interface AiDraft {
  id: string
  deal_id: string | null
  kind: string
  subject: string | null
  body: string
  status: DraftStatus
  model: string | null
  created_at: string
  updated_at: string | null
}

const KIND_LABEL: Record<string, string> = {
  email: 'Email',
  cim: 'CIM Draft',
  om: 'OM Draft',
  summary: 'Summary',
  bvr: 'BVR Draft',
  loi: 'LOI Draft',
  memo: 'Memo',
  other: 'Draft',
}

const STATUS_COLOR: Record<string, string> = {
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
  draft: 'bg-slate-50 text-slate-700 border-slate-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function DraftReviewDrawer({
  dealId,
  open,
  onClose,
}: {
  dealId: string
  open: boolean
  onClose: () => void
}) {
  const supabase = createClient()
  const [drafts, setDrafts] = useState<AiDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!dealId || !open) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('ai_drafts')
        .select('id, deal_id, kind, subject, body, status, model, created_at, updated_at')
        .eq('deal_id', dealId)
        .in('status', ['pending_review', 'draft'])
        .order('created_at', { ascending: false })

      if (qErr) {
        setError(qErr.message)
        setDrafts([])
        return
      }
      setDrafts((data || []) as AiDraft[])
      if ((data || []).length > 0 && !selectedId) {
        const first = (data as AiDraft[])[0]
        setSelectedId(first.id)
        setEditBody(first.body)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }, [dealId, open, selectedId, supabase])

  useEffect(() => { load() }, [load])

  const selected = drafts.find((d) => d.id === selectedId) || null

  function selectDraft(d: AiDraft) {
    setSelectedId(d.id)
    setEditBody(d.body)
  }

  async function approve() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const edited = editBody !== selected.body
      const { error: rpcErr } = await supabase.rpc('fn_draft_approve', {
        p_draft_id: selected.id,
        p_edited_body: edited ? editBody : null,
      })
      if (rpcErr) {
        // Fallback: direct update if RPC unavailable
        const { error: updErr } = await supabase
          .from('ai_drafts')
          .update({ status: 'approved', body: editBody })
          .eq('id', selected.id)
        if (updErr) throw new Error(updErr.message)
      }
      await load()
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('fn_draft_reject', {
        p_draft_id: selected.id,
        p_reason: null,
      })
      if (rpcErr) {
        const { error: updErr } = await supabase
          .from('ai_drafts')
          .update({ status: 'rejected' })
          .eq('id', selected.id)
        if (updErr) throw new Error(updErr.message)
      }
      await load()
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside className="w-full max-w-3xl bg-white shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI Draft Review</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {drafts.length} pending {drafts.length === 1 ? 'draft' : 'drafts'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
            >
              Close
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 flex">
          {/* List */}
          <div className="w-72 border-r border-slate-200 overflow-y-auto">
            {loading && drafts.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Loading drafts…</p>
            ) : drafts.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No pending drafts for this deal.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {drafts.map((d) => {
                  const active = d.id === selectedId
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => selectDraft(d)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          active ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {KIND_LABEL[d.kind] || d.kind}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLOR[d.status] || STATUS_COLOR.draft}`}>
                            {d.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {d.subject && (
                          <p className="text-xs text-slate-700 mt-1 truncate">{d.subject}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {fmtTime(d.created_at)}{d.model ? ` · ${d.model}` : ''}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected ? (
              <>
                <div className="px-5 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {KIND_LABEL[selected.kind] || selected.kind}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLOR[selected.status] || STATUS_COLOR.draft}`}>
                      {selected.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {selected.subject && (
                    <p className="text-sm text-slate-700 mt-1">{selected.subject}</p>
                  )}
                </div>

                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="flex-1 min-h-0 w-full px-5 py-4 text-sm font-mono text-slate-900 bg-slate-50 focus:outline-none resize-none"
                  disabled={busy}
                />

                <footer className="px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {editBody !== selected.body && <span className="text-amber-600 font-medium">Unsaved edits will be applied on Approve.</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={reject}
                      disabled={busy}
                      className="text-sm px-4 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={approve}
                      disabled={busy}
                      className="text-sm px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
                    >
                      {busy ? 'Working…' : 'Approve'}
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-400">Select a draft to review.</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
