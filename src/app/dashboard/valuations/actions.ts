'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { FinancialCategory } from '@/lib/types'

export async function createValuation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Extract business info
  const businessName = formData.get('business_name') as string
  const industry = formData.get('industry') as string
  const sicCode = formData.get('sic_code') as string
  const naicsCode = formData.get('naics_code') as string
  const location = formData.get('location') as string
  const description = formData.get('business_description') as string
  const annualRevenue = formData.get('annual_revenue')
    ? parseFloat(formData.get('annual_revenue') as string)
    : null

  // Create the valuation record
  const { data: valuation, error: valError } = await supabase
    .from('valuations')
    .insert({
      user_id: user.id,
      business_name: businessName,
      industry: industry || null,
      sic_code: sicCode || null,
      naics_code: naicsCode || null,
      location: location || null,
      business_description: description || null,
      annual_revenue: annualRevenue,
      status: 'draft',
    })
    .select()
    .single()

  if (valError || !valuation) {
    redirect('/dashboard/valuations/new?error=' + encodeURIComponent(valError?.message || 'Failed to create valuation'))
  }

  // Extract financial data from the repeating fields
  const fiscalYears = formData.getAll('fiscal_year')
  const categories = formData.getAll('category')
  const lineItems = formData.getAll('line_item')
  const amounts = formData.getAll('amount')

  if (fiscalYears.length > 0) {
    const financialRows = []
    for (let i = 0; i < fiscalYears.length; i++) {
      const amount = parseFloat(amounts[i] as string)
      if (isNaN(amount)) continue

      financialRows.push({
        valuation_id: valuation.id,
        fiscal_year: parseInt(fiscalYears[i] as string),
        category: categories[i] as FinancialCategory,
        line_item: lineItems[i] as string,
        amount,
      })
    }

    if (financialRows.length > 0) {
      await supabase.from('financial_data').insert(financialRows)
    }
  }

  // Increment usage counter (best-effort, won't block if RPC doesn't exist yet)
  try {
    await supabase.rpc('increment_valuation_count', { uid: user.id })
  } catch {
    // RPC may not exist yet — that's fine
  }

  redirect(`/dashboard/valuations/${valuation.id}`)
}
