'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import BuyerView from './BuyerView'
import SellerView from './SellerView'

// ============================================================
// CLIENT PORTAL — Phase 12.12a
// Unified /portal route. Branches internally by persona:
//   - seller  → SellerView (fn_portal_seller_dashboard)
//   - buyer   → BuyerView  (get_portal_view RPC)
//   - unauth  → BuyerView demo OR magic-link sign-in
// Auth is handled here; views only receive the resolved ids.
// ============================================================

type Persona = 'seller' | 'buyer' | 'anonymous'

interface ResolvedIdentity {
  authUser: User | null
  contactId: string | null
  contactName: string
  persona: Persona
  sellerListingId: string | null
}

const INITIAL_IDENTITY: ResolvedIdentity = {
  authUser: null,
  contactId: null,
  contactName: 'Guest',
  persona: 'anonymous',
  sellerListingId: null,
}

export default function ClientPortal() {
  const supabase = createClient()

  const [identity, setIdentity] = useState<ResolvedIdentity>(INITIAL_IDENTITY)
  const [resolving, setResolving] = useState(true)

  // Magic link form state
  const [magicEmail, setMagicEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [magicError, setMagicError] = useState<string | null>(null)

  const resolveIdentity = useCallback(async () => {
    setResolving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIdentity({ ...INITIAL_IDENTITY, persona: 'anonymous' })
        return
      }

      // Find contact row by auth_user_id
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      const contactId = contact?.id ?? null
      const contactName =
        [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Client'

      if (!contactId) {
        // Authenticated but no linked contact → fall back to buyer demo UX
        setIdentity({
          authUser: user,
          contactId: null,
          contactName,
          persona: 'buyer',
          sellerListingId: null,
        })
        return
      }

      // Check for seller access (parent_type = 'seller_listing', role = 'seller')
      const { data: sellerAccess } = await supabase
        .from('deal_access')
        .select('parent_id')
        .eq('contact_id', contactId)
        .eq('parent_type', 'seller_listing')
        .eq('role', 'seller')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sellerAccess?.parent_id) {
        setIdentity({
          authUser: user,
          contactId,
          contactName,
          persona: 'seller',
          sellerListingId: sellerAccess.parent_id as string,
        })
        return
      }

      // Default to buyer view (contact exists but no seller access)
      setIdentity({
        authUser: user,
        contactId,
        contactName,
        persona: 'buyer',
        sellerListingId: null,
      })
    } catch (err) {
      console.error('[portal] resolveIdentity failed:', err)
      setIdentity({ ...INITIAL_IDENTITY, persona: 'anonymous' })
    } finally {
      setResolving(false)
    }
  }, [supabase])

  useEffect(() => { resolveIdentity() }, [resolveIdentity])

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMagicError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: `${window.location.origin}/portal` },
    })
    if (error) setMagicError(error.message)
    else setMagicSent(true)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setIdentity({ ...INITIAL_IDENTITY, persona: 'anonymous' })
    await resolveIdentity()
  }

  if (resolving) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Loading your portal...</p>
        </div>
      </div>
    )
  }

  // Route by persona
  if (identity.persona === 'seller' && identity.sellerListingId) {
    return (
      <SellerView
        listingId={identity.sellerListingId}
        contactName={identity.contactName}
        onSignOut={handleSignOut}
      />
    )
  }

  // Authenticated buyer OR anonymous visitor (BuyerView handles its own demo fallback).
  // For unauthenticated visitors who explicitly request sign-in, show the magic-link form.
  if (identity.persona === 'anonymous' && magicSent === false && magicEmail.length === 0) {
    // Render BuyerView in demo mode by default so /portal is a live marketing surface
    return (
      <BuyerView
        contactId={null}
        contactName="Guest"
        isAuthenticated={false}
        viewerEmail={null}
        onSignOut={handleSignOut}
      />
    )
  }

  if (identity.persona === 'anonymous') {
    // Magic link form (triggered when user interacts with sign-in)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Client Portal Sign-In</h1>
          <p className="text-sm text-slate-500 mb-6">
            We&apos;ll email you a secure sign-in link.
          </p>
          {magicSent ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
              Check your inbox at <strong>{magicEmail}</strong> for the sign-in link.
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-4">
              <input
                type="email"
                required
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="submit"
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                Send Magic Link
              </button>
              {magicError && <p className="text-sm text-red-600">{magicError}</p>}
            </form>
          )}
        </div>
      </div>
    )
  }

  // Authenticated buyer
  return (
    <BuyerView
      contactId={identity.contactId}
      contactName={identity.contactName}
      isAuthenticated={identity.authUser !== null}
      viewerEmail={identity.authUser?.email ?? null}
      onSignOut={handleSignOut}
    />
  )
}
