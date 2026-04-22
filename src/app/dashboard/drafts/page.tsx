// ============================================================
// MainStreetOS — /dashboard/drafts (Phase 13.1 → 13.2)
// ------------------------------------------------------------
// Records:Drafts destination from the Basepoint-style sidebar.
// Surfaces all ai_drafts rows the broker can read (RLS-enforced)
// with the listing name joined in, so brokers have one place to
// sweep their pending_review queue across every deal.
//
// 13.2 update: TopBar replaces the inline header and the table
// moves into DraftsListClient so we can wire the new Attio-style
// ListControls (filter by kind/status, sort by date/kind/listing).
// ============================================================

import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import DraftsListClient, { type DraftsListRow } from './DraftsListClient'

export const dynamic = 'force-dynamic'

type DraftRow = {
  id: string
  kind: string
  status: string
  created_at: string
  model_used: string | null
  notion_page_url: string | null
  record_id: string | null
  payload: Record<string, unknown> | null
}

type ListingStub = {
  id: string
  name: string | null
  industry: string | null
}

export default async function DraftsPage() {
  const supabase = await createClient()

  const { data: drafts } = await supabase
    .from('ai_drafts')
    .select(
      'id, kind, status, created_at, model_used, notion_page_url, record_id, payload',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (drafts || []) as DraftRow[]

  // Join listing names for any rows tied to seller_listings
  const listingIds = Array.from(
    new Set(
      rows
        .filter((r) => r.record_id)
        .map((r) => r.record_id as string),
    ),
  )
  let listings: ListingStub[] = []
  if (listingIds.length > 0) {
    const { data } = await supabase
      .from('seller_listings')
      .select('id, name, industry')
      .in('id', listingIds)
    listings = (data || []) as ListingStub[]
  }
  const listingMap = new Map(listings.map((l) => [l.id, l]))

  const pendingCount = rows.filter((r) => r.status === 'pending_review').length

  const clientRows: DraftsListRow[] = rows.map((r) => {
    const listing = r.record_id ? listingMap.get(r.record_id) ?? null : null
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      created_at: r.created_at,
      model_used: r.model_used,
      notion_page_url: r.notion_page_url,
      record_id: r.record_id,
      mode: (r.payload?.mode as string | undefined) ?? null,
      listing_name: listing?.name ?? null,
      listing_industry: listing?.industry ?? null,
    }
  })

  return (
    <div>
      <TopBar
        breadcrumbs={[
          { label: 'Records', href: '/dashboard' },
          { label: 'Drafts' },
        ]}
        title="AI Drafts"
        subtitle="Every CIM, OM, BVR, and BLC the writer agents have produced. Review queue for pending drafts lives here."
        rightSlot={
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-600">{pendingCount} pending review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-slate-500">{rows.length} total</span>
            </div>
          </div>
        }
      />

      <DraftsListClient rows={clientRows} />
    </div>
  )
}
