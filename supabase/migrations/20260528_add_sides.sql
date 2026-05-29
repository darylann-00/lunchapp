-- Add 'side' as a valid meal_type and seed a starter catalog of lunchbox sides.
-- Sides are small accompaniments (fruit, veg, cheese, crackers) that round out the main.

-- 1. Widen the meal_type check constraint.
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_meal_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_meal_type_check
  CHECK (meal_type IN ('main', 'snack', 'side'));

-- 2. Seed global curated sides (created_by = null → visible to all users via RLS).
INSERT INTO recipes (name, description, prep_notes, ingredients, meal_type, is_packaged, source)
VALUES
  (
    'Apple Slices',
    'Fresh crisp apple wedges',
    'Core and slice into 8 wedges. Pack in a small lidded container.',
    '[{"name":"apple","quantity":"1","unit":"medium"}]',
    'side', false, 'curated'
  ),
  (
    'Baby Carrots',
    'Crunchy ready-to-eat baby carrots',
    'Rinse and pat dry. Pack in a small container.',
    '[{"name":"baby carrots","quantity":"1/4","unit":"cup"}]',
    'side', false, 'curated'
  ),
  (
    'Grapes',
    'A small bunch of seedless grapes',
    'Rinse, remove stems, and pack in a container.',
    '[{"name":"grapes","quantity":"1/2","unit":"cup"}]',
    'side', false, 'curated'
  ),
  (
    'Cheese Cubes',
    'Bite-sized cubes of mild cheddar',
    'Cut cheese into 1-inch cubes. Pack in a small container.',
    '[{"name":"cheddar cheese","quantity":"1","unit":"oz"}]',
    'side', false, 'curated'
  ),
  (
    'Cucumber Slices',
    'Cool, crisp cucumber rounds',
    'Wash and slice into rounds about 1/4 inch thick.',
    '[{"name":"cucumber","quantity":"1/3","unit":"medium"}]',
    'side', false, 'curated'
  ),
  (
    'Crackers',
    'A small portion of crackers',
    'Count out about 10 crackers and pack in a zip bag or small container.',
    '[{"name":"crackers","quantity":"10","unit":"pieces"}]',
    'side', true, 'curated'
  ),
  (
    'Strawberries',
    'Fresh hulled strawberries',
    'Rinse, hull, and pack. Slice larger ones in half.',
    '[{"name":"strawberries","quantity":"1/2","unit":"cup"}]',
    'side', false, 'curated'
  ),
  (
    'Celery Sticks',
    'Crunchy celery sticks',
    'Trim ends and cut into 3-inch sticks.',
    '[{"name":"celery","quantity":"2","unit":"stalks"}]',
    'side', false, 'curated'
  ),
  (
    'Orange Wedges',
    'Juicy orange segments',
    'Peel and separate into segments, or cut unpeeled into wedges.',
    '[{"name":"orange","quantity":"1","unit":"small"}]',
    'side', false, 'curated'
  ),
  (
    'Blueberries',
    'Fresh blueberries',
    'Rinse gently and pack in a small lidded container.',
    '[{"name":"blueberries","quantity":"1/3","unit":"cup"}]',
    'side', false, 'curated'
  ),
  (
    'Cherry Tomatoes',
    'Sweet bite-sized tomatoes',
    'Rinse and dry. Pack whole.',
    '[{"name":"cherry tomatoes","quantity":"1/4","unit":"cup"}]',
    'side', false, 'curated'
  ),
  (
    'Mini Bell Pepper Strips',
    'Sweet, colorful pepper strips',
    'Wash, seed, and slice into strips.',
    '[{"name":"mini bell peppers","quantity":"2","unit":"pieces"}]',
    'side', false, 'curated'
  );
