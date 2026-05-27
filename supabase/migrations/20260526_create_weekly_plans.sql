-- One row per weekly lunch plan. items + grocery_list stored as JSONB to
-- mirror the WeeklyPlan TypeScript type. Unique (user_id, week_start_date)
-- enforces the "at most one plan per week per user" invariant.

create table if not exists weekly_plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  week_start_date  date not null,
  status           text not null check (status in ('draft', 'final')),
  days             text[] not null,
  items            jsonb not null,
  grocery_list     jsonb,
  session_notes    text not null default '',
  created_at       timestamptz default now(),
  unique (user_id, week_start_date)
);

create index if not exists weekly_plans_user_id_idx on weekly_plans (user_id);
