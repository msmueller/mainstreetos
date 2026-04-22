'use client'

// ============================================================
// ListView — Phase 12.11c
// Generic Attio-parity list/table component for CRM entities.
//
// Features:
//   - Global search (debounced)
//   - Per-column sort (toggle asc/desc/off on header click)
//   - Per-column filter chips (auto-generated for string enums)
//   - Column visibility toggle
//   - Density toggle (compact / comfortable)
//   - Multi-select with bulk action slot
//   - Pagination with configurable page size
//   - CSV export of current filtered rows
//   - Save-this-view (via onSaveView callback) against saved_views schema
//
// Consumers provide:
//   - rows: T[]                  the data
//   - columns: ColumnDef<T>[]    column configuration
//   - getRowId: (row: T) => string
//   - rowHref?: (row: T) => string       optional per-row link
//   - bulkActions?: BulkAction<T>[]       optional bulk action buttons
//   - onSaveView?: (opts) => void         optional save-view callback
// ============================================================

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import SavedViewsMenu, { type SavedViewConfig } from './SavedViewsMenu'
import { createClient } from '@/lib/supabase/client'

export type ColumnDef<T> = {
  key: string
  label: string
  accessor: (row: T) => string | number | boolean | null | undefined
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
  width?: string
  align?: 'left' | 'right' | 'center'
  defaultVisible?: boolean
}

export type BulkAction<T> = {
  label: string
  onAction: (rows: T[]) => void | Promise<void>
  confirmText?: string
  variant?: 'default' | 'danger'
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

interface ListViewProps<T> {
  rows: T[]
  columns: ColumnDef<T>[]
  getRowId: (row: T) => string
  rowHref?: (row: T) => string
  bulkActions?: BulkAction<T>[]
  title?: string
  entityName?: string
  /**
   * saved_views.entity key (e.g. 'deals', 'buyer_leads', 'seller_listings').
   * When provided, the SavedViewsMenu is shown in the toolbar and the
   * Save view button inserts into saved_views directly.
   */
  entity?: string
  pageSizeOptions?: number[]
  initialPageSize?: number
  searchPlaceholder?: string
  /**
   * Optional escape hatch — when provided, Save view calls this instead of
   * the built-in insert. Kept for back-compat and for non-saved_views use.
   */
  onSaveView?: (opts: {
    search: string
    sort: SortState
    filters: Record<string, string[]>
    visibleColumns: string[]
  }) => void
  emptyMessage?: string
}

export default function ListView<T>({
  rows,
  columns,
  getRowId,
  rowHref,
  bulkActions = [],
  title,
  entityName = 'row',
  entity,
  pageSizeOptions = [25, 50, 100, 250],
  initialPageSize = 50,
  searchPlaceholder = 'Search…',
  onSaveView,
  emptyMessage = 'No results.',
}: ListViewProps<T>) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState<SortState>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key))
  )
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [savedViewsRefreshKey, setSavedViewsRefreshKey] = useState(0)
  const [activeViewName, setActiveViewName] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 180)
    return () => clearTimeout(t)
  }, [search])

  // Reset page on filter/search change
  useEffect(() => { setPage(0) }, [debouncedSearch, filters, sort])

  // Per-column unique values for filter dropdowns
  const uniqueByKey = useMemo(() => {
    const out: Record<string, string[]> = {}
    columns.filter((c) => c.filterable).forEach((c) => {
      const set = new Set<string>()
      rows.forEach((r) => {
        const v = c.accessor(r)
        if (v != null && v !== '') set.add(String(v))
      })
      out[c.key] = Array.from(set).sort()
    })
    return out
  }, [columns, rows])

  // Apply search + filters + sort
  const processed = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    let out = rows

    // Global search over all accessor values
    if (q) {
      out = out.filter((r) =>
        columns.some((c) => {
          const v = c.accessor(r)
          return v != null && String(v).toLowerCase().includes(q)
        })
      )
    }

    // Per-column filters
    const activeFilters = Object.entries(filters).filter(([, vals]) => vals.length > 0)
    if (activeFilters.length > 0) {
      out = out.filter((r) =>
        activeFilters.every(([key, vals]) => {
          const col = columns.find((c) => c.key === key)
          if (!col) return true
          const v = col.accessor(r)
          return v != null && vals.includes(String(v))
        })
      )
    }

    // Sort
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col) {
        const dir = sort.dir === 'asc' ? 1 : -1
        out = [...out].sort((a, b) => {
          const av = col.accessor(a)
          const bv = col.accessor(b)
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
          return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
        })
      }
    }

    return out
  }, [rows, columns, debouncedSearch, filters, sort])

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize))
  const pageStart = page * pageSize
  const pageRows = processed.slice(pageStart, pageStart + pageSize)

  // Visible columns in original order
  const shownColumns = columns.filter((c) => visibleColumns.has(c.key))

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function toggleFilterValue(colKey: string, value: string) {
    setFilters((prev) => {
      const existing = prev[colKey] || []
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value]
      return { ...prev, [colKey]: next }
    })
  }

  function clearFilters() {
    setFilters({})
    setSearch('')
  }

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleRowSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const pageIds = pageRows.map((r) => getRowId(r))
      const allSelected = pageIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  async function runBulkAction(action: BulkAction<T>) {
    if (action.confirmText && !window.confirm(action.confirmText)) return
    const selected = rows.filter((r) => selectedIds.has(getRowId(r)))
    if (selected.length === 0) return
    setBusyAction(action.label)
    try {
      await action.onAction(selected)
    } finally {
      setBusyAction(null)
    }
  }

  function applyConfig(cfg: SavedViewConfig, _viewId: string, viewName: string) {
    setSearch(cfg.search || '')
    setDebouncedSearch(cfg.search || '')
    setSort(cfg.sort || null)
    setFilters(cfg.filters || {})
    if (Array.isArray(cfg.visibleColumns) && cfg.visibleColumns.length > 0) {
      setVisibleColumns(new Set(cfg.visibleColumns))
    }
    setActiveViewName(viewName)
    setPage(0)
  }

  async function handleSaveView() {
    const config = {
      search: debouncedSearch,
      sort,
      filters,
      visibleColumns: Array.from(visibleColumns),
    }
    if (onSaveView) {
      onSaveView(config)
      setSavedViewsRefreshKey((k) => k + 1)
      return
    }
    if (!entity) return
    const name = window.prompt('Name this view:')
    if (!name) return
    const shareTeam = window.confirm(
      `Save "${name}" as a TEAM view (visible to your whole team)?\n\nOK = Team · Cancel = Personal`
    )
    const { error } = await supabase.from('saved_views').insert({
      name,
      entity,
      scope: shareTeam ? 'team' : 'personal',
      config,
    })
    if (error) { alert(`Failed to save view: ${error.message}`); return }
    setSavedViewsRefreshKey((k) => k + 1)
  }

  function exportCsv() {
    const rowsToExport = processed
    const headers = shownColumns.map((c) => c.label)
    const lines = [
      headers.map(csvEscape).join(','),
      ...rowsToExport.map((r) =>
        shownColumns.map((c) => csvEscape(formatForCsv(c.accessor(r)))).join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entityName}-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedCount = selectedIds.size
  const activeFilterCount = Object.values(filters).reduce((n, v) => n + v.length, 0)
  const cellPadding = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'
  const textSize = density === 'compact' ? 'text-xs' : 'text-sm'

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        {title && <h3 className="font-semibold text-slate-900 mr-2">{title}</h3>}

        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500 whitespace-nowrap">
          {processed.length} of {rows.length} {entityName}{rows.length === 1 ? '' : 's'}
          {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`}
        </div>

        {(activeFilterCount > 0 || search) && (
          <button
            onClick={clearFilters}
            className="text-xs px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
          >
            Clear
          </button>
        )}

        <button
          onClick={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
          className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
          title="Toggle density"
        >
          {density === 'compact' ? 'Compact' : 'Comfortable'}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowColumnsMenu((s) => !s)}
            className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
          >
            Columns ({shownColumns.length}/{columns.length})
          </button>
          {showColumnsMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-1 min-w-[220px] max-h-[320px] overflow-y-auto">
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(c.key)}
                    onChange={() => toggleColumn(c.key)}
                    className="rounded text-blue-600"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={exportCsv}
          className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
        >
          Export CSV
        </button>

        {entity && (
          <SavedViewsMenu
            entity={entity}
            onApply={applyConfig}
            refreshKey={savedViewsRefreshKey}
          />
        )}

        {(entity || onSaveView) && (
          <button
            onClick={handleSaveView}
            className="text-xs px-2 py-1 text-white bg-blue-600 hover:bg-blue-700 rounded"
          >
            Save view
          </button>
        )}
      </div>

      {activeViewName && (
        <div className="px-4 py-1.5 bg-blue-50/40 border-b border-blue-100 text-[11px] text-blue-700 flex items-center gap-2">
          <span className="font-semibold">Active view:</span>
          <span>{activeViewName}</span>
          <span className="text-blue-300">·</span>
          <span className="text-blue-500">Adjustments are not saved until you click <span className="font-semibold">Save view</span>.</span>
        </div>
      )}

      {/* Filter chip row (only for columns with filters active or dropdowns) */}
      <FilterChipRow
        columns={columns}
        filters={filters}
        uniqueByKey={uniqueByKey}
        onToggle={toggleFilterValue}
      />

      {/* Bulk action bar */}
      {selectedCount > 0 && bulkActions.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
          <span className="text-sm text-blue-900 font-medium">{selectedCount} selected</span>
          <div className="flex-1" />
          {bulkActions.map((a) => (
            <button
              key={a.label}
              onClick={() => runBulkAction(a)}
              disabled={busyAction === a.label}
              className={`text-xs px-3 py-1.5 rounded-md disabled:opacity-50 ${
                a.variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {busyAction === a.label ? 'Working…' : a.label}
            </button>
          ))}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs px-2 py-1 text-blue-700 hover:bg-blue-100 rounded"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className={`w-full ${textSize}`}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {bulkActions.length > 0 && (
                <th className={`${cellPadding} w-10`}>
                  <input
                    type="checkbox"
                    onChange={toggleSelectAllOnPage}
                    checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.has(getRowId(r)))}
                    className="rounded text-blue-600"
                  />
                </th>
              )}
              {shownColumns.map((c) => {
                const activeSort = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    className={`${cellPadding} text-${c.align || 'left'} font-semibold text-slate-600 uppercase tracking-wide text-[11px]`}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    {c.sortable !== false ? (
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        {c.label}
                        {activeSort && (
                          <span className="text-slate-400">{sort!.dir === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                )
              })}
              {rowHref && <th className={`${cellPadding} w-16`} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={shownColumns.length + (bulkActions.length > 0 ? 1 : 0) + (rowHref ? 1 : 0)} className="px-4 py-10 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const id = getRowId(row)
                const selected = selectedIds.has(id)
                return (
                  <tr key={id} className={`hover:bg-blue-50 transition-colors ${selected ? 'bg-blue-50/40' : ''}`}>
                    {bulkActions.length > 0 && (
                      <td className={cellPadding}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRowSelection(id)}
                          className="rounded text-blue-600"
                        />
                      </td>
                    )}
                    {shownColumns.map((c) => (
                      <td
                        key={c.key}
                        className={`${cellPadding} text-${c.align || 'left'} text-slate-900 align-middle`}
                        style={c.width ? { width: c.width } : undefined}
                      >
                        {c.render ? c.render(row) : formatValue(c.accessor(row))}
                      </td>
                    ))}
                    {rowHref && (
                      <td className={`${cellPadding} text-right`}>
                        <Link
                          href={rowHref(row)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Open →
                        </Link>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          {processed.length > 0 && (
            <>
              Showing {pageStart + 1}–{Math.min(pageStart + pageSize, processed.length)} of {processed.length}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0) }}
            className="text-xs px-2 py-1 border border-slate-200 rounded"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-2 py-1 border border-slate-200 rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-slate-500 tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs px-2 py-1 border border-slate-200 rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterChipRow<T>({
  columns,
  filters,
  uniqueByKey,
  onToggle,
}: {
  columns: ColumnDef<T>[]
  filters: Record<string, string[]>
  uniqueByKey: Record<string, string[]>
  onToggle: (colKey: string, value: string) => void
}) {
  const filterable = columns.filter((c) => c.filterable && (uniqueByKey[c.key]?.length || 0) > 0 && (uniqueByKey[c.key]?.length || 0) <= 40)
  const [openCol, setOpenCol] = useState<string | null>(null)

  if (filterable.length === 0) return null

  return (
    <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-400 uppercase tracking-wide mr-1">Filter by:</span>
      {filterable.map((c) => {
        const active = filters[c.key] || []
        const opts = uniqueByKey[c.key] || []
        return (
          <div key={c.key} className="relative">
            <button
              onClick={() => setOpenCol((o) => (o === c.key ? null : c.key))}
              className={`text-xs px-2 py-1 rounded-md border ${
                active.length > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.label}{active.length > 0 ? ` · ${active.length}` : ''}
            </button>
            {openCol === c.key && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-10 py-1 min-w-[200px] max-h-[280px] overflow-y-auto">
                {opts.map((v) => (
                  <label key={v} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active.includes(v)}
                      onChange={() => onToggle(c.key, v)}
                      className="rounded text-blue-600"
                    />
                    <span className="truncate">{v}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatValue(v: unknown): React.ReactNode {
  if (v == null || v === '') return <span className="text-slate-400">—</span>
  if (typeof v === 'boolean') return v ? '✓' : ''
  return String(v)
}

function formatForCsv(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
