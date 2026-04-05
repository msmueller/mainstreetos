import { login } from '@/app/auth/actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              MainStreet<span className="text-blue-600">OS<span style={{ fontSize: '0.45em', fontWeight: 400, verticalAlign: 'super', letterSpacing: 0 }}>™</span></span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              AI-Native Deal Operating System
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{decodeURIComponent(error)}</p>
            </div>
          )}

          {/* Login form */}
          <form className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="you@brokerage.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <button
              formAction={login}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <a href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign up
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          &copy; 2026 CRE Resources, LLC. MainStreetOS<span style={{ fontSize: '0.7em', fontWeight: 400, verticalAlign: 'super' }}>™</span>. All rights reserved.
        </p>
      </div>
    </div>
  )
}
