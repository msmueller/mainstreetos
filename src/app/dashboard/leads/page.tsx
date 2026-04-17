import { createClient } from '@/lib/supabase/server'
import type { Contact, Communication } from '@/lib/types'
import LeadsTable from './leads-table'
import SyncBbsButton from './sync-bbs-button'

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
    const { data } = await supabase
      .from('deal_access')
      .select('contact_id, nda_signed, deal_id, deals(listing_name)')
      .in('contact_id', contactIds)

    accessRows = (data || [])
  }

  // Build lead rows with deal names
  const leads = allContacts.map(c => {
    const access = accessRows.filter((a: any) => a.contact_id === c.id)
    const dealNames = access
      .map((a: any) => {
        const d = a.deals
        if (!d) return null
        if (Array.isArray(d)) return d[0]?.listing_name
        return d.listing_name
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leads & Contacts</h2>
          <p className="text-slate-500 mt-1">Track buyer leads, prospects, and contacts across all your deals.</p>
        </div>
        <SyncBbsButton />
      </div>

      <LeadsTable leads={leads} communications={allComms} />
    </div>
  )
}
