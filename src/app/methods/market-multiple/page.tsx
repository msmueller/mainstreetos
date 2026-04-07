'use client'

function Nav() {
  return (
    <nav className="border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="hover:opacity-80 transition"><span className="text-2xl font-bold text-slate-900">MainStreet</span><span className="text-2xl font-bold text-blue-600">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span></a>
        <div className="flex items-center gap-4">
          <a href="/methods" className="text-sm text-slate-600 hover:text-slate-900 transition">All Methods</a>
          <a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Get Started Free</a>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (<footer className="border-t border-slate-100 py-6"><div className="max-w-6xl mx-auto px-6 text-center"><p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved</p></div></footer>)
}

export default function MarketMultiplePage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
        <a href="/methods" className="text-xs text-blue-600 hover:underline">← All Valuation Methods</a>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-4xl">📈</span>
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Market Approach</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Market Multiple Method</h1>
          </div>
        </div>
        <p className="text-lg text-slate-500 mt-4 leading-relaxed">
          The market multiple method estimates business value by applying pricing multiples derived from comparable business transactions to the subject company's normalized earnings. It answers the question: <em>"What are similar businesses actually selling for?"</em>
        </p>
      </section>

      {/* USPAP Context Banner */}
      <section className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚖️</span>
            <div>
              <h3 className="text-sm font-bold text-emerald-800">USPAP Classification: Market Approach</h3>
              <p className="text-xs text-emerald-600 mt-1">Under USPAP Standard 9, the Market Approach values a business by comparison to guideline transactions of similar business enterprises. The appraiser must research sufficient comparable data from recognized transaction databases (DealStats, BizBuySell Comps, BizComps) and explain the basis for selecting specific multiples. Per the ASA Business Valuation Standards, the market approach provides the most direct indication of value when reliable comparable data exists, as it reflects actual buyer behavior in arm&apos;s-length transactions.</p>
              <p className="text-xs text-emerald-500 mt-2">Standards references: USPAP Standard 9, IRS Revenue Ruling 59-60 (Factors 1-8), NACVA Professional Standards Sec. .31–.41, IBBA Market Data Standards</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
              <div>
                <h4 className="font-bold text-slate-900">Normalize the Earnings</h4>
                <p className="text-sm text-slate-500 mt-1">Calculate the business's Seller's Discretionary Earnings (SDE) for businesses under approximately $1M in earnings, or EBITDA for larger businesses. Add back owner compensation, benefits, depreciation, interest, non-recurring expenses, and above-market rent to reveal the true economic benefit to a buyer.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
              <div>
                <h4 className="font-bold text-slate-900">Select Comparable Transactions</h4>
                <p className="text-sm text-slate-500 mt-1">Identify completed transactions of similar businesses using industry databases (DealStats, BizBuySell Comps, BizComps). Match by NAICS industry code, business size, geography, and business model. The more comparable the guideline transactions, the more reliable the multiple.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
              <div>
                <h4 className="font-bold text-slate-900">Derive the Multiple</h4>
                <p className="text-sm text-slate-500 mt-1">Calculate the median and quartile multiples from the comparable set. Typical SDE multiples for Main Street businesses range from 1.5x to 3.0x. EBITDA multiples for mid-market businesses range from 3x to 6x, with larger and more profitable businesses commanding higher multiples.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
              <div>
                <h4 className="font-bold text-slate-900">Apply Multiple to Earnings</h4>
                <p className="text-sm text-slate-500 mt-1">Multiply the normalized SDE or EBITDA by the selected multiple to determine indicated value. For example: $400,000 SDE × 2.10x multiple = $840,000 indicated value.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Formula */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">The Formula</h2>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <p className="text-2xl font-bold text-emerald-900">Business Value = Normalized Earnings × Market Multiple</p>
          <p className="text-sm text-emerald-600 mt-3">Where Normalized Earnings = SDE (for owner-operated businesses) or EBITDA (for professionally managed businesses)</p>
        </div>
      </section>

      {/* SDE vs EBITDA */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">SDE vs. EBITDA: Which Metric to Use</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="font-bold text-slate-900 mb-2">SDE (Seller's Discretionary Earnings)</h4>
            <p className="text-sm text-slate-500 mb-3">Best for owner-operated Main Street businesses where the owner's role is central to operations. Adds back full owner compensation, benefits, and perquisites to EBITDA.</p>
            <p className="text-xs text-slate-400"><strong>Typical range:</strong> 1.5x – 3.0x SDE</p>
            <p className="text-xs text-slate-400"><strong>Business size:</strong> Under ~$1M SDE / ~$5M revenue</p>
            <p className="text-xs text-slate-400"><strong>Buyer type:</strong> Owner-operator</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="font-bold text-slate-900 mb-2">EBITDA (Earnings Before Interest, Taxes, D&A)</h4>
            <p className="text-sm text-slate-500 mb-3">Best for professionally managed mid-market businesses with salaried management. Assumes the owner's role will be filled by a paid manager at market salary.</p>
            <p className="text-xs text-slate-400"><strong>Typical range:</strong> 3x – 6x EBITDA (mid-market)</p>
            <p className="text-xs text-slate-400"><strong>Business size:</strong> Over ~$2M EBITDA</p>
            <p className="text-xs text-slate-400"><strong>Buyer type:</strong> Financial/strategic acquirer</p>
          </div>
        </div>
      </section>

      {/* Key Factors */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Factors That Influence the Multiple</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { factor: 'Industry', desc: 'Single largest determinant. Tech/SaaS commands higher multiples; restaurants and retail lower.' },
              { factor: 'Business Size', desc: 'Larger businesses earn higher multiples due to reduced risk and broader buyer pool.' },
              { factor: 'Growth Trajectory', desc: 'Consistent revenue growth signals future earnings potential and increases the multiple.' },
              { factor: 'Customer Concentration', desc: 'Diversified customer base reduces risk. Heavy reliance on few customers compresses multiples.' },
              { factor: 'Owner Dependence', desc: 'Businesses that run without the owner command premium multiples over owner-dependent ones.' },
              { factor: 'Recurring Revenue', desc: 'Subscription or contractual revenue is more predictable and earns higher multiples.' },
              { factor: 'Profit Margins', desc: 'Higher margins indicate operational efficiency and pricing power, supporting higher multiples.' },
              { factor: 'Market Conditions', desc: 'Buyer demand, interest rates, and lending environment all influence current multiple ranges.' },
              { factor: 'Quality of Records', desc: 'Clean, audited financials increase buyer confidence and support premium pricing.' },
            ].map((f) => (
              <div key={f.factor} className="bg-white border border-slate-200 rounded-lg p-3">
                <h5 className="text-sm font-bold text-slate-800">{f.factor}</h5>
                <p className="text-xs text-slate-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How MainStreetOS Uses It */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How MainStreetOS™ Applies This Method</h2>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <p className="text-sm text-slate-300 mb-4">Agent 3 executes the Market Multiple method by:</p>
          <ul className="space-y-2">
            {[
              'Reading your normalized SDE or EBITDA from Agent 2 output',
              'Querying Open Brain for comparable transaction data from your past deals and industry benchmarks',
              'Selecting the appropriate earnings metric (SDE vs. EBITDA) based on business size and type',
              'Applying industry-specific multiple ranges from established databases',
              'Adjusting the multiple based on your broker-scored risk factors (15-factor CSRP)',
              'Producing an indicated value with the selected multiple and earnings figure',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>{item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Professional Standards Requirements */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Professional Standards Requirements</h2>
        <div className="space-y-3">
          {[
            { std: 'USPAP Standard 9', req: 'The appraiser must analyze sufficient comparable data, explain the basis for selecting specific pricing multiples, and reconcile the market indication with other approaches used. If the market approach is given primary weight, the appraiser must support this decision.' },
            { std: 'IRS Revenue Ruling 59-60', req: 'For tax-related valuations, eight factors must be considered including the nature of the business, financial condition, earning capacity, dividend-paying capacity, goodwill, prior sales of the business, market price of comparable entities, and the economic outlook of the industry.' },
            { std: 'NACVA Standards', req: 'Valuation methods are categorized into asset-based, market, income, or a combination. Professional judgment is used to select appropriate approaches. Rules of thumb are acceptable as reasonableness checks but should not be used as a primary method.' },
            { std: 'SBA SOP 50 10 7.1', req: 'For SBA 7(a) loan valuations, the business valuation must be performed by a qualified source. Market multiples from recognized databases are the primary lending test for Main Street transactions.' },
          ].map((s) => (
            <div key={s.std} className="bg-white border border-slate-200 rounded-lg p-4">
              <h5 className="text-sm font-bold text-slate-800">{s.std}</h5>
              <p className="text-xs text-slate-500 mt-1">{s.req}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Strengths & Limitations */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Strengths & Limitations</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-green-100 bg-green-50/50 rounded-xl p-5">
            <h4 className="font-bold text-green-800 mb-2">Strengths</h4>
            <ul className="space-y-1">
              {['Market-based — reflects actual buyer behavior', 'Easy to understand for clients and lenders', 'SBA lenders use multiples as primary lending test', 'Widely accepted in Main Street and mid-market M&A', 'Can be verified against public transaction databases'].map((s, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2"><span className="flex-shrink-0">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="border border-red-100 bg-red-50/50 rounded-xl p-5">
            <h4 className="font-bold text-red-800 mb-2">Limitations</h4>
            <ul className="space-y-1">
              {['Requires sufficient comparable transactions', 'Industry multiples may not account for unique business factors', 'Stale data if transaction databases are not current', 'Using SDE multiples on EBITDA businesses (or vice versa) produces inaccurate results', 'Does not directly account for growth or risk'].map((s, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="flex-shrink-0">✗</span>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Navigate to other methods */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Other Methods</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/methods/capitalization-of-earnings" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">🏦 Cap of Earnings</a>
          <a href="/methods/discounted-cash-flow" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">💰 DCF</a>
          <a href="/methods/asset-based" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">🏗️ Asset-Based</a>
          <a href="/methods/rule-of-thumb" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">📏 Rule of Thumb</a>
        </div>
      </section>

      <section className="bg-slate-900 py-12"><div className="max-w-3xl mx-auto px-6 text-center"><h2 className="text-2xl font-bold text-white mb-3">Run a Market Multiple Valuation</h2><p className="text-slate-400 mb-6">MainStreetOS™ applies this method alongside four others for a complete, defensible valuation.</p><a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a></div></section>
      <Footer />
    </div>
  )
}
