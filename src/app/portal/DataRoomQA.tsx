'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// Data Room AI Q&A — buyer-facing.
// Answers are drawn ONLY from documents the signed-in buyer is
// cleared for: the dataroom_qa edge function (verify_jwt) calls
// fn_portal_dataroom_search, which gates retrieval to the caller's
// max_tier + current_stage. The buyer can never surface content
// above their access level, even by asking.
// ============================================================

const FN_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dataroom_qa`
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

type Citation = { document_id: string; document_name: string }

export default function DataRoomQA({
  parentType,
  parentId,
}: {
  parentType: string
  parentId: string
}) {
  const supabase = createClient()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    setCitations([])
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setError('Your session expired — please sign in again.')
        return
      }
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: ANON,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parent_type: parentType, parent_id: parentId, question }),
      })
      const json = await res.json()
      if (!res.ok || json.ok === false) {
        setError(json.error || 'Something went wrong — please try again.')
        return
      }
      setAnswer(json.answer ?? '')
      setCitations(Array.isArray(json.citations) ? json.citations : [])
    } catch (err) {
      setError(String((err as Error).message ?? err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-slate-900">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          🤖 Ask about this data room
        </h3>
      </div>
      <div className="px-5 py-4">
        <p className="text-[11px] text-slate-500 mb-3">
          AI answers are drawn only from the documents you currently have access to, with sources
          cited. It cannot see documents above your access level.
        </p>
        <form onSubmit={ask} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is the asking price and how is it supported?"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {answer && (
          <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="whitespace-pre-wrap text-sm text-slate-800">{answer}</p>
            {citations.length > 0 && (
              <div className="mt-3 border-t border-slate-200 pt-2">
                <p className="text-[11px] font-medium text-slate-500">Sources</p>
                <ul className="mt-1 list-disc pl-5 text-[11px] text-slate-600">
                  {citations.map((c) => (
                    <li key={c.document_id}>{c.document_name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
