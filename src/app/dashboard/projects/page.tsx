import { createClient } from '@/lib/supabase/server'
import type { Project, ProjectWithCounts } from '@/lib/types'
import ProjectsViewSwitcher from './ProjectsViewSwitcher'
import TopBar from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

// ============================================================
// Phase 14.4 — Broker dashboard for PROJECTS (Consulting Side)
// ------------------------------------------------------------
// public.projects is the canonical live table (docs/MSOS-Entity-
// Architecture-and-Workflow-Model.md Section 4) — the client-portal
// side (ProjectView.tsx, project_access, project_deliverables)
// already existed from Phase 12.12-C. This is the first broker-
// facing UI on top of that real schema.
// ============================================================

interface AccessCountRow {
  project_id: string
  is_active: boolean
}
interface DeliverableCountRow {
  project_id: string
  status: string
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  await supabase.auth.getUser()

  const [projectsRes, accessRes, deliverablesRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('project_access').select('project_id, is_active'),
    supabase.from('project_deliverables').select('project_id, status'),
  ])

  const projects = (projectsRes.data || []) as Project[]
  const accessRows = (accessRes.data || []) as AccessCountRow[]
  const deliverableRows = (deliverablesRes.data || []) as DeliverableCountRow[]

  const clientIds = Array.from(new Set(projects.map((p) => p.client_contact_id).filter(Boolean))) as string[]
  const contactsRes = clientIds.length
    ? await supabase.from('contacts').select('id, first_name, last_name, company_name').in('id', clientIds)
    : { data: [] as { id: string; first_name: string; last_name: string; company_name: string | null }[] }
  const contactsById = new Map((contactsRes.data || []).map((c) => [c.id, c]))

  const projectsWithCounts: ProjectWithCounts[] = projects.map((p) => {
    const client = p.client_contact_id ? contactsById.get(p.client_contact_id) : undefined
    const deliverables = deliverableRows.filter((d) => d.project_id === p.id)
    const access = accessRows.filter((a) => a.project_id === p.id)
    return {
      ...p,
      client_name: client
        ? `${client.first_name} ${client.last_name}`.trim() || client.company_name || null
        : null,
      deliverable_count: deliverables.length,
      delivered_count: deliverables.filter((d) => d.status === 'delivered' || d.status === 'completed').length,
      access_count: access.filter((a) => a.is_active).length,
    }
  })

  return (
    <div>
      <TopBar
        breadcrumbs={[
          { label: 'Records', href: '/dashboard' },
          { label: 'Projects' },
        ]}
        title="Consulting Projects"
        subtitle="Manage advisory engagements — valuations, financial modeling, CRE BPOs, and other consulting work."
      />

      <ProjectsViewSwitcher projects={projectsWithCounts} />
    </div>
  )
}
