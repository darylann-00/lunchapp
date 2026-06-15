// Seed curated lunchbox components into the components table.
// Usage: npm run seed-components (requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey);

type SeedComponent = {
  name: string;
  category: 'protein' | 'carb' | 'fruit' | 'veggie' | 'fun';
  ingredients: Array<{ name: string; qty: string; unit?: string }>;
  also_fills?: string[];
  can_be_snack?: boolean;
  note?: string;
  tags: {
    prep?: string[];
    dietary?: string[];
    format?: string[];
  };
};

const COMPONENTS: SeedComponent[] = [
  // ── PROTEIN (~15) ───────────────────────────────────────────────────────

  {
    name: 'Turkey & Cheese Sandwich',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'sliced turkey', qty: '3', unit: 'slices' },
      { name: 'cheddar cheese', qty: '1', unit: 'slice' },
      { name: 'whole wheat bread', qty: '2', unit: 'slices' },
    ],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'egg-free'], format: ['cold'] },
    note: 'Cut diagonally for easier eating',
  },
  {
    name: 'PB&J Sandwich',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'peanut butter', qty: '2', unit: 'tbsp' },
      { name: 'jelly', qty: '1', unit: 'tbsp' },
      { name: 'bread', qty: '2', unit: 'slices' },
    ],
    tags: { prep: ['fresh'], dietary: ['dairy-free', 'egg-free'], format: ['room-temp'] },
    note: 'Spread PB on both slices to prevent sogginess',
  },
  {
    name: 'Ham & Cheese Wrap',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'sliced ham', qty: '3', unit: 'slices' },
      { name: 'cheese', qty: '1', unit: 'slice' },
      { name: 'flour tortilla', qty: '1' },
    ],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'egg-free'], format: ['cold'] },
  },
  {
    name: 'Cream Cheese Bagel',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'mini bagel', qty: '1' },
      { name: 'cream cheese', qty: '2', unit: 'tbsp' },
    ],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'egg-free', 'vegetarian'], format: ['cold'] },
  },
  {
    name: 'Cheese Quesadilla',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'flour tortilla', qty: '1' },
      { name: 'shredded cheese', qty: '1/3', unit: 'cup' },
    ],
    tags: { prep: ['make-ahead'], dietary: ['nut-free', 'egg-free', 'vegetarian'], format: ['room-temp'] },
    note: 'Can make ahead and pack at room temp — still tasty',
  },
  {
    name: 'Hummus & Veggie Wrap',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'hummus', qty: '3', unit: 'tbsp' },
      { name: 'flour tortilla', qty: '1' },
      { name: 'shredded carrots', qty: '2', unit: 'tbsp' },
      { name: 'cucumber', qty: '4', unit: 'slices' },
    ],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'vegan', 'vegetarian'], format: ['cold'] },
  },
  {
    name: 'Chicken Salad Sandwich',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'cooked chicken', qty: '1/2', unit: 'cup' },
      { name: 'mayonnaise', qty: '1', unit: 'tbsp' },
      { name: 'bread', qty: '2', unit: 'slices' },
    ],
    tags: { prep: ['make-ahead'], dietary: ['nut-free', 'dairy-free'], format: ['cold'] },
    note: 'Mix chicken salad night before; assemble morning of',
  },
  {
    name: 'Sunbutter & Jelly Sandwich',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'sunflower seed butter', qty: '2', unit: 'tbsp' },
      { name: 'jelly', qty: '1', unit: 'tbsp' },
      { name: 'bread', qty: '2', unit: 'slices' },
    ],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Egg Salad Sandwich',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'hard boiled eggs', qty: '2' },
      { name: 'mayonnaise', qty: '1', unit: 'tbsp' },
      { name: 'bread', qty: '2', unit: 'slices' },
    ],
    tags: { prep: ['make-ahead'], dietary: ['nut-free', 'dairy-free'], format: ['cold'] },
    note: 'Boil eggs on prep day; mash with mayo morning of',
  },
  {
    name: 'Bean & Cheese Burrito',
    category: 'protein',
    also_fills: ['carb'],
    ingredients: [
      { name: 'refried beans', qty: '1/3', unit: 'cup' },
      { name: 'shredded cheese', qty: '2', unit: 'tbsp' },
      { name: 'flour tortilla', qty: '1' },
    ],
    tags: { prep: ['freezer-friendly', 'make-ahead'], dietary: ['nut-free', 'egg-free', 'vegetarian'], format: ['room-temp'] },
    note: 'Batch-make and freeze; thaws by lunchtime',
  },
  {
    name: 'Hard Boiled Eggs',
    category: 'protein',
    can_be_snack: true,
    ingredients: [{ name: 'large eggs', qty: '2' }],
    tags: { prep: ['make-ahead'], dietary: ['nut-free', 'dairy-free', 'gluten-free', 'vegetarian'], format: ['cold'] },
    note: 'Peel night before for easy packing; keeps 5 days in fridge',
  },
  {
    name: 'String Cheese',
    category: 'protein',
    can_be_snack: true,
    ingredients: [{ name: 'string cheese', qty: '1' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'egg-free', 'gluten-free', 'vegetarian'], format: ['cold'] },
  },
  {
    name: 'Yogurt Tube',
    category: 'protein',
    can_be_snack: true,
    ingredients: [{ name: 'yogurt tube', qty: '1' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'egg-free', 'gluten-free', 'vegetarian'], format: ['cold'] },
    note: 'Freeze night before — acts as ice pack and thaws by lunch',
  },
  {
    name: 'Turkey Roll-Ups',
    category: 'protein',
    can_be_snack: true,
    ingredients: [
      { name: 'sliced turkey', qty: '3', unit: 'slices' },
      { name: 'cheese', qty: '1', unit: 'slice' },
    ],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'egg-free', 'gluten-free'], format: ['cold'] },
    note: 'Roll turkey around cheese sticks for easy eating',
  },
  {
    name: 'Cheese Cubes',
    category: 'protein',
    can_be_snack: true,
    ingredients: [{ name: 'cheddar cheese', qty: '1', unit: 'oz' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'egg-free', 'gluten-free', 'vegetarian'], format: ['cold'] },
  },

  // ── CARB (~10) ──────────────────────────────────────────────────────────

  {
    name: 'Goldfish Crackers',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'goldfish crackers', qty: '1', unit: 'serving' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'egg-free', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Pretzels',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'pretzel twists', qty: '1', unit: 'serving' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Popcorn',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'popcorn', qty: '1', unit: 'cup' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Wheat Thins',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'wheat thin crackers', qty: '1', unit: 'serving' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'egg-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Pita Chips',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'pita chips', qty: '1', unit: 'serving' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Tortilla Chips',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'tortilla chips', qty: '1', unit: 'serving' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Rice Cakes',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'rice cakes', qty: '2' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Animal Crackers',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'animal crackers', qty: '1', unit: 'serving' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'egg-free', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Granola',
    category: 'carb',
    can_be_snack: true,
    ingredients: [{ name: 'granola', qty: '1/3', unit: 'cup' }],
    tags: { prep: ['packaged'], dietary: ['egg-free', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Pasta Salad',
    category: 'carb',
    ingredients: [
      { name: 'cooked pasta', qty: '3/4', unit: 'cup' },
      { name: 'olive oil', qty: '1', unit: 'tsp' },
      { name: 'cherry tomatoes', qty: '4' },
    ],
    tags: { prep: ['make-ahead'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Make a big batch Sunday; keeps 4-5 days in fridge',
  },

  // ── FRUIT (~10) ─────────────────────────────────────────────────────────

  {
    name: 'Apple Slices',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'apple', qty: '1' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
    note: 'Squeeze lemon juice to prevent browning',
  },
  {
    name: 'Grapes',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'grapes', qty: '1/2', unit: 'cup' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Cut in half for younger kids',
  },
  {
    name: 'Strawberries',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'strawberries', qty: '5' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Hull and halve; pack in a leak-proof container',
  },
  {
    name: 'Blueberries',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'blueberries', qty: '1/3', unit: 'cup' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
  },
  {
    name: 'Banana',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'banana', qty: '1' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Mandarin Orange',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'mandarin orange', qty: '1' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Watermelon Cubes',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'watermelon', qty: '1/2', unit: 'cup' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
  },
  {
    name: 'Dried Mango',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'dried mango slices', qty: '1', unit: 'serving' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Applesauce Cup',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'applesauce cup', qty: '1' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Mixed Berries',
    category: 'fruit',
    can_be_snack: true,
    ingredients: [{ name: 'mixed berries', qty: '1/3', unit: 'cup' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
  },

  // ── VEGGIE (~8) ─────────────────────────────────────────────────────────

  {
    name: 'Baby Carrots',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'baby carrots', qty: '8' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Pair with ranch or hummus for dipping',
  },
  {
    name: 'Cucumber Slices',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'cucumber', qty: '1/3' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
  },
  {
    name: 'Snap Peas',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'sugar snap peas', qty: '1/2', unit: 'cup' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
  },
  {
    name: 'Cherry Tomatoes',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'cherry tomatoes', qty: '6' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Celery Sticks',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'celery stalks', qty: '2' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Cut into sticks; great with peanut butter or cream cheese',
  },
  {
    name: 'Bell Pepper Strips',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'bell pepper', qty: '1/2' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Cut into strips; keeps 4 days in fridge pre-cut',
  },
  {
    name: 'Edamame',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'shelled edamame', qty: '1/3', unit: 'cup' }],
    tags: { prep: ['make-ahead'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Cook from frozen; keeps 3 days in fridge',
  },
  {
    name: 'Broccoli Florets',
    category: 'veggie',
    can_be_snack: true,
    ingredients: [{ name: 'broccoli florets', qty: '1/2', unit: 'cup' }],
    tags: { prep: ['fresh'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['cold'] },
    note: 'Pair with ranch for dipping',
  },

  // ── FUN BITE (~8) ───────────────────────────────────────────────────────

  {
    name: 'Chocolate Chips',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'chocolate chips', qty: '2', unit: 'tbsp' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'egg-free', 'gluten-free', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Gummy Bears',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'gummy bears', qty: '1', unit: 'small handful' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Cookies (2 small)',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'small cookies', qty: '2' }],
    tags: { prep: ['packaged'], dietary: ['vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Mini Muffin',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'mini muffin', qty: '1' }],
    tags: { prep: ['freezer-friendly', 'make-ahead'], dietary: ['nut-free', 'vegetarian'], format: ['room-temp'] },
    note: 'Batch bake and freeze; thaws in lunchbox by noon',
  },
  {
    name: 'Fruit Leather',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'fruit leather', qty: '1' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Trail Mix',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'trail mix', qty: '2', unit: 'tbsp' }],
    tags: { prep: ['packaged'], dietary: ['dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Fruit Snack Pack',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'fruit snacks', qty: '1', unit: 'pack' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'dairy-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
  {
    name: 'Dark Chocolate Square',
    category: 'fun',
    can_be_snack: true,
    ingredients: [{ name: 'dark chocolate', qty: '1', unit: 'square' }],
    tags: { prep: ['packaged'], dietary: ['nut-free', 'egg-free', 'gluten-free', 'vegan', 'vegetarian'], format: ['room-temp'] },
  },
];

async function seed() {
  console.log(`Seeding ${COMPONENTS.length} components...`);

  const rows = COMPONENTS.map((c) => ({
    name: c.name,
    category: c.category,
    ingredients: c.ingredients,
    also_fills: c.also_fills ?? null,
    can_be_snack: c.can_be_snack ?? false,
    note: c.note ?? null,
    tags: c.tags,
    source: 'curated',
    created_by: null,
  }));

  const { data, error } = await db.from('components').insert(rows).select('id, name');

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`Seeded ${data.length} components successfully.`);
  for (const row of data) {
    console.log(`  ✓ ${row.name}`);
  }
}

seed();
