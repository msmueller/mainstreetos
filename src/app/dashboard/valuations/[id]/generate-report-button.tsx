'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SubscriptionTier } from '@/lib/types'

const ALLOWED_TIERS: SubscriptionTier[] = ['starter', 'professional', 'enterprise']

export default function GenerateReportButton({
  valuationId,
  status,
  reportUrl,
  tier,
}: {
  valuationId: string
  status: string
  reportUrl: string | null
  tier: SubscriptionTier
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const router = useRouter()

  // Already-generated report: show the stored link.
  if (reportUrl && !reportUrl.startsWith('local://')) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <span>📥</span> Download Business Valuation Report (.docx)
        </a>
      </div>
    )
  }

  // Gate: only show generate button when Agent 4 has finished.
  if (status !== 'review') return null

  const tierAllowed = ALLOWED_TIERS.includes(tier)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valuation_id: valuationId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Report generation failed')
        return
      }
      setUploadedUrl(data.report_url)
      setTimeout(() => router.refresh(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-sm text-slate-500 mb-3">
        Valuation complete. Generate a professional USPAP/NACVA-aligned Business Valuation Report (DOCX).
      </p>

      {!tierAllowed ? (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Starter plan required.</span>{' '}
            BVR Report generation is available on Starter, Professional, and Enterprise plans.{' '}
            <a href="/dashboard/billing" className="underline font-medium">Upgrade</a>
          </p>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`px-6 py-3 text-sm font-bold rounded-lg transition ${
            generating
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating report… (this may take 30–90s)
            </span>
          ) : (
            '📄 Generate BVR Report'
          )}
        </button>
      )}

      {uploadedUrl && (
        <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-800 mb-2">Report generated and uploaded.</p>
          <a
            href={uploadedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
          >
            📥 Download Business Valuation Report (.docx)
          </a>
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
