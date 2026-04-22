import { createClient } from '@/lib/supabase/server'
import type { Deal, DealWithCounts } from '@/lib/types'
import DealsViewSwitcher from './DealsViewSwitcher'

export const dynamic = 'force-dynamic'

export default async function DealsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  // Fetch all deals (RLS handles access control)
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })

  const allDeals = (deals || []) as Deal[]

  // Fetch buyer counts per deal from deal_access
  const dealIds = allDeals.map(d => d.id)
  let accessRows: { deal_id: string; is_active: boolean; nda_signed: boolean }[] = []

  if (dealIds.length > 0) {
    const { data } = await supabase
      .from('deal_access')
      .select('deal_id, is_active, nda_signed')
      .in('deal_id', dealIds)

    accessRows = (data || []) as typeof accessRows
  }

  // Compute counts
  const dealsWithCounts: DealWithCounts[] = allDeals.map(deal => {
    const access = accessRows.filter(a => a.deal_id === deal.id)
    return {
      ...deal,
      buyer_count: access.length,
      active_buyers: access.filter(a => a.is_active).length,
      nda_signed_count: access.filter(a => a.nda_signed).length,
    }
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Deal Pipeline</h2>
          <p className="text-slate-500 mt-1">Manage your active deals, listings, and buyer searches.</p>
        </div>
      </div>

      <DealsViewSwitcher deals={dealsWithCounts} />
    </div>
  )
}
