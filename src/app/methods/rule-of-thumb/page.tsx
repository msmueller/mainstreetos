'use client'

function Nav() { return (<nav className="border-b border-slate-100"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><a href="/" className="hover:opacity-80 transition"><span className="text-2xl font-bold text-slate-900">MainStreet</span><span className="text-2xl font-bold text-blue-600">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span></a><div className="flex items-center gap-4"><a href="/methods" className="text-sm text-slate-600 hover:text-slate-900 transition">All Methods</a><a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Get Started Free</a></div></div></nav>) }
function Footer() { return (<footer className="border-t border-slate-100 py-6"><div className="max-w-6xl mx-auto px-6 text-center"><p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved</p></div></footer>) }

export default function RuleOfThumbPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
        <a href="/methods" className="text-xs text-blue-600 hover:underline">← All Valuation Methods</a>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-4xl">📏</span>
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Market Approach</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Rule of Thumb</h1>
          </div>
        </div>
        <p className="text-lg text-slate-500 mt-4 leading-relaxed">
          Rules of thumb are industry-specific pricing benchmarks expressed as a percentage of annual revenue or a multiple of SDE/EBITDA. Developed from decades of actual transactions within specific industries, they provide a quick, intuitive sanity check on value. They should <em>never be used as the sole valuation method</em> — but they're valuable as a cross-validation tool alongside more rigorous approaches.
        </p>
      </section>

      {/* USPAP Context Banner */}
      <section className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚖️</span>
            <div>
              <h3 className="text-sm font-bold text-emerald-800">USPAP Classification: Market Approach — Industry Benchmarks</h3>
              <p className="text-xs text-emerald-600 mt-1">Rules of thumb fall under the Market Approach as they are derived from observed transaction patterns within specific industries. However, USPAP, ASA, NACVA, and IBBA all caution that rules of thumb are simplistic — they fail to differentiate operating characteristics or assets from one company to another. Under NACVA Professional Standards, rules of thumb are acceptable as reasonableness checks but should not be used as a primary valuation method. MainStreetOS™ uses rules of thumb strictly as a cross-validation indicator with reduced confidence weighting in the final reconciliation.</p>
              <p className="text-xs text-emerald-500 mt-2">Standards references: USPAP Standard 9, NACVA Professional Standards Sec. .31–.41, IBBA/Business Reference Guide, ASA FAQ on Rules of Thumb</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
          {[
            { n: '1', t: 'Identify the Industry Rule', d: 'Look up the industry-specific rule of thumb from established sources like the Business Reference Guide (BRG), DealStats, or IBBA industry publications. Rules are typically expressed as: a percentage of annual revenue (e.g., restaurants = 25%–40% of annual revenue), a multiple of SDE (e.g., landscaping = 1.5–2.5× SDE), or a multiple of EBITDA.' },
            { n: '2', t: 'Determine the Base Metric', d: "For revenue-based rules, use total annual sales (net of sales tax). For SDE-based rules, use normalized Seller's Discretionary Earnings. The annual sales figure is \"provable\" from tax returns — one advantage of revenue-based rules is less room for dispute." },
            { n: '3', t: 'Apply the Rule', d: 'Multiply the annual revenue or earnings by the rule of thumb percentage or multiple. For example: a restaurant doing $800,000 annual revenue with a rule of thumb of 30%–35% of revenue = $240,000–$280,000 indicated value. An inventory adjustment is often added separately.' },
            { n: '4', t: 'Cross-Validate', d: 'Compare the rule-of-thumb indication against the Market Multiple, Cap of Earnings, and DCF conclusions. Large discrepancies warrant investigation — either the rule of thumb is outdated for this specific business, or the other methods have an assumption that needs review.' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{s.n}</div>
              <div><h4 className="font-bold text-slate-900">{s.t}</h4><p className="text-sm text-slate-500 mt-1">{s.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">The Formula</h2>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <div className="space-y-3">
            <div>
              <p className="text-xl font-bold text-emerald-900">Revenue-Based: Value = Annual Revenue × Industry %</p>
              <p className="text-sm text-emerald-600">e.g., $800K revenue × 30% = $240K</p>
            </div>
            <div className="border-t border-emerald-200 pt-3">
              <p className="text-xl font-bold text-emerald-900">Earnings-Based: Value = SDE × Industry Multiple</p>
              <p className="text-sm text-emerald-600">e.g., $150K SDE × 2.0x = $300K</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Example Industry Rules of Thumb</h2>
          <p className="text-sm text-slate-500 mb-4">These are general ranges from industry sources. Actual pricing depends on specific business characteristics. Consult the Business Reference Guide and comparable transaction databases for current data.</p>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-900 text-white text-xs font-bold">
              <div className="p-3">Industry</div>
              <div className="p-3 text-center">Revenue Multiple</div>
              <div className="p-3 text-center">SDE Multiple</div>
            </div>
            {[
              { ind: 'Restaurants (Full Service)', rev: '25%–40%', sde: '1.5–2.5×' },
              { ind: 'Landscaping / Lawn Care', rev: '40%–50%', sde: '1.5–2.5×' },
              { ind: 'Auto Repair / Service', rev: '40%–55%', sde: '1.8–2.5×' },
              { ind: 'Dry Cleaners', rev: '70%–100%', sde: '2.0–3.0×' },
              { ind: 'Plumbing / HVAC', rev: '40%–60%', sde: '1.5–2.5×' },
              { ind: 'Convenience Stores', rev: '10%–20%', sde: '1.5–3.0×' },
              { ind: 'Day Care Centers', rev: '40%–60%', sde: '2.0–3.0×' },
              { ind: 'Dental Practices', rev: '60%–80%', sde: '1.5–2.5×' },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}>
                <div className="p-3 text-slate-700 font-medium">{row.ind}</div>
                <div className="p-3 text-center text-slate-600">{row.rev}</div>
                <div className="p-3 text-center text-slate-600">{row.sde}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Source: General industry ranges. Actual rules of thumb vary by source, region, and market conditions. Always verify against current transaction data.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Important Caveats</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h4 className="text-sm font-bold text-amber-800">From the ASA (American Society of Appraisers):</h4>
          <p className="text-sm text-amber-600 mt-2">Rules of thumb are usually quite simplistic. While they can provide a useful cross-check, they should not be the primary basis for a business valuation. Rules of thumb are based on just two figures — a revenue or earnings metric and a percentage or multiple — and do not account for the unique characteristics of any individual business. They should always be used in conjunction with more rigorous valuation methods that consider the specific financial performance, risk profile, and competitive position of the subject business.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">When to Rely on This Method</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-green-100 bg-green-50/50 rounded-xl p-5">
            <h4 className="font-bold text-green-800 mb-2">Useful When</h4>
            <ul className="space-y-1">
              {['Quick sanity check against other method results', 'Initial screening before full valuation engagement', 'Explaining value to sellers who "heard" what businesses in their industry sell for', 'Industries where rules of thumb are well-established with deep transaction data', 'Confirming that more rigorous methods are in a reasonable range'].map((s, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2"><span className="flex-shrink-0">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="border border-red-100 bg-red-50/50 rounded-xl p-5">
            <h4 className="font-bold text-red-800 mb-2">Dangerous When</h4>
            <ul className="space-y-1">
              {['Used as the sole basis for pricing a listing', 'Applied without checking comparability to the specific business', 'Source data is outdated or from a different region', 'Business has unique characteristics not captured by the rule', 'Confused with actual market multiples from transaction databases'].map((s, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="flex-shrink-0">✗</span>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How MainStreetOS™ Applies This Method</h2>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <p className="text-sm text-slate-300 mb-4">Agent 3 executes the Rule of Thumb method by:</p>
          <ul className="space-y-2">
            {['Identifying the business\'s NAICS industry classification', 'Looking up industry-specific revenue and SDE/EBITDA rules of thumb from established databases', 'Querying Open Brain for rule-of-thumb data from your past deals in similar industries', 'Applying both revenue-based and earnings-based rules where available', 'Flagging the result as a "cross-validation" indicator with lower confidence weighting', 'Noting discrepancies between rule-of-thumb and other method conclusions in the synthesis'].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-200"><span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Professional Standards Requirements */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Professional Standards Requirements</h2>
        <div className="space-y-3">
          {[
            { std: 'ASA (American Society of Appraisers)', req: 'Rules of thumb are usually quite simplistic. They fail to differentiate either operating characteristics or assets from one company to another. While they can provide a useful cross-check, they should not be the primary basis for a business valuation.' },
            { std: 'NACVA Professional Standards', req: 'Rules of thumb are acceptable as reasonableness checks but should not be used as a primary valuation method. Valuation methods are categorized into asset-based, market, income, or a combination of approaches. Professional judgment is required to select appropriate methods.' },
            { std: 'USPAP Standard 10 — Reporting', req: 'If a rule of thumb is included in the valuation report, the appraiser must disclose the source, explain its basis, and clearly indicate the weight (if any) given to this indication in the final reconciliation. Reliance on a rule of thumb as the sole basis for a value conclusion would not produce a credible result under USPAP.' },
            { std: 'Business Reference Guide (BRG)', req: 'The primary source for industry-specific rules of thumb, published annually with data from thousands of transactions. Rules are arranged by industry and express value as a percentage of revenue and/or a multiple of SDE. The BRG cautions that rules should be used alongside, not instead of, formal valuation methods.' },
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
          <a href="/methods/asset-based" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">🏗️ Asset-Based</a>
        </div>
      </section>

      <section className="bg-slate-900 py-12"><div className="max-w-3xl mx-auto px-6 text-center"><h2 className="text-2xl font-bold text-white mb-3">See All Five Methods Together</h2><p className="text-slate-400 mb-6">MainStreetOS™ uses Rule of Thumb as a cross-validation alongside four rigorous valuation methods for a complete, defensible analysis.</p><a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a></div></section>
      <Footer />
    </div>
  )
}
