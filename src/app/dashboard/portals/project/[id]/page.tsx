'use client'

// Phase 13.4 — Admin preview of a Consulting Client Portal.
// Renders the real ProjectView via the staff bypass in
// fn_portal_project_dashboard (data room included, no telemetry).

import { useParams, useRouter } from 'next/navigation'
import ProjectView from '@/app/portal/ProjectView'

export default function ProjectPortalPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  if (!id) return null

  return (
    <div className="-mx-6 -my-6">
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800 flex items-center justify-between">
        <span>Admin preview — this is exactly what the consulting client sees. No telemetry is recorded.</span>
        <button onClick={() => router.push('/dashboard/portals')} className="font-medium hover:underline">
          ← Back to Portals
        </button>
      </div>
      <ProjectView
        projectId={id}
        contactName="Admin Preview"
        onSignOut={() => router.push('/dashboard/portals')}
      />
    </div>
  )
}
