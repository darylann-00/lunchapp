-- Recipes table: curated, AI-generated, or user-created lunch dishes.
-- Supports meal_type filtering (main/snack), prep notes, and tagged attributes.

create table if not exists recipes (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  prep_notes           text not null,
  ingredients          jsonb not null,
  meal_type            text not null check (meal_type in ('main', 'snack')),
  is_packaged          boolean not null default false,
  source               text not null check (source in ('curated', 'ai', 'user')),
  source_url           text,
  source_attribution   text,
  prep_time_minutes    integer,
  created_by           uuid references auth.users on delete cascade,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create index if not exists recipes_created_by_idx on recipes (created_by);
create index if not exists recipes_meal_type_idx on recipes (meal_type);

-- Recipe tags: dietary (gluten-free, dairy-free), format (cold, hot), ingredient, occasion.

create table if not exists recipe_tags (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  category  text not null check (category in ('dietary', 'format', 'ingredient', 'occasion'))
);

-- Recipe-tag assignments: many-to-many junction table.

create table if not exists recipe_tag_assignments (
  recipe_id  uuid not null references recipes on delete cascade,
  tag_id     uuid not null references recipe_tags on delete cascade,
  primary key (recipe_id, tag_id)
);

create index if not exists recipe_tag_assignments_tag_id_idx on recipe_tag_assignments (tag_id);

-- Recipe feedback: per-user reactions (like, dislike, favorite).

create table if not exists recipe_feedback (
  user_id     uuid not null references auth.users on delete cascade,
  recipe_id   uuid not null references recipes on delete cascade,
  reaction    text not null check (reaction in ('like', 'dislike', 'favorite')),
  created_at  timestamptz default now(),
  primary key (user_id, recipe_id)
);

create index if not exists recipe_feedback_user_id_idx on recipe_feedback (user_id);

-- Enable Row Level Security on all recipe tables.

alter table recipes enable row level security;
alter table recipe_tags enable row level security;
alter table recipe_tag_assignments enable row level security;
alter table recipe_feedback enable row level security;

-- recipes: authenticated users can select global (created_by = null) or their own.
-- insert/update/delete only their own.

drop policy if exists "recipes_select" on recipes;
drop policy if exists "recipes_insert" on recipes;
drop policy if exists "recipes_update" on recipes;
drop policy if exists "recipes_delete" on recipes;

create policy "recipes_select"
  on recipes for select
  to authenticated
  using (created_by is null or created_by = auth.uid());

create policy "recipes_insert"
  on recipes for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "recipes_update"
  on recipes for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "recipes_delete"
  on recipes for delete
  to authenticated
  using (created_by = auth.uid());

-- recipe_tags: authenticated users can read all; no insert/update/delete from client.

drop policy if exists "recipe_tags_select" on recipe_tags;

create policy "recipe_tags_select"
  on recipe_tags for select
  to authenticated
  using (true);

-- recipe_tag_assignments: authenticated users can select all, insert/delete only their own.

drop policy if exists "recipe_tag_assignments_select" on recipe_tag_assignments;
drop policy if exists "recipe_tag_assignments_insert" on recipe_tag_assignments;
drop policy if exists "recipe_tag_assignments_delete" on recipe_tag_assignments;

create policy "recipe_tag_assignments_select"
  on recipe_tag_assignments for select
  to authenticated
  using (true);

create policy "recipe_tag_assignments_insert"
  on recipe_tag_assignments for insert
  to authenticated
  with check (exists (select 1 from recipes where recipes.id = recipe_id and recipes.created_by = auth.uid()));

create policy "recipe_tag_assignments_delete"
  on recipe_tag_assignments for delete
  to authenticated
  using (exists (select 1 from recipes where recipes.id = recipe_id and recipes.created_by = auth.uid()));

-- recipe_feedback: authenticated users read/insert/update/delete only their own.

drop policy if exists "recipe_feedback_select" on recipe_feedback;
drop policy if exists "recipe_feedback_insert" on recipe_feedback;
drop policy if exists "recipe_feedback_update" on recipe_feedback;
drop policy if exists "recipe_feedback_delete" on recipe_feedback;

create policy "recipe_feedback_select"
  on recipe_feedback for select
  to authenticated
  using (user_id = auth.uid());

create policy "recipe_feedback_insert"
  on recipe_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "recipe_feedback_update"
  on recipe_feedback for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recipe_feedback_delete"
  on recipe_feedback for delete
  to authenticated
  using (user_id = auth.uid());
