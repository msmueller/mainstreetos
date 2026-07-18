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
interface DataRoomFolder {
  name: string
  sort: number
  locked: boolean
  unlocks_at: string
}
interface DataRoomPayload {
  data_room: { name?: string; drive_root_url?: string } | null
  max_tier: string
  stage: string
  documents: DataRoomDoc[]
  folders: DataRoomFolder[]
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
  const [folders, setFolders] = useState<DataRoomFolder[]>([])
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
      setFolders(Array.isArray(payload.folders) ? payload.folders : [])
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

  if (loading || !ok || (docs.length === 0 && folders.length === 0)) return null

  // Map documents to their folder; docs with no folder go under "Other Documents".
  const docsByFolder = new Map<string, DataRoomDoc[]>()
  for (const d of docs) {
    const key = d.folder_name || 'Other Documents'
    if (!docsByFolder.has(key)) docsByFolder.set(key, [])
    docsByFolder.get(key)!.push(d)
  }
  const knownNames = new Set(folders.map((f) => f.name))
  const leftover = Array.from(docsByFolder.keys()).filter((k) => !knownNames.has(k))

  const renderDoc = (d: DataRoomDoc) => (
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
  )

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
          Documents are hosted securely in Google Drive and open in a new tab. Folders marked with a lock unlock as you
          advance through the deal stages.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {folders.map((f) => {
          const items = docsByFolder.get(f.name) || []
          if (items.length === 0 && !f.locked) return null
          return (
            <div key={f.name} className={`px-5 py-3 ${f.locked ? 'bg-slate-50/60' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-semibold ${f.locked ? 'text-slate-400' : 'text-slate-700'}`}>
                  {f.locked ? '🔒 ' : ''}{f.name}
                </span>
                {f.locked && (
                  <span className="text-[10px] font-medium text-slate-400">Unlocks at {f.unlocks_at}</span>
                )}
              </div>
              {items.length > 0 && <div className="space-y-1.5">{items.map(renderDoc)}</div>}
            </div>
          )
        })}
        {leftover.map((name) => (
          <div key={name} className="px-5 py-3">
            <span className="inline-block text-[11px] font-semibold text-slate-700 mb-2">{name}</span>
            <div className="space-y-1.5">{(docsByFolder.get(name) || []).map(renderDoc)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
