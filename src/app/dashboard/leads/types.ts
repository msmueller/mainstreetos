/**
 * Shared types for the /dashboard/leads route.
 *
 * Extracted 2026-06-01 (Phase 9) because importing `SignedEnvelopeForDrawer`
 * as a type-only import FROM page.tsx (a Server Component with `dynamic =
 * 'force-dynamic'` and node-only deps) INTO LeadsViewSwitcher.tsx (a
 * 'use client' component) caused Next.js's bundler to strip the type and
 * surface a "Property 'envelopes' does not exist" error at build time. A
 * neutral types module sidesteps the server/client boundary entirely.
 */

export interface SignedEnvelopeForDrawer {
  envelope_id: string
  envelope_number: number
  template_key: string
  listing_business_name: string | null
  completed_at: string | null
  buyer_email: string  // contact match key (lowercased)
  signed_pdf_signed_url: string | null
  audit_pdf_signed_url: string | null
}
