'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RunAgentsButton({ valuationId, status }: { valuationId: string; status: string }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  if (status !== 'draft') return null

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/agents/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valuation_id: valuationId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Agent failed')
        return
      }

      setResult(
        `Pipeline complete! ${data.agent_2.metric_type.toUpperCase()} selected → ${data.agent_3.methods_count} methods run → FMV: $${data.agent_4.valuation_mid.toLocaleString()} (range $${data.agent_4.valuation_low.toLocaleString()}–$${data.agent_4.valuation_high.toLocaleString()})`
      )

      // Refresh the page to show updated data
      setTimeout(() => router.refresh(), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-sm text-slate-500 mb-3">
        Financial data entered. Ready to run the CAIBVS&trade; normalization agent.
      </p>

      <button
        onClick={handleRun}
        disabled={running}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
          running
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {running ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Running Agents 2→3→4: Full Valuation Pipeline...
          </span>
        ) : (
          'Run Valuation Agents'
        )}
      </button>

      {result && (
        <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-800">{result}</p>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
