import { createClient } from '@/lib/supabase/server'
import ListingsListClient from './ListingsListClient'

export const dynamic = 'force-dynamic'

export interface SellerListingRow {
  id: string
  listing_name: string | null
  industry: string | null
  business_address: string | null
  asking_price: number | null
  annual_revenue: number | null
  sde: number | null
  listing_status: string | null
  seller_stage: string | null
  broker_id: string | null
  primary_contact_id: string | null
  created_at: string
}

export default async function ListingsPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('seller_listings')
    .select('id, listing_name, industry, business_address, asking_price, annual_revenue, sde, listing_status, seller_stage, broker_id, primary_contact_id, created_at')
    .order('created_at', { ascending: false })

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
