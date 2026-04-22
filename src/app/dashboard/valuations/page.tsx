import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Valuation } from '@/lib/types'

export default async function ValuationsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const { data: valuations } = await supabase
    .from('valuations')
    .select('*')
    .eq('user_id', authUser!.id)
    .order('created_at', { ascending: false })

  const items = (valuations || []) as Valuation[]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Valuations</h2>
          <p className="text-slate-500 mt-1">
            {items.length} valuation{items.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/dashboard/valuations/new"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
        >
          New Valuation
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-16 text-center">
          <div className="text-4xl mb-4">📈</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No valuations yet</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Create your first AI-powered business valuation. Enter business details and financial data, and our CAIBVS&trade; agents will run a multi-method analysis.
          </p>
          <Link
            href="/dashboard/valuations/new"
            className="inline-flex px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            Create First Valuation
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Business</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Industry</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">FMV</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/valuations/${v.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                      {v.business_name}
                    </Link>
                    {v.location && <p className="text-xs text-slate-400">{v.location}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{v.industry || '—'}</td>
                  <td className="px-6 py-4">
                    {v.valuation_mid ? (
                      <span className="text-sm font-medium text-slate-900">
                        ${v.valuation_mid.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">Pending</span>
                    )}
                    {v.valuation_low && v.valuation_high && (
                      <p className="text-xs text-slate-400">
                        ${v.valuation_low.toLocaleString()} – ${v.valuation_high.toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
