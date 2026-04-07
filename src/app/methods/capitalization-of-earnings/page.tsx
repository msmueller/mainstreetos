'use client'

function Nav() { return (<nav className="border-b border-slate-100"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><a href="/" className="hover:opacity-80 transition"><span className="text-2xl font-bold text-slate-900">MainStreet</span><span className="text-2xl font-bold text-blue-600">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span></a><div className="flex items-center gap-4"><a href="/methods" className="text-sm text-slate-600 hover:text-slate-900 transition">All Methods</a><a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Get Started Free</a></div></div></nav>) }
function Footer() { return (<footer className="border-t border-slate-100 py-6"><div className="max-w-6xl mx-auto px-6 text-center"><p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved</p></div></footer>) }

export default function CapOfEarningsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
        <a href="/methods" className="text-xs text-blue-600 hover:underline">← All Valuation Methods</a>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-4xl">🏦</span>
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Income Approach</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Capitalization of Earnings</h1>
          </div>
        </div>
        <p className="text-lg text-slate-500 mt-4 leading-relaxed">
          The Capitalization of Earnings method converts a single period of normalized earnings into an indication of value by dividing by a risk-adjusted capitalization rate. It's the most straightforward income approach — best suited for businesses with <em>stable, predictable earnings</em> that are expected to continue indefinitely.
        </p>
      </section>

      {/* USPAP Context Banner */}
      <section className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚖️</span>
            <div>
              <h3 className="text-sm font-bold text-blue-800">USPAP Classification: Income Approach — Direct Capitalization</h3>
              <p className="text-xs text-blue-600 mt-1">Under USPAP Standard 9, the Income Approach values a business based on anticipated economic benefits. The Capitalization of Earnings method is a direct capitalization technique that converts a single period of representative earnings into an indication of value. Per NACVA and IBA standards, the cap rate must be built from market-derived components — not arbitrarily assigned — and the appraiser must explain the basis for each component of the build-up. USPAP requires that capitalization rates and projections be based on reasonable and appropriate evidence.</p>
              <p className="text-xs text-blue-500 mt-2">Standards references: USPAP Standard 9, Ibbotson/Duff &amp; Phelps Build-Up Method, NACVA Professional Standards, Kroll Cost of Capital Navigator</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
          {[
            { n: '1', t: 'Determine Normalized Earnings', d: 'Calculate the business\'s sustainable, normalized earnings — typically SDE for Main Street or EBITDA for mid-market. Apply multi-year weighted averages to smooth cyclical variations. Remove one-time, non-recurring items.' },
            { n: '2', t: 'Build the Capitalization Rate', d: 'The cap rate represents the required rate of return an investor demands. For small businesses, it\'s built up from: Risk-Free Rate (20-year Treasury yield) + Equity Risk Premium + Size Premium + Industry Risk Premium + Company-Specific Risk Premium (CSRP). For Main Street businesses, total cap rates typically range from 20% to 33%.' },
            { n: '3', t: 'Adjust for Growth (if applicable)', d: 'If the business has a sustainable long-term growth expectation, subtract the growth rate from the discount rate to derive the cap rate. Cap Rate = Discount Rate − Long-Term Growth Rate. For no-growth businesses, the cap rate equals the discount rate.' },
            { n: '4', t: 'Divide Earnings by Cap Rate', d: 'Indicated Value = Normalized Earnings ÷ Capitalization Rate. For example: $200,000 SDE ÷ 25% cap rate = $800,000 indicated value. The lower the cap rate (lower risk), the higher the value.' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{s.n}</div>
              <div><h4 className="font-bold text-slate-900">{s.t}</h4><p className="text-sm text-slate-500 mt-1">{s.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">The Formula</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-2xl font-bold text-blue-900">Business Value = Normalized Earnings ÷ Capitalization Rate</p>
          <p className="text-sm text-blue-600 mt-3">Where Cap Rate = Discount Rate − Sustainable Growth Rate</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">The Build-Up Method for Cap Rate</h2>
        <p className="text-sm text-slate-500 mb-4">MainStreetOS™ builds the discount rate (and subsequently the cap rate) using the Build-Up Method, which is standard practice under USPAP and NACVA guidelines for privately held businesses:</p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 bg-slate-900 text-white text-xs font-bold">
            <div className="p-3">Component</div>
            <div className="p-3 text-right">Example Rate</div>
          </div>
          {[
            { c: 'Risk-Free Rate (20-Year US Treasury)', r: '4.3%' },
            { c: 'Equity Risk Premium', r: '4.6%' },
            { c: 'Size Premium (small private business)', r: '10.5%' },
            { c: 'Industry Risk Premium', r: '5.0%' },
            { c: 'Company-Specific Risk Premium (CSRP)', r: '7.0%' },
            { c: 'Total Discount Rate', r: '31.4%' },
            { c: 'Less: Long-Term Sustainable Growth Rate', r: '−3.0%' },
            { c: 'Capitalization Rate', r: '28.4%' },
          ].map((row, i) => (
            <div key={i} className={`grid grid-cols-2 text-sm ${i >= 5 ? 'font-bold' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}>
              <div className="p-3 text-slate-700">{row.c}</div>
              <div className="p-3 text-right text-slate-900">{row.r}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">The CSRP is where broker judgment matters most. MainStreetOS™ uses a 15-factor weighted scoring system across Business & Industry, Financial, and Operational risk categories.</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">When to Rely on This Method</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-green-100 bg-green-50/50 rounded-xl p-5">
            <h4 className="font-bold text-green-800 mb-2">Best When</h4>
            <ul className="space-y-1">
              {['Stable, predictable earnings over 3+ years', 'Mature business in an established industry', 'No significant expected changes in earnings trajectory', 'Business expected to operate indefinitely', 'Single-period earnings representative of future performance'].map((s, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2"><span className="flex-shrink-0">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="border border-red-100 bg-red-50/50 rounded-xl p-5">
            <h4 className="font-bold text-red-800 mb-2">Less Reliable When</h4>
            <ul className="space-y-1">
              {['Volatile or cyclical earnings history', 'Startup or turnaround businesses', 'Rapid growth or decline expected', 'Major planned capital expenditures ahead', 'Earnings driven by non-recurring factors'].map((s, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="flex-shrink-0">✗</span>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How MainStreetOS™ Applies This Method</h2>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <p className="text-sm text-slate-300 mb-4">Agent 3 executes Cap of Earnings by:</p>
          <ul className="space-y-2">
            {['Reading normalized SDE/EBITDA from Agent 2', 'Building the discount rate using the Build-Up Method with your broker-entered risk factor scores', 'Converting the discount rate to a cap rate by subtracting the sustainable growth rate', 'Dividing normalized earnings by the cap rate to produce indicated value', 'Querying Open Brain for historical cap rates from your past valuations for sanity checking'].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-200"><span className="text-blue-400 flex-shrink-0 mt-0.5">✓</span>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Professional Standards Requirements */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Professional Standards Requirements</h2>
        <div className="space-y-3">
          {[
            { std: 'USPAP Standard 9', req: 'Capitalization rates must be based on reasonable and appropriate evidence. The appraiser must weigh historical information and trends, current market factors, and reasonably anticipated events. The selection of the earnings period (single year vs. weighted average) must be explained and supported.' },
            { std: 'Build-Up Method (Duff & Phelps / Kroll)', req: 'The industry-standard method for constructing discount and capitalization rates for privately held businesses. Components include the risk-free rate, equity risk premium, size premium, industry risk premium, and company-specific risk premium (CSRP). All components must be sourced from recognized market data.' },
            { std: 'NACVA Standards', req: 'The capitalizer/divisor and the investor must be defined in terms of the same measure of investment return. A pre-tax capitalization rate must be applied to pre-tax earnings; post-tax to post-tax. Mismatching produces materially incorrect valuations.' },
            { std: 'AICPA SSVS VS Section 100', req: 'Requires that the valuation analyst consider and document the basis for all significant assumptions, including the discount rate, capitalization rate, and any adjustments to normalize earnings. The analyst must explain why the capitalization method was selected.' },
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
          <a href="/methods/discounted-cash-flow" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">💰 DCF</a>
          <a href="/methods/asset-based" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">🏗️ Asset-Based</a>
          <a href="/methods/rule-of-thumb" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">📏 Rule of Thumb</a>
        </div>
      </section>

      <section className="bg-slate-900 py-12"><div className="max-w-3xl mx-auto px-6 text-center"><h2 className="text-2xl font-bold text-white mb-3">Run a Cap of Earnings Valuation</h2><p className="text-slate-400 mb-6">MainStreetOS™ builds your cap rate from 15 risk factors and applies it alongside four other methods.</p><a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a></div></section>
      <Footer />
    </div>
  )
}
