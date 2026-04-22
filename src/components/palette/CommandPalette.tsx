'use client'

// ============================================================
// CommandPalette — Phase 12.11e
// ⌘K / Ctrl+K command palette with cross-entity search,
// navigation shortcuts, and quick actions. Mounted once in
// the dashboard layout; listens globally for the keyboard shortcut.
//
// Sources:
//   - Navigation (static links)
//   - Create (quick actions)
//   - Deals        (deals table)
//   - Listings     (seller_listings)
//   - Leads        (buyer_leads via contacts)
//   - Contacts     (contacts)
//   - Valuations   (valuations)
//   - Saved views  (saved_views)
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ResultGroup = 'Navigation' | 'Create' | 'Deals' | 'Listings' | 'Leads' | 'Contacts' | 'Valuations' | 'Saved Views'

interface PaletteResult {
  id: string
  group: ResultGroup
  label: string
  sublabel?: string
  href: string
  icon?: string
}

const STATIC_NAV: PaletteResult[] = [
  { id: 'nav-dashboard', group: 'Navigation', label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { id: 'nav-deals', group: 'Navigation', label: 'Deal Pipeline', href: '/dashboard/deals', icon: '🔄' },
  { id: 'nav-listings', group: 'Navigation', label: 'Seller Listings', href: '/dashboard/listings', icon: '🏢' },
  { id: 'nav-leads', group: 'Navigation', label: 'Leads & Contacts', href: '/dashboard/leads', icon: '👥' },
  { id: 'nav-valuations', group: 'Navigation', label: 'Valuations', href: '/dashboard/valuations', icon: '📈' },
]

const STATIC_CREATE: PaletteResult[] = [
  { id: 'new-valuation', group: 'Create', label: 'New Valuation', href: '/dashboard/valuations/new', icon: '➕' },
]

export default function CommandPalette() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<PaletteResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Focus input when opened, reset state when closed
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10)
    } else {
      setQuery('')
      setDebouncedQuery('')
      setActiveIndex(0)
    }
  }, [open])

  // Debounce the query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 160)
    return () => clearTimeout(t)
  }, [query])

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    const ilike = `%${trimmed}%`

    if (!trimmed) {
      // Empty state: show nav + create + a few recent items
      const [recentDeals, recentListings, recentValuations] = await Promise.all([
        supabase.from('deals').select('id, listing_name, industry').order('created_at', { ascending: false }).limit(5),
        supabase.from('seller_listings').select('id, listing_name, industry').order('created_at', { ascending: false }).limit(5),
        supabase.from('valuations').select('id, business_name, industry').order('created_at', { ascending: false }).limit(5),
      ])
      const r: PaletteResult[] = [
        ...STATIC_NAV,
        ...STATIC_CREATE,
        ...(recentDeals.data || []).map((d) => ({
          id: `deal-${d.id}`,
          group: 'Deals' as const,
          label: d.listing_name || 'Untitled deal',
          sublabel: d.industry || undefined,
          href: `/dashboard/deals/${d.id}`,
          icon: '🔄',
        })),
        ...(recentListings.data || []).map((l) => ({
          id: `listing-${l.id}`,
          group: 'Listings' as const,
          label: l.listing_name || 'Untitled listing',
          sublabel: l.industry || undefined,
          href: `/dashboard/deals/${l.id}`,
          icon: '🏢',
        })),
        ...(recentValuations.data || []).map((v) => ({
          id: `val-${v.id}`,
          group: 'Valuations' as const,
          label: v.business_name || 'Untitled valuation',
          sublabel: v.industry || undefined,
          href: `/dashboard/valuations/${v.id}`,
          icon: '📈',
        })),
      ]
      return r
    }

    const [deals, listings, leads, contacts, valuations, views] = await Promise.all([
      supabase
        .from('deals')
        .select('id, listing_name, industry, deal_status')
        .or(`listing_name.ilike.${ilike},industry.ilike.${ilike},business_address.ilike.${ilike}`)
        .limit(8),
      supabase
        .from('seller_listings')
        .select('id, listing_name, industry, listing_status')
        .or(`listing_name.ilike.${ilike},industry.ilike.${ilike},business_address.ilike.${ilike}`)
        .limit(8),
      supabase
        .from('buyer_leads')
        .select('id, contact_id, current_stage, contacts!inner(first_name, last_name, email)')
        .or(`first_name.ilike.${ilike},last_name.ilike.${ilike},email.ilike.${ilike}`, { foreignTable: 'contacts' })
        .limit(8),
      supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_name')
        .or(`first_name.ilike.${ilike},last_name.ilike.${ilike},email.ilike.${ilike},company_name.ilike.${ilike}`)
        .limit(8),
      supabase
        .from('valuations')
        .select('id, business_name, industry')
        .or(`business_name.ilike.${ilike},industry.ilike.${ilike}`)
        .limit(8),
      supabase
        .from('saved_views')
        .select('id, name, entity')
        .ilike('name', ilike)
        .limit(8),
    ])

    const entityRoute: Record<string, string> = {
      deals: '/dashboard/deals',
      buyer_leads: '/dashboard/leads',
      seller_listings: '/dashboard/listings',
      contacts: '/dashboard/leads',
    }

    // Fuzzy filter local nav items too
    const qLower = trimmed.toLowerCase()
    const filteredNav = [...STATIC_NAV, ...STATIC_CREATE].filter(
      (n) => n.label.toLowerCase().includes(qLower),
    )

    const r: PaletteResult[] = [
      ...filteredNav,
      ...(deals.data || []).map((d) => ({
        id: `deal-${d.id}`,
        group: 'Deals' as const,
        label: d.listing_name || 'Untitled deal',
        sublabel: [d.industry, d.deal_status].filter(Boolean).join(' · ') || undefined,
        href: `/dashboard/deals/${d.id}`,
        icon: '🔄',
      })),
      ...(listings.data || []).map((l) => ({
        id: `listing-${l.id}`,
        group: 'Listings' as const,
        label: l.listing_name || 'Untitled listing',
        sublabel: [l.industry, l.listing_status].filter(Boolean).join(' · ') || undefined,
        href: `/dashboard/deals/${l.id}`,
        icon: '🏢',
      })),
      ...(leads.data || []).map((row) => {
        const r2 = row as unknown as {
          id: string
          contact_id: string
          current_stage: string | null
          contacts: { first_name: string; last_name: string; email: string | null } | { first_name: string; last_name: string; email: string | null }[] | null
        }
        const c = Array.isArray(r2.contacts) ? r2.contacts[0] : r2.contacts
        const name = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Unnamed lead'
        return {
          id: `lead-${r2.id}`,
          group: 'Leads' as const,
          label: name || c?.email || 'Unnamed lead',
          sublabel: [c?.email, r2.current_stage].filter(Boolean).join(' · ') || undefined,
          href: `/dashboard/leads?contact=${r2.contact_id}`,
          icon: '👥',
        }
      }),
      ...(contacts.data || []).map((c) => ({
        id: `contact-${c.id}`,
        group: 'Contacts' as const,
        label: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || 'Unnamed contact',
        sublabel: [c.email, c.company_name].filter(Boolean).join(' · ') || undefined,
        href: `/dashboard/leads?contact=${c.id}`,
        icon: '👤',
      })),
      ...(valuations.data || []).map((v) => ({
        id: `val-${v.id}`,
        group: 'Valuations' as const,
        label: v.business_name || 'Untitled valuation',
        sublabel: v.industry || undefined,
        href: `/dashboard/valuations/${v.id}`,
        icon: '📈',
      })),
      ...(views.data || []).map((v) => {
        const route = (v.entity && entityRoute[v.entity]) || '/dashboard'
        return {
          id: `view-${v.id}`,
          group: 'Saved Views' as const,
          label: v.name,
          sublabel: v.entity || undefined,
          href: `${route}?view=${v.id}`,
          icon: '⭐',
        }
      }),
    ]
    return r
  }, [supabase])

  // Run search when debounced query changes (while open)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    runSearch(debouncedQuery).then((r) => {
      if (cancelled) return
      setResults(r)
      setActiveIndex(0)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [debouncedQuery, open, runSearch])

  // Group results preserving order
  const grouped = useMemo(() => {
    const map = new Map<ResultGroup, PaletteResult[]>()
    for (const r of results) {
      if (!map.has(r.group)) map.set(r.group, [])
      map.get(r.group)!.push(r)
    }
    return Array.from(map.entries())
  }, [results])

  function go(r: PaletteResult) {
    setOpen(false)
    router.push(r.href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[activeIndex]
      if (r) go(r)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-active-idx="${activeIndex}"]`)
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  let flatIdx = -1
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-slate-900/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <span className="text-slate-400 text-lg">⌘K</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search deals, listings, leads, contacts, valuations, saved views…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder-slate-400"
          />
          {loading && <span className="text-xs text-slate-400">Searching…</span>}
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && !loading && (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              {debouncedQuery ? 'No results.' : 'Start typing to search…'}
            </p>
          )}
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                {group}
              </div>
              {items.map((r) => {
                flatIdx++
                const idx = flatIdx
                const active = idx === activeIndex
                return (
                  <button
                    key={r.id}
                    data-active-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go(r)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      active ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base shrink-0">{r.icon || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${active ? 'text-blue-900 font-medium' : 'text-slate-900'}`}>
                        {r.label}
                      </p>
                      {r.sublabel && (
                        <p className={`text-xs truncate mt-0.5 ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                          {r.sublabel}
                        </p>
                      )}
                    </div>
                    {active && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-600 shrink-0">
                        ↵
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500">Esc</kbd>
            Close
          </span>
          <span className="ml-auto">
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
