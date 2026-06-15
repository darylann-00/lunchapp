-- Component Pivot: replace recipe-based model with component-based lunchbox assembler.

-- 1. Create components table
CREATE TABLE components (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN ('protein', 'carb', 'fruit', 'veggie', 'fun')),
  ingredients jsonb NOT NULL DEFAULT '[]',
  also_fills  text[],
  can_be_snack boolean NOT NULL DEFAULT false,
  note        text,
  tags        jsonb NOT NULL DEFAULT '{}',
  source      text NOT NULL DEFAULT 'curated' CHECK (source IN ('curated', 'ai', 'user')),
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Create component_feedback table
CREATE TABLE component_feedback (
  user_id      uuid REFERENCES auth.users(id),
  component_id uuid REFERENCES components(id) ON DELETE CASCADE,
  reaction     text NOT NULL CHECK (reaction IN ('like', 'dislike', 'favorite')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, component_id)
);

-- 3. Drop old recipe tables (FK order: assignments first, then feedback, tags, recipes)
DROP TABLE IF EXISTS recipe_tag_assignments CASCADE;
DROP TABLE IF EXISTS recipe_feedback CASCADE;
DROP TABLE IF EXISTS recipe_tags CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;

-- 4. Remove prep_progress from weekly_plans
ALTER TABLE weekly_plans DROP COLUMN IF EXISTS prep_progress;

-- 5. RLS on components
ALTER TABLE components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global components"
  ON components FOR SELECT
  USING (created_by IS NULL);

CREATE POLICY "Users can read own components"
  ON components FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own components"
  ON components FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own components"
  ON components FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own components"
  ON components FOR DELETE
  USING (created_by = auth.uid());

-- 6. RLS on component_feedback
ALTER TABLE component_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own feedback"
  ON component_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedback"
  ON component_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own feedback"
  ON component_feedback FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own feedback"
  ON component_feedback FOR DELETE
  USING (user_id = auth.uid());
