'use client'

// ============================================================
// MainStreetOS — RecordActionsMenu (Phase 13.2)
// ------------------------------------------------------------
// Attio-style ⋯ dropdown rendered in the TopBar rightSlot on
// record-detail pages. Items are pluggable so deal pages can
// surface Archive/Duplicate/Copy Link/Open in Notion while
// valuation pages can expose Export/Archive/Duplicate, etc.
// Closes on outside click or Escape.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type RecordAction =
  | {
      kind: 'link'
      label: string
      href: string
      external?: boolean
      icon?: React.ReactNode
      variant?: 'default' | 'danger'
    }
  | {
      kind: 'button'
      label: string
      onClick: () => void
      icon?: React.ReactNode
      variant?: 'default' | 'danger'
      disabled?: boolean
    }
  | { kind: 'divider' }

export default function RecordActionsMenu({
  items,
  align = 'right',
}: {
  items: RecordAction[]
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
        title="More actions"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={[
            'absolute z-20 top-full mt-1 min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-lg py-1',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {items.map((it, i) => {
            if (it.kind === 'divider') {
              return <div key={i} className="my-1 border-t border-slate-100" />
            }
            const danger = it.variant === 'danger'
            const cls = [
              'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition',
              danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
            ].join(' ')
            if (it.kind === 'link') {
              if (it.external) {
                return (
                  <a
                    key={i}
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cls}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                  >
                    {it.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{it.icon}</span>}
                    <span className="flex-1">{it.label}</span>
                    <span className="text-[10px] text-slate-400">↗</span>
                  </a>
                )
              }
              return (
                <Link
                  key={i}
                  href={it.href}
                  className={cls}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  {it.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{it.icon}</span>}
                  <span className="flex-1">{it.label}</span>
                </Link>
              )
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={`${cls} ${it.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {it.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{it.icon}</span>}
                <span className="flex-1">{it.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
