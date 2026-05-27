-- One row per auth user. Holds the single Kid + ParentPrefs as JSONB blobs
-- so the shape can evolve without a migration per field change.

create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  kid           jsonb,
  parent_prefs  jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
