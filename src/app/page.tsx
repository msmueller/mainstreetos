import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-4xl font-bold text-slate-900 tracking-tight hover:opacity-80 transition">
            MainStreet<span className="text-blue-600">OS</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition">Sign In</a>
            <a href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-base font-bold mb-6">
          AI-Native &middot; Built for Business Brokers
        </div>
        <h2 className="text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          The deal operating system<br />
          that <span className="text-blue-600">gets smarter</span> with every deal
        </h2>
        <p className="text-lg text-slate-500 mt-6 max-w-2xl mx-auto leading-relaxed">
          MainStreetOS automates business valuations, generates deal documents, manages your pipeline, and builds institutional memory that compounds across every deal you work.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <a href="/signup" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition text-sm">
            Start Free Valuation
          </a>
          <a href="#features" className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg transition text-sm">
            See How It Works
          </a>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl border border-slate-200">
            <div className="text-3xl mb-4">📈</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">AI-Agentic Valuations</h3>
            <p className="text-sm text-slate-500 leading-relaxed">5-agent pipeline: SDE/EBITDA auto-selection, market multiples, cap-of-earnings, DCF, asset-based. CSRP 8-factor scoring.</p>
          </div>
          <div className="p-6 rounded-xl border border-slate-200">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Semantic Memory</h3>
            <p className="text-sm text-slate-500 leading-relaxed">Built on Open Brain. Every deal feeds back as searchable knowledge. Your agents query your accumulated expertise.</p>
          </div>
          <div className="p-6 rounded-xl border border-slate-200">
            <div className="text-3xl mb-4">📄</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">AI Document Generation</h3>
            <p className="text-sm text-slate-500 leading-relaxed">Generate OMs, CIMs, and USPAP-style BVRs. Professional output, not fill-in templates.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-400">&copy; 2026 CRE Resources, LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
