'use client'

function Nav() {
  return (
    <nav className="border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="hover:opacity-80 transition"><span className="text-2xl font-bold text-slate-900">MainStreet</span><span className="text-2xl font-bold text-blue-600">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span></a>
        <div className="flex items-center gap-4">
          <a href="/methods" className="text-sm text-slate-600 hover:text-slate-900 transition">Valuation Methods</a>
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

export default function USPAPStandardsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full mb-4">
          ⚖️ PROFESSIONAL STANDARDS
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          USPAP Standards &<br />Business Valuation
        </h1>
        <p className="text-lg text-slate-500 mt-4 leading-relaxed">
          The Uniform Standards of Professional Appraisal Practice (USPAP) are the nationally recognized quality control standards for business valuation in the United States. MainStreetOS™ is designed from the ground up to produce valuations that align with USPAP Standards 9 and 10 — ensuring every report is credible, defensible, and professionally structured.
        </p>
      </section>

      {/* What is USPAP */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">What is USPAP?</h2>
        <div className="prose-sm text-slate-600 space-y-3">
          <p className="text-sm leading-relaxed">The Uniform Standards of Professional Appraisal Practice (USPAP) were first developed in 1986–87 by a joint committee representing the major U.S. and Canadian appraisal organizations. Following the Savings and Loan Crisis, Congress authorized USPAP through the Financial Institutions Reform, Recovery and Enforcement Act of 1989 (FIRREA). The Appraisal Foundation (TAF), through its Appraisal Standards Board (ASB), maintains and publishes USPAP on a periodic update cycle. The current edition took effect January 1, 2024.</p>
          <p className="text-sm leading-relaxed">USPAP establishes minimum quality standards for all appraisal disciplines — including real property, personal property, and business valuation. It does not prescribe specific methods. Instead, USPAP requires that appraisers use methods that would be acceptable to other appraisers familiar with the assignment and to the intended users of the appraisal. The Scope of Work Rule directs this — at the onset of an assignment, the appraiser identifies the problem, determines the appropriate scope of analysis, and documents the methodology used.</p>
          <p className="text-sm leading-relaxed">USPAP applies to appraisals performed for federally regulated lending institutions and is required by professional organizations including the American Society of Appraisers (ASA), the National Association of Certified Valuators and Analysts (NACVA), and the Appraisal Institute. Many appraisers adopt USPAP voluntarily even when not legally required, because compliance enhances credibility with clients, courts, and third-party users.</p>
        </div>
      </section>

      {/* Five Core Rules */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">The Five Core USPAP Rules</h2>
          <p className="text-sm text-slate-500 mb-6">These rules apply to all appraisal disciplines and all 10 standards. They form the ethical and procedural foundation of every USPAP-compliant valuation.</p>
          <div className="space-y-4">
            {[
              {
                rule: 'Ethics Rule',
                icon: '🤝',
                desc: 'Requires appraisers to provide services with integrity, impartiality, objectivity, and independent judgment. The appraiser must not advocate the cause or interest of any party, must not accept an assignment that includes reporting a predetermined opinion, and must disclose any prior services performed for the same property within three years. The 2024 edition organizes the rule into four sections: Nondiscrimination, Conduct, Management, and Confidentiality.',
                mainstreet: 'MainStreetOS™ AI agents follow deterministic financial calculations (never hallucinated), document all data sources, and have no bias toward any predetermined outcome. The platform cannot be instructed to produce a target value.'
              },
              {
                rule: 'Competency Rule',
                icon: '🎓',
                desc: 'The appraiser must possess — or acquire before accepting the assignment — the knowledge, skills, and experience necessary to complete the assignment competently. For business valuation, this includes understanding of financial statement analysis, valuation methodology, industry dynamics, and the specific characteristics of the subject business.',
                mainstreet: 'MainStreetOS™ embeds CAIBVS™ methodology developed through 5+ years of active brokerage practice and 45+ years of CRE and M&A transaction experience. The platform encodes industry-standard methods (Build-Up, DCF, Market Multiple) so that every valuation applies them correctly.'
              },
              {
                rule: 'Scope of Work Rule',
                icon: '📋',
                desc: 'The appraiser must correctly identify the problem to be solved and determine the appropriate scope of work needed to produce credible results. The scope must be determined before beginning the assignment, agreed upon with the client, and disclosed in the report. It defines the extent of research, analysis, and the valuation approaches to be applied.',
                mainstreet: 'MainStreetOS™ captures scope of work at valuation creation: business identification, value standard (Fair Market Value), premise (Going Concern vs. Liquidation), effective date, and intended use. All five valuation methods across all three approaches are applied by default — exceeding the minimum requirement.'
              },
              {
                rule: 'Record Keeping Rule',
                icon: '📁',
                desc: 'Appraisers must create and maintain a workfile for each assignment. The workfile must contain sufficient data, information, and documentation to support the appraiser\'s opinions and conclusions, and must be retained for a minimum of five years (or two years after final disposition of any judicial proceeding in which testimony was given).',
                mainstreet: 'MainStreetOS™ stores the complete valuation record — all inputs, agent outputs, financial data, risk factor scores, and the full agent audit trail — in Supabase with Row-Level Security. Every calculation is traceable. Open Brain captures the institutional reasoning behind each valuation as searchable knowledge.'
              },
              {
                rule: 'Jurisdictional Exception Rule',
                icon: '⚖️',
                desc: 'Preserves the balance of USPAP when a specific portion is contrary to the law or public policy of a jurisdiction. If a law or regulation creates a conflict with USPAP, the appraiser must comply with the law and cite the Jurisdictional Exception in the report, clearly stating what was done differently and why.',
                mainstreet: 'MainStreetOS™ BVR reports include standard USPAP assumptions and limiting conditions, with a section for the broker to note any jurisdictional exceptions that apply to the specific engagement.'
              },
            ].map((r) => (
              <div key={r.rule} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl">{r.icon}</span>
                  <h3 className="text-base font-bold text-slate-900">{r.rule}</h3>
                </div>
                <p className="text-sm text-slate-600 mb-3">{r.desc}</p>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-800 mb-1">How MainStreetOS™ Addresses This</p>
                  <p className="text-xs text-blue-600">{r.mainstreet}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Standards 9 and 10 */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Standards 9 & 10 — Business Valuation</h2>
        <p className="text-sm text-slate-500 mb-6">These are the two standards that apply specifically to business and intangible asset appraisals — the core of what MainStreetOS™ automates.</p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
            <h3 className="text-lg font-bold mb-3">Standard 9 — Development</h3>
            <p className="text-xs text-slate-300 mb-4">Governs how a business valuation is developed. The appraiser must:</p>
            <ul className="space-y-2">
              {[
                'Identify the business enterprise, ownership interest, or intangible asset being appraised',
                'Specify the type and definition of value (e.g., Fair Market Value)',
                'Determine the premise of value (Going Concern, Liquidation, or other)',
                'State the effective date of the valuation',
                'Identify the intended use and intended users of the appraisal',
                'Define the scope of work necessary for credible results',
                'Consider all three valuation approaches: Income, Market, and Asset',
                'Analyze sufficient data to support the opinion of value',
                'Explain and support the exclusion of any approach not used',
                'Reconcile indications from multiple approaches into a conclusion',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="text-blue-400 flex-shrink-0 mt-0.5 text-xs">{i + 1}.</span>{item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
            <h3 className="text-lg font-bold mb-3">Standard 10 — Reporting</h3>
            <p className="text-xs text-slate-300 mb-4">Governs how business valuation results are communicated. The report must:</p>
            <ul className="space-y-2">
              {[
                'Clearly and accurately set forth the appraisal in a manner that is not misleading',
                'Contain sufficient information for the intended users to understand the report',
                'State the identity of the client and any intended users',
                'State the intended use of the appraisal',
                'Summarize the scope of work performed',
                'Describe the business enterprise appraised',
                'State the effective date of the appraisal and the date of the report',
                'State the type and definition of value used',
                'Describe all assumptions, hypothetical conditions, and extraordinary assumptions',
                'Present the approaches, methods, and procedures used — and explain the reasoning for each',
                'State the conclusion of value and support the reconciliation of approaches',
                'Include a signed certification statement',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-200">
                  <span className="text-emerald-400 flex-shrink-0 mt-0.5 text-xs">{i + 1}.</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h4 className="text-sm font-bold text-amber-800 mb-2">Report Types Under Standard 10</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-amber-700">Appraisal Report</p>
              <p className="text-xs text-amber-600 mt-1">Comprehensive report with detailed analysis, suitable for external reliance — lenders, courts, investors, government agencies. Must contain sufficient information to allow intended users to understand the analysis and conclusions without additional information from the appraiser.</p>
            </div>
            <div>
              <p className="text-xs font-bold text-amber-700">Restricted Appraisal Report</p>
              <p className="text-xs text-amber-600 mt-1">Concise report intended for client use only. Contains the same analytical rigor but with abbreviated presentation. Not suitable for third-party reliance. Must state that the report is restricted and identify the client as the sole intended user.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Three Approaches */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">The Three Valuation Approaches</h2>
          <p className="text-sm text-slate-500 mb-6">USPAP requires that all three approaches be considered in every business appraisal. If an approach is omitted, the appraiser must explain and support the exclusion. MainStreetOS™ applies all three by default — running five methods across the three approaches simultaneously.</p>

          <div className="space-y-4">
            <div className="bg-white border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold flex-shrink-0">I</div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Income Approach</h3>
                  <p className="text-xs text-blue-600 font-semibold">Capitalization of Earnings · Discounted Cash Flow (DCF)</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">Values a business based on its ability to generate future economic benefits. The appraiser converts projected earnings or cash flows into present value using risk-adjusted rates. The Build-Up Method constructs the discount/cap rate from market-derived components: Risk-Free Rate + Equity Risk Premium + Size Premium + Industry Risk Premium + Company-Specific Risk Premium (CSRP).</p>
              <p className="text-xs text-slate-400">Two methods: Direct Capitalization (Cap of Earnings — single representative period) and Yield Capitalization (DCF — multi-period projection with terminal value). The choice depends on earnings stability and whether material changes are expected.</p>
            </div>

            <div className="bg-white border border-emerald-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold flex-shrink-0">M</div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Market Approach</h3>
                  <p className="text-xs text-emerald-600 font-semibold">Market Multiple Method · Rule of Thumb</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">Values a business by comparison to similar business enterprises that have sold in arm's-length transactions. The appraiser identifies guideline transactions using industry databases (DealStats, BizBuySell Comps, BizComps), extracts pricing multiples (SDE or EBITDA multiples), and applies them to the subject business's normalized earnings.</p>
              <p className="text-xs text-slate-400">Market Multiple is the primary market method. Rule of Thumb (industry-specific revenue or earnings benchmarks from the Business Reference Guide) serves as a cross-validation check but per NACVA and ASA guidance should never be the sole basis for a value conclusion.</p>
            </div>

            <div className="bg-white border border-amber-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold flex-shrink-0">A</div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Asset Approach</h3>
                  <p className="text-xs text-amber-600 font-semibold">Asset-Based Method (ANAV / Liquidation)</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">Values a business based on the fair market value of its underlying assets (tangible and intangible) minus all liabilities. Assets and liabilities are restated from book value to fair market value. Going Concern (Adjusted Net Asset Value) assumes continued operations; Liquidation assumes orderly or forced sale.</p>
              <p className="text-xs text-slate-400">Most relevant for asset-intensive businesses, startups with limited earnings history, holding companies, and asset-purchase transactions. For startups under 12 months old, the CAIBVS™ methodology assigns 75%+ weighting to the Asset Approach because income-based methods rely on unvalidated projections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Professional Standards */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Related Professional Standards</h2>
        <p className="text-sm text-slate-500 mb-6">USPAP is the primary standard, but several complementary frameworks apply to business valuation practice. MainStreetOS™ reports are designed to satisfy the requirements of all major standards.</p>

        <div className="space-y-3">
          {[
            { name: 'NACVA Professional Standards', org: 'National Association of Certified Valuators and Analysts', desc: 'Combines elements of USPAP and AICPA SSVS with additional guidelines for financial statement adjustments, capitalization and discount rates, and premiums and discounts. Requires that valuation methods be categorized into asset-based, market, income, or a combination. Rules of thumb are acceptable as reasonableness checks but should not be used as a primary method.' },
            { name: 'AICPA SSVS VS Section 100', org: 'American Institute of CPAs — Statement on Standards for Valuation Services', desc: 'Applies when a CPA performs a valuation engagement. Distinguishes between a Conclusion of Value and a Calculated Value. Requires documentation of all significant assumptions including discount rates, capitalization rates, and earnings normalization adjustments. The analyst must explain why specific approaches and methods were selected.' },
            { name: 'ASA Business Valuation Standards', org: 'American Society of Appraisers', desc: 'Requires members to follow USPAP guidelines regardless of the use of the appraisal. ASA has developed additional practice standards and a code of ethics (PAPCE) for business valuation. Defines three levels of service: Appraisal (full opinion), Limited Appraisal (restricted scope), and Calculation (client-specified methods).' },
            { name: 'IRS Revenue Ruling 59-60', org: 'Internal Revenue Service', desc: 'The foundational IRS guidance for valuing closely held businesses for tax purposes. Specifies eight factors that must be considered: (1) nature and history of the business, (2) economic outlook, (3) book value and financial condition, (4) earning capacity, (5) dividend-paying capacity, (6) goodwill and other intangibles, (7) prior sales of the subject, and (8) market price of comparable entities.' },
            { name: 'IRS Revenue Ruling 68-609', org: 'Internal Revenue Service', desc: 'Guidance for the Excess Earnings Method (also called the Treasury Method). Used to calculate goodwill as the excess of income-approach value over the fair return on tangible net assets. The IRS notes this method should be used only when no better basis is available, but it remains widely used for Main Street business valuations where goodwill is a significant component of value.' },
            { name: 'International Valuation Standards (IVS)', org: 'International Valuation Standards Council (IVSC)', desc: 'International standards that aim at the same goals as USPAP. A 2016 "Bridge from USPAP to IVS" document reconciles the two frameworks. MainStreetOS™ Appraisal Report format is designed to satisfy both USPAP and IVS reporting requirements where needed for cross-border transactions.' },
          ].map((std) => (
            <div key={std.name} className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-slate-900">{std.name}</h4>
              <p className="text-xs text-slate-400 mb-2">{std.org}</p>
              <p className="text-xs text-slate-600">{std.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why MainStreetOS Uses USPAP */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Why MainStreetOS™ Is Built on USPAP</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: 'Credibility with buyers and lenders', desc: 'SBA lenders, institutional buyers, and professional advisors expect valuations that follow recognized standards. A USPAP-aligned report commands more respect than a spreadsheet with a number on it.' },
              { title: 'Defensibility in disputes', desc: 'When a listing price is questioned or a transaction faces scrutiny, a valuation developed under USPAP methodology is defensible in court, mediation, or agency review because the process is documented and transparent.' },
              { title: 'Multi-method reconciliation', desc: 'USPAP requires consideration of all three approaches. This prevents the common error of relying on a single method — which can produce a misleading result if the method is inappropriate for the specific business.' },
              { title: 'Transparency of assumptions', desc: 'USPAP requires every significant assumption to be stated and supported. MainStreetOS™ documents all inputs, agent reasoning, and rate components so that any reviewer can trace the logic from input to conclusion.' },
              { title: 'Professional differentiation', desc: 'No competing broker platform (Deal Studio, Tupelo, Vertica) offers USPAP-aligned AI valuations. This is a genuine differentiator that positions MainStreetOS™ brokers as professionals who follow established standards.' },
              { title: 'Client confidence', desc: 'Business owners trust valuations more when they are told the methodology follows nationally recognized standards — not a proprietary "black box" formula. USPAP alignment builds trust before the engagement begins.' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-slate-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Link to Methods */}
      <section className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Explore Each Valuation Method</h2>
        <p className="text-sm text-slate-500 mb-6">See how MainStreetOS™ applies USPAP-aligned methodology in each of its five valuation methods:</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="/methods/market-multiple" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition font-medium">📈 Market Multiple</a>
          <a href="/methods/capitalization-of-earnings" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition font-medium">🏦 Cap of Earnings</a>
          <a href="/methods/discounted-cash-flow" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition font-medium">💰 DCF</a>
          <a href="/methods/asset-based" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition font-medium">🏗️ Asset-Based</a>
          <a href="/methods/rule-of-thumb" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition font-medium">📏 Rule of Thumb</a>
        </div>
      </section>

      <section className="bg-slate-900 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">USPAP-Aligned Valuations in Under 30 Minutes</h2>
          <p className="text-slate-400 mb-6">Five methods, three approaches, full reconciliation — with professional reporting that satisfies Standards 9 and 10. Try it free.</p>
          <a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
