import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, is_admin } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const url = 'https://yvlagovdcxwmfkefdrnv.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2bGFnb3ZkY3h3bWZrZWZkcm52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ4Nzc4NCwiZXhwIjoyMDg5MDYzNzg0fQ.yJeoqr0mftQiW3mrbEHG7cfMigvsMZYOkb60iXIi444'

  const admin = createClient(url, key)

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_admin: !!is_admin }
  })

  if (error) return res.status(400).json({ error: error.message })

  // Always create profile (trigger may not fire for admin-created users)
  const { error: profErr } = await admin.from('profiles').upsert({
    id: data.user.id,
    email,
    is_admin: !!is_admin
  })
  if (profErr) console.error('Profile upsert error:', profErr.message)

  return res.status(200).json({ user: data.user })
}
