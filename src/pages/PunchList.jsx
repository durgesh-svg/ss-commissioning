import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ChevronDown, ChevronUp, Loader2, CheckCircle2,
  AlertCircle, MessageSquare, Download, Send, X, ZoomIn
} from 'lucide-react'

const STATUS_CONFIG = {
  open:            { label: 'Open',             color: 'bg-orange-100 text-orange-700' },
  in_progress:     { label: 'In Progress',      color: 'bg-blue-100 text-blue-700' },
  pending_closure: { label: 'Pending Approval', color: 'bg-purple-100 text-purple-700' },
  closed:          { label: 'Closed',           color: 'bg-green-100 text-green-700' },
}

function PhotoModal({ url, onClose }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 rounded-full p-2 text-white"><X size={20} /></button>
      <img src={url} alt="punch photo" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  )
}

function isOverdue(punch) {
  if (!punch.target_date || punch.status === 'closed') return false
  return new Date(punch.target_date) < new Date(new Date().toDateString())
}

export default function PunchList() {
  const { profile, userSites } = useAuth()
  const [punches, setPunches] = useState([])
  const [sites, setSites] = useState([])
  const [systems, setSystems] = useState([])
  const [comments, setComments] = useState({})   // punch_id → [comment]
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [updating, setUpdating] = useState({})
  const [newComment, setNewComment] = useState({})
  const [submitting, setSubmitting] = useState({})
  const [lightboxUrl, setLightboxUrl] = useState(null)

  // Filters
  const [filterSite, setFilterSite] = useState('')
  const [filterSystem, setFilterSystem] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus, setFilterStatus] = useState('open')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [sitesRes, systemsRes, punchRes] = await Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
      supabase
        .from('punch_points')
        .select(`*, sites(name), systems(name),
          checklist_items(item_number, description),
          punch_photos(id, url)`)
        .order('created_at', { ascending: false }),
    ])
    setSites(sitesRes.data || [])
    setSystems(systemsRes.data || [])
    setPunches(punchRes.data || [])
    setLoading(false)
  }

  async function loadComments(punchId) {
    if (comments[punchId]) return
    const { data } = await supabase
      .from('punch_comments')
      .select('*')
      .eq('punch_id', punchId)
      .order('created_at')
    setComments(c => ({ ...c, [punchId]: data || [] }))
  }

  async function updateStatus(punch, status) {
    setUpdating(u => ({ ...u, [punch.id]: true }))
    const updates = { status, closed: status === 'closed' }
    if (status === 'closed') updates.closed_at = new Date().toISOString()
    if (status !== 'closed') updates.closed_at = null
    await supabase.from('punch_points').update(updates).eq('id', punch.id)
    setPunches(ps => ps.map(p => p.id === punch.id ? { ...p, ...updates } : p))
    setUpdating(u => ({ ...u, [punch.id]: false }))
  }

  async function submitComment(punchId) {
    const text = (newComment[punchId] || '').trim()
    if (!text) return
    setSubmitting(s => ({ ...s, [punchId]: true }))
    const { data } = await supabase
      .from('punch_comments')
      .insert({ punch_id: punchId, user_id: profile?.id, email: profile?.email, comment: text })
      .select().single()
    if (data) {
      setComments(c => ({ ...c, [punchId]: [...(c[punchId] || []), data] }))
      setNewComment(n => ({ ...n, [punchId]: '' }))
    }
    setSubmitting(s => ({ ...s, [punchId]: false }))
  }

  function exportExcel() {
    const rows = filtered.map(p => ({
      Site: p.sites?.name,
      System: p.systems?.name,
      'Item #': p.checklist_items?.item_number,
      Description: p.checklist_items?.description,
      Priority: p.priority || '',
      Status: STATUS_CONFIG[p.status]?.label || p.status,
      Contractor: p.contractor || '',
      'Target Date': p.target_date || '',
      Overdue: isOverdue(p) ? 'YES' : '',
      Remarks: p.remarks || '',
      'Closed At': p.closed_at ? new Date(p.closed_at).toLocaleString() : '',
      Photos: (p.punch_photos || []).map(ph => ph.url).join(', '),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Punch Points')
    XLSX.writeFile(wb, `punch-list-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const allowedSiteIds = userSites.map(s => s.id)
  const filtered = punches.filter(p => {
    if (!profile?.is_admin && !allowedSiteIds.includes(p.site_id)) return false
    if (filterSite && p.site_id !== filterSite) return false
    if (filterSystem && p.system_id !== filterSystem) return false
    if (filterPriority && p.priority !== filterPriority) return false
    if (filterStatus && p.status !== filterStatus) return false
    return true
  })

  const overdueCount = filtered.filter(isOverdue).length

  return (
    <div className="flex flex-col h-full">
      <PhotoModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      {/* Filters + Export */}
      <div className="bg-white border-b border-gray-100 px-3 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {profile?.is_admin && (
            <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="text-xs">
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select value={filterSystem} onChange={e => setFilterSystem(e.target.value)} className="text-xs">
            <option value="">All Systems</option>
            {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-xs">
            <option value="">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="Minor">Minor</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_closure">Pending Approval</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{filtered.length} punch{filtered.length !== 1 ? 'es' : ''}</span>
            {overdueCount > 0 && (
              <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {overdueCount} overdue
              </span>
            )}
          </div>
          {profile?.is_admin && (
            <button
              onClick={exportExcel}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Download size={13} /> Export Excel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CheckCircle2 size={40} className="mx-auto mb-2 text-gray-200" />
            <p>No punch points found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(punch => {
              const isOpen = expanded === punch.id
              const overdue = isOverdue(punch)
              const punchComments = comments[punch.id] || []
              const statusCfg = STATUS_CONFIG[punch.status] || STATUS_CONFIG.open

              return (
                <div key={punch.id} className="bg-white">
                  <button
                    className="w-full text-left px-4 py-3"
                    onClick={() => {
                      setExpanded(isOpen ? null : punch.id)
                      if (!isOpen) loadComments(punch.id)
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {punch.priority && (
                            <span className={`priority-badge ${punch.priority}`}>{punch.priority}</span>
                          )}
                          <span className={`priority-badge ${statusCfg.color}`}>{statusCfg.label}</span>
                          {overdue && (
                            <span className="priority-badge bg-red-100 text-red-700 flex items-center gap-0.5">
                              <AlertCircle size={10} /> Overdue
                            </span>
                          )}
                          {punch.punch_photos?.length > 0 && (
                            <span className="text-xs text-gray-400">📷 {punch.punch_photos.length}</span>
                          )}
                          {(comments[punch.id]?.length > 0) && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              <MessageSquare size={10} /> {comments[punch.id].length}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          #{punch.checklist_items?.item_number} — {punch.checklist_items?.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {punch.sites?.name} · {punch.systems?.name}
                          {punch.target_date && (
                            <span className={`ml-2 ${overdue ? 'text-red-500 font-semibold' : ''}`}>
                              · Due {punch.target_date}
                            </span>
                          )}
                        </p>
                      </div>
                      {isOpen
                        ? <ChevronUp size={16} className="text-gray-400 mt-1 shrink-0" />
                        : <ChevronDown size={16} className="text-gray-400 mt-1 shrink-0" />
                      }
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-4 space-y-4">
                      {/* Details */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <Detail label="Site" value={punch.sites?.name} />
                        <Detail label="System" value={punch.systems?.name} />
                        <Detail label="Priority" value={punch.priority || '—'} />
                        <Detail label="Contractor" value={punch.contractor || '—'} />
                        <Detail label="Target Date" value={punch.target_date || '—'} />
                        <Detail label="Remarks" value={punch.remarks || '—'} />
                      </div>

                      {/* Status progression */}
                      {profile?.is_admin && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Update Status</p>
                          <div className="flex flex-wrap gap-1.5">
                            {['open', 'in_progress', 'pending_closure', 'closed'].map(s => (
                              <button key={s} disabled={updating[punch.id] || punch.status === s}
                                onClick={() => updateStatus(punch, s)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all disabled:opacity-50 min-w-[60px] ${
                                  punch.status === s
                                    ? s === 'closed' ? 'bg-green-600 border-green-600 text-white'
                                      : s === 'in_progress' ? 'bg-blue-600 border-blue-600 text-white'
                                      : s === 'pending_closure' ? 'bg-purple-600 border-purple-600 text-white'
                                      : 'bg-orange-500 border-orange-500 text-white'
                                    : 'border-gray-200 text-gray-500 bg-white'
                                }`}>
                                {updating[punch.id] ? <Loader2 size={12} className="animate-spin mx-auto" /> : STATUS_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Site manager: two-step closure */}
                      {!profile?.is_admin && punch.status !== 'closed' && punch.status !== 'pending_closure' && (
                        <div className="flex gap-2">
                          {punch.status === 'open' && (
                            <button onClick={() => updateStatus(punch, 'in_progress')} disabled={updating[punch.id]}
                              className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 border-blue-400 text-blue-600 hover:bg-blue-50">
                              {updating[punch.id] ? 'Updating…' : 'Mark In Progress'}
                            </button>
                          )}
                          {punch.status === 'in_progress' && (
                            <button onClick={() => updateStatus(punch, 'pending_closure')} disabled={updating[punch.id]}
                              className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 border-purple-400 text-purple-700 hover:bg-purple-50">
                              {updating[punch.id] ? 'Updating…' : 'Request Closure'}
                            </button>
                          )}
                        </div>
                      )}
                      {!profile?.is_admin && punch.status === 'pending_closure' && (
                        <p className="text-xs text-center text-purple-600 font-semibold py-2 bg-purple-50 rounded-lg">
                          ⏳ Awaiting admin approval to close
                        </p>
                      )}

                      {/* Photos */}
                      {punch.punch_photos?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Photos</p>
                          <div className="flex flex-wrap gap-2">
                            {punch.punch_photos.map(photo => (
                              <div key={photo.id} className="relative w-20 h-20 cursor-pointer" onClick={() => setLightboxUrl(photo.url)}>
                                <img src={photo.url} alt="punch" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 rounded-lg transition-colors">
                                  <ZoomIn size={16} className="text-white opacity-0 hover:opacity-100" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comments */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          <MessageSquare size={12} /> Activity / Comments
                        </p>
                        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                          {punchComments.length === 0 && (
                            <p className="text-xs text-gray-400 italic">No comments yet</p>
                          )}
                          {punchComments.map(c => (
                            <div key={c.id} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-semibold text-gray-600">{c.email || 'User'}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{c.comment}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a comment…"
                            value={newComment[punch.id] || ''}
                            onChange={e => setNewComment(n => ({ ...n, [punch.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && submitComment(punch.id)}
                            className="flex-1 text-sm"
                          />
                          <button
                            onClick={() => submitComment(punch.id)}
                            disabled={submitting[punch.id] || !newComment[punch.id]?.trim()}
                            className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-40 transition-colors shrink-0"
                            style={{ background: '#d85a30' }}
                          >
                            {submitting[punch.id] ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5 break-words">{value}</p>
    </div>
  )
}
