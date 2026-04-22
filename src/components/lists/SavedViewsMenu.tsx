'use client'

// ============================================================
// SavedViewsMenu — Phase 12.11d
// Dropdown menu for saved views, with apply / rename / delete / pin.
// Also resolves ?view=<uuid> query param on mount and applies that view.
// Reads and writes the saved_views table (Phase 12.4 schema).
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export interface SavedViewConfig {
  search: string
  sort: { key: string; dir: 'asc' | 'desc' } | null
  filters: Record<string, string[]>
  visibleColumns: string[]
}

export interface SavedView {
  id: string
  name: string
  entity: string | null
  scope: string | null
  config: SavedViewConfig
  pinned_to_sidebar: boolean
  created_at: string
}

export default function SavedViewsMenu({
  entity,
  onApply,
  refreshKey = 0,
}: {
  entity: string
  onApply: (config: SavedViewConfig, viewId: string, viewName: string) => void
  refreshKey?: number
}) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [views, setViews] = useState<SavedView[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('saved_views')
      .select('id, name, entity, scope, config, pinned_to_sidebar, created_at')
      .eq('entity', entity)
      .order('pinned_to_sidebar', { ascending: false })
      .order('created_at', { ascending: false })
    setViews((data || []) as SavedView[])
    setLoading(false)
  }, [supabase, entity])

  useEffect(() => { load() }, [load, refreshKey])

  // Apply ?view=<id> on mount / when URL changes
  useEffect(() => {
    const viewId = searchParams?.get('view')
    if (!viewId || activeViewId === viewId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('saved_views')
        .select('id, name, config')
        .eq('id', viewId)
        .single()
      if (cancelled || !data) return
      setActiveViewId(data.id)
      onApply(data.config as SavedViewConfig, data.id, data.name)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function updateUrlView(id: string | null) {
    const sp = new URLSearchParams(searchParams?.toString() || '')
    if (id) sp.set('view', id)
    else sp.delete('view')
    const qs = sp.toString()
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false })
  }

  function apply(v: SavedView) {
    setActiveViewId(v.id)
    onApply(v.config, v.id, v.name)
    setOpen(false)
    updateUrlView(v.id)
  }

  function clearActive() {
    setActiveViewId(null)
    updateUrlView(null)
  }

  async function rename(v: SavedView) {
    const name = window.prompt('Rename view:', v.name)
    if (!name || name === v.name) return
    const { error } = await supabase.from('saved_views').update({ name }).eq('id', v.id)
    if (error) { alert(`Rename failed: ${error.message}`); return }
    await load()
  }

  async function del(v: SavedView) {
    if (!window.confirm(`Delete saved view "${v.name}"?`)) return
    const { error } = await supabase.from('saved_views').delete().eq('id', v.id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    if (activeViewId === v.id) clearActive()
    await load()
  }

  async function togglePin(v: SavedView) {
    const newPinned = !v.pinned_to_sidebar
    const { error } = await supabase
      .from('saved_views')
      .update({ pinned_to_sidebar: newPinned })
      .eq('id', v.id)
    if (error) { alert(`Pin failed: ${error.message}`); return }
    await load()
  }

  async function toggleScope(v: SavedView) {
    const newScope = v.scope === 'team' ? 'personal' : 'team'
    const { error } = await supabase
      .from('saved_views')
      .update({ scope: newScope })
      .eq('id', v.id)
    if (error) { alert(`Scope change failed: ${error.message}`); return }
    await load()
  }

  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) : null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`text-xs px-2 py-1 rounded border inline-flex items-center gap-1.5 ${
          activeView
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <span>
          {activeView ? `View: ${activeView.name}` : 'Saved views'}
        </span>
        {!activeView && views.length > 0 && (
          <span className="text-slate-400">({views.length})</span>
        )}
        {activeView && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); clearActive() }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clearActive() } }}
            className="text-blue-400 hover:text-blue-700 cursor-pointer"
            aria-label="Clear active view"
          >
            ×
          </span>
        )}
      </button>
      {open && (
        <>
          {/* Click-outside scrim */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-30 py-1 min-w-[300px] max-h-[420px] overflow-y-auto">
            <div className="px-3 py-1.5 text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-100 flex items-center justify-between">
              <span>
                {loading ? 'Loading…' : `${views.length} saved view${views.length === 1 ? '' : 's'}`}
              </span>
              {activeView && (
                <button
                  onClick={clearActive}
                  className="text-[11px] text-slate-500 hover:text-slate-900"
                >
                  Clear active
                </button>
              )}
            </div>
            {views.length === 0 && !loading && (
              <p className="px-3 py-3 text-xs text-slate-400">
                No saved views yet. Use <span className="font-semibold text-slate-600">Save view</span> to capture the current search, filters, sort, and columns.
              </p>
            )}
            {views.map((v) => {
              const active = activeViewId === v.id
              return (
                <div
                  key={v.id}
                  className={`px-3 py-2 flex items-center gap-1 hover:bg-slate-50 ${active ? 'bg-blue-50/40' : ''}`}
                >
                  <button
                    onClick={() => apply(v)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm text-slate-900 truncate font-medium flex items-center gap-1.5">
                      {v.pinned_to_sidebar && <span className="text-amber-500" aria-label="Pinned">★</span>}
                      <span className="truncate">{v.name}</span>
                      {v.scope === 'team' && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Team</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(v) }}
                      title={v.pinned_to_sidebar ? 'Unpin from sidebar' : 'Pin to sidebar'}
                      className={`text-sm px-1.5 py-1 rounded hover:bg-amber-50 ${
                        v.pinned_to_sidebar ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'
                      }`}
                    >
                      {v.pinned_to_sidebar ? '★' : '☆'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleScope(v) }}
                      title={v.scope === 'team' ? 'Make personal' : 'Share with team'}
                      className="text-xs px-1.5 py-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded"
                    >
                      {v.scope === 'team' ? '👥' : '👤'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); rename(v) }}
                      title="Rename"
                      className="text-xs px-1.5 py-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); del(v) }}
                      title="Delete"
                      className="text-xs px-1.5 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
