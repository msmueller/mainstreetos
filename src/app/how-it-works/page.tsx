'use client'
import { useState } from 'react'

const steps = [
  {
    number: '01',
    title: 'Enter Your Recast P&L',
    subtitle: 'Full Historical Financials — Just Like Your Deal Workbook',
    description: 'Enter 3–5 years of historical financial data with 14 default OpEx detail lines and 6 SDE normalization add-backs. The platform auto-computes Gross Profit, NOI, and Normalized SDE in real-time as you type — exactly mirroring your Deal Workbook workflow.',
    details: [
      'Revenue, COGS, and 14 Operating Expense line items',
      'SDE Add-Backs: Owner Comp, Benefits, D&A, Interest, Non-Recurring, Above-Market Rent',
      'Multi-year tabs with weighted average support (1–5 years)',
      'Owner comp double-count protection',
      'Auto-computed subtotals update in real-time',
    ],
    icon: '📊',
  },
  {
    number: '02',
    title: 'Score the Risk Factors',
    subtitle: '15-Factor CSRP Risk Analysis with Discount Rate Build-Up',
    description: 'Rate each of 15 risk factors on a 1–5 scale across three categories: Business & Industry, Financial, and Operational. The platform computes your weighted CSRP Premium, Discount Rate, and Capitalization Rate — feeding directly into DCF and Cap of Earnings methods.',
    details: [
      'Business & Industry: Industry Stability, Competitive Position, Customer Concentration, Supplier Dependence, Regulatory Environment',
      'Financial: Revenue Trend, Profit Margin Stability, Working Capital, Debt Level, Financial Records Quality',
      'Operational: Owner Dependence, Key Employee Risk, Systems & Processes, Facility/Equipment, Lease Position',
      'Configurable base rates: Risk-Free, Equity Premium, Size Premium, Growth Rate',
      'Real-time discount rate and cap rate computation',
    ],
    icon: '⚠️',
  },
  {
    number: '03',
    title: 'AI Agents Run the Pipeline',
    subtitle: '4-Agent Autonomous Valuation — CAIBVS™ Methodology',
    description: 'Click one button and our AI agents execute the full valuation pipeline autonomously. Agent 2 normalizes earnings and selects SDE vs. EBITDA. Agent 3 runs all 5 valuation methods. Agent 4 synthesizes a weighted FMV with a defensible range. All findings auto-capture to your Open Brain knowledge base.',
    details: [
      'Agent 2: SDE/EBITDA auto-selection, multi-year weighted average, LLM normalizing adjustments',
      'Agent 3: Market Multiple, Cap of Earnings, DCF, Asset-Based, Rule of Thumb — all with your risk-adjusted rates',
      'Agent 4: Weighted FMV synthesis, dispersion-based range (low/mid/high), method agreement analysis',
      'Open Brain auto-capture: every valuation feeds back as searchable institutional knowledge',
      'Full agent audit trail in the valuation record',
    ],
    icon: '🤖',
  },
  {
    number: '04',
    title: 'Generate Your Report',
    subtitle: 'Professional USPAP-Style Business Valuation Report',
    description: 'Agent 5 generates a professional DOCX/PDF Business Valuation Report — not a fill-in template, but a complete narrative document with Executive Summary, Financial Analysis, all 5 valuation methods, Risk Analysis, and Certification. Ready to hand to your client.',
    details: [
      'Cover page with your branding',
      'Executive Summary with conclusion of value and range',
      'Multi-year P&L summary table and SDE normalization waterfall',
      'Each valuation method with reasoning, multiples, and rates used',
      'Risk Analysis breakdown with 15-factor scores',
      'Standard USPAP assumptions, limiting conditions, and certification',
    ],
    icon: '📄',
  },
]

const comparisons = [
  { task: 'Business Valuation Report', manual: '20–40 hours', mainstreet: '< 30 minutes' },
  { task: 'Offering Memorandum', manual: '8–15 hours', mainstreet: '< 10 minutes' },
  { task: 'Financial Recast & SDE Calc', manual: '3–5 hours', mainstreet: '< 5 minutes' },
  { task: 'Risk Analysis & Discount Rate', manual: '2–4 hours', mainstreet: '< 2 minutes' },
  { task: 'Deal Knowledge Retention', manual: 'Lost between deals', mainstreet: 'Auto-captured forever' },
]

export default function HowItWorksPage() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="block text-center hover:opacity-80 transition">
            <div>
              <span className="text-2xl font-bold text-slate-900">MainStreet</span>
              <span className="text-2xl font-bold text-blue-600">OS</span>
              <span className="text-xs text-slate-400 align-super ml-0.5">™</span>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-slate-600 hover:text-slate-900 transition">Home</a>
            <a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
              Get Started Free
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          How MainStreet<span className="text-blue-600">OS</span><span className="text-xs text-slate-400 align-super">™</span> Works
        </h1>
        <p className="text-lg text-slate-500 mt-4 max-w-3xl mx-auto leading-relaxed">
          From recast P&L to professional valuation report in under 30 minutes. 
          Four steps. Five valuation methods. One AI-native platform built by a broker, for brokers.
        </p>
      </section>

      {/* Steps */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="space-y-6">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-200 transition-all overflow-hidden shadow-sm hover:shadow-md"
            >
              <button
                onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                className="w-full text-left p-6 flex items-start gap-5"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold">
                  {step.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{step.icon}</span>
                    <h3 className="text-xl font-bold text-slate-900">{step.title}</h3>
                  </div>
                  <p className="text-sm font-semibold text-blue-600 mt-1">{step.subtitle}</p>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{step.description}</p>
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className={`text-slate-600 text-lg transition-transform ${expandedStep === i ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </div>
              </button>

              {expandedStep === i && (
                <div className="px-6 pb-6 pt-0">
                  <div className="ml-19 pl-5 border-l-2 border-blue-100">
                    <ul className="space-y-2">
                      {step.details.map((detail, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5 flex-shrink-0">✓</span>
                          <span className="text-sm text-slate-600">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Time Comparison */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-2">
            The Time Savings Are Real
          </h2>
          <p className="text-slate-500 text-center mb-10">
            Side-by-side: manual process vs. MainStreetOS™ AI-agentic workflow
          </p>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-900 text-white text-sm font-bold">
              <div className="p-4">Task</div>
              <div className="p-4 text-center">Manual Process</div>
              <div className="p-4 text-center">MainStreetOS™</div>
            </div>
            {comparisons.map((row, i) => (
              <div key={i} className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}>
                <div className="p-4 font-medium text-slate-800">{row.task}</div>
                <div className="p-4 text-center text-red-500 font-semibold">{row.manual}</div>
                <div className="p-4 text-center text-green-600 font-semibold">{row.mainstreet}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Brain Section */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 md:p-12 text-white">
          <div className="flex items-start gap-4 mb-6">
            <span className="text-4xl">🧠</span>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">The Open Brain Advantage</h2>
              <p className="text-slate-300 mt-1">Your AI gets smarter with every deal you work</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white/10 rounded-xl p-5">
              <h4 className="font-bold text-white mb-2">🔄 Auto-Capture</h4>
              <p className="text-sm text-slate-300">Every completed valuation auto-captures findings to your semantic knowledge base. No manual entry needed.</p>
            </div>
            <div className="bg-white/10 rounded-xl p-5">
              <h4 className="font-bold text-white mb-2">🔍 AI Queries Your Expertise</h4>
              <p className="text-sm text-slate-300">Agents search your accumulated knowledge before running valuations — leveraging patterns from your past deals.</p>
            </div>
            <div className="bg-white/10 rounded-xl p-5">
              <h4 className="font-bold text-white mb-2">🌐 Cross-Tool Memory</h4>
              <p className="text-sm text-slate-300">Built on the MCP protocol. Your knowledge follows you across Claude, ChatGPT, Cursor, and the MainStreetOS™ web app.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-16 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          Ready to Transform Your Practice?
        </h2>
        <p className="text-slate-500 mb-8">
          Join the next generation of AI-native business brokers. Start with a free valuation — no credit card required.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="/signup" className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">
            Start Free Valuation
          </a>
          <a href="/brochure.html" target="_blank" className="px-8 py-3 border border-slate-400 text-slate-900 hover:bg-slate-100 font-bold rounded-lg transition text-sm">
            View Product Brochure →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved · mainstreetos.biz</p>
        </div>
      </footer>
    </div>
  )
}
