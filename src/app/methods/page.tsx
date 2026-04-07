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
          <a href="/features/ai-valuations" className="text-sm text-slate-600 hover:text-slate-900 transition">AI Valuations</a>
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

const methods = [
  { slug: 'market-multiple', icon: '📈', title: 'Market Multiple Method', approach: 'Market Approach', tagline: 'What comparable businesses actually sell for — SDE and EBITDA multiples derived from completed transactions.' },
  { slug: 'capitalization-of-earnings', icon: '🏦', title: 'Capitalization of Earnings', approach: 'Income Approach', tagline: 'Stable, normalized earnings converted to value by dividing by a risk-adjusted capitalization rate.' },
  { slug: 'discounted-cash-flow', icon: '💰', title: 'Discounted Cash Flow (DCF)', approach: 'Income Approach', tagline: 'Projected future free cash flows discounted to present value using a build-up discount rate.' },
  { slug: 'asset-based', icon: '🏗️', title: 'Asset-Based Method', approach: 'Asset Approach', tagline: 'Fair market value of all tangible and intangible business assets minus liabilities.' },
  { slug: 'rule-of-thumb', icon: '📏', title: 'Rule of Thumb', approach: 'Market Approach', tagline: 'Industry-specific pricing benchmarks used as a cross-validation sanity check.' },
]

export default function MethodsIndexPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full mb-4">
          📊 USPAP-ALIGNED VALUATION METHODS
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          Five Valuation Methods
        </h1>
        <p className="text-lg text-slate-500 mt-4 max-w-3xl mx-auto leading-relaxed">
          MainStreetOS™ applies all five USPAP-recognized valuation methods to every engagement, weighting each by relevance to the subject business. The Uniform Standards of Professional Appraisal Practice require that all three valuation approaches be <em>considered</em> — and that any omitted approach be explained and supported. Our platform satisfies this requirement by default.
        </p>
      </section>

      {/* USPAP Framework */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white mb-10">
          <h2 className="text-xl font-bold mb-4">USPAP Standards 9 & 10 — Business Valuation</h2>
          <p className="text-sm text-slate-300 mb-4">The Uniform Standards of Professional Appraisal Practice (USPAP), promulgated by The Appraisal Foundation and authorized by Congress in 1989, is the nationally recognized quality control standard for business valuation in the United States. Standards 9 and 10 apply specifically to business and intangible asset appraisals:</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <h4 className="font-bold text-white mb-2">Standard 9 — Development</h4>
              <p className="text-xs text-slate-300">Governs how a business valuation is developed. Requires the appraiser to: identify the business being valued, specify the value standard (e.g., Fair Market Value), select appropriate valuation approaches (Income, Market, Asset), perform financial analysis and industry research, consider control and marketability factors, and determine the scope of work necessary to produce credible results.</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <h4 className="font-bold text-white mb-2">Standard 10 — Reporting</h4>
              <p className="text-xs text-slate-300">Governs how business valuation results are communicated. Requires the report to clearly state all assumptions, sources of information, and analytical procedures. The appraiser must explain and support the inclusion or exclusion of any valuation approach. Two report types are recognized: the Appraisal Report (comprehensive, for external reliance) and the Restricted Appraisal Report (concise, client-only).</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Additional professional standards recognized by MainStreetOS™: NACVA Professional Standards, AICPA SSVS VS Section 100, ASA Business Valuation Standards, and IRS Revenue Ruling 59-60.</p>
        </div>

        <h2 className="text-xl font-bold text-slate-900 text-center mb-6">The Three Valuation Approaches</h2>
        <p className="text-sm text-slate-500 text-center mb-6 max-w-3xl mx-auto">USPAP requires all three approaches be considered in every business appraisal assignment. If an approach is omitted, the appraiser must explain and support the exclusion in the report.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <h3 className="text-sm font-bold text-blue-800 mb-2">Income Approach</h3>
            <p className="text-xs text-blue-600 mb-3">Values a business based on its ability to generate future economic benefits. Converts projected earnings or cash flows into present value using risk-adjusted rates derived from the Build-Up Method.</p>
            <p className="text-xs text-blue-400 mb-2">Methods: Cap of Earnings, DCF</p>
            <p className="text-xs text-blue-500 italic">Best when: stable or projectable earnings exist and are the primary value driver.</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
            <h3 className="text-sm font-bold text-emerald-800 mb-2">Market Approach</h3>
            <p className="text-xs text-emerald-600 mb-3">Values a business by comparison to similar businesses that have sold. Uses pricing multiples derived from guideline transactions in the same industry. Relies on databases like DealStats, BizBuySell Comps, and BizComps.</p>
            <p className="text-xs text-emerald-400 mb-2">Methods: Market Multiple, Rule of Thumb</p>
            <p className="text-xs text-emerald-500 italic">Best when: sufficient comparable transactions exist in the subject industry.</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
            <h3 className="text-sm font-bold text-amber-800 mb-2">Asset Approach</h3>
            <p className="text-xs text-amber-600 mb-3">Values a business based on the fair market value of its underlying assets minus liabilities. Most relevant for asset-intensive businesses, startups with limited earnings history, holding companies, and asset-purchase transactions.</p>
            <p className="text-xs text-amber-400 mb-2">Methods: Asset-Based (ANAV / Liquidation)</p>
            <p className="text-xs text-amber-500 italic">Best when: value is primarily in tangible/intangible assets, not earnings capacity.</p>
          </div>
        </div>
      </section>

      {/* Key Concepts */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-xl font-bold text-slate-900 text-center mb-6">Key USPAP Concepts in Business Valuation</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {[
              { term: 'Fair Market Value (FMV)', def: 'The price at which the business would change hands between a willing buyer and a willing seller, both having reasonable knowledge of relevant facts, and neither being under any compulsion to act. This is the most common value standard in business appraisals.' },
              { term: 'Going Concern Premise', def: 'Assumes the business will continue operating as an ongoing enterprise. Assets are valued in-place, as part of an operating business, not individually at liquidation prices.' },
              { term: 'Scope of Work', def: 'The type and extent of research and analysis required for a specific assignment. Must be determined before the appraisal begins, agreed upon with the client, and documented in the report.' },
              { term: 'Effective Date of Valuation', def: 'The specific date as of which the opinion of value applies. All market conditions, financial data, and assumptions are as of this date. USPAP requires every valuation to have a clearly stated effective date.' },
              { term: 'Extraordinary Assumptions', def: 'Assumptions directly related to the assignment that, if found to be false, could alter the appraiser\'s opinion of value. Must be stated prominently in the report.' },
              { term: 'Reconciliation', def: 'The process of weighing the indications from multiple valuation methods and approaches to arrive at a final conclusion of value. USPAP requires the appraiser to explain and support the weighting applied to each approach.' },
            ].map((item) => (
              <div key={item.term} className="bg-white border border-slate-200 rounded-lg p-4">
                <h5 className="text-sm font-bold text-slate-800 mb-1">{item.term}</h5>
                <p className="text-xs text-slate-500">{item.def}</p>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-bold text-slate-900 text-center mb-8">Explore Each Method</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {methods.map((m) => (
              <a key={m.slug} href={`/methods/${m.slug}`} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-200 hover:shadow-md transition group">
                <span className="text-3xl">{m.icon}</span>
                <h3 className="text-base font-bold text-slate-900 mt-3 group-hover:text-blue-600 transition">{m.title}</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mt-1">{m.approach}</p>
                <p className="text-sm text-slate-500 mt-2">{m.tagline}</p>
                <p className="text-xs text-blue-600 font-bold mt-3">Learn more →</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How MainStreetOS Reconciles */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-slate-900 text-center mb-4">How MainStreetOS™ Reconciles Five Methods</h2>
        <p className="text-sm text-slate-500 text-center mb-6 max-w-3xl mx-auto">USPAP requires the appraiser to reconcile the value indications from all approaches used, explaining the weighting applied. Agent 4 (FMV Synthesis) performs this reconciliation automatically:</p>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="space-y-3">
            {[
              { step: 'Collect all five method results from Agent 3', detail: 'Market Multiple, Cap of Earnings, DCF, Asset-Based, and Rule of Thumb indicated values' },
              { step: 'Analyze method agreement', detail: 'Calculate dispersion, identify outliers, flag methods where data quality was limited' },
              { step: 'Apply confidence-based weighting', detail: 'Weight each method based on data quality, relevance to subject business, and method reliability for the specific business type' },
              { step: 'Produce weighted FMV with range', detail: 'Single-point weighted Fair Market Value plus a defensible low–mid–high range based on method dispersion' },
              { step: 'Document reconciliation reasoning', detail: 'Explain and support the weighting applied to each method — satisfying USPAP Standard 10 reporting requirements' },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{s.step}</p>
                  <p className="text-xs text-slate-500">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">See All Five Methods in Action</h2>
          <p className="text-slate-400 mb-6">MainStreetOS™ runs all five valuation methods simultaneously, reconciles them with confidence-based weighting, and produces a USPAP-aligned report — in under 30 minutes.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="/signup" className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a>
            <a href="/features/ai-valuations" className="px-8 py-3 border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold rounded-lg transition text-sm">Back to AI Valuations</a>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
