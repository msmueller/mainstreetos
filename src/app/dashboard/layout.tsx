import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signout } from '@/app/auth/actions'
import type { User } from '@/lib/types'
import CommandPalette from '@/components/palette/CommandPalette'
import PaletteTrigger from '@/components/palette/PaletteTrigger'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  const user = profile as User | null

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <Link href="/" className="block p-5 border-b border-slate-100 text-center hover:bg-slate-50 transition">
          <div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">MainStreet</span><span className="text-lg font-bold text-blue-600 tracking-tight">OS</span><span className="text-xs text-slate-400 align-super ml-0.5">™</span>
          </div>
          <p className="text-sm font-semibold text-slate-500 tracking-wide mt-1">AI-Native Deal Operating System</p>
        </Link>

        {/* Command palette trigger */}
        <div className="px-3 pt-3">
          <PaletteTrigger />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <NavItem href="/dashboard" label="Dashboard" icon="📊" />
          <NavItem href="/dashboard/valuations" label="Valuations" icon="📈" />
          <NavItem href="/dashboard/valuations/new" label="New Valuation" icon="➕" />

          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
              Deals
            </p>
          </div>
          <NavItem href="/dashboard/deals" label="Deal Pipeline" icon="🔄" />
          <NavItem href="/dashboard/leads" label="Leads & Contacts" icon="👥" />

          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
              Coming Soon
            </p>
          </div>
          <NavItem href="#" label="Documents" icon="📄" disabled />
          <NavItem href="#" label="Knowledge Base" icon="🧠" disabled />
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {user?.full_name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.full_name || authUser.email}
              </p>
              <p className="text-xs text-slate-400 capitalize">
                {user?.subscription_tier || 'free'} plan
              </p>
            </div>
          </div>
          <form>
            <button
              formAction={signout}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>

      {/* Global ⌘K command palette (mounted once per dashboard) */}
      <CommandPalette />
    </div>
  )
}

function NavItem({
  href,
  label,
  icon,
  disabled = false,
}: {
  href: string
  label: string
  icon: string
  disabled?: boolean
}) {
  const className = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
    disabled
      ? 'text-slate-300 cursor-not-allowed'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`
  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        <span className="text-base">{icon}</span>
        <span>{label}</span>
      </span>
    )
  }
  return (
    <Link href={href} className={className}>
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
