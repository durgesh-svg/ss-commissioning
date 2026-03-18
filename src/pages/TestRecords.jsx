import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Trash2, Loader2, Save } from 'lucide-react'

const EMPTY_EP  = { ep_number: '', ep_value_with_grid: '', ep_value_without_grid: '', cover_status: 'OK' }
const EMPTY_IR  = { row_label: '', voltage_inject: '1000V', r_y: '', y_b: '', b_r: '', r_e: '', y_e: '', b_e: '', remark: '' }
const EMPTY_HT  = { row_label: '', voltage_inject: '5000V', r_y: '', y_b: '', b_r: '', r_e: '', y_e: '', b_e: '', remark: '' }

export default function TestRecords() {
  const { profile, userSites } = useAuth()
  const [sites, setSites]             = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState(null)
  const [tab, setTab]                 = useState('earthing')
  const [loading, setLoading]         = useState(false)

  // Earthing pits
  const [epRows, setEpRows]           = useState([])
  // IR: inverter LT
  const [irRows, setIrRows]           = useState([])
  // IR: HT cable
  const [htRows, setHtRows]           = useState([])

  const [saving, setSaving]           = useState(false)

  useEffect(() => { loadSites() }, [userSites])

  async function loadSites() {
    if (profile?.is_admin) {
      const { data } = await supabase.from('sites').select('*').order('name')
      setSites(data || [])
      setSelectedSiteId(data?.[0]?.id || null)
    } else {
      setSites(userSites)
      setSelectedSiteId(userSites[0]?.id || profile?.site_id || null)
    }
  }

  useEffect(() => {
    if (selectedSiteId) loadRecords()
  }, [selectedSiteId])

  async function loadRecords() {
    setLoading(true)
    const [epRes, irRes, htRes] = await Promise.all([
      supabase.from('earthing_pit_records').select('*').eq('site_id', selectedSiteId).order('sort_order'),
      supabase.from('ir_records').select('*').eq('site_id', selectedSiteId).eq('record_type', 'inverter_lt').order('sort_order'),
      supabase.from('ir_records').select('*').eq('site_id', selectedSiteId).eq('record_type', 'ht_cable').order('sort_order'),
    ])
    setEpRows(epRes.data?.length ? epRes.data : [{ ...EMPTY_EP, _new: true }])
    setIrRows(irRes.data?.length ? irRes.data : [{ ...EMPTY_IR, _new: true }])
    setHtRows(htRes.data?.length ? htRes.data : [{ ...EMPTY_HT, _new: true }])
    setLoading(false)
  }

  /* ── earthing helpers ── */
  function updateEp(idx, field, value) {
    setEpRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value, _dirty: true } : r))
  }
  function addEpRow() {
    setEpRows(rows => [...rows, { ...EMPTY_EP, _new: true }])
  }
  async function removeEpRow(idx) {
    const row = epRows[idx]
    if (row.id) await supabase.from('earthing_pit_records').delete().eq('id', row.id)
    setEpRows(rows => rows.filter((_, i) => i !== idx))
  }

  /* ── IR helpers ── */
  function updateIr(idx, field, value, type) {
    if (type === 'inverter_lt') setIrRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value, _dirty: true } : r))
    else setHtRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value, _dirty: true } : r))
  }
  function addIrRow(type) {
    if (type === 'inverter_lt') setIrRows(rows => [...rows, { ...EMPTY_IR, _new: true }])
    else setHtRows(rows => [...rows, { ...EMPTY_HT, _new: true }])
  }
  async function removeIrRow(idx, type) {
    const rows = type === 'inverter_lt' ? irRows : htRows
    const row = rows[idx]
    if (row.id) await supabase.from('ir_records').delete().eq('id', row.id)
    if (type === 'inverter_lt') setIrRows(r => r.filter((_, i) => i !== idx))
    else setHtRows(r => r.filter((_, i) => i !== idx))
  }

  async function saveAll() {
    setSaving(true)

    // Save EP rows
    const newEpRows = []
    for (let i = 0; i < epRows.length; i++) {
      const r = epRows[i]
      if (!r.ep_number) { newEpRows.push(r); continue }
      const payload = { site_id: selectedSiteId, ep_number: r.ep_number,
        ep_value_with_grid: r.ep_value_with_grid || null,
        ep_value_without_grid: r.ep_value_without_grid || null,
        cover_status: r.cover_status || 'OK', sort_order: i, updated_at: new Date().toISOString() }
      if (r.id) {
        const { data } = await supabase.from('earthing_pit_records').update(payload).eq('id', r.id).select().single()
        newEpRows.push(data || r)
      } else {
        const { data } = await supabase.from('earthing_pit_records').insert(payload).select().single()
        newEpRows.push(data || r)
      }
    }
    setEpRows(newEpRows)

    // Save IR rows
    async function saveIrType(rows, type) {
      const saved = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (!r.row_label) { saved.push(r); continue }
        const payload = { site_id: selectedSiteId, record_type: type,
          row_label: r.row_label, voltage_inject: r.voltage_inject,
          r_y: r.r_y, y_b: r.y_b, b_r: r.b_r, r_e: r.r_e, y_e: r.y_e, b_e: r.b_e,
          remark: r.remark, sort_order: i, updated_at: new Date().toISOString() }
        if (r.id) {
          const { data } = await supabase.from('ir_records').update(payload).eq('id', r.id).select().single()
          saved.push(data || r)
        } else {
          const { data } = await supabase.from('ir_records').insert(payload).select().single()
          saved.push(data || r)
        }
      }
      return saved
    }
    setIrRows(await saveIrType(irRows, 'inverter_lt'))
    setHtRows(await saveIrType(htRows, 'ht_cable'))

    setSaving(false)
  }

  const selectableSites = profile?.is_admin ? sites : userSites

  return (
    <div className="flex flex-col h-full">
      {/* Site selector */}
      {selectableSites.length > 1 ? (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <select value={selectedSiteId || ''} onChange={e => setSelectedSiteId(e.target.value)} className="text-sm w-full">
            {selectableSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      ) : (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <p className="text-sm font-medium text-gray-700">{selectableSites[0]?.name || '—'}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex">
        {[
          { key: 'earthing', label: 'Earthing Pits' },
          { key: 'ir_inv',   label: 'IR — Inverter/LT' },
          { key: 'ir_ht',    label: 'IR — HT Cable' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto pb-24">
        {loading
          ? <div className="p-6 text-center text-gray-400"><Loader2 size={18} className="animate-spin mx-auto" /></div>
          : (
            <>
              {tab === 'earthing' && <EarthingTable rows={epRows} onChange={updateEp} onAdd={addEpRow} onRemove={removeEpRow} />}
              {tab === 'ir_inv'   && <IRTable rows={irRows} type="inverter_lt" title="Inverter to LT Panel" labelHeader="Inverter No." onChange={updateIr} onAdd={addIrRow} onRemove={removeIrRow} />}
              {tab === 'ir_ht'    && <IRTable rows={htRows} type="ht_cable"    title="HT Cable (HT Panel to TL)" labelHeader="Location"    onChange={updateIr} onAdd={addIrRow} onRemove={removeIrRow} />}
            </>
          )
        }
      </div>

      {/* Save button */}
      <div className="fixed bottom-16 left-0 right-0 px-4 py-2 bg-white border-t border-gray-100">
        <button onClick={saveAll} disabled={saving}
          className="w-full py-2.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: '#d85a30' }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save All Records'}
        </button>
      </div>
    </div>
  )
}

function EarthingTable({ rows, onChange, onAdd, onRemove }) {
  return (
    <div className="p-3">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Earth Pit Records</p>
        </div>
        {/* Header */}
        <div className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
          <div className="col-span-3">EP No.</div>
          <div className="col-span-3">With Grid (Ω)</div>
          <div className="col-span-3">Without Grid (Ω)</div>
          <div className="col-span-2">Cover</div>
          <div className="col-span-1"></div>
        </div>
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-1 px-2 py-1.5 border-b border-gray-50 items-center">
            <input className="col-span-3 text-xs py-1 px-2 border border-gray-200 rounded" placeholder="EP-1"
              value={row.ep_number} onChange={e => onChange(idx, 'ep_number', e.target.value)} />
            <input className="col-span-3 text-xs py-1 px-2 border border-gray-200 rounded" placeholder="0.00" type="number" step="0.01"
              value={row.ep_value_with_grid} onChange={e => onChange(idx, 'ep_value_with_grid', e.target.value)} />
            <input className="col-span-3 text-xs py-1 px-2 border border-gray-200 rounded" placeholder="0.00" type="number" step="0.01"
              value={row.ep_value_without_grid} onChange={e => onChange(idx, 'ep_value_without_grid', e.target.value)} />
            <select className="col-span-2 text-xs py-1 px-1 border border-gray-200 rounded"
              value={row.cover_status} onChange={e => onChange(idx, 'cover_status', e.target.value)}>
              <option>OK</option><option>Not OK</option>
            </select>
            <button onClick={() => onRemove(idx)} className="col-span-1 text-red-400 flex justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
        <button onClick={onAdd} className="w-full py-2 text-xs text-orange-600 font-semibold flex items-center justify-center gap-1 hover:bg-orange-50">
          <Plus size={13} /> Add Row
        </button>
      </div>
    </div>
  )
}

function IRTable({ rows, type, title, labelHeader, onChange, onAdd, onRemove }) {
  return (
    <div className="p-3">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">IR Values — {title}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{labelHeader}</th>
                <th className="px-2 py-2 font-semibold text-gray-500">V Inject</th>
                <th className="px-2 py-2 font-semibold text-gray-500">R-Y</th>
                <th className="px-2 py-2 font-semibold text-gray-500">Y-B</th>
                <th className="px-2 py-2 font-semibold text-gray-500">B-R</th>
                <th className="px-2 py-2 font-semibold text-gray-500">R-E</th>
                <th className="px-2 py-2 font-semibold text-gray-500">Y-E</th>
                <th className="px-2 py-2 font-semibold text-gray-500">B-E</th>
                <th className="px-2 py-2 font-semibold text-gray-500">Remark</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  {['row_label','voltage_inject','r_y','y_b','b_r','r_e','y_e','b_e','remark'].map(field => (
                    <td key={field} className="px-1 py-1">
                      <input className="w-full min-w-[48px] text-xs py-1 px-1.5 border border-gray-200 rounded"
                        placeholder={field === 'row_label' ? (type === 'inverter_lt' ? '1' : 'IDT-HT') : '—'}
                        value={row[field] || ''}
                        onChange={e => onChange(idx, field, e.target.value, type)} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button onClick={() => onRemove(idx, type)} className="text-red-400"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => onAdd(type)} className="w-full py-2 text-xs text-orange-600 font-semibold flex items-center justify-center gap-1 hover:bg-orange-50">
          <Plus size={13} /> Add Row
        </button>
      </div>
    </div>
  )
}
