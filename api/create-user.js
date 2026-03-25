import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, is_admin } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const admin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_admin: !!is_admin }
  })

  if (error) return res.status(400).json({ error: error.message })

  // Update profile is_admin flag
  if (is_admin) {
    await admin.from('profiles').update({ is_admin: true }).eq('id', data.user.id)
  }

  return res.status(200).json({ user: data.user })
}
