'use client'

import { useState } from 'react'

interface SyncResult {
  success: boolean
  total: number
  created: number
  skipped: number
  errors: number
  results: Array<{ name: string; email: string | null; type: string; listing: string | null }>
}

export default function SyncBbsButton() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/gmail/sync-bbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Sync last 30 days by default
          afterDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0].replace(/-/g, '/'),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Sync failed')
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
      >
        {syncing ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Syncing BBS Leads...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync BBS Leads
          </>
        )}
      </button>

      {/* Result banner */}
      {result && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-sm font-medium text-emerald-800">
            Sync complete — {result.created} new leads imported, {result.skipped} skipped
            {result.errors > 0 && `, ${result.errors} errors`}
          </p>
          {result.results.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.results.map((r, i) => (
                <li key={i} className="text-xs text-emerald-700 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 font-medium">
                    {r.type === 'listing_lead' ? 'Lead' : r.type === 'signed_nda' ? 'NDA' : 'Directory'}
                  </span>
                  {r.name} ({r.email})
                  {r.listing && <span className="text-emerald-500">→ {r.listing}</span>}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 underline"
          >
            Refresh page to see new leads
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
          {error.includes('GOOGLE_CLIENT_ID') || error.includes('Missing') ? (
            <p className="text-xs text-red-600 mt-1">
              Gmail integration not configured yet.{' '}
              <a href="/api/gmail/auth" className="underline">Set up Gmail connection →</a>
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
