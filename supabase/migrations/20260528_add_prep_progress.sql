-- Track per-dish prep progress for each weekly plan.
-- Shape: { [dishId: string]: number[] }  (checked step indices per dish)
alter table weekly_plans
  add column if not exists prep_progress jsonb not null default '{}'::jsonb;
