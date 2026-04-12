'use client'

import { useState, useMemo } from 'react'
import type { DealWithCounts, DealType, DealStatus, SellerStage } from '@/lib/types'
import { SELLER_STAGES } from '@/lib/types'

const formatCurrency = (value: number | null) => {
  if (!value) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const getDealTypeColor = (dt: DealType | null) => {
  switch (dt) {
    case 'business_disposition': return 'border-l-4 border-l-emerald-500'
    case 'cre_disposition': return 'border-l-4 border-l-blue-500'
    case 'business_acquisition': return 'border-l-4 border-l-purple-500'
    case 'cre_acquisition': return 'border-l-4 border-l-indigo-500'
    default: return 'border-l-4 border-l-gray-300'
  }
}

const getDealTypeBadge = (dt: DealType | null) => {
  switch (dt) {
    case 'business_disposition': return 'bg-emerald-100 text-emerald-800'
    case 'cre_disposition': return 'bg-blue-100 text-blue-800'
    case 'business_acquisition': return 'bg-purple-100 text-purple-800'
    case 'cre_acquisition': return 'bg-indigo-100 text-indigo-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const getDealTypeLabel = (dt: DealType | null) => {
  switch (dt) {
    case 'business_disposition': return 'Business Sale'
    case 'cre_disposition': return 'CRE Sale'
    case 'business_acquisition': return 'Buyer Search'
    case 'cre_acquisition': return 'CRE Acquisition'
    default: return dt || '—'
  }
}

const getStatusBadge = (s: DealStatus | null) => {
  switch (s) {
    case 'active': return 'bg-emerald-100 text-emerald-800'
    case 'under_contract': return 'bg-blue-100 text-blue-800'
    case 'closed': return 'bg-gray-100 text-gray-600'
    case 'expired': return 'bg-amber-100 text-amber-800'
    case 'withdrawn': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-600'
  }
}

const getStatusLabel = (s: DealStatus | null) => {
  switch (s) {
    case 'active': return 'Active'
    case 'under_contract': return 'Under Contract'
    case 'closed': return 'Closed'
    case 'expired': return 'Expired'
    case 'withdrawn': return 'Withdrawn'
    default: return s || '—'
  }
}

interface Props {
  deals: DealWithCounts[]
}

type SortConfig = { key: string; direction: 'asc' | 'desc' }

export default function PipelineView({ deals }: Props) {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [selectedStatus, setSelectedStatus] = useState<'all' | DealStatus>('all')
  const [selectedTypes, setSelectedTypes] = useState<DealType[]>([])
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'listing_name', direction: 'asc' })

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const statusOk = selectedStatus === 'all' || d.deal_status === selectedStatus
      const typeOk = selectedTypes.length === 0 || (d.deal_type && selectedTypes.includes(d.deal_type))
      return statusOk && typeOk
    })
  }, [deals, selectedStatus, selectedTypes])

  const sortedDeals = useMemo(() => {
    return [...filteredDeals].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortConfig.key]
      const bVal = (b as unknown as Record<string, unknown>)[sortConfig.key]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string)
      }
      return sortConfig.direction === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [filteredDeals, sortConfig])

  const stats = useMemo(() => {
    const active = deals.filter(d => d.deal_status === 'active')
    return {
      activeDealCount: active.length,
      pipelineValue: active.reduce((s, d) => s + (d.asking_price || 0), 0),
      commissionPotential: active.reduce((s, d) => s + (d.potential_commission || 0), 0),
      activeBuyers: active.reduce((s, d) => s + (d.active_buyers || 0), 0),
    }
  }, [deals])

  const stageBreakdown = useMemo(() => {
    const map: Record<string, DealWithCounts[]> = {}
    SELLER_STAGES.forEach(s => { map[s.key] = sortedDeals.filter(d => d.seller_stage === s.key) })
    return map
  }, [sortedDeals])

  const toggleType = (t: DealType) => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Active Deals</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.activeDealCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Pipeline Value</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.pipelineValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Commission Potential</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.commissionPotential)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Active Buyers</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.activeBuyers}</p>
        </div>
      </div>

      {/* Filters + View Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Deal Status</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'under_contract', 'closed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    selectedStatus === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All Deals' : getStatusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Deal Type</p>
          <div className="flex flex-wrap gap-2">
            {(['business_disposition', 'cre_disposition', 'business_acquisition', 'cre_acquisition'] as DealType[]).map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedTypes.includes(t)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {getDealTypeLabel(t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {SELLER_STAGES.map(stage => (
            <div key={stage.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-sm text-slate-900">{stage.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stageBreakdown[stage.key].length} deal{stageBreakdown[stage.key].length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
                {stageBreakdown[stage.key].length === 0 ? (
                  <div className="flex items-center justify-center h-24">
                    <p className="text-sm text-slate-400">No deals</p>
                  </div>
                ) : (
                  stageBreakdown[stage.key].map(deal => (
                    <a
                      key={deal.id}
                      href={`/dashboard/deals/${deal.id}`}
                      className={`block ${getDealTypeColor(deal.deal_type)} bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow`}
                    >
                      <h4 className="font-semibold text-sm text-slate-900 mb-1 line-clamp-2 hover:text-blue-600">
                        {deal.listing_name}
                      </h4>
                      {deal.industry && <p className="text-xs text-slate-500 mb-2">{deal.industry}</p>}
                      {deal.asking_price && (
                        <p className="text-sm font-semibold text-emerald-600 mb-2">{formatCurrency(deal.asking_price)}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {deal.active_buyers > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            {deal.active_buyers} Buyer{deal.active_buyers !== 1 ? 's' : ''}
                          </span>
                        )}
                        {deal.nda_signed_count > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {deal.nda_signed_count} NDA
                          </span>
                        )}
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getDealTypeBadge(deal.deal_type)}`}>
                        {getDealTypeLabel(deal.deal_type)}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    { label: 'Deal Name', key: 'listing_name' },
                    { label: 'Industry', key: 'industry' },
                    { label: 'Asking Price', key: 'asking_price' },
                    { label: 'Status', key: 'deal_status' },
                    { label: 'Stage', key: 'seller_stage' },
                    { label: 'Buyers', key: 'active_buyers' },
                    { label: 'NDAs', key: 'nda_signed_count' },
                    { label: 'Commission', key: 'potential_commission' },
                    { label: 'Type', key: 'deal_type' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-50 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedDeals.map(deal => (
                  <tr key={deal.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <a href={`/dashboard/deals/${deal.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600">
                        {deal.listing_name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{deal.industry || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(deal.asking_price)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(deal.deal_status)}`}>
                        {getStatusLabel(deal.deal_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {SELLER_STAGES.find(s => s.key === deal.seller_stage)?.label || deal.seller_stage || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {deal.active_buyers}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {deal.nda_signed_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCurrency(deal.potential_commission)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDealTypeBadge(deal.deal_type)}`}>
                        {getDealTypeLabel(deal.deal_type)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500 text-center mt-6">
        Showing {sortedDeals.length} of {deals.length} deals
      </p>
    </div>
  )
}
