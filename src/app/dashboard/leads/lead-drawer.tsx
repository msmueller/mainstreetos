'use client'

import { useState } from 'react'
import type { Communication, CommunicationType } from '@/lib/types'
import { COMM_TYPE_LABELS } from '@/lib/types'
import CommForm from './comm-form'

interface LeadInfo {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  source: string | null
  is_active: boolean
  deal_names: string[]
}

interface LeadDrawerProps {
  lead: LeadInfo
  communications: Communication[]
  onClose: () => void
  onCommAdded: (comm: Communication) => void
}

const typeIcon: Record<CommunicationType, string> = {
  email: '✉',
  phone: '📞',
  note: '📝',
  text: '💬',
}

const typeColor: Record<CommunicationType, string> = {
  email: 'bg-blue-100 text-blue-700 border-blue-200',
  phone: 'bg-amber-100 text-amber-700 border-amber-200',
  note: 'bg-slate-100 text-slate-700 border-slate-200',
  text: 'bg-purple-100 text-purple-700 border-purple-200',
}

const directionLabel = (d: string | null) => {
  if (d === 'inbound') return '← Received'
  if (d === 'outbound') return '→ Sent'
  return ''
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function LeadDrawer({ lead, communications, onClose, onCommAdded }: LeadDrawerProps) {
  const [showForm, setShowForm] = useState(false)
  const [typeFilter, setTypeFilter] = useState<CommunicationType | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = typeFilter === 'all'
    ? communications
    : communications.filter(c => c.comm_type === typeFilter)

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  )

  const typeCounts = communications.reduce((acc, c) => {
    acc[c.comm_type] = (acc[c.comm_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-slide-in">
        {/* Header */}
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {lead.first_name} {lead.last_name}
              </h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {lead.email && (
                  <span className="text-sm text-slate-500">{lead.email}</span>
                )}
                {lead.email && lead.phone && (
                  <span className="text-slate-300">·</span>
                )}
                {lead.phone && (
                  <span className="text-sm text-slate-500">{lead.phone}</span>
                )}
              </div>
              {lead.company_name && (
                <p className="text-sm text-slate-400 mt-0.5">{lead.company_name}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Deal badges */}
          {lead.deal_names.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {lead.deal_names.map((name, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Type filter chips */}
          <div className="flex gap-1.5 mt-4">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                typeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({communications.length})
            </button>
            {(['email', 'phone', 'note', 'text'] as CommunicationType[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  typeFilter === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {typeIcon[t]} {COMM_TYPE_LABELS[t]} {typeCounts[t] ? `(${typeCounts[t]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-5">
          {showForm && (
            <div className="mb-5">
              <CommForm
                contactId={lead.id}
                contactEmail={lead.email}
                contactPhone={lead.phone}
                onSaved={(comm) => {
                  onCommAdded(comm)
                  setShowForm(false)
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No communications logged yet.</p>
              <p className="text-slate-400 text-xs mt-1">Click the button below to add one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map(c => {
                const isExpanded = expandedId === c.id
                return (
                  <div
                    key={c.id}
                    className="border border-slate-200 rounded-lg hover:border-slate-300 transition"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="w-full text-left p-3"
                    >
                      <div className="flex items-start gap-3">
                        {/* Type badge */}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 mt-0.5 ${typeColor[c.comm_type]}`}>
                          {typeIcon[c.comm_type]} {COMM_TYPE_LABELS[c.comm_type]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {c.subject || c.summary || (c.body ? c.body.slice(0, 60) + (c.body.length > 60 ? '…' : '') : 'No subject')}
                            </p>
                            <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(c.occurred_at)}</span>
                          </div>
                          {c.direction && (
                            <p className="text-xs text-slate-400 mt-0.5">{directionLabel(c.direction)}</p>
                          )}
                        </div>
                        <svg
                          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-100 pt-3">
                        {/* Email-specific details */}
                        {c.comm_type === 'email' && c.from_address && (
                          <p className="text-xs text-slate-500 mb-1">
                            <span className="font-medium">From:</span> {c.from_address}
                          </p>
                        )}
                        {c.comm_type === 'email' && c.to_addresses && c.to_addresses.length > 0 && (
                          <p className="text-xs text-slate-500 mb-1">
                            <span className="font-medium">To:</span> {c.to_addresses.join(', ')}
                          </p>
                        )}

                        {/* Phone-specific */}
                        {c.comm_type === 'phone' && c.duration_minutes && (
                          <p className="text-xs text-slate-500 mb-1">
                            <span className="font-medium">Duration:</span> {c.duration_minutes} min
                          </p>
                        )}
                        {(c.comm_type === 'phone' || c.comm_type === 'text') && c.phone_number && (
                          <p className="text-xs text-slate-500 mb-1">
                            <span className="font-medium">Number:</span> {c.phone_number}
                          </p>
                        )}

                        {/* Body */}
                        {c.body && (
                          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                            {c.body}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span>{formatFullDate(c.occurred_at)}</span>
                          {c.logged_by !== 'manual' && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              {c.logged_by === 'gmail_sync' ? 'Gmail Sync' : 'BBS Scrape'}
                            </span>
                          )}
                          {c.is_pinned && (
                            <span className="text-amber-500">📌 Pinned</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer / Add button */}
        {!showForm && (
          <div className="border-t border-slate-200 p-4">
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Communication
            </button>
          </div>
        )}
      </div>
    </>
  )
}
