import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Camera, X, Loader2, ChevronDown, ChevronUp,
  ImagePlus, StickyNote, CheckCircle2, Trash2, ZoomIn
} from 'lucide-react'

/* ── inline photo lightbox ── */
function PhotoModal({ url, onClose }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 rounded-full p-2 text-white"><X size={20} /></button>
      <img src={url} alt="photo" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  )
}

export default function Checklist() {
  const { profile, userSites } = useAuth()
  const [searchParams] = useSearchParams()

  const [sites, setSites]               = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState(null)
  const [systems, setSystems]           = useState([])
  const [activeSystemIdx, setActiveSystemIdx] = useState(0)
  const [items, setItems]               = useState([])
  const [responses, setResponses]       = useState({})
  const [punches, setPunches]           = useState({})
  const [punchPhotos, setPunchPhotos]   = useState({})
  const [respPhotos, setRespPhotos]     = useState({})
  const [contractorMap, setContractorMap] = useState({}) // system_id → contractor_name
  const [expandedItem, setExpandedItem] = useState(null)
  const [pendingPick, setPendingPick]   = useState({}) // item_id → 'ok'|'punch' (not yet saved)
  const [saving, setSaving]             = useState({})
  const [loading, setLoading]           = useState(true)
  const [photoConfirmed, setPhotoConfirmed] = useState({})
  const [uploadingPhoto, setUploadingPhoto] = useState({})
  const [lightboxUrl, setLightboxUrl]   = useState(null)
  const [photoErrors, setPhotoErrors]   = useState({}) // item_id → bool

  useEffect(() => { loadStaticData() }, [userSites])

  async function loadStaticData() {
    const [sitesRes, systemsRes] = await Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
    ])
    setSites(sitesRes.data || [])
    setSystems(systemsRes.data || [])

    const paramSite = searchParams.get('site')
    if (profile?.is_admin) {
      setSelectedSiteId(paramSite || sitesRes.data?.[0]?.id || null)
    } else {
      // Use first assigned site, or fallback to profile.site_id
      setSelectedSiteId(paramSite || userSites[0]?.id || profile?.site_id || null)
    }
  }

  // Keep profile.site_id in sync with selected site so RLS INSERT checks pass
  useEffect(() => {
    if (selectedSiteId && profile?.id) {
      supabase.from('profiles').update({ site_id: selectedSiteId }).eq('id', profile.id)
    }
  }, [selectedSiteId])

  useEffect(() => {
    if (selectedSiteId && systems.length) loadChecklist()
  }, [selectedSiteId, activeSystemIdx, systems])

  async function loadChecklist() {
    setLoading(true)
    const sys = systems[activeSystemIdx]
    if (!sys) return

    const [itemsRes, responsesRes, contractorRes] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('system_id', sys.id).order('item_number'),
      supabase.from('checklist_responses').select('*').eq('site_id', selectedSiteId).eq('system_id', sys.id),
      supabase.from('contractor_assignments').select('contractor_name').eq('site_id', selectedSiteId).eq('system_id', sys.id).maybeSingle(),
    ])

    const itemList = itemsRes.data || []
    setItems(itemList)

    const respMap = {}
    for (const r of responsesRes.data || []) respMap[r.item_id] = r
    setResponses(respMap)

    // Contractor pre-fill
    setContractorMap(prev => ({ ...prev, [sys.id]: contractorRes.data?.contractor_name || '' }))

    // Load punch points + response photos in parallel
    const punchItemIds = itemList.filter(i => respMap[i.id]?.status === 'punch').map(i => i.id)
    const allRespIds = (responsesRes.data || []).map(r => r.id)

    const [punchRes, rPhotoRes] = await Promise.all([
      punchItemIds.length
        ? supabase.from('punch_points').select('*').eq('site_id', selectedSiteId).in('item_id', punchItemIds)
        : Promise.resolve({ data: [] }),
      allRespIds.length
        ? supabase.from('response_photos').select('*').in('response_id', allRespIds)
        : Promise.resolve({ data: [] }),
    ])

    const punchMap = {}
    for (const p of punchRes.data || []) punchMap[p.item_id] = p
    setPunches(punchMap)

    const rPhotoMap = {}
    for (const ph of rPhotoRes.data || []) {
      if (!rPhotoMap[ph.response_id]) rPhotoMap[ph.response_id] = []
      rPhotoMap[ph.response_id].push(ph)
    }
    setRespPhotos(rPhotoMap)

    // Load punch photos (needs punch IDs from above)
    const punchIds = (punchRes.data || []).map(p => p.id)
    if (punchIds.length) {
      const photoRes = await supabase.from('punch_photos').select('*').in('punch_id', punchIds)
      const photoMap = {}
      for (const ph of photoRes.data || []) {
        if (!photoMap[ph.punch_id]) photoMap[ph.punch_id] = []
        photoMap[ph.punch_id].push(ph)
      }
      setPunchPhotos(photoMap)
    } else { setPunchPhotos({}) }

    setLoading(false)
  }

  // For OK: open panel, save only on Done
  // For Punch: save immediately (punch record needed for photos), then mark pending-done
  function handlePick(item, status) {
    const existing = responses[item.id]
    if (existing?.status === status) {
      setExpandedItem(expandedItem === item.id ? null : item.id)
      return
    }
    // Both OK and Punch save immediately so photos can be uploaded right away
    saveImmediately(item, status)
  }

  // Saves to DB immediately, marks item as pending-done (faded color until Done pressed)
  async function saveImmediately(item, status) {
    const sys = systems[activeSystemIdx]
    if (!sys || !selectedSiteId) return
    setSaving(s => ({ ...s, [item.id]: true }))
    try {
      const existing = responses[item.id]
      let respData
      if (existing) {
        const { data, error } = await supabase
          .from('checklist_responses')
          .update({ status, updated_at: new Date().toISOString(), updated_by: profile?.id })
          .eq('id', existing.id).select().single()
        if (error) { alert('Save failed: ' + error.message); return }
        respData = data
        setResponses(r => ({ ...r, [item.id]: data }))
        if (status === 'ok' && punches[item.id]) {
          await supabase.from('punch_points').delete().eq('id', punches[item.id].id)
          setPunches(p => { const n = { ...p }; delete n[item.id]; return n })
          setPunchPhotos(ph => { const n = { ...ph }; delete n[punches[item.id]?.id]; return n })
        }
        if (status === 'punch' && !punches[item.id]) await createPunch(item, sys, data.id)
      } else {
        const { data, error } = await supabase
          .from('checklist_responses')
          .insert({ site_id: selectedSiteId, system_id: sys.id, item_id: item.id, status, updated_by: profile?.id })
          .select().single()
        if (error) { alert('Save failed: ' + error.message); return }
        respData = data
        setResponses(r => ({ ...r, [item.id]: data }))
        if (status === 'punch') await createPunch(item, sys, data.id)
      }
      setPendingPick(p => ({ ...p, [item.id]: status })) // faded until Done
      setExpandedItem(item.id)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(s => ({ ...s, [item.id]: false }))
    }
  }

  // Called when Done is pressed — saves OK to DB (punch already saved), clears pending
  async function saveStatus(item, status) {
    const sys = systems[activeSystemIdx]
    if (!sys || !selectedSiteId) { alert('No site/system selected'); return }
    setSaving(s => ({ ...s, [item.id]: true }))
    try {
      const existing = responses[item.id]
      if (existing) {
        const { data, error } = await supabase
          .from('checklist_responses')
          .update({ status, updated_at: new Date().toISOString(), updated_by: profile?.id })
          .eq('id', existing.id).select().single()
        if (error) { alert('Save failed: ' + error.message); return }
        setResponses(r => ({ ...r, [item.id]: data }))
      } else {
        const { data, error } = await supabase
          .from('checklist_responses')
          .insert({ site_id: selectedSiteId, system_id: sys.id, item_id: item.id, status, updated_by: profile?.id })
          .select().single()
        if (error) { alert('Save failed: ' + error.message); return }
        setResponses(r => ({ ...r, [item.id]: data }))
      }
      setPendingPick(p => { const n = { ...p }; delete n[item.id]; return n })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(s => ({ ...s, [item.id]: false }))
    }
  }

  async function createPunch(item, sys, responseId) {
    const prefillContractor = contractorMap[sys.id] || ''
    const { data, error } = await supabase
      .from('punch_points')
      .insert({ response_id: responseId, site_id: selectedSiteId, system_id: sys.id, item_id: item.id, contractor: prefillContractor })
      .select().single()
    if (error) { alert('Punch create failed: ' + error.message); return null }
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

  function showPhotoConfirm(itemId) {
    setPhotoConfirmed(c => ({ ...c, [itemId]: true }))
    setPhotoErrors(e => ({ ...e, [itemId]: false }))
    setTimeout(() => setPhotoConfirmed(c => ({ ...c, [itemId]: false })), 2500)
  }

  async function handlePunchPhotoUpload(e, itemId) {
    const punch = punches[itemId]
    if (!punch) return
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploadingPhoto(u => ({ ...u, [itemId]: true }))
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
    setUploadingPhoto(u => ({ ...u, [itemId]: false }))
    showPhotoConfirm(itemId)
    e.target.value = ''
  }

  async function handleRespPhotoUpload(e, itemId) {
    const resp = responses[itemId]
    if (!resp) return
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploadingPhoto(u => ({ ...u, [itemId]: true }))
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
    setUploadingPhoto(u => ({ ...u, [itemId]: false }))
    showPhotoConfirm(itemId)
    e.target.value = ''
  }

  async function handleDone(item, photos, status) {
    if (!photos || photos.length === 0) {
      setPhotoErrors(e => ({ ...e, [item.id]: true }))
      return
    }
    setPhotoErrors(e => ({ ...e, [item.id]: false }))
    // Both OK and Punch are already saved on click — just clear pending + close
    setPendingPick(p => { const n = { ...p }; delete n[item.id]; return n })
    setExpandedItem(null)
  }

  async function deleteOkResponse(itemId) {
    const resp = responses[itemId]
    if (!resp) return
    const photos = respPhotos[resp.id] || []
    for (const ph of photos) await supabase.storage.from('punch-photos').remove([ph.storage_path])
    await supabase.from('response_photos').delete().eq('response_id', resp.id)
    await supabase.from('checklist_responses').update({ status: null, notes: null }).eq('id', resp.id)
    setResponses(r => ({ ...r, [itemId]: { ...r[itemId], status: null, notes: null } }))
    setRespPhotos(rp => { const n = { ...rp }; delete n[resp.id]; return n })
    setExpandedItem(null)
  }

  async function deletePunch(itemId) {
    const punch = punches[itemId]
    const resp = responses[itemId]
    setSaving(s => ({ ...s, [itemId]: true }))
    try {
      if (punch) {
        // Delete photos from storage + DB
        const photos = punchPhotos[punch.id] || []
        for (const ph of photos) await supabase.storage.from('punch-photos').remove([ph.storage_path])
        await supabase.from('punch_photos').delete().eq('punch_id', punch.id)
        const { error } = await supabase.from('punch_points').delete().eq('id', punch.id)
        if (error) { alert('Delete failed: ' + error.message); return }
        setPunches(p => { const n = { ...p }; delete n[itemId]; return n })
        setPunchPhotos(ph => { const n = { ...ph }; delete n[punch.id]; return n })
      } else {
        // punch_points record missing — delete by item_id + site as fallback
        await supabase.from('punch_points').delete().eq('item_id', itemId).eq('site_id', selectedSiteId)
      }
      if (resp) {
        await supabase.from('checklist_responses').update({ status: null }).eq('id', resp.id)
        setResponses(r => ({ ...r, [itemId]: { ...r[itemId], status: null } }))
      }
      setPendingPick(p => { const n = { ...p }; delete n[itemId]; return n })
      setExpandedItem(null)
    } catch (err) {
      alert('Error deleting punch: ' + err.message)
    } finally {
      setSaving(s => ({ ...s, [itemId]: false }))
    }
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

  // Selectable sites: admin sees all, site manager sees assigned
  const selectableSites = profile?.is_admin ? sites : userSites

  if (!selectedSiteId && !profile?.is_admin && userSites.length === 0) {
    return <div className="p-6 text-center text-gray-500">No site assigned. Contact admin.</div>
  }

  return (
    <div className="flex flex-col h-full">
      <PhotoModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      {/* Site selector */}
      <div className="bg-white border-b border-gray-100 px-4 py-2">
        {selectableSites.length > 1 ? (
          <select
            value={selectedSiteId || ''}
            onChange={e => { setSelectedSiteId(e.target.value); setActiveSystemIdx(0) }}
            className="text-sm font-medium w-full"
          >
            {selectableSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          <p className="text-sm font-medium text-gray-700">{selectableSites[0]?.name || '—'}</p>
        )}
      </div>

      {/* System tabs */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="flex min-w-max">
          {systems.map((s, idx) => (
            <button key={s.id} onClick={() => { setActiveSystemIdx(idx); setExpandedItem(null) }}
              className={`relative px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeSystemIdx === idx ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
              }`}>
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
              const savedStatus = resp?.status
              const pending = pendingPick[item.id]
              // solid color only after Done pressed (no pending)
              const isPunch = savedStatus === 'punch' && !pending
              const isOk = savedStatus === 'ok' && !pending
              // faded color = saved but Done not yet pressed, OR ok selected but not yet saved
              const isPendingOk = (savedStatus === 'ok' && pending === 'ok') || (!savedStatus && pending === 'ok')
              const isPendingPunch = (savedStatus === 'punch' && pending === 'punch')
              const isExpanded = expandedItem === item.id
              const isSaving = saving[item.id]
              const hasPhotoError = photoErrors[item.id]

              return (
                <div key={item.id} className="bg-white">
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 mt-0.5 w-5 shrink-0">{item.item_number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{item.description}</p>
                        {!isExpanded && (rphotos.length > 0 || pphotos.length > 0 || resp?.notes) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {(rphotos.length > 0 || pphotos.length > 0) && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                <Camera size={11} /> {rphotos.length + pphotos.length} photo{rphotos.length + pphotos.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {resp?.notes && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                <StickyNote size={11} /> note
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
                        <button onClick={() => handlePick(item, 'ok')} disabled={isSaving}
                          className={`btn-ok ${isOk ? 'active' : isPendingOk ? 'opacity-50 active' : ''}`}>OK</button>
                        <button onClick={() => handlePick(item, 'punch')} disabled={isSaving}
                          className={`btn-punch ${isPunch ? 'active' : isPendingPunch ? 'opacity-50 active' : ''}`}>Punch</button>
                        {(isOk || isPunch || isPendingOk || isPendingPunch) && (
                          <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} className="text-gray-400">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* OK expanded panel */}
                  {isExpanded && (isOk || isPendingOk || savedStatus === 'ok') && (
                    <div className="bg-green-50 border-t border-green-100 px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                          <ImagePlus size={13} /> Photos &amp; Notes
                        </p>
                        <button onClick={() => setExpandedItem(null)}
                          className="text-xs font-semibold text-gray-500 border border-gray-300 rounded-lg px-3 py-1">✕ Close</button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                        <textarea rows={2} defaultValue={resp?.notes || ''} placeholder="Add observation notes…"
                          onBlur={e => updateNotes(item.id, e.target.value)} className="resize-none w-full" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                          Photos <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {rphotos.map(photo => (
                            <div key={photo.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                              <img src={photo.url} alt="" className="w-full h-full object-cover cursor-pointer"
                                onClick={() => setLightboxUrl(photo.url)} />
                              <button onClick={() => removeRespPhoto(photo, item.id)}
                                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"><X size={10} /></button>
                              <button onClick={() => setLightboxUrl(photo.url)}
                                className="absolute bottom-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"><ZoomIn size={10} /></button>
                            </div>
                          ))}
                          <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                            uploadingPhoto[item.id] ? 'opacity-50 pointer-events-none border-green-300 text-green-500'
                            : hasPhotoError ? 'border-red-400 text-red-500 bg-red-50' : 'border-green-300 text-green-500 hover:bg-green-50'}`}>
                            {uploadingPhoto[item.id]
                              ? <Loader2 size={20} className="animate-spin text-green-500" />
                              : <><Camera size={20} /><span className="text-xs mt-1">Add</span></>}
                            <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                              onChange={e => handleRespPhotoUpload(e, item.id)} />
                          </label>
                        </div>
                        {hasPhotoError && (
                          <p className="text-xs text-red-600 mt-1 font-semibold">⚠ At least 1 photo is required before closing</p>
                        )}
                        {photoConfirmed[item.id] && (
                          <div className="mt-2 flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                            <CheckCircle2 size={14} /> Photo saved successfully
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleDone(item, rphotos, 'ok')}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-green-600">Done</button>
                        <button onClick={() => deleteOkResponse(item.id)}
                          className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border-2 border-red-200 hover:bg-red-50">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Punch expanded panel */}
                  {isExpanded && (isPunch || isPendingPunch || savedStatus === 'punch') && (
                    <div className="bg-orange-50 border-t border-orange-100 px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-orange-700">Punch Details</p>
                        <button onClick={() => setExpandedItem(null)}
                          className="text-xs font-semibold text-gray-500 border border-gray-300 rounded-lg px-3 py-1">✕ Close</button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Priority *</label>
                        <div className="flex gap-2">
                          {['Critical', 'Minor'].map(p => (
                            <button key={p} onClick={() => updatePunch(item.id, { priority: p })}
                              className={`px-4 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                                punch?.priority === p
                                  ? p === 'Critical' ? 'bg-red-600 border-red-600 text-white' : 'bg-yellow-500 border-yellow-500 text-white'
                                  : 'border-gray-300 text-gray-500'}`}>{p}</button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Contractor</label>
                        <input type="text" defaultValue={punch?.contractor || ''}
                          placeholder="Contractor name"
                          onBlur={e => updatePunch(item.id, { contractor: e.target.value })} />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Target Closure Date</label>
                        <input type="date" defaultValue={punch?.target_date || ''}
                          onBlur={e => updatePunch(item.id, { target_date: e.target.value || null })} />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks</label>
                        <textarea rows={2} defaultValue={punch?.remarks || ''} placeholder="Add remarks…"
                          onBlur={e => updatePunch(item.id, { remarks: e.target.value })} className="resize-none" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                        <textarea rows={2} defaultValue={resp?.notes || ''} placeholder="Additional notes…"
                          onBlur={e => updateNotes(item.id, e.target.value)} className="resize-none" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                          Photos <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {pphotos.map(photo => (
                            <div key={photo.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                              <img src={photo.url} alt="punch" className="w-full h-full object-cover cursor-pointer"
                                onClick={() => setLightboxUrl(photo.url)} />
                              <button onClick={() => removePunchPhoto(photo, item.id)}
                                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"><X size={10} /></button>
                              <button onClick={() => setLightboxUrl(photo.url)}
                                className="absolute bottom-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"><ZoomIn size={10} /></button>
                            </div>
                          ))}
                          <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                            uploadingPhoto[item.id] ? 'opacity-50 pointer-events-none border-orange-300 text-orange-400'
                            : hasPhotoError ? 'border-red-400 text-red-500 bg-red-50' : 'border-orange-300 text-orange-400 hover:bg-orange-50'}`}>
                            {uploadingPhoto[item.id]
                              ? <Loader2 size={20} className="animate-spin text-orange-400" />
                              : <><Camera size={20} /><span className="text-xs mt-1">Add</span></>}
                            <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                              onChange={e => handlePunchPhotoUpload(e, item.id)} />
                          </label>
                        </div>
                        {hasPhotoError && (
                          <p className="text-xs text-red-600 mt-1 font-semibold">⚠ At least 1 photo is required before closing</p>
                        )}
                        {photoConfirmed[item.id] && (
                          <div className="mt-2 flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                            <CheckCircle2 size={14} /> Photo saved successfully
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleDone(item, pphotos, 'punch')}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#d85a30' }}>
                          Done
                        </button>
                        <button onClick={() => deletePunch(item.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border-2 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none">
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Punch
                        </button>
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
