import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      return NextResponse.json({ error: 'Auth error', details: authError.message })
    }

    if (!user) {
      return NextResponse.json({ error: 'No authenticated user' })
    }

    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('id, listing_name, deal_status, broker_id')
      .limit(5)

    return NextResponse.json({
      auth_user_id: user.id,
      auth_email: user.email,
      deals_count: deals?.length || 0,
      deals_error: dealsError?.message || null,
      sample_deals: deals?.slice(0, 3).map(d => ({ name: d.listing_name, broker_id: d.broker_id })),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Server error', details: (e as Error).message })
  }
}
