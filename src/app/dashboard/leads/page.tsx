import { createClient } from '@/lib/supabase/server'
import type { Contact } from '@/lib/types'
import LeadsTable from './leads-table'

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

  // Fetch deal_access to compute deal counts and NDA counts per contact
  const contactIds = allContacts.map(c => c.id)
  let accessRows: { contact_id: string; nda_signed: boolean }[] = []

  if (contactIds.length > 0) {
    const { data } = await supabase
      .from('deal_access')
      .select('contact_id, nda_signed')
      .in('contact_id', contactIds)

    accessRows = (data || []) as typeof accessRows
  }

  // Build lead rows
  const leads = allContacts.map(c => {
    const access = accessRows.filter(a => a.contact_id === c.id)
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
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Leads & Contacts</h2>
        <p className="text-slate-500 mt-1">Track buyer leads, prospects, and contacts across all your deals.</p>
      </div>

      <LeadsTable leads={leads} />
    </div>
  )
}
