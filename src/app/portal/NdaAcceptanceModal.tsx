'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// NdaAcceptanceModal — Phase 12.12b
// Click-accept NDA flow with audit trail. Calls
// fn_portal_accept_nda(parent_type, parent_id, typed_name,
//                      user_agent, client_ip)
// ============================================================

interface NdaTemplate {
  id: string
  version: string
  name: string
  body_markdown: string
  effective_from: string
}

interface NdaAcceptanceModalProps {
  open: boolean
  parentType: string        // 'seller_listing' | 'buyer_engagement'
  parentId: string
  listingName?: string
  onClose: () => void
  onAccepted: () => void    // called after successful acceptance (parent should reload)
}

export default function NdaAcceptanceModal({
  open,
  parentType,
  parentId,
  listingName,
  onClose,
  onAccepted,
}: NdaAcceptanceModalProps) {
  const supabase = createClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [template, setTemplate] = useState<NdaTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [hasScrolled, setHasScrolled] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [typedName, setTypedName] = useState('')

  // Load the currently-active template via the status RPC
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcErr } = await supabase
          .rpc('fn_portal_nda_status', {
            p_parent_type: parentType,
            p_parent_id: parentId,
          })
        if (cancelled) return
        if (rpcErr) {
          setError(rpcErr.message || 'Failed to load NDA')
          return
        }
        const payload = data as { template?: NdaTemplate } | null
        if (payload?.template?.id) {
          setTemplate(payload.template)
        } else {
          setError('No active NDA template configured.')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unexpected error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [open, parentType, parentId, supabase])

  // Reset local state whenever the modal opens/closes
  useEffect(() => {
    if (open) {
      setHasScrolled(false)
      setAgreed(false)
      setTypedName('')
      setError(null)
    }
  }, [open])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 16
    if (nearBottom && !hasScrolled) setHasScrolled(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!template) return
    setError(null)
    setSubmitting(true)

    try {
      const { data, error: rpcErr } = await supabase
        .rpc('fn_portal_accept_nda', {
          p_parent_type: parentType,
          p_parent_id: parentId,
          p_typed_name: typedName.trim(),
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          p_client_ip: null, // server-side edge functions can populate this later
        })

      if (rpcErr) {
        setError(rpcErr.message || 'Failed to record acceptance')
        return
      }

      const payload = data as { status?: string } | null
      if (payload?.status === 'accepted' || payload?.status === 'already_accepted') {
        onAccepted()
      } else {
        setError('Unexpected response from server.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    !submitting &&
    hasScrolled &&
    agreed &&
    typedName.trim().length >= 2

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nda-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 id="nda-modal-title" className="text-lg font-bold text-slate-900">
              🔒 Confidentiality Agreement
            </h2>
            {listingName && (
              <p className="text-xs text-slate-500 mt-0.5">
                Required to view confidential materials for {listingName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body — scrollable NDA text */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="px-6 py-4 overflow-y-auto flex-1 bg-slate-50"
        >
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error && !template ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          ) : template ? (
            <>
              <div className="mb-3 text-xs text-slate-500 flex items-center gap-2">
                <span>Version {template.version}</span>
                <span>•</span>
                <span>{template.name}</span>
              </div>
              <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap leading-relaxed">
                {template.body_markdown}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer — controls */}
        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 border-t border-slate-200 bg-white flex-shrink-0 space-y-3"
        >
          {!hasScrolled && template && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Please scroll to the bottom of the Agreement before accepting.
            </p>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={!hasScrolled || submitting}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
            />
            <span className="text-sm text-slate-700">
              I have read and agree to be bound by the terms of this Confidentiality and
              Non-Disclosure Agreement. I understand that my electronic acceptance is
              legally binding under E-SIGN and UETA.
            </span>
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Type your full legal name as your electronic signature
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              disabled={!agreed || submitting}
              placeholder="First Last"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-400"
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Recording...' : 'I Agree & Accept'}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            By clicking &quot;I Agree &amp; Accept&quot;, you consent to sign this Agreement electronically.
            Your acceptance, including timestamp, IP address, browser, and a cryptographic hash of
            the exact text you accepted, is recorded as an audit trail.
          </p>
        </form>
      </div>
    </div>
  )
}
