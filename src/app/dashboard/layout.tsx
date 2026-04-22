// ============================================================
// MainStreetOS — Dashboard layout (Phase 13.1)
// ------------------------------------------------------------
// Shell: Basepoint-style Sidebar (client) + content region.
// Sidebar is a client component so it can read the active
// pathname; user data and a server-fetched Recents list are
// passed in as props so the broker can jump back to any
// record they've been working on without copy/pasting URLs.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import CommandPalette from '@/components/palette/CommandPalette'
import Sidebar, { type RecentItem } from '@/components/layout/Sidebar'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  const user = profile as User | null

  // Recents — 5 most recently updated seller_listings + 5 valuations the
  // broker can read (RLS enforced). Merged by updated_at, top 5 overall.
  const [dealsRes, valuationsRes] = await Promise.all([
    supabase
      .from('seller_listings')
      .select('id, name, industry, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('valuations')
      .select('id, business_name, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  type DealStub = { id: string; name: string | null; industry: string | null; updated_at: string }
  type ValStub = { id: string; business_name: string | null; updated_at: string }

  const dealRecents: (RecentItem & { _ts: number })[] = ((dealsRes.data || []) as DealStub[]).map(
    (d) => ({
      kind: 'deal',
      id: d.id,
      href: `/dashboard/deals/${d.id}`,
      label: d.name || 'Untitled Listing',
      sublabel: d.industry,
      _ts: new Date(d.updated_at).getTime(),
    }),
  )

  const valRecents: (RecentItem & { _ts: number })[] = ((valuationsRes.data || []) as ValStub[]).map(
    (v) => ({
      kind: 'valuation',
      id: v.id,
      href: `/dashboard/valuations/${v.id}`,
      label: v.business_name || 'Untitled Valuation',
      sublabel: null,
      _ts: new Date(v.updated_at).getTime(),
    }),
  )

  const recents: RecentItem[] = [...dealRecents, ...valRecents]
    .sort((a, b) => b._ts - a._ts)
    .slice(0, 5)
    .map((r) => ({
      kind: r.kind,
      id: r.id,
      href: r.href,
      label: r.label,
      sublabel: r.sublabel,
    }))

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        user={{
          fullName: user?.full_name ?? null,
          email: authUser.email ?? '',
          tier: user?.subscription_tier ?? null,
        }}
        recents={recents}
      />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>

      {/* Global ⌘K command palette (mounted once per dashboard) */}
      <CommandPalette />
    </div>
  )
}
