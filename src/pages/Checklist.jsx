import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Camera, X, Loader2, ChevronDown, ChevronUp, ImagePlus, StickyNote } from 'lucide-react'

export default function Checklist() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()

  const [sites, setSites] = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState(null)
  const [systems, setSystems] = useState([])
  const [activeSystemIdx, setActiveSystemIdx] = useState(0)
  const [items, setItems] = useState([])
  const [responses, setResponses] = useState({})   // item_id → response row
  const [punches, setPunches] = useState({})        // item_id → punch_point row
  const [punchPhotos, setPunchPhotos] = useState({}) // punch_id → [photo]
  const [respPhotos, setRespPhotos] = useState({})   // response_id → [photo]
  const [expandedItem, setExpandedItem] = useState(null)
  const [saving, setSaving] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStaticData() }, [])

  async function loadStaticData() {
    const [sitesRes, systemsRes] = await Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
    ])
    setSites(sitesRes.data || [])
    setSystems(systemsRes.data || [])
    const paramSite = searchParams.get('site')
    if (profile?.is_admin) {
      setSelectedSiteId(paramSite || (sitesRes.data?.[0]?.id ?? null))
    } else {
      setSelectedSiteId(profile?.site_id ?? null)
    }
  }

  useEffect(() => {
    if (selectedSiteId && systems.length) loadChecklist()
  }, [selectedSiteId, activeSystemIdx, systems])

  async function loadChecklist() {
    setLoading(true)
    const sys = systems[activeSystemIdx]
    if (!sys) return

    const [itemsRes, responsesRes] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('system_id', sys.id).order('item_number'),
      supabase.from('checklist_responses').select('*').eq('site_id', selectedSiteId).eq('system_id', sys.id),
    ])

    const itemList = itemsRes.data || []
    setItems(itemList)

    const respMap = {}
    for (const r of responsesRes.data || []) respMap[r.item_id] = r
    setResponses(respMap)

    // Load punch points
    const punchItemIds = itemList.filter(i => respMap[i.id]?.status === 'punch').map(i => i.id)
    if (punchItemIds.length) {
      const punchRes = await supabase
        .from('punch_points').select('*').eq('site_id', selectedSiteId).in('item_id', punchItemIds)
      const punchMap = {}
      for (const p of punchRes.data || []) punchMap[p.item_id] = p
      setPunches(punchMap)

      const punchIds = (punchRes.data || []).map(p => p.id)
      if (punchIds.length) {
        const photoRes = await supabase.from('punch_photos').select('*').in('punch_id', punchIds)
        const photoMap = {}
        for (const ph of photoRes.data || []) {
          if (!photoMap[ph.punch_id]) photoMap[ph.punch_id] = []
          photoMap[ph.punch_id].push(ph)
        }
        setPunchPhotos(photoMap)
      } else {
        setPunchPhotos({})
      }
    } else {
      setPunches({})
      setPunchPhotos({})
    }

    // Load response photos (for OK items)
    const allRespIds = (responsesRes.data || []).map(r => r.id)
    if (allRespIds.length) {
      const rPhotoRes = await supabase.from('response_photos').select('*').in('response_id', allRespIds)
      const rPhotoMap = {}
      for (const ph of rPhotoRes.data || []) {
        if (!rPhotoMap[ph.response_id]) rPhotoMap[ph.response_id] = []
        rPhotoMap[ph.response_id].push(ph)
      }
      setRespPhotos(rPhotoMap)
    } else {
      setRespPhotos({})
    }

    setLoading(false)
  }

  async function handleStatus(item, status) {
    const sys = systems[activeSystemIdx]
    setSaving(s => ({ ...s, [item.id]: true }))
    const existing = responses[item.id]

    if (existing) {
      const { data } = await supabase
        .from('checklist_responses')
        .update({ status, updated_at: new Date().toISOString(), updated_by: profile?.id })
        .eq('id', existing.id).select().single()
      setResponses(r => ({ ...r, [item.id]: data }))

      if (status === 'ok' && punches[item.id]) {
        await supabase.from('punch_points').delete().eq('id', punches[item.id].id)
        setPunches(p => { const n = { ...p }; delete n[item.id]; return n })
        setPunchPhotos(ph => { const n = { ...ph }; delete n[punches[item.id]?.id]; return n })
      }
      if (status === 'punch') {
        setExpandedItem(item.id)
        if (!punches[item.id]) await createPunch(item, sys, data.id)
      }
    } else {
      const { data } = await supabase
        .from('checklist_responses')
        .insert({ site_id: selectedSiteId, system_id: sys.id, item_id: item.id, status, updated_by: profile?.id })
        .select().single()
      setResponses(r => ({ ...r, [item.id]: data }))
      if (status === 'punch') {
        setExpandedItem(item.id)
        await createPunch(item, sys, data.id)
      }
      if (status === 'ok') setExpandedItem(item.id) // auto-open for photo/notes
    }

    setSaving(s => ({ ...s, [item.id]: false }))
  }

  async function createPunch(item, sys, responseId) {
    const { data } = await supabase
      .from('punch_points')
      .insert({ response_id: responseId, site_id: selectedSiteId, system_id: sys.id, item_id: item.id })
      .select().single()
    if (data) setPunches(p => ({ ...p, [item.id]: data }))
    return data
  }

  async function updatePunch(itemId, fields) {
    const punch = punches[itemId]
    if (!punch) return
    const { data } = await supabase.from('punch_points').update(fields).eq('id', punch.id).select().single()
    if (data) setPunches(p => ({ ...p, [itemId]: data }))
  }

  async function updateNotes(itemId, notes) {
    const resp = responses[itemId]
    if (!resp) return
    await supabase.from('checklist_responses').update({ notes }).eq('id', resp.id)
    setResponses(r => ({ ...r, [itemId]: { ...r[itemId], notes } }))
  }

  // Upload photo for punch items
  async function handlePunchPhotoUpload(e, itemId) {
    const punch = punches[itemId]
    if (!punch) return
    const files = Array.from(e.target.files)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `punches/${punch.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('punch-photos').upload(path, file)
      if (error) continue
      const { data: urlData } = supabase.storage.from('punch-photos').getPublicUrl(path)
      const { data: photo } = await supabase
        .from('punch_photos').insert({ punch_id: punch.id, storage_path: path, url: urlData.publicUrl })
        .select().single()
      if (photo) setPunchPhotos(ph => ({ ...ph, [punch.id]: [...(ph[punch.id] || []), photo] }))
    }
    e.target.value = ''
  }

  // Upload photo for OK items (stored in response_photos)
  async function handleRespPhotoUpload(e, itemId) {
    const resp = responses[itemId]
    if (!resp) return
    const files = Array.from(e.target.files)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `responses/${resp.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('punch-photos').upload(path, file)
      if (error) continue
      const { data: urlData } = supabase.storage.from('punch-photos').getPublicUrl(path)
      const { data: photo } = await supabase
        .from('response_photos').insert({ response_id: resp.id, storage_path: path, url: urlData.publicUrl })
        .select().single()
      if (photo) setRespPhotos(rp => ({ ...rp, [resp.id]: [...(rp[resp.id] || []), photo] }))
    }
    e.target.value = ''
  }

  async function removePunchPhoto(photo, itemId) {
    await supabase.storage.from('punch-photos').remove([photo.storage_path])
    await supabase.from('punch_photos').delete().eq('id', photo.id)
    const punchId = punches[itemId]?.id
    setPunchPhotos(ph => ({ ...ph, [punchId]: (ph[punchId] || []).filter(p => p.id !== photo.id) }))
  }

  async function removeRespPhoto(photo, itemId) {
    await supabase.storage.from('punch-photos').remove([photo.storage_path])
    await supabase.from('response_photos').delete().eq('id', photo.id)
    const respId = responses[itemId]?.id
    setRespPhotos(rp => ({ ...rp, [respId]: (rp[respId] || []).filter(p => p.id !== photo.id) }))
  }

  if (!selectedSiteId && !profile?.is_admin) {
    return <div className="p-6 text-center text-gray-500">No site assigned. Contact admin.</div>
  }

  return (
    <div className="flex flex-col h-full">
      {profile?.is_admin && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <select value={selectedSiteId || ''} onChange={e => { setSelectedSiteId(e.target.value); setActiveSystemIdx(0) }} className="text-sm">
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {!profile?.is_admin && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <p className="text-sm font-medium text-gray-700">{profile?.sites?.name}</p>
        </div>
      )}

      {/* System tabs */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="flex min-w-max">
          {systems.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => { setActiveSystemIdx(idx); setExpandedItem(null) }}
              className={`relative px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeSystemIdx === idx ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => {
              const resp = responses[item.id]
              const punch = punches[item.id]
              const pphotos = punchPhotos[punch?.id] || []
              const rphotos = respPhotos[resp?.id] || []
              const isPunch = resp?.status === 'punch'
              const isOk = resp?.status === 'ok'
              const isExpanded = expandedItem === item.id
              const isSaving = saving[item.id]
              const hasMedia = pphotos.length > 0 || rphotos.length > 0 || resp?.notes

              return (
                <div key={item.id} className="bg-white">
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 mt-0.5 w-5 shrink-0">{item.item_number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{item.description}</p>
                        {/* Media indicator */}
                        {hasMedia && !isExpanded && (
                          <div className="flex items-center gap-2 mt-1">
                            {rphotos.length > 0 && <span className="text-xs text-gray-400">📷 {rphotos.length}</span>}
                            {pphotos.length > 0 && <span className="text-xs text-gray-400">📷 {pphotos.length}</span>}
                            {resp?.notes && <span className="text-xs text-gray-400 flex items-center gap-0.5"><StickyNote size={10} /> note</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
                        <button onClick={() => handleStatus(item, 'ok')} disabled={isSaving}
                          className={`btn-ok ${isOk ? 'active' : ''}`}>OK</button>
                        <button
                          onClick={() => {
                            handleStatus(item, 'punch')
                            if (isPunch) setExpandedItem(isExpanded ? null : item.id)
                          }}
                          disabled={isSaving}
                          className={`btn-punch ${isPunch ? 'active' : ''}`}>Punch</button>
                        {/* Expand button for OK items */}
                        {isOk && (
                          <button
                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                            className={`p-1.5 rounded-lg border transition-colors ${isExpanded ? 'border-orange-400 text-orange-500 bg-orange-50' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}
                            title="Add photo / note"
                          >
                            <ImagePlus size={14} />
                          </button>
                        )}
                        {isPunch && (
                          <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} className="text-gray-400 hover:text-gray-600">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* OK expanded panel — photos + notes */}
                  {isExpanded && isOk && (
                    <div className="bg-green-50 border-t border-green-100 px-4 py-4 space-y-3">
                      <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                        <ImagePlus size={13} /> Photos &amp; Notes for this OK item
                      </p>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                        <textarea
                          rows={2}
                          defaultValue={resp?.notes || ''}
                          placeholder="Add observation notes…"
                          onBlur={e => updateNotes(item.id, e.target.value)}
                          className="resize-none w-full"
                        />
                      </div>

                      {/* Photos */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Photos</label>
                        <div className="flex flex-wrap gap-2">
                          {rphotos.map(photo => (
                            <div key={photo.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                              <img src={photo.url} alt="" className="w-full h-full object-cover" />
                              <button onClick={() => removeRespPhoto(photo, item.id)}
                                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-green-300 flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 transition-colors text-green-500">
                            <Camera size={20} />
                            <span className="text-xs mt-1">Add</span>
                            <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                              onChange={e => handleRespPhotoUpload(e, item.id)} />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Punch expanded panel */}
                  {isExpanded && isPunch && punch && (
                    <div className="bg-orange-50 border-t border-orange-100 px-4 py-4 space-y-3">
                      {/* Priority */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Priority *</label>
                        <div className="flex gap-2">
                          {['Critical', 'Minor'].map(p => (
                            <button key={p} onClick={() => updatePunch(item.id, { priority: p })}
                              className={`px-4 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                                punch.priority === p
                                  ? p === 'Critical' ? 'bg-red-600 border-red-600 text-white' : 'bg-yellow-500 border-yellow-500 text-white'
                                  : 'border-gray-300 text-gray-500'
                              }`}>{p}</button>
                          ))}
                        </div>
                      </div>

                      {/* Contractor */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Contractor</label>
                        <input type="text" defaultValue={punch.contractor || ''} placeholder="Contractor name"
                          onBlur={e => updatePunch(item.id, { contractor: e.target.value })} />
                      </div>

                      {/* Target date */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Target Closure Date</label>
                        <input type="date" defaultValue={punch.target_date || ''}
                          onBlur={e => updatePunch(item.id, { target_date: e.target.value || null })} />
                      </div>

                      {/* Remarks */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks</label>
                        <textarea rows={2} defaultValue={punch.remarks || ''} placeholder="Add remarks…"
                          onBlur={e => updatePunch(item.id, { remarks: e.target.value })} className="resize-none" />
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                        <textarea rows={2} defaultValue={resp?.notes || ''} placeholder="Additional notes…"
                          onBlur={e => updateNotes(item.id, e.target.value)} className="resize-none" />
                      </div>

                      {/* Photos */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Photos</label>
                        <div className="flex flex-wrap gap-2">
                          {pphotos.map(photo => (
                            <div key={photo.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                              <img src={photo.url} alt="punch" className="w-full h-full object-cover" />
                              <button onClick={() => removePunchPhoto(photo, item.id)}
                                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-orange-300 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-50 transition-colors text-orange-400">
                            <Camera size={20} />
                            <span className="text-xs mt-1">Add</span>
                            <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                              onChange={e => handlePunchPhotoUpload(e, item.id)} />
                          </label>
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
