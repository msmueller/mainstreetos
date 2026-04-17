'use client'

import { useState, useMemo } from 'react'
import type { Communication } from '@/lib/types'
import LeadDrawer from './lead-drawer'

interface LeadRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  source: string | null
  liquid_cash: number | null
  is_active: boolean
  proof_of_funds_received: boolean
  created_at: string
  deal_count: number
  nda_count: number
  deal_names: string[]
}

const fmt = (v: number | null) => {
  if (!v) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

interface LeadsTableProps {
  leads: LeadRow[]
  communications: Communication[]
}

export default function LeadsTable({ leads, communications: initialComms }: LeadsTableProps) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [communications, setCommunications] = useState<Communication[]>(initialComms)

  const sources = useMemo(() => {
    const s = new Set(leads.map(l => l.source).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [leads])

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase()
      const nameMatch = !q || `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        (l.email?.toLowerCase().includes(q)) ||
        (l.company_name?.toLowerCase().includes(q))
      const srcMatch = sourceFilter === 'all' || l.source === sourceFilter
      const activeMatch = activeFilter === 'all' ||
        (activeFilter === 'active' && l.is_active) ||
        (activeFilter === 'inactive' && !l.is_active)
      return nameMatch && srcMatch && activeMatch
    })
  }, [leads, search, sourceFilter, activeFilter])

  const selectedLead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) : null
  const selectedComms = selectedLeadId
    ? communications.filter(c => c.contact_id === selectedLeadId)
    : []

  // Count communications per contact for the table
  const commCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of communications) {
      counts[c.contact_id] = (counts[c.contact_id] || 0) + 1
    }
    return counts
  }, [communications])

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total Leads</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{leads.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Active</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{leads.filter(l => l.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">POF Received</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{leads.filter(l => l.proof_of_funds_received).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">With NDAs</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{leads.filter(l => l.nda_count > 0).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            {sources.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['all', 'active', 'inactive'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveFilter(v)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  activeFilter === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Deal Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Liquid Cash</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Comms</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">NDAs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">POF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-slate-400">
                    No leads match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLeadId(l.id)}
                    className="hover:bg-blue-50 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                      {l.first_name} {l.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{l.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{l.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{l.company_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-56">
                      {l.deal_names.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {l.deal_names.map((name, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.source ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {l.source}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{fmt(l.liquid_cash)}</td>
                    <td className="px-4 py-3">
                      {(commCounts[l.id] || 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {commCounts[l.id]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {l.nda_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.proof_of_funds_received ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                        {l.proof_of_funds_received ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                        {l.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-sm text-slate-500 text-center mt-4">
        Showing {filtered.length} of {leads.length} leads — click a row to view communication history
      </p>

      {/* Slide-out drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          communications={selectedComms}
          onClose={() => setSelectedLeadId(null)}
          onCommAdded={(comm) => {
            setCommunications(prev => [...prev, comm])
          }}
        />
      )}
    </div>
  )
}
