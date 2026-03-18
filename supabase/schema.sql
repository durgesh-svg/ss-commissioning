-- ============================================================
-- Stockwell Solar Pre-Commissioning App — Supabase Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Sites ──────────────────────────────────────────────────
create table if not exists sites (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique
);

-- ── Systems ────────────────────────────────────────────────
create table if not exists systems (
  id    uuid primary key default uuid_generate_v4(),
  name  text not null,
  label text not null unique  -- slug used in code e.g. 'inverter'
);

-- ── Checklist items ────────────────────────────────────────
create table if not exists checklist_items (
  id          uuid primary key default uuid_generate_v4(),
  system_id   uuid not null references systems(id) on delete cascade,
  item_number integer not null,
  description text not null,
  unique (system_id, item_number)
);

-- ── Profiles (extends auth.users) ──────────────────────────
create table if not exists profiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  email    text,
  is_admin boolean not null default false,
  site_id  uuid references sites(id) on delete set null
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Checklist responses ────────────────────────────────────
create table if not exists checklist_responses (
  id         uuid primary key default uuid_generate_v4(),
  site_id    uuid not null references sites(id) on delete cascade,
  system_id  uuid not null references systems(id) on delete cascade,
  item_id    uuid not null references checklist_items(id) on delete cascade,
  status     text check (status in ('ok', 'punch')),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  unique (site_id, system_id, item_id)
);

-- ── Punch points ───────────────────────────────────────────
create table if not exists punch_points (
  id          uuid primary key default uuid_generate_v4(),
  response_id uuid references checklist_responses(id) on delete cascade,
  site_id     uuid not null references sites(id) on delete cascade,
  system_id   uuid not null references systems(id) on delete cascade,
  item_id     uuid not null references checklist_items(id) on delete cascade,
  priority    text check (priority in ('Critical', 'Minor')),
  contractor  text,
  target_date date,
  remarks     text,
  closed      boolean not null default false,
  closed_at   timestamptz,
  created_at  timestamptz default now()
);

-- ── Punch photos ───────────────────────────────────────────
create table if not exists punch_photos (
  id           uuid primary key default uuid_generate_v4(),
  punch_id     uuid not null references punch_points(id) on delete cascade,
  storage_path text not null,
  url          text not null,
  uploaded_at  timestamptz default now()
);

-- ── Row Level Security ─────────────────────────────────────
alter table sites               enable row level security;
alter table systems             enable row level security;
alter table checklist_items     enable row level security;
alter table profiles            enable row level security;
alter table checklist_responses enable row level security;
alter table punch_points        enable row level security;
alter table punch_photos        enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: current user's site_id
create or replace function my_site_id()
returns uuid language sql security definer stable as $$
  select site_id from profiles where id = auth.uid();
$$;

-- Sites: everyone authenticated can read
create policy "sites_read" on sites for select to authenticated using (true);

-- Systems: everyone authenticated can read
create policy "systems_read" on systems for select to authenticated using (true);

-- Checklist items: everyone authenticated can read
create policy "items_read" on checklist_items for select to authenticated using (true);

-- Profiles: users see their own; admins see all
create policy "profiles_own" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update to authenticated
  using (id = auth.uid());

-- Checklist responses: site managers see/edit their site; admins see all
create policy "responses_read" on checklist_responses for select to authenticated
  using (is_admin() or site_id = my_site_id());
create policy "responses_insert" on checklist_responses for insert to authenticated
  with check (is_admin() or site_id = my_site_id());
create policy "responses_update" on checklist_responses for update to authenticated
  using (is_admin() or site_id = my_site_id());

-- Punch points: site managers see/edit/delete their site; admins see all
create policy "punches_read" on punch_points for select to authenticated
  using (is_admin() or site_id = my_site_id());
create policy "punches_insert" on punch_points for insert to authenticated
  with check (is_admin() or site_id = my_site_id());
create policy "punches_update" on punch_points for update to authenticated
  using (is_admin() or site_id = my_site_id());
create policy "punches_delete" on punch_points for delete to authenticated
  using (is_admin() or site_id = my_site_id());

-- Punch photos: follow punch point access
create policy "photos_read" on punch_photos for select to authenticated
  using (
    is_admin() or
    exists (
      select 1 from punch_points pp
      where pp.id = punch_photos.punch_id
        and pp.site_id = my_site_id()
    )
  );
create policy "photos_insert" on punch_photos for insert to authenticated
  with check (
    is_admin() or
    exists (
      select 1 from punch_points pp
      where pp.id = punch_photos.punch_id
        and pp.site_id = my_site_id()
    )
  );
create policy "photos_delete" on punch_photos for delete to authenticated
  using (
    is_admin() or
    exists (
      select 1 from punch_points pp
      where pp.id = punch_photos.punch_id
        and pp.site_id = my_site_id()
    )
  );

-- ── Storage bucket ─────────────────────────────────────────
-- Run this in Supabase Storage UI or via management API:
-- insert into storage.buckets (id, name, public) values ('punch-photos', 'punch-photos', true);

-- Storage RLS (public bucket — URLs are stable and direct)
-- insert into storage.policies ... handled by Supabase Storage UI
