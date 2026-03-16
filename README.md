# SS Commissioning — Stockwell Solar Pre-Commissioning App

React + Supabase PWA for solar site pre-commissioning checklists with photo-linked punch points.

---

## Quick Start

### 1. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run `supabase/schema.sql`
3. Then run `supabase/seed.sql` to populate sites, systems, and all 270+ checklist items
4. Go to **Storage** → create a bucket named `punch-photos` set to **Public**
5. In the **punch-photos** bucket Storage Policies, add:
   - **INSERT**: `(auth.role() = 'authenticated')`
   - **SELECT**: `true`
   - **DELETE**: `(auth.role() = 'authenticated')`

### 2. Create users

In Supabase → **Authentication** → **Users** → Invite or add users.

Then in the **profiles** table set:
- `is_admin = true` for admin users
- `site_id = <uuid>` for each site manager (copy UUID from the `sites` table)

### 3. Local dev

```bash
cp .env.local.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

### 4. Deploy to Vercel

Connect your GitHub repo to Vercel — it auto-detects Vite. Set these env vars in the Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Or via CLI:
```bash
npx vercel --prod
```

---

## PWA — Install on Android

1. Open the deployed URL in **Chrome for Android**
2. Tap **⋮ → Add to Home Screen** (or accept the install banner)
3. App installs as "SS Commissioning" with the Stockwell Solar orange icon

---

## Roles

| Role | Can see | Can do |
|------|---------|--------|
| Admin | All 17 sites — Dashboard, Checklist, Punch list | Mark punches closed/open |
| Site Manager | Their assigned site only | Fill checklist, attach photos, raise punches |

---

## File Structure

```
supabase/schema.sql      — DB schema + RLS policies
supabase/seed.sql        — 17 sites, 18 systems, 270 checklist items
src/
  lib/supabase.js
  contexts/AuthContext.jsx
  pages/Login.jsx
  pages/Dashboard.jsx    — Admin only
  pages/Checklist.jsx    — OK/Punch + photo upload
  pages/PunchList.jsx    — Filterable punch list
  components/Layout.jsx
public/
  manifest.json
  sw.js
  icons/icon-192.png
  icons/icon-512.png
vercel.json
```

---

## Systems & Item Counts

| System | Items |
|--------|-------|
| Inverter | 41 |
| ACDB | 30 |
| Transformer | 30 |
| HT Panel | 20 |
| WMS | 19 |
| SCADA | 19 |
| LA | 18 |
| PV Module | 17 |
| Table Alignment & Earthing | 16 |
| Aux Transformer | 15 |
| AC Cable | 15 |
| DC Cable | 15 |
| Grid Earthing | 15 |
| MCR Room | 15 |
| Switchyard | 15 |
| Earthing System | 14 |
| Control Cable | 14 |
| CCTV | 12 |
| **Total** | **270** |
