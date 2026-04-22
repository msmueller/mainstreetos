'use client'

// ============================================================
// MainStreetOS — ListControls (Phase 13.2)
// ------------------------------------------------------------
// Attio/Basepoint-style secondary toolbar rendered below the
// TopBar on index pages. View switcher, Filter button, Sort
// button, and an optional trailing slot for extras (e.g.,
// Import/Export). Filter/Sort dropdowns are UI-only in 13.2 —
// they announce the control surface; deeper query-binding
// lands in a later phase.
// ============================================================

import { useEffect, useRef, useState } from 'react'

export type ListView = {
  key: string
  label: string
  icon?: React.ReactNode
}

export type SortOption = {
  key: string
  label: string
}

export type FilterOption = {
  key: string
  label: string
}

export default function ListControls({
  views,
  activeView,
  onViewChange,
  filters = [],
  activeFilters = [],
  onFilterToggle,
  sorts = [],
  activeSort,
  onSortChange,
  trailing,
  totalCount,
}: {
  views?: ListView[]
  activeView?: string
  onViewChange?: (v: string) => void
  filters?: FilterOption[]
  activeFilters?: string[]
  onFilterToggle?: (key: string) => void
  sorts?: SortOption[]
  activeSort?: string
  onSortChange?: (s: string) => void
  trailing?: React.ReactNode
  totalCount?: number
}) {
  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-lg px-2 py-1.5">
      {views && views.length > 1 && (
        <div className="flex items-center gap-0.5 bg-slate-50 rounded-md p-0.5">
          {views.map((v) => {
            const active = v.key === activeView
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onViewChange?.(v.key)}
                className={[
                  'px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition',
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {v.icon && <span className="w-3.5 h-3.5">{v.icon}</span>}
                <span>{v.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {views && views.length > 1 && (filters.length > 0 || sorts.length > 0) && (
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
      )}

      {sorts.length > 0 && (
        <DropdownButton
          label={
            activeSort
              ? `Sort: ${sorts.find((s) => s.key === activeSort)?.label || activeSort}`
              : 'Sort'
          }
          icon={<SortIcon />}
          items={sorts.map((s) => ({
            key: s.key,
            label: s.label,
            active: s.key === activeSort,
            onSelect: () => onSortChange?.(s.key),
          }))}
        />
      )}

      {filters.length > 0 && (
        <DropdownButton
          label={
            activeFilters.length > 0
              ? `Filter · ${activeFilters.length}`
              : 'Filter'
          }
          icon={<FilterIcon />}
          items={filters.map((f) => ({
            key: f.key,
            label: f.label,
            active: activeFilters.includes(f.key),
            onSelect: () => onFilterToggle?.(f.key),
          }))}
          multiSelect
        />
      )}

      <div className="flex-1" />

      {typeof totalCount === 'number' && (
        <span className="text-xs text-slate-400 mr-1">
          {totalCount.toLocaleString()} {totalCount === 1 ? 'record' : 'records'}
        </span>
      )}

      {trailing}
    </div>
  )
}

// ------------------------------------------------------------
// Dropdown subcomponent
// ------------------------------------------------------------

type DropdownItem = {
  key: string
  label: string
  active?: boolean
  onSelect: () => void
}

function DropdownButton({
  label,
  icon,
  items,
  multiSelect = false,
}: {
  label: string
  icon?: React.ReactNode
  items: DropdownItem[]
  multiSelect?: boolean
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
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-md transition border border-transparent hover:border-slate-200"
      >
        {icon}
        <span>{label}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-slate-400">
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {items.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">No options</div>
          )}
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                it.onSelect()
                if (!multiSelect) setOpen(false)
              }}
              className={[
                'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition',
                it.active
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                {it.active ? (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M5 10l3 3 7-7" />
                  </svg>
                ) : null}
              </span>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SortIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M5 4v12M5 4l-2 2M5 4l2 2" />
      <path d="M13 16V4M13 16l-2-2M13 16l2-2" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M3 5h14M6 10h8M9 15h2" />
    </svg>
  )
}
