import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Contact, Communication } from '@/lib/types'
import type { SignedEnvelopeForDrawer } from './types'
import LeadsViewSwitcher from './LeadsViewSwitcher'
import SyncBbsButton from './sync-bbs-button'
import TopBar from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

// Phase 9 (2026-06-01): Documents section needs Storage read access on
// private buckets `signed-documents` + `audit-certificates`. RLS-aware
// anon client cannot generate signed URLs for these — we mint them
// server-side with the service role key. Stays inside this route only.
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

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

  // Phase 9 (2026-06-01): fetch every completed sign_envelope whose buyer
  // signer email matches one of our contacts. Mint short-lived signed URLs
  // server-side for the signed NDA + audit certificate PDFs so the lead
  // drawer can show "View Signed NDA" / "View Audit Cert" buttons without
  // exposing the private storage buckets.
  let envelopes: SignedEnvelopeForDrawer[] = []
  const contactEmails = allContacts
    .map(c => (c.email || '').toLowerCase().trim())
    .filter(e => e.length > 0)

  if (contactEmails.length > 0) {
    // Service-role client — Storage signed-URL minting requires elevated rights.
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceUrl && serviceKey) {
      const admin = createServiceClient(serviceUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      // Join sign_signers (role='buyer') → sign_envelopes (status='completed').
      const { data: signerRows } = await admin
        .from('sign_signers')
        .select(`
          email,
          envelope_id,
          sign_envelopes!inner (
            id,
            envelope_number,
            template_key,
            listing_business_name,
            completed_at,
            status,
            signed_pdf_path,
            audit_pdf_path
          )
        `)
        .eq('role', 'buyer')
        .in('email', contactEmails)
        .eq('sign_envelopes.status', 'completed')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (signerRows || []) as any[]

      envelopes = await Promise.all(
        rows.map(async (row) => {
          const env = Array.isArray(row.sign_envelopes) ? row.sign_envelopes[0] : row.sign_envelopes
          if (!env) return null
          // Storage paths look like "signed-documents/<envelope_id>/<file>.pdf"
          // The bucket name is the leading segment; .createSignedUrl takes the
          // path WITHIN the bucket.
          const signSplit = splitBucketPath(env.signed_pdf_path)
          const auditSplit = splitBucketPath(env.audit_pdf_path)

          const [signed, audit] = await Promise.all([
            signSplit
              ? admin.storage
                  .from(signSplit.bucket)
                  .createSignedUrl(signSplit.path, SIGNED_URL_TTL_SECONDS)
                  .then(r => r.data?.signedUrl ?? null)
                  .catch(() => null)
              : Promise.resolve(null),
            auditSplit
              ? admin.storage
                  .from(auditSplit.bucket)
                  .createSignedUrl(auditSplit.path, SIGNED_URL_TTL_SECONDS)
                  .then(r => r.data?.signedUrl ?? null)
                  .catch(() => null)
              : Promise.resolve(null),
          ])

          return {
            envelope_id: String(env.id),
            envelope_number: Number(env.envelope_number),
            template_key: String(env.template_key),
            listing_business_name: env.listing_business_name ?? null,
            completed_at: env.completed_at ?? null,
            buyer_email: String(row.email).toLowerCase(),
            signed_pdf_signed_url: signed,
            audit_pdf_signed_url: audit,
          } as SignedEnvelopeForDrawer
        })
      ).then(arr => arr.filter((e): e is SignedEnvelopeForDrawer => !!e))
    } else {
      console.warn(
        '[dashboard/leads] SUPABASE_SERVICE_ROLE_KEY missing — Documents section will be empty.'
      )
    }
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

      <LeadsViewSwitcher
        leads={leads}
        communications={allComms}
        envelopes={envelopes}
      />
    </div>
  )
}

/**
 * sign_envelopes.signed_pdf_path is stored as "<bucket>/<rest>" — split it
 * into the two pieces `createSignedUrl` needs. Returns null if the path is
 * empty, malformed, or has no '/' separator.
 */
function splitBucketPath(p: unknown): { bucket: string; path: string } | null {
  if (!p || typeof p !== 'string') return null
  const idx = p.indexOf('/')
  if (idx <= 0 || idx >= p.length - 1) return null
  return { bucket: p.slice(0, idx), path: p.slice(idx + 1) }
}
