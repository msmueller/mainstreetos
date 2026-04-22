import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Valuation, User } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface BrokerCounts {
  active_deals: number
  buyer_leads: number
  seller_listings: number
  pending_drafts: number
}
interface RecentActivity {
  id: string
  kind: string | null
  subject: string | null
  created_at: string
  deal_id: string | null
}
interface PinnedView {
  id: string
  name: string
  scope: string | null
  entity: string | null
}

async function loadBrokerContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [deals, leads, listings, drafts, activities, views] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('deal_status', 'active'),
    supabase.from('buyer_leads').select('id', { count: 'exact', head: true }).not('current_stage', 'in', '("closed_won","lost")'),
    supabase.from('seller_listings').select('id', { count: 'exact', head: true }).eq('listing_status', 'active'),
    supabase.from('ai_drafts').select('id', { count: 'exact', head: true }).in('status', ['pending_review', 'draft']),
    supabase.from('activities').select('id, kind, subject, created_at, deal_id').order('created_at', { ascending: false }).limit(8),
    supabase.from('saved_views').select('id, name, scope, entity').eq('pinned_to_sidebar', true).limit(10),
  ])

  const counts: BrokerCounts = {
    active_deals: deals.count ?? 0,
    buyer_leads: leads.count ?? 0,
    seller_listings: listings.count ?? 0,
    pending_drafts: drafts.count ?? 0,
  }

  return {
    counts,
    recent: (activities.data || []) as RecentActivity[],
    pinned: (views.data || []) as PinnedView[],
    hasAnyBrokerData: (counts.active_deals + counts.buyer_leads + counts.seller_listings + counts.pending_drafts) > 0,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser!.id)
    .single()

  const user = profile as User

  const [valuationRes, brokerCtx] = await Promise.all([
    supabase
      .from('valuations')
      .select('*', { count: 'exact' })
      .eq('user_id', authUser!.id)
      .order('created_at', { ascending: false })
      .limit(5),
    loadBrokerContext(supabase),
  ])

  const recentValuations = (valuationRes.data || []) as Valuation[]
  const totalValuations = valuationRes.count || 0

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          Welcome back, {user.full_name.split(' ')[0]}
        </h2>
        <p className="text-slate-500 mt-1">
          Here&apos;s an overview of your MainStreetOS<span style={{ fontSize: '0.7em', fontWeight: 400, verticalAlign: 'super' }}>™</span> activity.
        </p>
      </div>

      {/* Broker overview — visible when user has any broker-scope data */}
      {brokerCtx.hasAnyBrokerData && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Broker Overview</h3>
            <Link href="/dashboard/deals" className="text-xs text-blue-600 hover:text-blue-800 font-medium">View all deals →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <BrokerTile label="Active Deals" value={brokerCtx.counts.active_deals} href="/dashboard/deals" accent="blue" />
            <BrokerTile label="Buyer Leads" value={brokerCtx.counts.buyer_leads} href="/dashboard/leads" accent="purple" />
            <BrokerTile label="Seller Listings" value={brokerCtx.counts.seller_listings} href="/dashboard/listings" accent="emerald" />
            <BrokerTile
              label="Pending AI Drafts"
              value={brokerCtx.counts.pending_drafts}
              href="/dashboard/deals"
              accent="amber"
              urgent={brokerCtx.counts.pending_drafts > 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Recent Activity</h4>
                <span className="text-xs text-slate-400">{brokerCtx.recent.length} events</span>
              </div>
              {brokerCtx.recent.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">No recent activity.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {brokerCtx.recent.map((a) => (
                    <li key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900 truncate">
                          {a.subject || a.kind || 'Activity'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {a.kind ? <span className="capitalize">{a.kind.replace(/_/g, ' ')}</span> : 'event'}
                          {' · '}
                          {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      {a.deal_id && (
                        <Link
                          href={`/dashboard/deals/${a.deal_id}`}
                          className="text-xs px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          Open
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pinned Saved Views */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900">Pinned Views</h4>
              </div>
              {brokerCtx.pinned.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">No pinned views yet. Pin a saved view to see it here.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {brokerCtx.pinned.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={viewHref(v)}
                        className="block px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <p className="text-sm text-slate-900 truncate">{v.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">
                          {v.entity || v.scope || 'view'}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Valuations"
          value={totalValuations.toString()}
          sublabel="All time"
        />
        <StatCard
          label="This Month"
          value={user.valuations_this_month.toString()}
          sublabel={`of ${tierLimit(user.subscription_tier)} included`}
        />
        <StatCard
          label="Subscription"
          value={user.subscription_tier.charAt(0).toUpperCase() + user.subscription_tier.slice(1)}
          sublabel="Current plan"
        />
      </div>

      {/* Recent valuations */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Recent Valuations</h3>
          <Link
            href="/dashboard/valuations/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            New Valuation
          </Link>
        </div>

        {recentValuations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm mb-4">
              No valuations yet. Create your first one to get started.
            </p>
            <Link
              href="/dashboard/valuations/new"
              className="inline-flex px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              Create First Valuation
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentValuations.map((v) => (
              <a
                key={v.id}
                href={`/dashboard/valuations/${v.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition"
              >
                <div>
                  <p className="font-medium text-slate-900">{v.business_name}</p>
                  <p className="text-sm text-slate-500">
                    {v.industry || 'No industry'} &middot; {new Date(v.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {v.valuation_mid && (
                    <span className="text-sm font-medium text-slate-700">
                      ${v.valuation_mid.toLocaleString()}
                    </span>
                  )}
                  <StatusBadge status={v.status} />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sublabel}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    processing: 'bg-amber-100 text-amber-700',
    review: 'bg-blue-100 text-blue-700',
    complete: 'bg-green-100 text-green-700',
    archived: 'bg-slate-100 text-slate-500',
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function tierLimit(tier: string): number {
  const limits: Record<string, number> = { free: 1, starter: 5, professional: 25, enterprise: 999 }
  return limits[tier] || 1
}

function BrokerTile({
  label,
  value,
  href,
  accent = 'blue',
  urgent = false,
}: {
  label: string
  value: number
  href: string
  accent?: 'blue' | 'purple' | 'emerald' | 'amber'
  urgent?: boolean
}) {
  const accentClass: Record<string, string> = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  }
  return (
    <Link
      href={href}
      className={`block bg-white rounded-xl border p-5 hover:shadow-sm transition-shadow ${
        urgent ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
      }`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accentClass[accent]}`}>{value}</p>
      {urgent && <p className="text-xs text-amber-700 mt-1 font-medium">Awaiting review</p>}
    </Link>
  )
}

function viewHref(v: { entity: string | null; scope: string | null; id: string }): string {
  // Map entity → list route. Falls back to /dashboard with ?view= param.
  const entityRoute: Record<string, string> = {
    deals: '/dashboard/deals',
    buyer_leads: '/dashboard/leads',
    seller_listings: '/dashboard/listings',
    contacts: '/dashboard/contacts',
  }
  const base = v.entity && entityRoute[v.entity] ? entityRoute[v.entity] : '/dashboard'
  return `${base}?view=${v.id}`
}
