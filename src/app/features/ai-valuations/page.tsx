'use client'

function Nav() {
  return (
    <nav className="border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="hover:opacity-80 transition">
          <span className="text-2xl font-bold text-slate-900">MainStreet</span>
          <span className="text-2xl font-bold text-blue-600">OS</span>
          <span className="text-xs text-slate-400 align-super ml-0.5">™</span>
        </a>
        <div className="flex items-center gap-4">
          <a href="/how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition">How It Works</a>
          <a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Get Started Free</a>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-100 py-6">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved · mainstreetos.biz</p>
      </div>
    </footer>
  )
}

const agents = [
  {
    id: 'agent-2',
    label: 'Agent 2',
    title: 'Earnings Normalization',
    color: 'bg-blue-600',
    dotColor: 'bg-blue-600',
    description: 'Reads your recast P&L data, selects SDE vs. EBITDA automatically based on business size and type, applies multi-year weighted averages, and generates LLM-powered normalizing adjustment recommendations.',
    inputs: ['Recast P&L (3–5 years)', 'Revenue, COGS, OpEx detail', 'SDE add-backs'],
    outputs: ['Normalized SDE or EBITDA', 'Weighted average earnings', 'Adjustment memo'],
  },
  {
    id: 'agent-3',
    label: 'Agent 3',
    title: '5-Method Valuation',
    color: 'bg-emerald-600',
    dotColor: 'bg-emerald-600',
    description: 'Runs all five valuation methods simultaneously using your normalized earnings and broker-scored risk factors. Queries Open Brain for comparable deal intelligence from your accumulated knowledge base.',
    inputs: ['Normalized earnings from Agent 2', 'Risk factor scores (15 factors)', 'Discount & cap rates', 'Open Brain knowledge'],
    outputs: ['Market Multiple value', 'Cap of Earnings value', 'DCF value', 'Asset-Based value', 'Rule of Thumb value'],
  },
  {
    id: 'agent-4',
    label: 'Agent 4',
    title: 'FMV Synthesis',
    color: 'bg-purple-600',
    dotColor: 'bg-purple-600',
    description: 'Synthesizes all five method results into a single weighted Fair Market Value with a defensible range. Analyzes method agreement, applies confidence-based weighting, and auto-captures findings to Open Brain.',
    inputs: ['5 method values from Agent 3', 'Method confidence scores', 'Business characteristics'],
    outputs: ['Weighted FMV', 'Low–Mid–High range', 'Method agreement analysis', 'Open Brain auto-capture'],
  },
]

export default function AIValuationsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full mb-4">
          🤖 CORE FEATURE
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          AI-Agentic Valuations
        </h1>
        <p className="text-lg text-slate-500 mt-4 max-w-3xl mx-auto leading-relaxed">
          A 4-agent autonomous pipeline that runs USPAP-aligned business valuations using the CAIBVS™ methodology.
          Five methods. Risk-adjusted rates. Professional report. Under 30 minutes.
        </p>
      </section>

      {/* Pipeline Diagram */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">The Agent Pipeline</h2>
        <div className="relative">
          {/* Flow line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
            {/* Broker Input */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-2xl mb-3">📊</div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center w-full shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">You</p>
                <p className="text-sm font-bold text-slate-900 mt-1">Enter P&L + Score Risk</p>
              </div>
            </div>

            {/* Agent 2 */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-sm font-bold mb-3">A2</div>
              <div className="bg-white border-2 border-blue-200 rounded-xl p-3 text-center w-full shadow-sm">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Agent 2</p>
                <p className="text-sm font-bold text-slate-900 mt-1">Normalize Earnings</p>
                <p className="text-xs text-slate-500 mt-1">SDE/EBITDA selection</p>
              </div>
            </div>

            {/* Agent 3 */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-sm font-bold mb-3">A3</div>
              <div className="bg-white border-2 border-emerald-200 rounded-xl p-3 text-center w-full shadow-sm">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Agent 3</p>
                <p className="text-sm font-bold text-slate-900 mt-1">5-Method Valuation</p>
                <p className="text-xs text-slate-500 mt-1">+ Open Brain query</p>
              </div>
            </div>

            {/* Agent 4 */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-sm font-bold mb-3">A4</div>
              <div className="bg-white border-2 border-purple-200 rounded-xl p-3 text-center w-full shadow-sm">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wide">Agent 4</p>
                <p className="text-sm font-bold text-slate-900 mt-1">FMV Synthesis</p>
                <p className="text-xs text-slate-500 mt-1">Weighted range output</p>
              </div>
            </div>

            {/* Output */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-2xl mb-3">📄</div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center w-full shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Output</p>
                <p className="text-sm font-bold text-slate-900 mt-1">BVR Report (DOCX/PDF)</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-slate-400 mt-6">One click triggers the full pipeline. All findings auto-capture to your Open Brain knowledge base.</p>
      </section>

      {/* Agent Detail Cards */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Inside Each Agent</h2>
          <div className="space-y-6">
            {agents.map((agent) => (
              <div key={agent.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`${agent.color} text-white text-xs font-bold px-3 py-1.5 rounded-lg`}>{agent.label}</div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{agent.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{agent.description}</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Inputs</p>
                    <ul className="space-y-1">
                      {agent.inputs.map((input, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>{input}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Outputs</p>
                    <ul className="space-y-1">
                      {agent.outputs.map((output, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{output}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 Methods */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Five Valuation Methods</h2>
        <p className="text-slate-500 text-center mb-10">Every valuation uses all five — weighted by relevance to produce a defensible range</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { name: 'Market Multiple', desc: 'Industry SDE/EBITDA multiples applied to normalized earnings', icon: '📈' },
            { name: 'Cap of Earnings', desc: 'Normalized earnings divided by risk-adjusted capitalization rate', icon: '🏦' },
            { name: 'DCF', desc: 'Discounted future cash flows using CSRP-derived discount rate', icon: '💰' },
            { name: 'Asset-Based', desc: 'Fair market value of tangible and intangible business assets', icon: '🏗️' },
            { name: 'Rule of Thumb', desc: 'Industry-specific revenue or earnings multipliers', icon: '📏' },
          ].map((method) => (
            <div key={method.name} className="bg-white border border-slate-200 rounded-xl p-4 text-center hover:border-blue-200 hover:shadow-md transition">
              <span className="text-2xl">{method.icon}</span>
              <h4 className="text-sm font-bold text-slate-900 mt-3">{method.name}</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{method.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Run Your First AI Valuation</h2>
          <p className="text-slate-400 mb-6">From recast P&L to professional BVR in under 30 minutes. Free tier includes 1 valuation per month.</p>
          <a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">
            Start Free Valuation →
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
