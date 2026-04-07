'use client'

function Nav() { return (<nav className="border-b border-slate-100"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><a href="/" className="hover:opacity-80 transition"><span className="text-2xl font-bold text-slate-900">MainStreet</span><span className="text-2xl font-bold text-blue-600">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span></a><div className="flex items-center gap-4"><a href="/methods" className="text-sm text-slate-600 hover:text-slate-900 transition">All Methods</a><a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Get Started Free</a></div></div></nav>) }
function Footer() { return (<footer className="border-t border-slate-100 py-6"><div className="max-w-6xl mx-auto px-6 text-center"><p className="text-sm text-slate-400">© 2026 CRE Resources, LLC · MainStreetOS™ · All Rights Reserved</p></div></footer>) }

export default function DCFPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
        <a href="/methods" className="text-xs text-blue-600 hover:underline">← All Valuation Methods</a>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-4xl">💰</span>
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Income Approach</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Discounted Cash Flow (DCF)</h1>
          </div>
        </div>
        <p className="text-lg text-slate-500 mt-4 leading-relaxed">
          The DCF method values a business by projecting its future free cash flows over a forecast period (typically 5 years), estimating a terminal value for all years beyond, and discounting everything back to present value using a risk-adjusted discount rate. It's the most theoretically rigorous method — and the most sensitive to assumptions.
        </p>
      </section>

      {/* USPAP Context Banner */}
      <section className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚖️</span>
            <div>
              <h3 className="text-sm font-bold text-blue-800">USPAP Classification: Income Approach — Yield Capitalization</h3>
              <p className="text-xs text-blue-600 mt-1">Under USPAP Standard 9, the DCF method is a yield capitalization technique that projects multiple periods of future earnings and discounts them to present value. Unlike direct capitalization (Cap of Earnings), DCF explicitly models changes in cash flows over a projection period, making it more appropriate when earnings are expected to change materially. USPAP requires that projections be based on reasonable and appropriate evidence, and that the appraiser explain and support the basis for growth assumptions, discount rate components, and terminal value methodology.</p>
              <p className="text-xs text-blue-500 mt-2">Standards references: USPAP Standard 9, Duff &amp; Phelps/Kroll Build-Up Method, Gordon Growth Model, NACVA DCF Standards, Shannon Pratt&apos;s Cost of Capital</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-4">
          {[
            { n: '1', t: 'Project Future Free Cash Flows', d: 'Starting from normalized historical earnings, project free cash flows for each year of a 5-year forecast period. Adjust for expected revenue growth, margin changes, capital expenditures, and working capital requirements. FCF = Net Operating Income − Capital Expenditures ± Changes in Working Capital.' },
            { n: '2', t: 'Determine the Discount Rate', d: 'Build the discount rate using the Build-Up Method: Risk-Free Rate + Equity Risk Premium + Size Premium + Industry Risk Premium + Company-Specific Risk Premium (CSRP). For small private businesses, discount rates typically range from 20% to 35%. The CSRP is derived from the 15-factor risk analysis scored by the broker.' },
            { n: '3', t: 'Calculate Terminal Value', d: 'Terminal value captures the business\'s worth beyond the 5-year forecast period and typically represents 60–80% of total value. Two approaches are used: the Gordon Growth Model (FCF Year 5 × (1 + g) ÷ (r − g)) and the Exit Multiple Method (Year 5 EBITDA × exit multiple). MainStreetOS™ uses a blended average of both methods.' },
            { n: '4', t: 'Discount to Present Value', d: 'Each projected cash flow and the terminal value are discounted back to today using the formula: PV = FCF ÷ (1 + r)^n, where r is the discount rate and n is the year number. Sum all present values to arrive at the indicated business value.' },
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
          <p className="text-lg font-bold text-blue-900">Business Value = Σ [FCFₙ ÷ (1 + r)ⁿ] + [Terminal Value ÷ (1 + r)⁵]</p>
          <p className="text-sm text-blue-600 mt-3">Sum of discounted future cash flows (Years 1–5) plus discounted terminal value</p>
          <div className="grid md:grid-cols-2 gap-4 mt-4 text-left">
            <div className="bg-white/80 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-800">Gordon Growth Terminal Value</p>
              <p className="text-xs text-blue-600 mt-1">TV = FCF₅ × (1 + g) ÷ (r − g)</p>
              <p className="text-xs text-blue-400 mt-1">where g = long-term sustainable growth rate</p>
            </div>
            <div className="bg-white/80 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-800">Exit Multiple Terminal Value</p>
              <p className="text-xs text-blue-600 mt-1">TV = Year 5 EBITDA × Exit Multiple</p>
              <p className="text-xs text-blue-400 mt-1">where Exit Multiple reflects expected sale conditions</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Why Terminal Value Matters So Much</h2>
        <p className="text-sm text-slate-500 mb-4">Terminal value typically accounts for 60–80% of the total DCF valuation. This means small changes in the long-term growth rate or exit multiple have an outsized impact on the final number. This is why MainStreetOS™ uses a blended approach — averaging the Gordon Growth and Exit Multiple methods to cross-validate and reduce the impact of any single assumption.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h4 className="text-sm font-bold text-amber-800">Sensitivity Warning</h4>
          <p className="text-xs text-amber-600 mt-1">A 1-percentage-point change in the discount rate can shift the total valuation by 10–20%. A fractional increase in the perpetual growth rate can materially increase terminal value. This is why DCF results should always be cross-validated against Market Multiple and Cap of Earnings conclusions.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">When to Rely on This Method</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-green-100 bg-green-50/50 rounded-xl p-5">
            <h4 className="font-bold text-green-800 mb-2">Best When</h4>
            <ul className="space-y-1">
              {['Cash flows are the primary value driver', 'Growth or decline is expected — captures changing earnings trajectory', 'Business has planned capital investments that affect future cash flows', 'Sophisticated buyer (PE firm, institutional) expects a DCF model', 'Need a forward-looking valuation grounded in specific projections'].map((s, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2"><span className="flex-shrink-0">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="border border-red-100 bg-red-50/50 rounded-xl p-5">
            <h4 className="font-bold text-red-800 mb-2">Less Reliable When</h4>
            <ul className="space-y-1">
              {['Startup businesses with no historical cash flows to project from', 'Highly volatile or unpredictable earnings', 'Limited financial data makes projection speculative', 'Terminal value dominates excessively (signals weak near-term cash flows)', 'Small businesses where complexity of DCF exceeds the precision needed'].map((s, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="flex-shrink-0">✗</span>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How MainStreetOS™ Applies This Method</h2>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <p className="text-sm text-slate-300 mb-4">Agent 3 executes the DCF method by:</p>
          <ul className="space-y-2">
            {['Projecting 5-year free cash flows from Agent 2\'s normalized earnings with growth adjustments', 'Building the discount rate using the CSRP Build-Up Method from your 15-factor risk scores', 'Calculating terminal value using both Gordon Growth and Exit Multiple methods, then blending', 'Discounting all cash flows and terminal value back to present value', 'Computing the implied IRR (Internal Rate of Return) for buyer validation', 'Auto-capturing the DCF assumptions and results to Open Brain for future reference'].map((item, i) => (
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
            { std: 'USPAP Standard 9', req: 'The appraiser must base estimates of capitalization rates and projections of future earnings capacity on reasonable and appropriate evidence. Projections must weigh historical information and trends, current market factors, and reasonably anticipated events. The terminal value methodology and long-term growth assumption must be explained and supported.' },
            { std: 'Discount Rate (Build-Up Method)', req: 'For small private businesses, discount rates typically range from 20% to 35%, substantially higher than the 8-10% applied to large public companies. Failing to apply an appropriate size premium is one of the most common errors in small business DCF models. The company-specific risk premium (CSRP) accounts for risks unique to the subject business.' },
            { std: 'Terminal Value Requirements', req: 'Terminal value typically accounts for 60-80% of total DCF valuation. The perpetual growth rate must not exceed long-term GDP growth (typically 2-3%). Using both the Gordon Growth Model and Exit Multiple method, then blending results, is considered best practice by NACVA and ASA practitioners.' },
            { std: 'AICPA SSVS', req: 'The analyst must clearly state and support all significant projections and assumptions. Year 1 of projected cash flows is the year following the valuation date. A sensitivity analysis showing the impact of key assumption changes on value is strongly recommended for defensibility.' },
            { std: 'Common Errors (Per Sofer Advisors / NACVA)', req: 'Using an unrealistically high revenue growth rate unsupported by historical performance; applying a discount rate too low for a small private company; omitting required capex from FCF calculations; using a terminal growth rate exceeding long-term GDP growth; failing to reconcile DCF against market multiples.' },
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
          <a href="/methods/asset-based" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">🏗️ Asset-Based</a>
          <a href="/methods/rule-of-thumb" className="px-4 py-2 bg-slate-100 hover:bg-blue-50 text-sm text-slate-700 hover:text-blue-700 rounded-lg transition">📏 Rule of Thumb</a>
        </div>
      </section>

      <section className="bg-slate-900 py-12"><div className="max-w-3xl mx-auto px-6 text-center"><h2 className="text-2xl font-bold text-white mb-3">Run a DCF Valuation</h2><p className="text-slate-400 mb-6">MainStreetOS™ builds your discount rate from 15 risk factors, projects 5-year cash flows, and blends two terminal value methods.</p><a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">Start Free Valuation →</a></div></section>
      <Footer />
    </div>
  )
}
