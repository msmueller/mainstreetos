import { createClient } from '@/lib/supabase/server'
import type { Contact, Communication } from '@/lib/types'
import LeadsViewSwitcher from './LeadsViewSwitcher'
import SyncBbsButton from './sync-bbs-button'
import TopBar from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  // Fetch all contacts (RLS handles access control)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  const allContacts = (contacts || []) as Contact[]

  // Fetch deal_access joined with deal names
  const contactIds = allContacts.map(c => c.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let accessRows: any[] = []

  if (contactIds.length > 0) {
    // 2026-06-01: deal_access.deal_id references seller_listings.id (no
    // `deals` table exists in the schema — the prior `deals(listing_name)`
    // join was returning null for every row, so Deal Name showed "—" for
    // all 161 buyers). Use `seller_listings(name)` to surface the canonical
    // short listing name (e.g., "Royal Silk") as the Deal Name.
    const { data } = await supabase
      .from('deal_access')
      .select('contact_id, nda_signed, deal_id, seller_listings(name)')
      .in('contact_id', contactIds)

    accessRows = (data || [])
  }

  // Build lead rows with deal names
  const leads = allContacts.map(c => {
    const access = accessRows.filter((a: any) => a.contact_id === c.id)
    const dealNames = access
      .map((a: any) => {
        const d = a.seller_listings
        if (!d) return null
        if (Array.isArray(d)) return d[0]?.name
        return d.name
      })
      .filter((name: any): name is string => !!name)
    // Deduplicate
    const uniqueDealNames = [...new Set(dealNames)]
    return {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      company_name: c.company_name,
      source: c.source,
      liquid_cash: c.liquid_cash,
      is_active: c.is_active,
      proof_of_funds_received: c.proof_of_funds_received,
      created_at: c.created_at,
      deal_count: access.length,
      nda_count: access.filter(a => a.nda_signed).length,
      deal_names: uniqueDealNames,
    }
  })

  // Fetch all communications for these contacts
  let allComms: Communication[] = []
  if (contactIds.length > 0) {
    const { data: commsData } = await supabase
      .from('communications')
      .select('*')
      .in('contact_id', contactIds)
      .order('occurred_at', { ascending: false })

    allComms = (commsData || []) as Communication[]
  }

  return (
    <div>
      <TopBar
        breadcrumbs={[
          { label: 'Records', href: '/dashboard' },
          { label: 'Buyers' },
        ]}
        title="Leads & Contacts"
        subtitle="Track buyer leads, prospects, and contacts across all your deals."
        rightSlot={<SyncBbsButton />}
      />

      <LeadsViewSwitcher leads={leads} communications={allComms} />
    </div>
  )
}
