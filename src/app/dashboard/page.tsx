import { createClient } from '@/lib/supabase/server'
import type { Valuation, User } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser!.id)
    .single()

  const user = profile as User

  const { data: valuations, count } = await supabase
    .from('valuations')
    .select('*', { count: 'exact' })
    .eq('user_id', authUser!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const recentValuations = (valuations || []) as Valuation[]
  const totalValuations = count || 0

  const completed = recentValuations.filter(v => v.status === 'complete').length
  const inProgress = recentValuations.filter(v => ['draft', 'processing', 'review'].includes(v.status)).length

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          Welcome back, {user.full_name.split(' ')[0]}
        </h2>
        <p className="text-slate-500 mt-1">
          Here&apos;s an overview of your MainStreetOS activity.
        </p>
      </div>

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
          <a
            href="/dashboard/valuations/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            New Valuation
          </a>
        </div>

        {recentValuations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm mb-4">
              No valuations yet. Create your first one to get started.
            </p>
            <a
              href="/dashboard/valuations/new"
              className="inline-flex px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              Create First Valuation
            </a>
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
