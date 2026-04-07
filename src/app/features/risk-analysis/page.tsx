'use client'
import { useState } from 'react'

function Nav() {
  return (
    <nav className="border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="hover:opacity-80 transition"><span className="text-2xl font-bold text-slate-900">MainStreet</span><span className="text-2xl font-bold text-blue-600">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span></a>
        <div className="flex items-center gap-4">
          <a href="/methods" className="text-sm text-slate-600 hover:text-slate-900 transition">Valuation Methods</a>
          <a href="/uspap-standards" className="text-sm text-slate-600 hover:text-slate-900 transition">USPAP Standards</a>
          <a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Get Started Free</a>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (<footer className="border-t border-slate-100 py-6"><div className="max-w-6xl mx-auto px-6 text-center"><p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved · mainstreetos.biz</p></div></footer>)
}

const riskGroups = [
  {
    name: 'Business & Industry',
    color: 'blue',
    factors: [
      { id: 'industry_stability', label: 'Industry Stability', weight: 0.08, desc: 'Is the industry growing, stable, or declining? Are there existential threats (technology disruption, regulatory change, consumer shifts)?', low: 'Declining industry with major disruption risk', mid: 'Stable industry with normal competitive dynamics', high: 'Growing industry with strong secular tailwinds' },
      { id: 'competitive_position', label: 'Competitive Position', weight: 0.08, desc: 'Does the business have defensible advantages — location, brand, proprietary processes, exclusive territories, or patents? Or is it a commodity player?', low: 'Commodity business, easily replicated', mid: 'Some differentiation, moderate barriers to entry', high: 'Strong brand/moat, significant barriers to entry' },
      { id: 'customer_concentration', label: 'Customer Concentration', weight: 0.06, desc: 'What percentage of revenue comes from the top 1–3 customers? Loss of a major customer would devastate revenue.', low: 'Top 3 customers = 50%+ of revenue', mid: 'Top 3 customers = 20–50% of revenue', high: 'Highly diversified, no customer > 10%' },
      { id: 'supplier_dependence', label: 'Supplier Dependence', weight: 0.05, desc: 'Is the business dependent on a single supplier, exclusive distributor, or sole-source material? Supply chain disruption risk.', low: 'Single-source supplier, no alternatives', mid: 'Limited suppliers but alternatives exist', high: 'Multiple interchangeable suppliers' },
      { id: 'regulatory_environment', label: 'Regulatory Environment', weight: 0.04, desc: 'Is the business subject to heavy regulation, licensing requirements, or pending regulatory changes that could impact operations?', low: 'Heavy regulation with pending adverse changes', mid: 'Normal industry regulation, stable environment', high: 'Light regulation, regulatory tailwinds' },
    ]
  },
  {
    name: 'Financial',
    color: 'emerald',
    factors: [
      { id: 'revenue_trend', label: 'Revenue Trend', weight: 0.08, desc: 'Is revenue growing, flat, or declining over the historical period? Consistent growth reduces risk.', low: 'Declining revenue 3+ years', mid: 'Flat or inconsistent revenue', high: 'Consistent growth 3+ years' },
      { id: 'profit_margin_stability', label: 'Profit Margin Stability', weight: 0.08, desc: 'Are margins stable, improving, or compressing? Volatile margins indicate pricing or cost structure risk.', low: 'Highly volatile or declining margins', mid: 'Some margin variation, broadly stable', high: 'Stable or improving margins' },
      { id: 'working_capital', label: 'Working Capital', weight: 0.05, desc: 'Does the business have adequate working capital? Are receivables collectible? Is inventory current?', low: 'Negative working capital, aged receivables', mid: 'Adequate but tight working capital', high: 'Strong working capital position' },
      { id: 'debt_level', label: 'Debt Level', weight: 0.04, desc: 'What is the debt-to-equity ratio? Is the business overleveraged? Are debt covenants at risk?', low: 'Overleveraged, covenant risk', mid: 'Moderate debt, manageable service', high: 'Low debt, strong coverage ratios' },
      { id: 'financial_records_quality', label: 'Financial Records Quality', weight: 0.05, desc: 'Are financial records professionally prepared? Tax returns filed? Are records audited, reviewed, compiled, or self-prepared?', low: 'Self-prepared, inconsistent with tax returns', mid: 'Accountant-compiled, consistent', high: 'CPA-reviewed or audited financials' },
    ]
  },
  {
    name: 'Operational',
    color: 'amber',
    factors: [
      { id: 'owner_dependence', label: 'Owner Dependence', weight: 0.10, desc: 'This is typically the highest-weighted factor for Main Street businesses. Would the business survive without the current owner? Are relationships, knowledge, and decisions concentrated in one person?', low: 'Business collapses without owner', mid: 'Owner important but capable manager exists', high: 'Business runs independently, owner is passive' },
      { id: 'key_employee_risk', label: 'Key Employee Risk', weight: 0.06, desc: 'Are there critical employees whose departure would significantly impact operations? Are they under contract?', low: 'Critical employee(s) with no contract', mid: 'Important employees, some retention measures', high: 'Distributed knowledge, strong team depth' },
      { id: 'systems_processes', label: 'Systems & Processes', weight: 0.05, desc: 'Are operations documented in SOPs? Is there a POS system, CRM, scheduling software? Or does everything run on tribal knowledge?', low: 'No documentation, tribal knowledge only', mid: 'Basic systems in place, partial documentation', high: 'Fully documented SOPs, robust systems' },
      { id: 'facility_equipment', label: 'Facility & Equipment', weight: 0.05, desc: 'What condition is the equipment in? Is the facility adequate for current and future operations? Are major CapEx needs imminent?', low: 'Aged equipment, major CapEx needed', mid: 'Adequate condition, normal maintenance', high: 'Excellent condition, recently upgraded' },
      { id: 'lease_position', label: 'Lease Position', weight: 0.05, desc: 'How much time remains on the lease? Is the rent at market? Is the lease assignable? Is there a renewal option? Lease risk is a deal-killer for many buyers.', low: 'Short-term lease, above-market rent, not assignable', mid: 'Adequate term remaining, market rent', high: 'Long-term lease, below-market rent, assignable with options' },
    ]
  },
]

const buildUpExample = [
  { component: 'Risk-Free Rate', source: '20-Year U.S. Treasury Bond Yield', example: '4.50%', role: 'Baseline return for zero-risk investment. Foundation of all discount rates.' },
  { component: 'Equity Risk Premium', source: 'Kroll Cost of Capital Navigator / Duff & Phelps', example: '6.50%', role: 'Additional return required for investing in equities vs. risk-free bonds.' },
  { component: 'Size Premium', source: 'Kroll Size Study (10th Decile for micro-cap)', example: '5.50%', role: 'Additional return for the extra risk of investing in small private companies vs. large public companies.' },
  { component: 'Industry Risk Premium', source: 'Kroll Industry Risk Premium data', example: '2.00%', role: 'Industry-specific risk adjustment. Positive for higher-risk industries, negative for lower-risk.' },
  { component: 'Company-Specific Risk Premium (CSRP)', source: '15-Factor Weighted Risk Analysis (this page)', example: '7.50%', role: 'The risk premium unique to this specific business. Derived from the 15-factor scoring system.' },
  { component: 'Total Discount Rate', source: 'Sum of all components', example: '26.00%', role: 'The total required rate of return for investing in this business.' },
  { component: 'Less: Long-Term Growth Rate', source: 'Analyst estimate (must not exceed GDP growth)', example: '−2.00%', role: 'Sustainable long-term earnings growth. Subtracted to convert discount rate to cap rate.' },
  { component: 'Capitalization Rate', source: 'Discount Rate − Growth Rate', example: '24.00%', role: 'Used in Capitalization of Earnings method. Also the denominator in Cap of Earnings formula.' },
]

export default function RiskFactorsPage() {
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full mb-4">
          ⚠️ KEY DIFFERENTIATOR
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          15-Factor Risk Analysis &<br/>Discount Rate Build-Up
        </h1>
        <p className="text-lg text-slate-500 mt-4 leading-relaxed max-w-4xl">
          Most valuators treat risk analysis as an afterthought — a single subjective number plugged into a formula. MainStreetOS™ treats it as a <em>first-class analytical process</em> with its own dedicated AI agent, a structured 15-factor scoring system, and a transparent discount rate build-up that produces defensible, auditable capitalization and discount rates.
        </p>
        <p className="text-sm text-slate-400 mt-3">The Company-Specific Risk Premium (CSRP) is the single most influential variable in Income Approach valuations — yet it receives the least rigorous analysis in traditional practice. We're changing that.</p>
      </section>

      {/* Why This Matters */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Why Risk Analysis Deserves Its Own Agent</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-red-100 bg-red-50/50 rounded-xl p-5">
            <h4 className="font-bold text-red-800 mb-3">The Industry Problem</h4>
            <ul className="space-y-2">
              {[
                'Most brokers assign a "gut feel" CSRP of 5–10% with no supporting analysis',
                'A 2% change in the CSRP shifts the entire valuation by 10–20%+',
                'Lenders, buyers, and courts question unsupported discount rates',
                'No competing platform (Deal Studio, Tupelo, Vertica) offers structured risk scoring',
                'NACVA and ASA standards require the CSRP to be explained and supported — yet most reports treat it as a single line item',
              ].map((item, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="flex-shrink-0">✗</span>{item}</li>
              ))}
            </ul>
          </div>
          <div className="border border-green-100 bg-green-50/50 rounded-xl p-5">
            <h4 className="font-bold text-green-800 mb-3">The MainStreetOS™ Solution</h4>
            <ul className="space-y-2">
              {[
                'Dedicated Risk Analysis Agent that performs deep analysis of each factor before scoring',
                '15 risk factors across 3 categories with configurable weights that sum to 100%',
                'AI-powered factor analysis: the agent researches industry conditions, interprets financial trends, and evaluates operational risks',
                'Transparent build-up from Risk-Free Rate through CSRP to final Cap Rate — every component sourced and explained',
                'Auto-capture to Open Brain: risk assessments from past deals inform future scoring',
              ].map((item, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2"><span className="flex-shrink-0">✓</span>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 15-Factor Diagram */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">The 15-Factor CSRP Scoring System</h2>
          <p className="text-sm text-slate-500 text-center mb-8">Each factor is scored 1–5 (Low Risk to High Risk) and multiplied by its weight. Weights sum to 100%. The weighted average produces the CSRP Premium.</p>

          {riskGroups.map((group) => {
            const colors = {
              blue: { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', text: 'text-blue-600', accent: 'text-blue-500' },
              emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600', accent: 'text-emerald-500' },
              amber: { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-600', accent: 'text-amber-500' },
            }
            const c = colors[group.color as keyof typeof colors]
            const totalWeight = group.factors.reduce((sum, f) => sum + f.weight, 0)

            return (
              <div key={group.name} className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className={`text-lg font-bold ${c.title}`}>{group.name}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{(totalWeight * 100).toFixed(0)}% total weight</span>
                </div>
                <div className="space-y-2">
                  {group.factors.map((factor) => {
                    const isExpanded = expandedFactor === factor.id
                    return (
                      <div key={factor.id} className={`${c.bg} border ${c.border} rounded-xl overflow-hidden`}>
                        <button
                          onClick={() => setExpandedFactor(isExpanded ? null : factor.id)}
                          className="w-full text-left p-4 flex items-center gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${c.title}`}>{factor.label}</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${c.badge}`}>{(factor.weight * 100).toFixed(0)}%</span>
                              {factor.id === 'owner_dependence' && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Highest Weight</span>
                              )}
                            </div>
                            <p className={`text-xs ${c.text} mt-1`}>{factor.desc}</p>
                          </div>
                          <span className={`${c.accent} text-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4">
                            <div className="bg-white rounded-lg p-3 space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-red-50 rounded-lg p-2 text-center">
                                  <p className="text-xs font-bold text-red-700">Score 1–2 (Higher Risk)</p>
                                  <p className="text-xs text-red-600 mt-1">{factor.low}</p>
                                </div>
                                <div className="bg-amber-50 rounded-lg p-2 text-center">
                                  <p className="text-xs font-bold text-amber-700">Score 3 (Average)</p>
                                  <p className="text-xs text-amber-600 mt-1">{factor.mid}</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-2 text-center">
                                  <p className="text-xs font-bold text-green-700">Score 4–5 (Lower Risk)</p>
                                  <p className="text-xs text-green-600 mt-1">{factor.high}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="bg-white border border-slate-200 rounded-xl p-4 mt-6 text-center">
            <p className="text-xs text-slate-500">Total weights across all 15 factors: <strong className="text-slate-900">100%</strong>. Weighted average score (1–5 scale) maps to CSRP Premium (typically 3%–15% for Main Street businesses).</p>
          </div>
        </div>
      </section>

      {/* Discount Rate Build-Up */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">The Discount Rate Build-Up</h2>
        <p className="text-sm text-slate-500 text-center mb-8">The CSRP feeds directly into the Build-Up Method — the industry-standard technique for constructing discount and capitalization rates for privately held businesses under USPAP, NACVA, and ASA standards.</p>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 bg-slate-900 text-white text-xs font-bold">
            <div className="col-span-3 p-3">Component</div>
            <div className="col-span-4 p-3">Data Source</div>
            <div className="col-span-2 p-3 text-right">Example</div>
            <div className="col-span-3 p-3">Role</div>
          </div>
          {buildUpExample.map((row, i) => {
            const isBold = i >= 5
            const isCSRP = row.component.includes('CSRP')
            return (
              <div key={i} className={`grid grid-cols-12 text-sm ${isBold ? 'font-bold' : ''} ${isCSRP ? 'bg-blue-50 border-l-4 border-l-blue-500' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}>
                <div className={`col-span-3 p-3 ${isBold ? 'text-slate-900' : 'text-slate-700'}`}>{row.component}</div>
                <div className="col-span-4 p-3 text-xs text-slate-500">{row.source}</div>
                <div className={`col-span-2 p-3 text-right ${isBold ? 'text-slate-900' : 'text-slate-700'}`}>{row.example}</div>
                <div className="col-span-3 p-3 text-xs text-slate-400">{row.role}</div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3 text-center">Example rates for illustration. Actual rates are sourced from current market data (Kroll Cost of Capital Navigator) and the 15-factor risk scoring specific to the subject business.</p>
      </section>

      {/* The Risk Analysis Agent */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">The Risk Analysis Agent</h2>
          <p className="text-sm text-slate-500 text-center mb-8">A dedicated AI agent that performs deep-dive risk analysis — not just storing scores, but actively researching, analyzing, and explaining each risk factor before computing the CSRP.</p>

          {/* Agent Pipeline Position */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
            <h3 className="text-base font-bold text-slate-900 mb-4 text-center">Position in the Agent Pipeline</h3>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <div className="px-3 py-2 bg-slate-100 rounded-lg text-slate-600 text-center">
                <p className="text-xs font-bold">You</p>
                <p className="text-xs">Enter P&L</p>
              </div>
              <span className="text-slate-300">→</span>
              <div className="px-3 py-2 bg-blue-100 rounded-lg text-blue-700 text-center">
                <p className="text-xs font-bold">Agent 2</p>
                <p className="text-xs">Normalize</p>
              </div>
              <span className="text-slate-300">→</span>
              <div className="px-3 py-2 bg-red-100 border-2 border-red-400 rounded-lg text-red-700 text-center">
                <p className="text-xs font-bold">Agent 2.5 ★</p>
                <p className="text-xs">Risk Analysis</p>
              </div>
              <span className="text-slate-300">→</span>
              <div className="px-3 py-2 bg-emerald-100 rounded-lg text-emerald-700 text-center">
                <p className="text-xs font-bold">Agent 3</p>
                <p className="text-xs">5 Methods</p>
              </div>
              <span className="text-slate-300">→</span>
              <div className="px-3 py-2 bg-purple-100 rounded-lg text-purple-700 text-center">
                <p className="text-xs font-bold">Agent 4</p>
                <p className="text-xs">FMV Synthesis</p>
              </div>
              <span className="text-slate-300">→</span>
              <div className="px-3 py-2 bg-slate-100 rounded-lg text-slate-600 text-center">
                <p className="text-xs font-bold">Agent 5</p>
                <p className="text-xs">BVR Report</p>
              </div>
            </div>
          </div>

          {/* What the Agent Does */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center text-sm font-bold">2.5</div>
              <div>
                <h3 className="text-lg font-bold">Agent 2.5 — Risk Analysis Agent</h3>
                <p className="text-slate-400 text-sm">Deep-dive risk assessment with AI-powered factor analysis</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 rounded-xl p-4">
                <h4 className="font-bold text-white text-sm mb-2">Inputs</h4>
                <ul className="space-y-1">
                  {[
                    'Normalized P&L data from Agent 2 (revenue trends, margin analysis)',
                    'Business description, NAICS code, location, industry',
                    'Broker-entered risk factor scores (15 factors)',
                    'Open Brain: past risk assessments from similar businesses',
                    'Optional: lease abstract data, customer list, org chart',
                  ].map((item, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2"><span className="text-red-400 flex-shrink-0">→</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <h4 className="font-bold text-white text-sm mb-2">Outputs</h4>
                <ul className="space-y-1">
                  {[
                    'Validated/adjusted risk factor scores with AI reasoning for each',
                    'Computed CSRP Premium (weighted average mapped to premium range)',
                    'Complete discount rate via Build-Up Method',
                    'Capitalization rate (discount rate − growth rate)',
                    'Risk narrative for BVR report (all 15 factors explained)',
                    'Risk factor data written to risk_factors table',
                    'Open Brain auto-capture: risk assessment findings for future reference',
                  ].map((item, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2"><span className="text-green-400 flex-shrink-0">✓</span>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <h4 className="font-bold text-white text-sm mb-3">What Makes This Agent Different</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs font-bold text-white">AI Factor Analysis</p>
                <p className="text-xs text-slate-400 mt-1">The agent doesn't just read scores — it analyzes the P&L data to validate them. If the broker scores Revenue Trend as "4" but the financials show declining revenue, the agent flags the inconsistency and recommends an adjustment.</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs font-bold text-white">Industry Intelligence</p>
                <p className="text-xs text-slate-400 mt-1">Queries Open Brain for industry-specific risk patterns. "In 12 past restaurant valuations, the average Owner Dependence score was 2.1 and the average CSRP was 8.5%." Context from your accumulated deal history informs the current assessment.</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs font-bold text-white">Narrative Generation</p>
                <p className="text-xs text-slate-400 mt-1">Produces a detailed risk narrative for each of the 15 factors — not boilerplate, but specific analysis referencing the subject business's actual financial data, industry conditions, and operational characteristics. This narrative goes directly into the BVR report.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CSRP Mapping */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">How Scores Map to CSRP Premium</h2>
        <p className="text-sm text-slate-500 text-center mb-6">The weighted average score (1.0–5.0) maps inversely to the Company-Specific Risk Premium. Lower scores = higher risk = higher premium.</p>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 bg-slate-900 text-white text-xs font-bold">
            <div className="p-3">Weighted Average Score</div>
            <div className="p-3">Risk Level</div>
            <div className="p-3">Typical CSRP Range</div>
            <div className="p-3">Interpretation</div>
          </div>
          {[
            { score: '1.0 – 1.5', level: 'Very High Risk', csrp: '12% – 15%+', color: 'bg-red-50 text-red-700', interp: 'Severe deficiencies across multiple categories. Business may not be financeable.' },
            { score: '1.5 – 2.0', level: 'High Risk', csrp: '9% – 12%', color: 'bg-red-50 text-red-600', interp: 'Significant risk factors. Heavily owner-dependent with financial or operational issues.' },
            { score: '2.0 – 2.5', level: 'Above Average Risk', csrp: '7% – 9%', color: 'bg-amber-50 text-amber-700', interp: 'Common for Main Street businesses. Moderate owner dependence, some concentration risks.' },
            { score: '2.5 – 3.0', level: 'Average Risk', csrp: '5% – 7%', color: 'bg-amber-50 text-amber-600', interp: 'Well-run Main Street business with typical risks. Adequate systems and diversification.' },
            { score: '3.0 – 3.5', level: 'Below Average Risk', csrp: '3% – 5%', color: 'bg-green-50 text-green-600', interp: 'Strong operational business. Good systems, some owner independence, healthy financials.' },
            { score: '3.5 – 4.0', level: 'Low Risk', csrp: '1% – 3%', color: 'bg-green-50 text-green-700', interp: 'Exceptional business. Minimal owner dependence, diversified revenue, strong systems.' },
            { score: '4.0 – 5.0', level: 'Very Low Risk', csrp: '0% – 1%', color: 'bg-green-50 text-green-800', interp: 'Rare for private businesses. Institutional quality. Often approaching mid-market characteristics.' },
          ].map((row, i) => (
            <div key={i} className={`grid grid-cols-4 text-sm ${row.color} border-t border-slate-100`}>
              <div className="p-3 font-bold">{row.score}</div>
              <div className="p-3 font-bold">{row.level}</div>
              <div className="p-3 font-bold">{row.csrp}</div>
              <div className="p-3 text-xs">{row.interp}</div>
            </div>
          ))}
        </div>
      </section>

      {/* USPAP Context */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">USPAP & Professional Standards Requirements</h2>
          <div className="space-y-3">
            {[
              { std: 'USPAP Standard 9', req: 'Capitalization and discount rates must be based on reasonable and appropriate evidence. The appraiser must explain the basis for each component of the build-up. The CSRP cannot be an arbitrary number — it must be supported by analysis of the specific risk characteristics of the subject business.' },
              { std: 'NACVA Professional Standards', req: 'The capitalizer/divisor and the benefit stream must be consistently defined. Professional judgment is required in determining the CSRP, but that judgment must be documented and defensible. NACVA recommends a structured, multi-factor approach to CSRP determination.' },
              { std: 'Kroll / Duff & Phelps Cost of Capital', req: 'The Build-Up Method is the industry-standard framework for discount rate construction. The Risk-Free Rate, Equity Risk Premium, and Size Premium are sourced from published market data (Kroll Cost of Capital Navigator). Only the Industry Risk Premium and CSRP involve appraiser judgment.' },
              { std: 'AICPA SSVS', req: 'The analyst must document the basis for all significant assumptions including the discount rate and capitalization rate. The CSRP determination should reference specific risk factors of the subject business and explain how each factor contributes to the overall premium.' },
            ].map((s) => (
              <div key={s.std} className="bg-white border border-slate-200 rounded-lg p-4">
                <h5 className="text-sm font-bold text-slate-800">{s.std}</h5>
                <p className="text-xs text-slate-500 mt-1">{s.req}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Risk-Adjusted Valuations That Defend Themselves</h2>
          <p className="text-slate-400 mb-6">15 factors. Transparent build-up. AI-validated scoring. Every rate sourced, every factor explained. Professional tier includes the full Risk Analysis Agent.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="/signup" className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a>
            <a href="/methods" className="px-8 py-3 border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold rounded-lg transition text-sm">All Valuation Methods</a>
            <a href="/uspap-standards" className="px-8 py-3 border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold rounded-lg transition text-sm">USPAP Standards</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
