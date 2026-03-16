import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, CheckSquare, AlertTriangle, LogOut } from 'lucide-react'

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const navItems = profile?.is_admin
    ? [
        { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/checklist',icon: CheckSquare,     label: 'Checklist' },
        { to: '/punches',  icon: AlertTriangle,   label: 'Punches' },
      ]
    : [
        { to: '/',         icon: CheckSquare,     label: 'Checklist' },
        { to: '/punches',  icon: AlertTriangle,   label: 'Punches' },
      ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="text-white shadow-md flex items-center justify-between px-4 h-14 shrink-0" style={{ background: '#d85a30' }}>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Stockwell Solar" style={{height:"32px",objectFit:"contain",filter:"brightness(0) invert(1)"}} />
          {profile?.sites?.name && (
            <span className="text-orange-100 text-sm">· {profile.sites.name}</span>
          )}
          {profile?.is_admin && (
            <span className="text-orange-100 text-xs bg-orange-700 rounded px-1.5 py-0.5">Admin</span>
          )}
        </div>
        <button onClick={signOut} className="p-2 rounded-lg hover:bg-orange-700 transition-colors" title="Sign out">
          <LogOut size={18} />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex safe-bottom">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to ||
            (to !== '/' && location.pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                active ? 'text-orange-600' : 'text-gray-400'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
