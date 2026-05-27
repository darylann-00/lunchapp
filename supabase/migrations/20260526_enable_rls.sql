-- Enable Row Level Security on all user-data tables. Without RLS, the
-- public anon key in src/lib/supabase.ts would let any authenticated user
-- read or write any other user's row. Owner-only policies below.

alter table profiles      enable row level security;
alter table weekly_plans  enable row level security;

-- profiles: owner is the auth user whose id matches profiles.id

drop policy if exists "profiles_select_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_delete_own" on profiles;

create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on profiles for delete
  to authenticated
  using (auth.uid() = id);

-- weekly_plans: owner is the auth user whose id matches weekly_plans.user_id

drop policy if exists "weekly_plans_select_own" on weekly_plans;
drop policy if exists "weekly_plans_insert_own" on weekly_plans;
drop policy if exists "weekly_plans_update_own" on weekly_plans;
drop policy if exists "weekly_plans_delete_own" on weekly_plans;

create policy "weekly_plans_select_own"
  on weekly_plans for select
  to authenticated
  using (auth.uid() = user_id);

create policy "weekly_plans_insert_own"
  on weekly_plans for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "weekly_plans_update_own"
  on weekly_plans for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "weekly_plans_delete_own"
  on weekly_plans for delete
  to authenticated
  using (auth.uid() = user_id);
