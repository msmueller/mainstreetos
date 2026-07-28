import { createClient } from '@/lib/supabase/server'
import ContactsListClient from './ContactsListClient'
import TopBar from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

export interface ContactRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  source: string | null
  is_active: boolean
  proof_of_funds_received: boolean
  liquid_cash: number | null
  connection_strength: number | null
  notion_page_id: string | null
  last_activity_at: string | null
  created_at: string
}

export default async function ContactsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone, company_name, source, is_active, proof_of_funds_received, liquid_cash, connection_strength, notion_page_id, last_activity_at, created_at'
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[contacts/page] supabase error:', error)
  }

  const rows = (data || []) as ContactRow[]

  return (
    <div>
      <TopBar
        breadcrumbs={[
          { label: 'Records', href: '/dashboard' },
          { label: 'Contacts' },
        ]}
        title="Contacts"
        subtitle="Every person in MSOS — buyers, sellers, co-brokers, and advisors. Canonical lead management lives in Notion LEADS; this is the transactional directory."
      />

      <ContactsListClient rows={rows} />
    </div>
  )
}
