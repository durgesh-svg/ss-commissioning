import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [userSites, setUserSites] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const [profileRes, sitesRes] = await Promise.all([
      supabase.from('profiles').select('*, sites(id, name)').eq('id', userId).single(),
      supabase.from('user_site_assignments').select('site_id, sites(id, name)').eq('user_id', userId),
    ])
    const p = profileRes.data ?? { id: userId, is_admin: false, site_id: null }
    setProfile(p)
    const assigned = (sitesRes.data || []).map(r => r.sites).filter(Boolean)
    // If user has multi-site assignments use those, else fall back to profile.sites
    if (assigned.length > 0) {
      setUserSites(assigned)
    } else if (p.sites) {
      setUserSites([p.sites])
    } else {
      setUserSites([])
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setUserSites([]); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, userSites, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
