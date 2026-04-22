// ============================================================
// MainStreetOS — TopBar (Phase 13.2)
// ------------------------------------------------------------
// Attio-style page header: breadcrumb trail, large title,
// optional subtitle, right-side actions slot, optional primary
// action button. Rendered at the top of each dashboard page
// (explicit-per-page pattern so breadcrumbs and actions can be
// fed from that page's own server-fetched context).
// ============================================================

import Link from 'next/link'
import type { ReactNode } from 'react'

export type Crumb = {
  label: string
  href?: string
}

export type TopBarProps = {
  breadcrumbs?: Crumb[]
  title: string
  subtitle?: string | null
  rightSlot?: ReactNode
  primaryAction?: {
    label: string
    href?: string
    onClick?: () => void
    variant?: 'primary' | 'secondary'
  }
  titleAdornment?: ReactNode // e.g., status pill next to the title
}

export default function TopBar({
  breadcrumbs = [],
  title,
  subtitle,
  rightSlot,
  primaryAction,
  titleAdornment,
}: TopBarProps) {
  return (
    <div className="mb-6">
      {breadcrumbs.length > 0 && <Breadcrumbs crumbs={breadcrumbs} />}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{title}</h1>
            {titleAdornment}
          </div>
          {subtitle && (
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          {primaryAction && renderPrimaryAction(primaryAction)}
        </div>
      </div>
    </div>
  )
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="mb-2 text-xs text-slate-500 flex items-center gap-1 flex-wrap">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {c.href && !last ? (
              <Link
                href={c.href}
                className="hover:text-slate-900 hover:underline transition"
              >
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'text-slate-700 font-medium' : ''}>{c.label}</span>
            )}
            {!last && <ChevronRight />}
          </span>
        )
      })}
    </nav>
  )
}

function renderPrimaryAction(a: NonNullable<TopBarProps['primaryAction']>) {
  const isPrimary = (a.variant ?? 'primary') === 'primary'
  const base =
    'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-md transition shadow-sm'
  const cls = isPrimary
    ? `${base} bg-blue-600 text-white hover:bg-blue-700`
    : `${base} bg-white border border-slate-200 text-slate-700 hover:bg-slate-50`
  if (a.href) {
    return (
      <Link href={a.href} className={cls}>
        {a.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={a.onClick} className={cls}>
      {a.label}
    </button>
  )
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3 text-slate-300"
    >
      <path d="M7 5l5 5-5 5" />
    </svg>
  )
}
