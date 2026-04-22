import { createClient } from '@/lib/supabase/server'
import ListingsListClient from './ListingsListClient'

export const dynamic = 'force-dynamic'

export interface SellerListingRow {
  id: string
  name: string | null
  industry: string | null
  asking_price_usd: number | null
  revenue_ttm_usd: number | null
  sde_ttm_usd: number | null
  ebitda_ttm_usd: number | null
  stage: string | null
  owner_user_id: string | null
  primary_contact_id: string | null
  created_at: string
}

export default async function ListingsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seller_listings')
    .select('id, name, industry, asking_price_usd, revenue_ttm_usd, sde_ttm_usd, ebitda_ttm_usd, stage, owner_user_id, primary_contact_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listings/page] supabase error:', error)
  }

  const rows = (data || []) as SellerListingRow[]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Seller Listings</h2>
          <p className="text-slate-500 mt-1">
            All business-for-sale listings across your pipeline. Filter, sort, bulk-select, and export.
          </p>
        </div>
      </div>

      <ListingsListClient rows={rows} />
    </div>
  )
}
