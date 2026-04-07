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

export default function SemanticMemoryPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full mb-4">
          🧠 DEEPEST MOAT
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          Semantic Memory
        </h1>
        <p className="text-lg text-slate-500 mt-4 max-w-3xl mx-auto leading-relaxed">
          Powered by Open Brain — a Postgres + pgvector knowledge base using the MCP protocol.
          Every deal you work makes your AI smarter. Your expertise becomes searchable institutional knowledge.
        </p>
      </section>

      {/* Architecture Diagram */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">How Semantic Memory Works</h2>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 md:p-8">
          {/* Top Row: Input Sources */}
          <div className="text-center mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Knowledge Sources</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: '📊', label: 'Valuations', sub: 'Auto-captured findings' },
              { icon: '💬', label: 'Conversations', sub: 'Claude, ChatGPT, Cursor' },
              { icon: '📝', label: 'Notes & Observations', sub: 'Manual captures' },
              { icon: '📈', label: 'Deal Intelligence', sub: 'Market data, comps' },
            ].map((src) => (
              <div key={src.label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <span className="text-xl">{src.icon}</span>
                <p className="text-xs font-bold text-slate-800 mt-1">{src.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{src.sub}</p>
              </div>
            ))}
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center mb-4">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-300" />
              <div className="text-slate-400">▼</div>
              <p className="text-xs text-slate-400 mt-1">embed via pgvector</p>
            </div>
          </div>

          {/* Core: Open Brain */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-3xl">🧠</span>
              <div>
                <h3 className="text-xl font-bold">Open Brain</h3>
                <p className="text-slate-400 text-sm">Supabase Postgres + pgvector + MCP Protocol</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-white">Thoughts Table</p>
                <p className="text-xs text-slate-400 mt-1">Structured observations, tasks, ideas, references, person notes</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-white">Vector Embeddings</p>
                <p className="text-xs text-slate-400 mt-1">1536-dim vectors for semantic similarity search by meaning</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-white">MCP Server</p>
                <p className="text-xs text-slate-400 mt-1">Supabase Edge Function exposing capture, search, list tools</p>
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center mb-4">
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-300" />
              <div className="text-slate-400">▼</div>
              <p className="text-xs text-slate-400 mt-1">queried by AI agents via MCP</p>
            </div>
          </div>

          {/* Bottom Row: Consumers */}
          <div className="text-center mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Tools That Use Your Knowledge</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: '🌐', label: 'MainStreetOS™ App', sub: 'Valuation agents query knowledge' },
              { icon: '🤖', label: 'Claude', sub: 'Desktop, web, mobile' },
              { icon: '💻', label: 'Cursor / Claude Code', sub: 'Code-aware context' },
              { icon: '🔗', label: 'Any MCP Client', sub: 'Universal protocol' },
            ].map((tool) => (
              <div key={tool.label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <span className="text-xl">{tool.icon}</span>
                <p className="text-xs font-bold text-slate-800 mt-1">{tool.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{tool.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Flywheel */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">The Compounding Flywheel</h2>
          <p className="text-slate-500 text-center mb-10">Every deal you work makes the next one faster and smarter</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-4">1</div>
              <h4 className="font-bold text-slate-900 mb-2">Work a Deal</h4>
              <p className="text-sm text-slate-500">Run a valuation, write an OM, analyze a lease, negotiate an LOI. Every action generates knowledge.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto mb-4">2</div>
              <h4 className="font-bold text-slate-900 mb-2">Auto-Capture</h4>
              <p className="text-sm text-slate-500">Valuation findings, deal observations, and market intelligence auto-capture as embedded thoughts in Open Brain.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl mx-auto mb-4">3</div>
              <h4 className="font-bold text-slate-900 mb-2">Smarter AI</h4>
              <p className="text-sm text-slate-500">Next time your agents run, they query your accumulated expertise — finding patterns, comps, and insights from past deals.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why This Matters */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Why This Is Different</h2>
        <p className="text-slate-500 text-center mb-10">No other broker platform has semantic memory or cross-tool knowledge persistence</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-red-100 bg-red-50/50 rounded-xl p-6">
            <h4 className="font-bold text-red-800 mb-3">Without Semantic Memory</h4>
            <ul className="space-y-2">
              {[
                'Every valuation starts from scratch',
                'Deal intelligence lives in your head (or scattered notes)',
                'AI has no context about your past work',
                'Switching tools means losing all context',
                'Institutional knowledge walks out the door with people',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <span className="flex-shrink-0">✗</span>{item}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-green-100 bg-green-50/50 rounded-xl p-6">
            <h4 className="font-bold text-green-800 mb-3">With Open Brain</h4>
            <ul className="space-y-2">
              {[
                'Agents reference patterns from 50+ past valuations',
                'Every deal observation is searchable by meaning',
                'AI already knows your market, your clients, your methodology',
                'Knowledge follows you across Claude, Cursor, ChatGPT, and the web app',
                'Institutional knowledge compounds — permanently',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                  <span className="flex-shrink-0">✓</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Start Building Your Knowledge Base</h2>
          <p className="text-slate-400 mb-6">Professional tier includes full Open Brain access with MCP protocol for cross-tool AI memory.</p>
          <a href="/signup" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-sm">
            Get Started Free →
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
