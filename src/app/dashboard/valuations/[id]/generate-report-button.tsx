'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateReportButton({ valuationId, status, reportUrl }: {
  valuationId: string
  status: string
  reportUrl: string | null
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const router = useRouter()

  // Show download link if report already exists
  if (reportUrl && !reportUrl.startsWith('local://')) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
        >
          <span>📄</span> Download Business Valuation Report
        </a>
      </div>
    )
  }

  // Only show generate button when status is "review"
  if (status !== 'review') return null

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/agents/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valuation_id: valuationId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Report generation failed')
        return
      }

      // Download the DOCX file
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)

      // Trigger download
      const filename = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'report.docx'
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Refresh the page to show updated status
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
        Valuation complete. Generate a professional USPAP-style Business Valuation Report (DOCX).
      </p>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
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
            Generating Report...
          </span>
        ) : (
          '📄 Generate Business Valuation Report'
        )}
      </button>

      {downloadUrl && (
        <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-800">
            Report generated and downloaded.{' '}
            <a href={downloadUrl} download className="underline font-medium">Download again</a>
          </p>
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
