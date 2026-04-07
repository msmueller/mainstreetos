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

const docTypes = [
  {
    icon: '📄',
    title: 'Business Valuation Report (BVR)',
    status: 'Phase 1',
    statusColor: 'bg-green-100 text-green-700',
    time: '< 30 minutes',
    manualTime: '20–40 hours',
    description: 'Professional USPAP-style valuation report with executive summary, 5-method analysis, risk assessment, and certification. Generated as DOCX/PDF with your firm branding.',
    sections: ['Cover page with firm branding', 'Executive summary with FMV conclusion', 'Business description and industry overview', 'Multi-year P&L summary and SDE normalization', 'All 5 valuation methods with reasoning', '15-factor risk analysis with CSRP build-up', 'USPAP assumptions and limiting conditions', 'Certification and signature block'],
  },
  {
    icon: '📋',
    title: 'Offering Memorandum (OM)',
    status: 'Phase 2',
    statusColor: 'bg-blue-100 text-blue-700',
    time: '< 10 minutes',
    manualTime: '8–15 hours',
    description: 'Pre-NDA marketing document for BizBuySell leads and initial prospect engagement. High-level business overview with financial highlights — no confidential detail.',
    sections: ['Business overview and opportunity summary', 'Location and market highlights', 'High-level financial performance', 'Growth opportunity narrative', 'Asking price and deal structure', 'Next steps and NDA instructions'],
  },
  {
    icon: '📑',
    title: 'Confidential Information Memorandum (CIM)',
    status: 'Phase 2',
    statusColor: 'bg-blue-100 text-blue-700',
    time: '< 15 minutes',
    manualTime: '12–20 hours',
    description: 'Post-NDA detailed financial and operational summary. Includes historical P&L tables, cash flow analysis, asset summary, and complete business narrative for qualified buyers.',
    sections: ['Detailed business description', 'Products, services, and customer base', 'Historical P&L (3–5 year)', 'Cash flow analysis and SDE detail', 'Balance sheet and asset summary', 'Lease analysis and facility overview', 'Management and staffing', 'Growth and transition plan'],
  },
  {
    icon: '📝',
    title: 'Lease Abstracts & LOIs',
    status: 'Phase 3',
    statusColor: 'bg-amber-100 text-amber-700',
    time: '< 5 minutes',
    manualTime: '2–4 hours',
    description: 'Automated lease summary extraction and Letter of Intent generation with standard M&A terms, contingencies, and closing conditions.',
    sections: ['Lease term, rent, escalations', 'Assignment and subletting clauses', 'Renewal options and termination rights', 'LOI with offer terms and contingencies'],
  },
]

export default function AIDocGenPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full mb-4">
          📄 CORE FEATURE
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          AI Document Generation
        </h1>
        <p className="text-lg text-slate-500 mt-4 max-w-3xl mx-auto leading-relaxed">
          Professional deal documents in minutes, not days. BVRs, OMs, CIMs, lease abstracts, and LOIs — 
          generated from your data, your branding, and your accumulated knowledge.
        </p>
      </section>

      {/* Generation Flow Diagram */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">The Document Generation Flow</h2>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 md:p-8">
          {/* Three Columns: Data Sources → AI Engine → Output */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Column 1: Data Sources */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">Data Sources</p>
              <div className="space-y-3">
                {[
                  { icon: '📊', label: 'Recast P&L Data', sub: 'Multi-year financials' },
                  { icon: '⚠️', label: 'Risk Factor Scores', sub: '15-factor CSRP analysis' },
                  { icon: '🤖', label: 'Agent Pipeline Results', sub: 'FMV, range, methods' },
                  { icon: '🧠', label: 'Open Brain Knowledge', sub: 'Comps, industry data' },
                  { icon: '🏢', label: 'Business Profile', sub: 'Description, location' },
                ].map((src) => (
                  <div key={src.label} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-lg">{src.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{src.label}</p>
                      <p className="text-xs text-slate-400">{src.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: AI Engine */}
            <div className="flex flex-col items-center justify-center">
              <div className="hidden md:flex flex-col items-center mb-4">
                <p className="text-xs text-slate-400">feeds into</p>
                <div className="text-slate-300 text-xl">→</div>
              </div>
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white text-center w-full">
                <span className="text-3xl">⚙️</span>
                <h3 className="text-base font-bold mt-2">Agent 5: Report Generation</h3>
                <p className="text-xs text-slate-400 mt-2">Hybrid deterministic + generative architecture</p>
                <div className="mt-3 space-y-2">
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-xs font-bold">Deterministic Layer</p>
                    <p className="text-xs text-slate-400">Financial tables, calculations, ratios — computed precisely, never hallucinated</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-xs font-bold">Generative Layer</p>
                    <p className="text-xs text-slate-400">Narrative sections, analysis, conclusions — LLM-generated with factual grounding</p>
                  </div>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-center mt-4">
                <div className="text-slate-300 text-xl">→</div>
                <p className="text-xs text-slate-400">produces</p>
              </div>
            </div>

            {/* Column 3: Outputs */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">Document Output</p>
              <div className="space-y-3">
                {[
                  { icon: '📄', label: 'DOCX Report', sub: 'Editable Word document' },
                  { icon: '📕', label: 'PDF Report', sub: 'Print-ready, branded' },
                  { icon: '🏷️', label: 'Your Firm Branding', sub: 'Logo, name, credentials' },
                  { icon: '📊', label: 'Formatted Tables', sub: 'P&L, methods, risk scores' },
                  { icon: '✍️', label: 'Certification Block', sub: 'USPAP compliance language' },
                ].map((out) => (
                  <div key={out.label} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-lg">{out.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{out.label}</p>
                      <p className="text-xs text-slate-400">{out.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Document Type Cards */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Document Types</h2>
          <p className="text-slate-500 text-center mb-10">Professional deal documents across the full deal lifecycle</p>
          <div className="space-y-6">
            {docTypes.map((doc) => (
              <div key={doc.title} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-wrap items-start gap-4 mb-4">
                  <span className="text-3xl">{doc.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-900">{doc.title}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${doc.statusColor}`}>{doc.status}</span>
                    </div>
                    <p className="text-sm text-slate-500">{doc.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-slate-400">Manual</div>
                    <div className="text-sm font-bold text-red-500 line-through">{doc.manualTime}</div>
                    <div className="text-xs text-slate-400 mt-1">MainStreetOS™</div>
                    <div className="text-sm font-bold text-green-600">{doc.time}</div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 mt-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Sections Generated</p>
                  <div className="grid sm:grid-cols-2 gap-1">
                    {doc.sections.map((section, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{section}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Key Insight */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 md:p-12 text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center">Why Hybrid Architecture Matters</h2>
          <p className="text-slate-300 text-center max-w-3xl mx-auto mb-8">
            Most AI document tools use LLMs for everything — including financial calculations. 
            That's why they hallucinate numbers. MainStreetOS™ uses a different approach.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/10 rounded-xl p-5">
              <h4 className="font-bold text-white mb-3">🔢 Deterministic Layer</h4>
              <p className="text-sm text-slate-300 mb-3">Financial tables, SDE calculations, discount rate math, valuation method formulas — all computed precisely in code. Never touched by the LLM.</p>
              <p className="text-xs text-slate-400 italic">The numbers in your report are computed, not generated.</p>
            </div>
            <div className="bg-white/10 rounded-xl p-5">
              <h4 className="font-bold text-white mb-3">✍️ Generative Layer</h4>
              <p className="text-sm text-slate-300 mb-3">Executive summary, business narrative, methodology explanations, conclusion language — written by AI but grounded in the deterministic facts.</p>
              <p className="text-xs text-slate-400 italic">The narrative is generated. The facts it references are verified.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Generate Your First Report</h2>
          <p className="text-slate-400 mb-6">Professional BVR in minutes. Free tier includes 1 valuation report per month. No credit card required.</p>
          <a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">
            Start Free Valuation →
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
