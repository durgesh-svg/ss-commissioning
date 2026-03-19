import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle2, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

const SEV_COLOR = {
  error:   'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  info:    'bg-blue-100 text-blue-700',
}

export default function ErrorLog() {
  const [errors, setErrors]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(null)
  const [filter, setFilter]       = useState('unresolved') // all | unresolved | resolved

  useEffect(() => { fetchErrors() }, [filter])

  async function fetchErrors() {
    setLoading(true)
    let q = supabase
      .from('app_errors')
      .select('*, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter === 'unresolved') q = q.eq('resolved', false)
    if (filter === 'resolved')   q = q.eq('resolved', true)
    const { data } = await q
    setErrors(data || [])
    setLoading(false)
  }

  async function markResolved(id, resolved) {
    await supabase.from('app_errors').update({ resolved: !resolved }).eq('id', id)
    setErrors(e => e.map(x => x.id === id ? { ...x, resolved: !resolved } : x))
  }

  async function deleteError(id) {
    await supabase.from('app_errors').delete().eq('id', id)
    setErrors(e => e.filter(x => x.id !== id))
  }

  async function clearResolved() {
    await supabase.from('app_errors').delete().eq('resolved', true)
    fetchErrors()
  }

  const unresolved = errors.filter(e => !e.resolved).length

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Error Log</h1>
          {unresolved > 0 && (
            <span className="text-xs text-red-600 font-medium">{unresolved} unresolved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchErrors} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>
          <button onClick={clearResolved} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            Clear resolved
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['unresolved', 'all', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize ${filter === f ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : errors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-2 text-green-400" />
          <p className="text-sm">No errors 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {errors.map(err => (
            <div key={err.id} className={`bg-white rounded-xl border ${err.resolved ? 'border-gray-100 opacity-60' : 'border-red-100'} overflow-hidden`}>
              <div className="flex items-start gap-3 p-3">
                <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${err.resolved ? 'text-gray-400' : 'text-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_COLOR[err.severity] || SEV_COLOR.error}`}>
                      {err.severity}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(err.created_at).toLocaleString()}
                    </span>
                    {err.profiles?.email && (
                      <span className="text-xs text-gray-400">{err.profiles.email}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 break-words">{err.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{err.url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setExpanded(expanded === err.id ? null : err.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50">
                    {expanded === err.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button onClick={() => markResolved(err.id, err.resolved)}
                    className={`p-1.5 rounded-lg ${err.resolved ? 'text-gray-400 hover:bg-gray-50' : 'text-green-600 hover:bg-green-50'}`}>
                    <CheckCircle2 size={14} />
                  </button>
                  <button onClick={() => deleteError(err.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expanded === err.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
                  {err.stack && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Stack Trace</p>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all bg-white rounded p-2 border border-gray-100 max-h-48 overflow-auto">
                        {err.stack}
                      </pre>
                    </div>
                  )}
                  {err.context && Object.keys(err.context).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Context</p>
                      <pre className="text-xs text-gray-600 bg-white rounded p-2 border border-gray-100">
                        {JSON.stringify(err.context, null, 2)}
                      </pre>
                    </div>
                  )}
                  {err.user_agent && (
                    <p className="text-xs text-gray-400">UA: {err.user_agent}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
