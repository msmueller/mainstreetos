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
  const weightingMethod = (formData.get('weighting_method') as string) || 'linear_recent'
  const ownerCompInOpex = formData.get('owner_comp_in_opex') === 'on'

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
      weighting_method: weightingMethod,
      owner_comp_in_opex: ownerCompInOpex,
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

  // Save risk factors if provided
  const riskFreeRate = formData.get('risk_free_rate')
  if (riskFreeRate) {
    const riskKeys = [
      'industry_stability', 'competitive_position', 'customer_concentration',
      'supplier_dependence', 'regulatory_environment', 'revenue_trend',
      'profit_margin_stability', 'working_capital', 'debt_level',
      'financial_records_quality', 'owner_dependence', 'key_employee_risk',
      'systems_processes', 'facility_equipment', 'lease_position',
    ]

    const riskData: Record<string, unknown> = {
      valuation_id: valuation.id,
      risk_free_rate: parseFloat(riskFreeRate as string),
      equity_risk_premium: parseFloat(formData.get('equity_risk_premium') as string),
      size_premium: parseFloat(formData.get('size_premium') as string),
      long_term_growth_rate: parseFloat(formData.get('long_term_growth_rate') as string),
      discount_rate: parseFloat(formData.get('computed_discount_rate') as string),
      capitalization_rate: parseFloat(formData.get('computed_cap_rate') as string),
    }

    for (const key of riskKeys) {
      const score = formData.get(`risk_${key}_score`)
      const weight = formData.get(`risk_${key}_weight`)
      if (score) riskData[`${key}_score`] = parseInt(score as string)
      if (weight) riskData[`${key}_weight`] = parseFloat(weight as string)
    }

    // Compute weighted risk score and CSRP
    let weightedScore = 0
    for (const key of riskKeys) {
      const s = riskData[`${key}_score`] as number || 3
      const w = riskData[`${key}_weight`] as number || 0.05
      weightedScore += s * w
    }
    riskData.weighted_risk_score = weightedScore
    riskData.csrp_premium = weightedScore * 0.05

    await supabase.from('risk_factors').insert(riskData)
  }

  redirect(`/dashboard/valuations/${valuation.id}`)
}
