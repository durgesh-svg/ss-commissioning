import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AlertTriangle, CheckCircle, ClipboardList } from 'lucide-react'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [sites, setSites] = useState([])
  const [systems, setSystems] = useState([])
  const [stats, setStats] = useState({ total: 0, done: 0, punches: 0, criticalOpen: 0 })
  const [siteStats, setSiteStats] = useState({})
  const [systemStats, setSystemStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const [sitesRes, systemsRes, itemsRes, responsesRes, punchesRes] = await Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
      supabase.from('checklist_items').select('id, system_id'),
      supabase.from('checklist_responses').select('site_id, system_id, item_id, status'),
      supabase.from('punch_points').select('site_id, system_id, priority, closed'),
    ])

    const allSites = sitesRes.data || []
    const allSystems = systemsRes.data || []
    const allItems = itemsRes.data || []
    const responses = responsesRes.data || []
    const punches = punchesRes.data || []

    setSites(allSites)
    setSystems(allSystems)

    // Total items = sites × items per system
    const totalPossible = allSites.length * allItems.length
    const done = responses.filter(r => r.status).length
    const openPunches = punches.filter(p => !p.closed).length
    const criticalOpen = punches.filter(p => !p.closed && p.priority === 'Critical').length
    setStats({ total: totalPossible, done, punches: openPunches, criticalOpen })

    // Per-site stats
    const siteMap = {}
    allSites.forEach(site => {
      const siteItems = allItems.length
      const siteDone = responses.filter(r => r.site_id === site.id && r.status).length
      const sitePunches = punches.filter(p => p.site_id === site.id && !p.closed).length
      siteMap[site.id] = {
        total: siteItems,
        done: siteDone,
        pct: siteItems ? Math.round((siteDone / siteItems) * 100) : 0,
        openPunches: sitePunches,
      }
    })
    setSiteStats(siteMap)

    // Per-system stats (across all sites)
    const systemMap = {}
    allSystems.forEach(sys => {
      const sysItems = allItems.filter(i => i.system_id === sys.id).length * allSites.length
      const sysDone = responses.filter(r => r.system_id === sys.id && r.status).length
      systemMap[sys.id] = {
        total: sysItems,
        done: sysDone,
        pct: sysItems ? Math.round((sysDone / sysItems) * 100) : 0,
      }
    })
    setSystemStats(systemMap)

    setLoading(false)
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Loading dashboard…</div>

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<CheckCircle className="text-green-500" size={20} />}
          label="Checks Done"
          value={stats.done.toLocaleString()}
        />
        <StatCard
          icon={<AlertTriangle className="text-orange-500" size={20} />}
          label="Open Punches"
          value={stats.punches}
        />
        <StatCard
          icon={<AlertTriangle className="text-red-500" size={20} />}
          label="Critical Open"
          value={stats.criticalOpen}
        />
      </div>

      {/* System progress */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">System Progress (All Sites)</h2>
        <div className="space-y-2">
          {systems.map(sys => {
            const s = systemStats[sys.id] || { pct: 0 }
            return (
              <div key={sys.id}>
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span>{sys.name}</span>
                  <span>{s.pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${s.pct}%`, background: '#d85a30' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Site cards */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Sites</h2>
        <div className="grid grid-cols-1 gap-3">
          {sites.map(site => {
            const s = siteStats[site.id] || { pct: 0, openPunches: 0 }
            return (
              <button
                key={site.id}
                onClick={() => navigate(`/checklist?site=${site.id}`)}
                className="card text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800 text-sm">{site.name}</span>
                  <div className="flex items-center gap-2">
                    {s.openPunches > 0 && (
                      <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-semibold">
                        {s.openPunches} punch{s.openPunches !== 1 ? 'es' : ''}
                      </span>
                    )}
                    <span className="text-sm font-bold" style={{ color: '#d85a30' }}>{s.pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.pct}%`, background: '#d85a30' }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="card flex flex-col items-center text-center gap-1 py-3">
      {icon}
      <div className="text-xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
