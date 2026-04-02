import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Valuation, FinancialData, ValuationMethod } from '@/lib/types'

export default async function ValuationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: valuation } = await supabase
    .from('valuations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!valuation) notFound()
  const v = valuation as Valuation

  const { data: financials } = await supabase
    .from('financial_data')
    .select('*')
    .eq('valuation_id', id)
    .order('fiscal_year', { ascending: true })
    .order('category', { ascending: true })

  const { data: methods } = await supabase
    .from('valuation_methods')
    .select('*')
    .eq('valuation_id', id)
    .order('weight', { ascending: false })

  const finData = (financials || []) as FinancialData[]
  const methodData = (methods || []) as ValuationMethod[]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <a href="/dashboard/valuations" className="text-sm text-slate-400 hover:text-slate-600 transition">
            &larr; All Valuations
          </a>
          <h2 className="text-2xl font-bold text-slate-900 mt-2">{v.business_name}</h2>
          <p className="text-slate-500 mt-1">
            {[v.industry, v.location].filter(Boolean).join(' \u00b7 ') || 'No details'}
            {v.sic_code && ` \u00b7 SIC ${v.sic_code}`}
          </p>
        </div>
        <StatusBadge status={v.status} />
      </div>

      {/* Valuation Result (if complete) */}
      {v.valuation_mid && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-6 text-white">
          <p className="text-sm font-medium text-blue-200">Fair Market Value (Weighted)</p>
          <p className="text-4xl font-bold mt-1">${v.valuation_mid.toLocaleString()}</p>
          {v.valuation_low && v.valuation_high && (
            <p className="text-sm text-blue-200 mt-2">
              Range: ${v.valuation_low.toLocaleString()} &ndash; ${v.valuation_high.toLocaleString()}
            </p>
          )}
          {v.metric_type && v.normalized_earnings && (
            <p className="text-sm text-blue-200 mt-1">
              Based on {v.metric_type.toUpperCase()} of ${v.normalized_earnings.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Agent Pipeline Status */}
      {v.status !== 'complete' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Agent Pipeline</h3>
          <div className="space-y-3">
            <PipelineStep step={1} label="Financial Data Intake" status={finData.length > 0 ? 'complete' : 'pending'} />
            <PipelineStep step={2} label="Normalization & Metric Selection" status={v.normalized_earnings ? 'complete' : v.status === 'processing' ? 'running' : 'pending'} />
            <PipelineStep step={3} label="Multi-Method Valuation" status={methodData.length > 0 ? 'complete' : 'pending'} />
            <PipelineStep step={4} label="Synthesis & Range" status={v.valuation_mid ? 'complete' : 'pending'} />
            <PipelineStep step={5} label="Report Generation" status={v.report_url ? 'complete' : 'pending'} />
          </div>

          {v.status === 'draft' && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500 mb-3">
                Financial data entered. Ready to run the valuation pipeline.
              </p>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
                Run Valuation Agents
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Data */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">
            Financial Data ({finData.length} line items)
          </h3>
          {finData.length === 0 ? (
            <p className="text-sm text-slate-400">No financial data entered yet.</p>
          ) : (
            <div className="space-y-2">
              {finData.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm text-slate-900">{f.line_item}</p>
                    <p className="text-xs text-slate-400">
                      FY{f.fiscal_year} &middot; {f.category.replace('_', ' ')}
                      {f.is_adjustment && ' \u00b7 Adjustment'}
                    </p>
                  </div>
                  <span className={`text-sm font-medium ${f.amount >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                    ${Math.abs(f.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Valuation Methods */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Valuation Methods</h3>
          {methodData.length === 0 ? (
            <p className="text-sm text-slate-400">Methods will populate after agents run.</p>
          ) : (
            <div className="space-y-4">
              {methodData.map((m) => (
                <div key={m.id} className="p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-900">
                      {formatMethod(m.method)}
                    </p>
                    <span className="text-xs text-slate-500">{(m.weight * 100).toFixed(0)}% weight</span>
                  </div>
                  {m.result_value && (
                    <p className="text-lg font-bold text-slate-900">${m.result_value.toLocaleString()}</p>
                  )}
                  {m.multiple_used && (
                    <p className="text-xs text-slate-500">{m.multiple_used}x multiple</p>
                  )}
                  {m.reasoning && (
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Business Description */}
      {v.business_description && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
          <h3 className="font-semibold text-slate-900 mb-2">Business Description</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{v.business_description}</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    processing: 'bg-amber-100 text-amber-700',
    review: 'bg-blue-100 text-blue-700',
    complete: 'bg-green-100 text-green-700',
    archived: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${styles[status] || styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function PipelineStep({ step, label, status }: { step: number; label: string; status: 'complete' | 'running' | 'pending' }) {
  const icons = { complete: '\u2705', running: '\u23f3', pending: '\u2b55' }
  const styles = {
    complete: 'text-green-700 bg-green-50',
    running: 'text-amber-700 bg-amber-50',
    pending: 'text-slate-400 bg-slate-50',
  }
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${styles[status]}`}>
      <span>{icons[status]}</span>
      <span className="text-sm font-medium">Agent {step}: {label}</span>
    </div>
  )
}

function formatMethod(method: string): string {
  const names: Record<string, string> = {
    market_multiple: 'Market Multiple',
    capitalization_of_earnings: 'Capitalization of Earnings',
    dcf: 'Discounted Cash Flow',
    asset_based: 'Asset-Based',
    rule_of_thumb: 'Rule of Thumb',
  }
  return names[method] || method
}
