'use client'

// ============================================================
// MainStreetOS — Sidebar (Phase 13.1)
// ------------------------------------------------------------
// Basepoint-inspired left sidebar. Workspace header, Quick
// Actions palette trigger, Favorites (stub), Records section
// with colored icon tiles. Active-route detection via
// usePathname. MSOS blue accent for the selected state — the
// per-record tile colors stay on brand (orange / blue /
// emerald / purple) regardless of which row is active.
// ============================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signout } from '@/app/auth/actions'
import PaletteTrigger from '@/components/palette/PaletteTrigger'

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

type UserSummary = {
  fullName: string | null
  email: string
  tier: string | null
}

export type RecentItem = {
  kind: 'deal' | 'valuation'
  id: string
  href: string
  label: string
  sublabel?: string | null
}

type RecordLink = {
  href: string
  label: string
  tile: {
    bg: string // tailwind bg class for the icon tile
    fg: string // tailwind text class for the glyph
  }
  glyph: React.ReactNode
  matchPrefix?: string // if set, pathname.startsWith(matchPrefix) counts as active
}

type TopLink = {
  href: string
  label: string
  icon: React.ReactNode
}

// ------------------------------------------------------------
// Nav model
// ------------------------------------------------------------

const TOP_LINKS: TopLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
  { href: '/dashboard/valuations/new', label: 'New Valuation', icon: <PlusIcon /> },
]

const RECORDS: RecordLink[] = [
  {
    href: '/dashboard/deals',
    matchPrefix: '/dashboard/deals',
    label: 'Deals',
    tile: { bg: 'bg-orange-500', fg: 'text-white' },
    glyph: <DealsGlyph />,
  },
  {
    href: '/dashboard/leads',
    matchPrefix: '/dashboard/leads',
    label: 'Buyers',
    tile: { bg: 'bg-blue-500', fg: 'text-white' },
    glyph: <BuyersGlyph />,
  },
  {
    href: '/dashboard/valuations',
    matchPrefix: '/dashboard/valuations',
    label: 'Valuations',
    tile: { bg: 'bg-emerald-500', fg: 'text-white' },
    glyph: <ValuationsGlyph />,
  },
  {
    href: '/dashboard/drafts',
    matchPrefix: '/dashboard/drafts',
    label: 'Drafts',
    tile: { bg: 'bg-violet-500', fg: 'text-white' },
    glyph: <DraftsGlyph />,
  },
]

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

export default function Sidebar({
  user,
  recents = [],
}: {
  user: UserSummary
  recents?: RecentItem[]
}) {
  const pathname = usePathname() || ''
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [recentsOpen, setRecentsOpen] = useState(true)
  const [recordsOpen, setRecordsOpen] = useState(true)

  function isActive(link: RecordLink | TopLink) {
    const prefix = 'matchPrefix' in link && link.matchPrefix
    if (prefix) {
      // Exact dashboard root should not match every /dashboard/* route
      if (prefix === '/dashboard') return pathname === '/dashboard'
      return pathname === prefix || pathname.startsWith(prefix + '/')
    }
    // top links: exact match (Dashboard root) or new-valuation exact
    return pathname === link.href
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
      {/* Workspace header */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition"
      >
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
          M
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-slate-900 tracking-tight">MainStreet</span>
            <span className="text-sm font-semibold text-blue-600 tracking-tight">OS</span>
            <span className="text-[9px] text-slate-400 align-super">™</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight truncate">AI-Native Deal OS</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </Link>

      {/* Quick Actions search */}
      <div className="px-3 pt-3">
        <PaletteTrigger />
      </div>

      {/* Top-level items */}
      <nav className="px-3 pt-3 pb-2 space-y-0.5">
        {TOP_LINKS.map((link) => {
          const active = isActive(link)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition',
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              <span
                className={[
                  'w-4 h-4 flex items-center justify-center',
                  active ? 'text-blue-600' : 'text-slate-400',
                ].join(' ')}
              >
                {link.icon}
              </span>
              <span className="flex-1">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Recents — auto-populated from most recently updated records */}
      <div className="px-3 pt-2">
        <button
          onClick={() => setRecentsOpen((o) => !o)}
          className="w-full flex items-center gap-1 px-1 py-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider hover:text-slate-600 transition"
        >
          <Caret open={recentsOpen} />
          <span>Recents</span>
        </button>
        {recentsOpen && (
          <div className="space-y-0.5 mt-0.5">
            {recents.length === 0 ? (
              <div className="px-2 py-1 text-xs text-slate-400 italic">
                Open a deal or valuation to see it here.
              </div>
            ) : (
              recents.map((r) => {
                const active = pathname === r.href
                return (
                  <Link
                    key={`${r.kind}-${r.id}`}
                    href={r.href}
                    title={r.label}
                    className={[
                      'flex items-center gap-2 px-2 py-1 rounded-md text-[13px] transition',
                      active
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[9px] font-bold shrink-0',
                        r.kind === 'deal'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-emerald-100 text-emerald-600',
                      ].join(' ')}
                    >
                      {r.kind === 'deal' ? 'D' : 'V'}
                    </span>
                    <span className="flex-1 truncate">{r.label}</span>
                  </Link>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Favorites (collapsible stub — user-pinned, not yet wired) */}
      <div className="px-3 pt-2">
        <button
          onClick={() => setFavoritesOpen((o) => !o)}
          className="w-full flex items-center gap-1 px-1 py-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider hover:text-slate-600 transition"
        >
          <Caret open={favoritesOpen} />
          <span>Favorites</span>
        </button>
        {favoritesOpen && (
          <div className="px-2 py-1 text-xs text-slate-400 italic">
            Pin a deal or valuation to keep it here.
          </div>
        )}
      </div>

      {/* Records */}
      <div className="px-3 pt-1 flex-1 overflow-y-auto">
        <button
          onClick={() => setRecordsOpen((o) => !o)}
          className="w-full flex items-center gap-1 px-1 py-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider hover:text-slate-600 transition"
        >
          <Caret open={recordsOpen} />
          <span>Records</span>
        </button>
        {recordsOpen && (
          <div className="space-y-0.5 mt-0.5">
            {RECORDS.map((r) => {
              const active = isActive(r)
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  className={[
                    'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition',
                    active
                      ? 'bg-blue-50 text-blue-700 font-medium ring-1 ring-inset ring-blue-100'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-5 h-5 rounded-md flex items-center justify-center shadow-sm shrink-0',
                      r.tile.bg,
                      r.tile.fg,
                    ].join(' ')}
                  >
                    {r.glyph}
                  </span>
                  <span className="flex-1 truncate">{r.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* User block */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-blue-700">
              {(user.fullName || user.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">
              {user.fullName || user.email}
            </p>
            <p className="text-[10px] text-slate-400 capitalize">
              {user.tier || 'free'} plan
            </p>
          </div>
        </div>
        <form>
          <button
            formAction={signout}
            className="w-full text-left px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md transition"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}

// ------------------------------------------------------------
// Inline icons (kept local to avoid adding an icon dep)
// ------------------------------------------------------------

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 9.5L10 3l7 6.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

function ChevronDown({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8l4 4 4-4" />
    </svg>
  )
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M7 5l6 5-6 5" />
    </svg>
  )
}

function DealsGlyph() {
  // dollar sign
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M13 6.5c-.7-1-1.9-1.5-3-1.5-1.7 0-3 .9-3 2.3 0 3 6 1.7 6 4.7 0 1.4-1.3 2.5-3 2.5-1.3 0-2.5-.6-3.2-1.5M10 3.5v13" />
    </svg>
  )
}

function BuyersGlyph() {
  // user head + shoulders
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <circle cx="10" cy="7" r="2.5" />
      <path d="M4 16c1-3 3.5-4 6-4s5 1 6 4" />
    </svg>
  )
}

function ValuationsGlyph() {
  // trending up chart
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M3 14l4-4 3 3 7-7" />
      <path d="M13 6h4v4" />
    </svg>
  )
}

function DraftsGlyph() {
  // document with lines
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M12 3v3h3M7 10h6M7 13h6" />
    </svg>
  )
}
