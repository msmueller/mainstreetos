'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// Secure Data Room — Phase 12.15d
// Renders the Google-Drive-hosted, tier + stage gated documents
// for the signed-in buyer via fn_portal_data_room(parent_type, parent_id).
// Additive + defensive: renders nothing on error / no access / empty,
// so it can never break the existing BuyerView surface.
// ============================================================

interface DataRoomDoc {
  id: string
  name: string
  type: string
  tier: string
  source: string
  url: string | null
  drive_file_id: string | null
  download_disabled: boolean
  min_stage: string
  folder_name?: string | null
  folder_sort?: number | null
}
interface DataRoomPayload {
  data_room: { name?: string; drive_root_url?: string } | null
  max_tier: string
  stage: string
  documents: DataRoomDoc[]
}

const TIER_META: Record<string, { label: string; cls: string }> = {
  level_1_basic:        { label: 'Tier 1 · Marketing',  cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  level_2_nda_required: { label: 'Tier 2 · NDA',        cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  level_3_deal_room:    { label: 'Tier 3 · Deal Room',  cls: 'bg-rose-50 text-rose-800 border-rose-200' },
}

export default function DataRoomSection({
  parentType,
  parentId,
}: {
  parentType: string
  parentId: string
}) {
  const supabase = createClient()
  const [docs, setDocs] = useState<DataRoomDoc[]>([])
  const [roomName, setRoomName] = useState('Secure Data Room')
  const [loading, setLoading] = useState(true)
  const [ok, setOk] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('fn_portal_data_room', {
        p_parent_type: parentType,
        p_parent_id: parentId,
      })
      if (error) { setOk(false); return }
      const payload = data as DataRoomPayload | null
      if (!payload) { setOk(false); return }
      setDocs(Array.isArray(payload.documents) ? payload.documents : [])
      if (payload.data_room?.name) setRoomName(payload.data_room.name)
      setOk(true)
    } catch (err) {
      console.error('[data-room] fn_portal_data_room failed:', err)
      setOk(false)
    } finally {
      setLoading(false)
    }
  }, [supabase, parentType, parentId])

  useEffect(() => { load() }, [load])

  if (loading || !ok || docs.length === 0) return null

  // Group documents by their data-room folder, ordered by the folder's sort order.
  // Documents with no folder fall into "Other Documents" at the end.
  const folderMap = new Map<string, { sort: number; label: string; items: DataRoomDoc[] }>()
  for (const d of docs) {
    const label = d.folder_name || 'Other Documents'
    const sort = d.folder_sort ?? 999
    if (!folderMap.has(label)) folderMap.set(label, { sort, label, items: [] })
    folderMap.get(label)!.items.push(d)
  }
  const groups = Array.from(folderMap.values()).sort((a, b) => a.sort - b.sort)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-slate-900 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">🗄 {roomName}</h3>
        <span className="text-[11px] text-slate-300">
          {docs.length} {docs.length === 1 ? 'file' : 'files'} at your access level
        </span>
      </div>
      <div className="px-5 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-[11px] text-slate-500">
          Documents are hosted securely in Google Drive and open in a new tab. Access is tied to your email — if a file
          does not open, your broker has not yet shared that tier with you.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {groups.map((g) => (
          <div key={g.label} className="px-5 py-3">
            <span className="inline-block text-[11px] font-semibold text-slate-700 mb-2">
              {g.label}
            </span>
            <div className="space-y-1.5">
              {g.items.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{d.name}</p>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {(d.type || 'document').replace(/_/g, ' ')}
                      {TIER_META[d.tier]?.label ? ` · ${TIER_META[d.tier]?.label}` : ''}
                      {d.download_disabled ? ' · view only' : ''}
                    </p>
                  </div>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Open ↗
                    </a>
                  ) : (
                    <span className="flex-shrink-0 text-[11px] text-slate-400">unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
