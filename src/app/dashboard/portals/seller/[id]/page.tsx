'use client'

// Phase 13.4 — Admin preview of a Seller Client Portal.
// Renders the real SellerView via the staff bypass in
// fn_portal_seller_dashboard / fn_portal_doc_telemetry.

import { useParams, useRouter } from 'next/navigation'
import SellerView from '@/app/portal/SellerView'

export default function SellerPortalPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  if (!id) return null

  return (
    <div className="-mx-6 -my-6">
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800 flex items-center justify-between">
        <span>Admin preview — this is exactly what the seller sees. No telemetry is recorded.</span>
        <button onClick={() => router.push('/dashboard/portals')} className="font-medium hover:underline">
          ← Back to Portals
        </button>
      </div>
      <SellerView
        listingId={id}
        contactName="Admin Preview"
        onSignOut={() => router.push('/dashboard/portals')}
      />
    </div>
  )
}
