'use client'

import { useState } from 'react'

export interface StageStepperItem {
  key: string
  label: string
}

interface DealStageStepperProps {
  /** Ordered list of stages to render as stepper nodes. */
  stages: StageStepperItem[]
  /** The currently-active stage key, or null/unrecognized if unknown. */
  currentKey: string | null
  /** Called when the broker picks a different stage from "Move stage." Omit to render read-only. */
  onSelectStage?: (key: string) => void
  /** Disables the "Move stage" control (e.g. demo/seeded data with no live row to write to). */
  disabled?: boolean
  /** Shows a spinner on "Move stage" while a write is in flight. */
  updating?: boolean
  /** Surfaced under the stepper if the last stage-change attempt failed. */
  error?: string | null
}

// Stage labels in this codebase are stored as "N. Label" (see SELLER_STAGES /
// BUYER_PIPELINE_STAGES in lib/types.ts) so the raw enum ordering is legible
// on its own. The stepper already conveys position visually, so strip the
// leading ordinal for the node captions; the full "N. Label" text is kept
// in the "Move stage" menu and the "Currently in ..." line.
function stripOrdinal(label: string): string {
  return label.replace(/^\d+\.\s*/, '')
}

/**
 * Phase 14.1 — horizontal deal-lifecycle stepper.
 *
 * Mirrors BizScout DEALOS's deal-stage stepper (evaluated 2026-07-31, see
 * docs/Phase-14-BizScout-Gap-Close-Design-and-Build-Plan.md): every node uses
 * the same ring + inner-dot motif (dark/filled = passed, amber ring+dot =
 * current, light ring = upcoming), joined by a bold connecting line so the
 * completed path reads clearly at a glance. "Move stage" opens a flat list
 * of every stage with a checkmark on the current one — intentionally no
 * per-stage gating or confirmation step, matching what BSDOS actually does.
 *
 * 2026-08-01: revised node/line styling to be darker and more clearly
 * connected (per broker feedback comparing a real listing screenshot
 * against BSDOS), and added an "unmapped stage" warning: if `currentKey` is
 * set but doesn't match any of the supplied `stages`, that's a real data
 * issue (the underlying row's stage value isn't one of the canonical
 * SELLER_STAGES/BUYER_PIPELINE_STAGES keys) and should be surfaced, not
 * silently rendered as a flat, undifferentiated stepper.
 */
export default function DealStageStepper({
  stages,
  currentKey,
  onSelectStage,
  disabled = false,
  updating = false,
  error = null,
}: DealStageStepperProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const currentIndex = stages.findIndex((s) => s.key === currentKey)
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : null
  const unmapped = !currentStage && currentKey != null && currentKey !== ''

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Deal Stage
          {currentStage && (
            <span className="ml-2 normal-case font-normal text-slate-500">
              Currently in <span className="font-semibold text-slate-700">{stripOrdinal(currentStage.label)}</span>
            </span>
          )}
          {unmapped && (
            <span className="ml-2 inline-flex items-center gap-1 normal-case font-medium text-amber-800 bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 text-[10px] align-middle">
              Stage value &quot;{currentKey}&quot; doesn&apos;t match a known stage — showing unset
            </span>
          )}
        </p>

        {onSelectStage && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={disabled || updating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 rounded-lg transition-colors"
            >
              {updating ? (
                <span className="inline-block w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M7 5l5 5-5 5" />
                </svg>
              )}
              Move stage
            </button>

            {menuOpen && (
              <>
                {/* click-outside backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-80 overflow-y-auto">
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Update Deal Stage
                  </p>
                  {stages.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        if (s.key !== currentKey) onSelectStage(s.key)
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <span>{s.label}</span>
                      {s.key === currentKey && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-600 shrink-0">
                          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start">
        {stages.map((s, i) => {
          const passed = currentIndex >= 0 && i < currentIndex
          const isCurrent = i === currentIndex
          const isLast = i === stages.length - 1
          return (
            <div key={s.key} className={`flex items-start ${isLast ? '' : 'flex-1'}`}>
              <div className="flex flex-col items-center" style={{ width: 92 }}>
                {/* Every node uses the same ring + inner-dot motif; only the
                    ring/dot color and size change with state, so passed,
                    current, and upcoming nodes read as one connected family
                    rather than mismatched shapes. */}
                <div
                  className={`relative rounded-full shrink-0 flex items-center justify-center transition-colors ${
                    isCurrent
                      ? 'w-5 h-5 bg-white ring-4 ring-amber-200 border-2 border-amber-500'
                      : passed
                        ? 'w-4 h-4 bg-slate-900 ring-4 ring-slate-300'
                        : 'w-4 h-4 bg-white border-2 border-slate-300'
                  }`}
                >
                  {isCurrent && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                  {passed && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span
                  className={`mt-2 text-[10px] text-center leading-tight ${
                    isCurrent ? 'font-bold text-slate-900' : passed ? 'font-medium text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {stripOrdinal(s.label)}
                </span>
              </div>
              {!isLast && (
                <div className={`h-1 flex-1 mt-2 rounded-full ${passed || isCurrent ? 'bg-slate-900' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
