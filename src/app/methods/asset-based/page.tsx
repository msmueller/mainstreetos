'use client'

function Nav() { return (<nav className="border-b border-slate-100"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><a href="/" className="hover:opacity-80 transition"><span className="text-2xl font-bold text-slate-900">MainStreet</span><span className="text-2xl font-bold text-blue-600">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span></a><div className="flex items-center gap-4"><a href="/methods" className="text-sm text-slate-600 hover:text-slate-900 transition">All Methods</a><a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Get Started Free</a></div></div></nav>) }
function Footer() { return (<footer className="border-t border-slate-100 py-6"><div className="max-w-6xl mx-auto px-6 text-center"><p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved</p></div></footer>) }

export default function AssetBasedPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
        <a href="/methods" className="text-xs text-blue-600 hover:underline">← All Valuation Methods</a>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-4xl">🏗️</span>
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Asset Approach</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Asset-Based Method</h1>
          </div>
        </div>
        <p className="text-lg text-slate-500 mt-4 leading-relaxed">
          The Asset-Based method determines business value by appraising the fair market value of all business assets (tangible and intangible) and subtracting all liabilities. It answers: <em>"What is the business worth based on what it owns?"</em> This approach is most relevant for asset-intensive businesses, startups with limited earnings history, and asset-purchase transactions.
        </p>
      </section>

      {/* USPAP Context Banner */}
      <section className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚖️</span>
            <div>
              <h3 className="text-sm font-bold text-amber-800">USPAP Classification: Asset Approach</h3>
              <p className="text-xs text-amber-600 mt-1">Under USPAP Standard 9, the Asset Approach determines business value by appraising the fair market value of all business assets (tangible and intangible) and subtracting liabilities. USPAP requires that the appraiser identify and value each significant asset category, explain the basis for restating book values to fair market value, and disclose any assets or liabilities that could not be independently appraised. The Asset Approach may also be appropriate for operating service-based companies with marginal earnings or operating losses.</p>
              <p className="text-xs text-amber-500 mt-2">Standards references: USPAP Standard 9, ASA Asset Approach Standards, NACVA ANAV Guidelines, Excess Earnings Method (Revenue Ruling 68-609)</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Two Variations</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="font-bold text-slate-900 mb-2">Going-Concern (ANAV)</h4>
            <p className="text-sm text-slate-500 mb-3">Adjusted Net Asset Value — assumes the business will continue operating. Assets and liabilities are restated to fair market value. Includes tangible assets, intangible assets (goodwill, customer lists, brand value, proprietary processes), and all liabilities at current value.</p>
            <p className="text-xs text-slate-400"><strong>Use when:</strong> Business is ongoing, buyer intends to operate it</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="font-bold text-slate-900 mb-2">Liquidation Value</h4>
            <p className="text-sm text-slate-500 mb-3">Determines the total amount a business would receive if every asset were sold off individually and all liabilities were settled. Typically produces the lowest value because assets sell at distressed or wholesale prices, not going-concern prices.</p>
            <p className="text-xs text-slate-400"><strong>Use when:</strong> Business is closing or being dissolved</p>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works (Going-Concern ANAV)</h2>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
          {[
            { n: '1', t: 'Identify All Tangible Assets', d: 'Inventory all tangible business assets: equipment, furniture, fixtures, vehicles, inventory, real estate, leasehold improvements, cash, accounts receivable. Restate each asset at fair market value (not book value), accounting for depreciation, condition, and current market prices.' },
            { n: '2', t: 'Identify Intangible Assets', d: 'Appraise intangible assets: goodwill, brand/trade name value, customer lists and relationships, proprietary processes or recipes, non-compete agreements, assembled workforce value, franchise rights, licenses, and patents. For many Main Street businesses, goodwill is the largest component of value.' },
            { n: '3', t: 'Identify All Liabilities', d: 'List all current and long-term liabilities at their settlement value: accounts payable, accrued expenses, loans, lease obligations, deferred revenue, tax liabilities, and any contingent liabilities.' },
            { n: '4', t: 'Calculate Net Asset Value', d: 'Adjusted Net Asset Value = (Fair Market Value of Tangible Assets + Fair Market Value of Intangible Assets) − Total Liabilities at Settlement Value. This represents the equity value of the business.' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{s.n}</div>
              <div><h4 className="font-bold text-slate-900">{s.t}</h4><p className="text-sm text-slate-500 mt-1">{s.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">The Formula</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-2xl font-bold text-amber-900">Business Value = (Tangible Assets + Intangible Assets) − Liabilities</p>
          <p className="text-sm text-amber-600 mt-3">All assets and liabilities at fair market value, not book value</p>
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Typical Asset Categories</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-bold text-slate-900 mb-3">Tangible Assets</h4>
              <ul className="space-y-1">
                {['Equipment, machinery, and tools', 'Furniture, fixtures, and signage', 'Vehicles and rolling stock', 'Inventory (raw materials, WIP, finished goods)', 'Real estate and leasehold improvements', 'Cash and accounts receivable', 'Prepaid expenses and deposits'].map((a, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2"><span className="text-amber-500 flex-shrink-0">•</span>{a}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-bold text-slate-900 mb-3">Intangible Assets</h4>
              <ul className="space-y-1">
                {['Goodwill (often the largest component)', 'Customer lists and relationships', 'Brand value and trade name', 'Proprietary processes, recipes, or formulas', 'Franchise rights and licenses', 'Non-compete and non-solicitation agreements', 'Assembled/trained workforce value', 'Patents, trademarks, and copyrights'].map((a, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2"><span className="text-purple-500 flex-shrink-0">•</span>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">When to Rely on This Method</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-green-100 bg-green-50/50 rounded-xl p-5">
            <h4 className="font-bold text-green-800 mb-2">Best When</h4>
            <ul className="space-y-1">
              {['Startup businesses with less than 12 months of operating history', 'Asset-intensive businesses (manufacturing, distribution, construction)', 'Transaction structured as an asset purchase', 'Business with marginal or negative earnings', 'Holding companies or investment entities', 'Franchise operations where assets dominate initial value'].map((s, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2"><span className="flex-shrink-0">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="border border-red-100 bg-red-50/50 rounded-xl p-5">
            <h4 className="font-bold text-red-800 mb-2">Less Reliable When</h4>
            <ul className="space-y-1">
              {['Service businesses where value is primarily in earnings capacity', 'Business value significantly exceeds asset base (high goodwill)', 'Difficult to appraise intangible assets independently', 'Book value diverges significantly from fair market value', 'Operating business where income approach better captures value'].map((s, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="flex-shrink-0">✗</span>{s}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-4">
          <h4 className="text-sm font-bold text-blue-800">CAIBVS™ Methodology Note</h4>
          <p className="text-xs text-blue-600 mt-1">For startup businesses with less than 12 months of operating history, the Asset-Based Approach should be the dominant valuation method (75%+ weighting) because income-based methods rely on unvalidated projections. The Adjusted Net Asset Value anchors the valuation to tangible and intangible assets that actually exist, rather than speculative cash flows. This is especially important when the transaction is structured as an Asset Purchase.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How MainStreetOS™ Applies This Method</h2>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <p className="text-sm text-slate-300 mb-4">Agent 3 executes the Asset-Based method by:</p>
          <ul className="space-y-2">
            {['Reading the asset and liability data entered on the valuation record', 'Adjusting book values to fair market value using industry-standard depreciation and replacement cost approaches', 'Estimating goodwill as the excess of income-approach value over tangible net assets (excess earnings method)', 'Querying Open Brain for comparable asset values from past deals in similar industries', 'Producing both going-concern (ANAV) and liquidation value indications', 'Flagging when asset-based should receive dominant weighting (startups, asset purchases)'].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-200"><span className="text-amber-400 flex-shrink-0 mt-0.5">✓</span>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Professional Standards Requirements */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Professional Standards Requirements</h2>
        <div className="space-y-3">
          {[
            { std: 'USPAP Standard 9', req: 'The appraiser must identify and value each significant asset category at fair market value, not book value. The basis for restatement must be explained (replacement cost, comparable sales, income attribution). Non-operating assets must be identified and valued separately. Goodwill must be supported by a recognized method such as the Excess Earnings approach.' },
            { std: 'IRS Revenue Ruling 68-609', req: 'The foundational guidance for the Excess Earnings Method (also called the Treasury Method or Formula Method). Goodwill is calculated as the excess of income-approach value over the fair return on tangible net assets. While the IRS notes this method should be used only when there is no better basis available, it remains widely used for Main Street business valuations.' },
            { std: 'NACVA Standards', req: 'The asset-based approach should be considered for every engagement per USPAP. It is most appropriate when: (1) the company is asset-intensive, (2) the company is a startup with limited earnings history, (3) the transaction is structured as an asset purchase, or (4) the company has marginal or negative earnings.' },
            { std: 'CAIBVS™ Methodology (CSRP Scoring)', req: 'For startup businesses with less than 12 months of operating history, the Asset-Based Approach should receive dominant weighting (75%+) because income-based methods rely on unvalidated projections. Compare franchisor pro forma projections against FDD Item 19 actual franchise system performance — significant gaps between projected and actual performance are a major red flag.' },
          ].map((s) => (
            <div key={s.std} className="bg-white border border-slate-200 rounded-lg p-4">
              <h5 className="text-sm font-bold text-slate-800">{s.std}</h5>
              <p className="text-xs text-slate-500 mt-1">{s.req}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Other Methods</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/methods/market-multiple" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">📈 Market Multiple</a>
          <a href="/methods/capitalization-of-earnings" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">🏦 Cap of Earnings</a>
          <a href="/methods/discounted-cash-flow" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">💰 DCF</a>
          <a href="/methods/rule-of-thumb" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">📏 Rule of Thumb</a>
        </div>
      </section>

      <section className="bg-slate-900 py-12"><div className="max-w-3xl mx-auto px-6 text-center"><h2 className="text-2xl font-bold text-white mb-3">Run an Asset-Based Valuation</h2><p className="text-slate-400 mb-6">MainStreetOS™ includes asset-based analysis alongside four other methods — with automatic weighting for startups and asset purchases.</p><a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a></div></section>
      <Footer />
    </div>
  )
}
