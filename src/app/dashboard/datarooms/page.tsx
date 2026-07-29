import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

// ============================================================
// DATA ROOMS ADMIN — Phase 13.4
// Every data room (deal + project) with its folder tree and
// grant list. Folder tiles open the backing Google Drive
// folders, where individual documents can be called up.
// Data via fn_admin_list_data_rooms (staff-only RPC).
// ============================================================

interface RoomFolder {
  id: string
  name: string
  url: string
  tier: string | null
}

interface RoomGrant {
  contact: string | null
  email: string | null
  tier: string | null
  status: string | null
  granted_at: string | null
}

interface Room {
  id: string
  name: string | null
  parent_type: string
  parent_label: string
  drive_root_url: string | null
  is_active: boolean
  created_at: string
  folders: RoomFolder[]
  grants: RoomGrant[]
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  seller_listing: { label: 'Deal', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  buyer_engagement: { label: 'Buyer Search', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  project: { label: 'Project', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
}

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export default async function DataRoomsAdminPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_admin_list_data_rooms')

  if (error) {
    console.error('[datarooms/page] rpc error:', error)
  }

  const rooms = (Array.isArray(data) ? data : []) as Room[]

  return (
    <div>
      <TopBar
        breadcrumbs={[{ label: 'Records', href: '/dashboard' }, { label: 'Data Rooms' }]}
        title="Data Rooms"
        subtitle="Every deal and project data room — inspect folders, open documents in Drive, and review who holds access."
      />

      {rooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-10 text-center text-sm text-slate-500">
          No data rooms yet. Rooms are provisioned per deal or project.
        </div>
      ) : (
        <div className="space-y-6">
          {rooms.map((room) => {
            const badge = TYPE_BADGE[room.parent_type] || { label: room.parent_type, cls: 'bg-slate-50 text-slate-600 border-slate-200' }
            return (
              <div key={room.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-slate-900">{room.name || room.parent_label}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                      {!room.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {room.parent_label} · created {fmtDate(room.created_at)}
                    </p>
                  </div>
                  {room.drive_root_url && (
                    <a
                      href={room.drive_root_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shrink-0"
                    >
                      Open in Drive ↗
                    </a>
                  )}
                </div>

                {room.folders.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
                    {room.folders.map((f) => (
                      <a
                        key={f.id}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <span className="leading-none">📁</span>
                        <span className="text-sm font-medium text-slate-800 truncate">{f.name}</span>
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Access ({room.grants.filter((g) => g.status === 'granted').length} active)
                  </p>
                  {room.grants.length === 0 ? (
                    <p className="text-sm text-slate-500">No grants issued.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {room.grants.map((g, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2.5 py-1 rounded-full border ${
                            g.status === 'granted'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200 line-through'
                          }`}
                          title={`${g.email || ''} · ${g.tier || ''} · ${fmtDate(g.granted_at)}`}
                        >
                          {g.contact || g.email || 'Unknown'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
