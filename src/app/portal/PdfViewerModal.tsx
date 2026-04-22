'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// ============================================================
// PdfViewerModal — Phase 12.12c
// Inline pdf.js viewer for buyer portal. Renders signed-URL
// PDFs page-by-page inside a branded modal, with a diagonal
// client-side watermark overlay (viewer email + date).
//
// Non-PDF documents fall back to signedUrl in a new tab —
// the caller should detect mime_type and only open the modal
// for application/pdf.
// ============================================================

// Point pdf.js at the matching worker version via CDN.
// Must happen at module scope so the Document renderer can find it.
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface PdfViewerModalProps {
  open: boolean
  signedUrl: string | null
  documentName: string
  watermarkLabel: string    // e.g. "markm@creresources.biz • 2026-04-21"
  onClose: () => void
}

// Build a data URL SVG watermark pattern so CSS can tile it.
function buildWatermarkDataUrl(label: string): string {
  // Escape the label for SVG
  const safe = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='460' height='220' viewBox='0 0 460 220'>
    <text x='230' y='110'
      font-family='-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      font-size='16'
      fill='rgba(15, 23, 42, 0.10)'
      text-anchor='middle'
      transform='rotate(-28 230 110)'>
      ${safe} · CONFIDENTIAL
    </text>
  </svg>`

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

export default function PdfViewerModal({
  open,
  signedUrl,
  documentName,
  watermarkLabel,
  onClose,
}: PdfViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reset viewer state whenever we open a new doc. React's recommended
  // pattern for "derive state from prop changes" is to compare prev vs
  // current during render instead of useEffect+setState.
  const sessionKey = open ? (signedUrl ?? '(empty)') : null
  const [prevSessionKey, setPrevSessionKey] = useState<string | null>(null)
  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey)
    setNumPages(0)
    setScale(1.1)
    setLoading(true)
    setError(null)
  }

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Keyboard: Esc closes
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onDocLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
  }, [])

  const onDocLoadError = useCallback((err: Error) => {
    console.error('[pdf-viewer] load failed:', err)
    setError(err.message || 'Failed to load document')
    setLoading(false)
  }, [])

  const watermarkUrl = useMemo(
    () => buildWatermarkDataUrl(watermarkLabel),
    [watermarkLabel],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-title"
    >
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2
            id="pdf-viewer-title"
            className="text-sm font-semibold text-white truncate"
          >
            📄 {documentName}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {numPages > 0 ? `${numPages} page${numPages === 1 ? '' : 's'} · ` : ''}
            Viewing as <span className="text-slate-200">{watermarkLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}
            disabled={scale <= 0.5}
            className="px-2 py-1 text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-40"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-slate-300 min-w-[3rem] text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)))}
            disabled={scale >= 2.5}
            className="px-2 py-1 text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-40"
            aria-label="Zoom in"
          >
            +
          </button>
          <div className="h-5 w-px bg-slate-600 mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-slate-200 bg-slate-700 hover:bg-red-600 hover:text-white rounded transition-colors"
            aria-label="Close viewer"
          >
            Close ✕
          </button>
        </div>
      </div>

      {/* Body — scrollable page stack with watermark overlay */}
      <div className="flex-1 overflow-auto relative">
        <div
          className="min-h-full py-6 px-4 flex flex-col items-center gap-4 select-none"
          style={{
            // Block casual right-click save. Doesn't defeat devtools but
            // matches the "no casual leak" posture.
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            userSelect: 'none',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {loading && !error && (
            <div className="text-slate-300 text-sm flex items-center gap-3 py-12">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Loading document…
            </div>
          )}

          {error && (
            <div className="max-w-md w-full bg-red-950/50 border border-red-800 rounded-lg p-4 text-sm text-red-200">
              <p className="font-semibold mb-1">Couldn&apos;t load document</p>
              <p className="text-xs text-red-300">{error}</p>
              <p className="text-xs text-red-400 mt-2">
                The signed URL may have expired. Close and try again.
              </p>
            </div>
          )}

          {signedUrl && !error && (
            <Document
              file={signedUrl}
              onLoadSuccess={onDocLoadSuccess}
              onLoadError={onDocLoadError}
              loading={null}
              error={null}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <div
                  key={`page-${i + 1}`}
                  className="relative shadow-xl bg-white rounded overflow-hidden"
                  style={{ marginBottom: '1rem' }}
                >
                  <Page
                    pageNumber={i + 1}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                  />
                  {/* Watermark overlay — sits above page content, click-through */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: watermarkUrl,
                      backgroundRepeat: 'repeat',
                      backgroundSize: '460px 220px',
                    }}
                  />
                </div>
              ))}
            </Document>
          )}
        </div>
      </div>

      {/* Footer disclosure */}
      <div className="flex-shrink-0 bg-slate-800 border-t border-slate-700 px-4 py-2 text-[11px] text-slate-400 text-center">
        This document is confidential. Your access is logged with timestamp, IP, and browser for audit.
      </div>
    </div>
  )
}
