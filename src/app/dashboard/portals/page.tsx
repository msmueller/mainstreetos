import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// ============================================================
// ADMIN PORTALS HUB — Phase 13.4
// One place to see every active portal binding across the three
// client surfaces (Seller / Buyer / Consulting Client) and jump
// into an admin preview of exactly what that person sees.
// Previews use the staff bypass in the portal RPCs and do NOT
// write portal telemetry.
// ============================================================

interface AccessRow {
  id: string
  role: string
  parent_type: string | null
  parent_id: string | null
  current_stage: string | null
  nda_signed: boolean
  contacts: { first_name: string; last_name: string; email: string | null } | null
}

interface ProjectAccessRow {
  id: string
  project_id: string
  contacts: { first_name: string; last_name: string; email: string | null } | null
  projects: { project_name: string | null; project_status: string | null } | null
}

const personName = (c: { first_name: string; last_name: string } | null) =>
  c ? `${c.first_name} ${c.last_name}`.trim() : 'Unknown'

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
      <p className="text-xs text-slate-500 mb-4">{subtitle}</p>
      {children}
    </div>
  )
}

export default async function PortalsAdminPage() {
  const supabase = await createClient()

  const [sellersRes, buyersRes, clientsRes, listingsRes] = await Promise.all([
    supabase
      .from('deal_access')
      .select('id, role, parent_type, parent_id, current_stage, nda_signed, contacts(first_name, last_name, email)')
      .eq('role', 'seller')
      .eq('is_active', true),
    supabase
      .from('deal_access')
      .select('id, role, parent_type, parent_id, current_stage, nda_signed, contacts(first_name, last_name, email)')
      .eq('role', 'buyer')
      .eq('is_active', true)
      .eq('parent_type', 'seller_listing')
      .limit(100),
    supabase
      .from('project_access')
      .select('id, project_id, contacts(first_name, last_name, email), projects(project_name, project_status)')
      .eq('is_active', true),
    // parent_id is polymorphic (no FK), so listing names resolve via a lookup map
    supabase.from('seller_listings').select('id, name'),
  ])

  const sellers = (sellersRes.data || []) as unknown as AccessRow[]
  const buyers = (buyersRes.data || []) as unknown as AccessRow[]
  const clients = (clientsRes.data || []) as unknown as ProjectAccessRow[]
  const listingName = new Map(
    ((listingsRes.data || []) as { id: string; name: string | null }[]).map((l) => [l.id, l.name])
  )

  return (
    <div>
      <TopBar
        breadcrumbs={[{ label: 'Records', href: '/dashboard' }, { label: 'Portals' }]}
        title="Client Portals"
        subtitle="Every active portal binding across the three surfaces. Preview opens the exact view that person sees — read-only, no telemetry recorded."
      />

      <div className="space-y-6">
        <SectionCard title="Seller Client Portals" subtitle="Listing clients with active seller portal access.">
          {sellers.length === 0 ? (
            <p className="text-sm text-slate-500">No active seller portal grants.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sellers.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{personName(r.contacts)}</p>
                    <p className="text-xs text-slate-500">
                      {r.contacts?.email} · {(r.parent_id && listingName.get(r.parent_id)) || r.parent_id}
                    </p>
                  </div>
                  {r.parent_id && (
                    <Link
                      href={`/dashboard/portals/seller/${r.parent_id}`}
                      className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shrink-0"
                    >
                      Preview portal
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Buyer Portals"
          subtitle="Active buyer grants on listings. Buyer detail (stages, NDA, docs visible) lives on each deal page; per-buyer portal impersonation is a follow-up."
        >
          {buyers.length === 0 ? (
            <p className="text-sm text-slate-500">No active buyer portal grants on listings.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {buyers.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{personName(r.contacts)}</p>
                    <p className="text-xs text-slate-500">
                      {r.contacts?.email} · {(r.parent_id && listingName.get(r.parent_id)) || r.parent_id} · stage: {r.current_stage || '—'}
                      {r.nda_signed ? ' · NDA ✓' : ''}
                    </p>
                  </div>
                  {r.parent_id && (
                    <Link
                      href={`/dashboard/deals/${r.parent_id}`}
                      className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg shrink-0"
                    >
                      Open deal
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Consulting Client Portals" subtitle="Advisory clients with active project portal access.">
          {clients.length === 0 ? (
            <p className="text-sm text-slate-500">No active consulting portal grants.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {clients.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{personName(r.contacts)}</p>
                    <p className="text-xs text-slate-500">
                      {r.contacts?.email} · {r.projects?.project_name || r.project_id}
                      {r.projects?.project_status ? ` · ${r.projects.project_status.replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/portals/project/${r.project_id}`}
                    className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shrink-0"
                  >
                    Preview portal
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
