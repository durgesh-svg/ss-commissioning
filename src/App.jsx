import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Checklist from './pages/Checklist'
import PunchList from './pages/PunchList'
import Settings from './pages/Settings'
import TestRecords from './pages/TestRecords'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { profile } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              {profile?.is_admin ? (
                <>
                  <Route path="/"          element={<Dashboard />} />
                  <Route path="/checklist" element={<Checklist />} />
                  <Route path="/punches"   element={<PunchList />} />
                  <Route path="/records"   element={<TestRecords />} />
                  <Route path="/settings"  element={<Settings />} />
                  <Route path="*"          element={<Navigate to="/" replace />} />
                </>
              ) : (
                <>
                  <Route path="/"        element={<Checklist />} />
                  <Route path="/punches" element={<PunchList />} />
                  <Route path="/records" element={<TestRecords />} />
                  <Route path="*"        element={<Navigate to="/" replace />} />
                </>
              )}
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
