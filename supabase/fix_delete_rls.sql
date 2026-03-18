-- ============================================================
-- Fix: Add missing DELETE policies for punch_points and punch_photos
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Drop old punches policies and recreate with DELETE included
drop policy if exists "punches_read"   on punch_points;
drop policy if exists "punches_insert" on punch_points;
drop policy if exists "punches_update" on punch_points;
drop policy if exists "punches_delete" on punch_points;
-- Also drop any old-named variants that may exist
drop policy if exists "pp_read"   on punch_points;
drop policy if exists "pp_insert" on punch_points;
drop policy if exists "pp_update" on punch_points;
drop policy if exists "pp_delete" on punch_points;

create policy "punches_read" on punch_points for select to authenticated
  using (is_admin() or site_id = my_site_id());

create policy "punches_insert" on punch_points for insert to authenticated
  with check (is_admin() or site_id = my_site_id());

create policy "punches_update" on punch_points for update to authenticated
  using (is_admin() or site_id = my_site_id());

create policy "punches_delete" on punch_points for delete to authenticated
  using (is_admin() or site_id = my_site_id());

-- 2. Drop old photos policies and recreate with DELETE included
drop policy if exists "photos_read"   on punch_photos;
drop policy if exists "photos_insert" on punch_photos;
drop policy if exists "photos_delete" on punch_photos;

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

-- 3. Also fix response_photos table (same missing DELETE policy)
alter table response_photos enable row level security;

drop policy if exists "rphotos_read"   on response_photos;
drop policy if exists "rphotos_insert" on response_photos;
drop policy if exists "rphotos_delete" on response_photos;

create policy "rphotos_read" on response_photos for select to authenticated
  using (
    is_admin() or
    exists (
      select 1 from checklist_responses cr
      where cr.id = response_photos.response_id
        and cr.site_id = my_site_id()
    )
  );

create policy "rphotos_insert" on response_photos for insert to authenticated
  with check (
    is_admin() or
    exists (
      select 1 from checklist_responses cr
      where cr.id = response_photos.response_id
        and cr.site_id = my_site_id()
    )
  );

create policy "rphotos_delete" on response_photos for delete to authenticated
  using (
    is_admin() or
    exists (
      select 1 from checklist_responses cr
      where cr.id = response_photos.response_id
        and cr.site_id = my_site_id()
    )
  );

-- 4. Fix checklist_responses DELETE (also missing)
drop policy if exists "responses_delete" on checklist_responses;

create policy "responses_delete" on checklist_responses for delete to authenticated
  using (is_admin() or site_id = my_site_id());
