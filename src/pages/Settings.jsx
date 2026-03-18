import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, Plus, Trash2, Upload, UserPlus, Building2, HardHat, X } from 'lucide-react'

export default function Settings() {
  const [tab, setTab] = useState('users')

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-100 flex">
        {[
          { key: 'users',       label: 'Users',       icon: UserPlus },
          { key: 'sites',       label: 'Sites',       icon: Building2 },
          { key: 'contractors', label: 'Contractors', icon: HardHat },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold border-b-2 transition-colors ${
              tab === key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'users'       && <UsersTab />}
        {tab === 'sites'       && <SitesTab />}
        {tab === 'contractors' && <ContractorsTab />}
      </div>
    </div>
  )
}

/* ── USERS TAB ── */
function UsersTab() {
  const [users, setUsers]           = useState([])
  const [sites, setSites]           = useState([])
  const [assignments, setAssignments] = useState({}) // user_id → [site_id]
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [newEmail, setNewEmail]     = useState('')
  const [newPass, setNewPass]       = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [sitesRes, profilesRes, assignRes] = await Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('profiles').select('id, email, is_admin, site_id'),
      supabase.from('user_site_assignments').select('user_id, site_id'),
    ])
    setSites(sitesRes.data || [])
    setUsers(profilesRes.data || [])
    const aMap = {}
    for (const a of assignRes.data || []) {
      if (!aMap[a.user_id]) aMap[a.user_id] = []
      aMap[a.user_id].push(a.site_id)
    }
    setAssignments(aMap)
    setLoading(false)
  }

  async function createUser() {
    if (!newEmail || !newPass) { setError('Email and password required'); return }
    setCreating(true); setError(''); setSuccess('')
    const { data, error: e } = await supabase.functions.invoke('create-user', {
      body: { email: newEmail, password: newPass, is_admin: newIsAdmin }
    })
    if (e || data?.error) {
      // fallback: use admin API via service role — we'll do it via SQL function
      const { error: rpcErr } = await supabase.rpc('admin_create_user', {
        p_email: newEmail, p_password: newPass, p_is_admin: newIsAdmin
      })
      if (rpcErr) { setError(rpcErr.message); setCreating(false); return }
    }
    setSuccess(`User ${newEmail} created`)
    setNewEmail(''); setNewPass(''); setNewIsAdmin(false)
    setCreating(false)
    await loadData()
  }

  async function toggleSiteAssignment(userId, siteId, assigned) {
    if (assigned) {
      await supabase.from('user_site_assignments').delete().eq('user_id', userId).eq('site_id', siteId)
      setAssignments(a => ({ ...a, [userId]: (a[userId] || []).filter(s => s !== siteId) }))
    } else {
      await supabase.from('user_site_assignments').insert({ user_id: userId, site_id: siteId })
      setAssignments(a => ({ ...a, [userId]: [...(a[userId] || []), siteId] }))
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-400"><Loader2 size={18} className="animate-spin mx-auto" /></div>

  return (
    <div className="p-4 space-y-6">
      {/* Create user */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2"><UserPlus size={15} /> Create New User</h3>
        <input type="email" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={newPass} onChange={e => setNewPass(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)} className="w-4 h-4" />
          Admin user
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600">{success}</p>}
        <button onClick={createUser} disabled={creating}
          className="w-full py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: '#d85a30' }}>
          {creating ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Create User'}
        </button>
      </div>

      {/* User site assignments */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">User → Site Assignments</h3>
        {users.filter(u => !u.is_admin).map(user => (
          <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">{user.email}</p>
            <div className="flex flex-wrap gap-1.5">
              {sites.map(site => {
                const assigned = (assignments[user.id] || []).includes(site.id)
                return (
                  <button key={site.id} onClick={() => toggleSiteAssignment(user.id, site.id, assigned)}
                    className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                      assigned ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-500'}`}>
                    {site.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── SITES TAB ── */
function SitesTab() {
  const [sites, setSites]   = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding]   = useState(false)

  useEffect(() => { loadSites() }, [])
  async function loadSites() {
    const { data } = await supabase.from('sites').select('*').order('name')
    setSites(data || [])
    setLoading(false)
  }

  async function addSite() {
    if (!newName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('sites').insert({ name: newName.trim() }).select().single()
    if (data) setSites(s => [...s, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName('')
    setAdding(false)
  }

  async function deleteSite(id) {
    if (!window.confirm('Remove this site? This will not delete existing data.')) return
    await supabase.from('sites').delete().eq('id', id)
    setSites(s => s.filter(x => x.id !== id))
  }

  if (loading) return <div className="p-6 text-center text-gray-400"><Loader2 size={18} className="animate-spin mx-auto" /></div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input type="text" placeholder="New site name" value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSite()} className="flex-1" />
        <button onClick={addSite} disabled={adding || !newName.trim()}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1"
          style={{ background: '#d85a30' }}>
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="space-y-2">
        {sites.map(site => (
          <div key={site.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
            <span className="text-sm text-gray-800">{site.name}</span>
            <button onClick={() => deleteSite(site.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── CONTRACTORS TAB ── */
function ContractorsTab() {
  const [sites, setSites]         = useState([])
  const [systems, setSystems]     = useState([])
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState({})
  const [bulkText, setBulkText]   = useState('')
  const [showBulk, setShowBulk]   = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [sitesRes, systemsRes, caRes] = await Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
      supabase.from('contractor_assignments').select('*'),
    ])
    setSites(sitesRes.data || [])
    setSystems(systemsRes.data || [])
    setRows(caRes.data || [])
    setLoading(false)
  }

  function getContractor(siteId, systemId) {
    return rows.find(r => r.site_id === siteId && r.system_id === systemId)?.contractor_name || ''
  }

  async function setContractor(siteId, systemId, value) {
    const key = `${siteId}_${systemId}`
    setSaving(s => ({ ...s, [key]: true }))
    const existing = rows.find(r => r.site_id === siteId && r.system_id === systemId)
    if (value.trim()) {
      if (existing) {
        await supabase.from('contractor_assignments').update({ contractor_name: value }).eq('id', existing.id)
        setRows(r => r.map(x => x.id === existing.id ? { ...x, contractor_name: value } : x))
      } else {
        const { data } = await supabase.from('contractor_assignments')
          .insert({ site_id: siteId, system_id: systemId, contractor_name: value }).select().single()
        if (data) setRows(r => [...r, data])
      }
    } else if (existing) {
      await supabase.from('contractor_assignments').delete().eq('id', existing.id)
      setRows(r => r.filter(x => x.id !== existing.id))
    }
    setSaving(s => ({ ...s, [key]: false }))
  }

  async function importBulk() {
    // Format: SiteName,SystemName,ContractorName per line
    const lines = bulkText.trim().split('\n').filter(Boolean)
    for (const line of lines) {
      const [siteName, sysName, contractor] = line.split(',').map(s => s.trim())
      const site = sites.find(s => s.name.toLowerCase() === siteName.toLowerCase())
      const sys  = systems.find(s => s.name.toLowerCase() === sysName.toLowerCase())
      if (site && sys && contractor) {
        await setContractor(site.id, sys.id, contractor)
      }
    }
    setBulkText('')
    setShowBulk(false)
  }

  if (loading) return <div className="p-6 text-center text-gray-400"><Loader2 size={18} className="animate-spin mx-auto" /></div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Set default contractor per site + system. Auto-filled on new punches.</p>
        <button onClick={() => setShowBulk(!showBulk)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600">
          <Upload size={12} /> Bulk Import
        </button>
      </div>

      {showBulk && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600">One row per line: <code className="bg-gray-100 px-1 rounded">SiteName, SystemName, ContractorName</code></p>
          <textarea rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)}
            placeholder="Raimalwara-1, Inverter, ABC Contractors&#10;Raimalwara-1, ACDB, XYZ Ltd" className="resize-none w-full text-xs" />
          <div className="flex gap-2">
            <button onClick={importBulk} className="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: '#d85a30' }}>Import</button>
            <button onClick={() => setShowBulk(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sites.map(site => (
          <div key={site.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">{site.name}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {systems.map(sys => {
                const key = `${site.id}_${sys.id}`
                return (
                  <div key={sys.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">{sys.name}</span>
                    <div className="flex-1 relative">
                      <input type="text" defaultValue={getContractor(site.id, sys.id)}
                        placeholder="Contractor name"
                        onBlur={e => setContractor(site.id, sys.id, e.target.value)}
                        className="text-xs w-full py-1 px-2 border border-gray-200 rounded-lg" />
                      {saving[key] && <Loader2 size={10} className="animate-spin text-gray-400 absolute right-2 top-2" />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
