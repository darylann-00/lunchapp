import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Ingredient,
  Kid,
  ParentPrefs,
  ParsedSession,
  Dish,
  RecipeMealType,
  RecipeReaction,
} from '../types';

// A recipe row joined with its tag names. The flat shape (rather than the join
// payload Supabase returns) is what every other module wants to work with.
export type RecipeWithTags = {
  id: string;
  name: string;
  description: string | null;
  prepNotes: string;
  ingredients: Ingredient[];
  mealType: RecipeMealType;
  isPackaged: boolean;
  source: 'curated' | 'ai' | 'user';
  sourceUrl: string | null;
  sourceAttribution: string | null;
  prepTimeMinutes: number | null;
  createdBy: string | null;
  tags: string[];
};

// Approximate split for the candidate pool sent to the AI in Stage 2.
const TARGET_MAINS = 30;
const TARGET_SNACKS = 20;
const TARGET_SIDES = 20;

// Substring → tag heuristic for AI-generated recipes (Stage 3). Deliberately
// small; exhaustive tagging is owned by the curated seed script.
const INGREDIENT_TAG_RULES: Array<{ match: RegExp; tag: string }> = [
  { match: /peanut\s*butter/i, tag: 'has-peanut-butter' },
  { match: /\bpeanut/i, tag: 'has-peanut-butter' },
  { match: /almond|walnut|pecan|cashew|hazelnut|pistachio|tree\s*nut/i, tag: 'has-tree-nuts' },
  { match: /\begg(s)?\b/i, tag: 'has-eggs' },
  // Exclude plant "butters" (peanut/almond/cashew/sunflower/seed butter) so a
  // jelly-and-sun-butter recipe doesn't get tagged has-dairy.
  { match: /milk|cheese|yogurt|cream|dairy|(?<!(?:almond|cashew|peanut|sunflower|seed) )\bbutter\b/i, tag: 'has-dairy' },
  { match: /bread|tortilla|wheat|flour|pasta|noodle|cracker|bun|wrap/i, tag: 'has-wheat' },
  { match: /soy\s*sauce|tofu|edamame|tempeh|miso/i, tag: 'has-soy' },
  { match: /fish|salmon|tuna|shrimp|cod|crab|lobster|anchov/i, tag: 'has-seafood' },
  { match: /chicken/i, tag: 'has-chicken' },
  { match: /turkey/i, tag: 'has-turkey' },
  { match: /\bbeef\b|ground\s*beef|steak/i, tag: 'has-beef' },
  { match: /\bpork\b|bacon|ham|prosciutto/i, tag: 'has-pork' },
  { match: /honey/i, tag: 'has-honey' },
  { match: /chocolate|cocoa/i, tag: 'has-chocolate' },
];

const ANIMAL_PROTEIN_TAGS = new Set([
  'has-chicken',
  'has-turkey',
  'has-beef',
  'has-pork',
  'has-seafood',
]);

// Ingredient → tag for the heuristic. Returns deduped tag names that exist in
// the controlled vocabulary (see scripts/import_recipes.ts TAG_CATEGORY_MAP).
export function autoTagRecipe(ingredients: Ingredient[]): string[] {
  const found = new Set<string>();
  const haystack = ingredients.map((i) => i.name.toLowerCase()).join(' | ');

  for (const rule of INGREDIENT_TAG_RULES) {
    if (rule.match.test(haystack)) found.add(rule.tag);
  }

  // Negative dietary tags only when *no* matching ingredient was found.
  if (!found.has('has-dairy')) found.add('dairy-free');
  if (!found.has('has-peanut-butter')) found.add('peanut-free');
  if (!found.has('has-tree-nuts')) found.add('tree-nut-free');
  if (!found.has('has-eggs')) found.add('egg-free');
  if (!found.has('has-wheat')) found.add('gluten-free');

  // Crude dietary inference. Vegetarian = no animal-protein ingredient tags
  // (eggs and dairy are allowed). Vegan adds no eggs and no dairy on top.
  const hasMeat = [...found].some((t) => ANIMAL_PROTEIN_TAGS.has(t));
  if (!hasMeat) {
    found.add('vegetarian');
    if (!found.has('has-eggs') && !found.has('has-dairy')) found.add('vegan');
  }

  return [...found];
}

// Canonical allergen → ingredient-name pattern. Keyed by the onboarding chip
// values (see Onboarding.tsx DIETARY_OPTIONS). Patterns err toward
// over-matching: dropping a safe recipe is acceptable; serving an allergen is
// not. Notable product decisions encoded here: coconut is allowed under "tree
// nuts"; plant milks/butters are excluded from "dairy"; "fish" and "shellfish"
// stay distinct.
const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  peanuts: /\bpeanut/i,
  'tree nuts': /\b(?:almond|walnut|pecan|cashew|hazelnut|pistachio|macadamia|brazil nut|pine nut|praline|marzipan|nutella)(?:s|es)?\b|tree\s*nuts?/i,
  dairy: /\b(?:cheese|cheddar|mozzarella|parmesan|yogurt|yoghurt|cream|custard|ghee|whey|casein|dairy|buttermilk)(?:s|es)?\b|(?<!(?:almond|oat|soy|coconut|rice|cashew|hemp|pea)\s)\bmilk\b|(?<!(?:almond|cashew|peanut|sunflower|seed|soy|coconut)\s)\bbutter\b/i,
  eggs: /\begg(?!plant)|mayonnaise|\bmayo\b|aioli|meringue|frittata|omelet|quiche/i,
  gluten: /\b(?:wheat|flour|bread|breadcrumb|pasta|noodle|cracker|tortilla|bun|bagel|pita|cereal|barley|rye|couscous|gluten|pretzel|crouton)(?:s|es)?\b/i,
  fish: /\b(?:fish|salmon|tuna|cod|tilapia|halibut|trout|haddock|mackerel|sardine|anchovy|anchovies)(?:s|es)?\b/i,
  shellfish: /\b(?:shellfish|shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|crayfish|squid|calamari)(?:s|es)?\b/i,
  soy: /\b(?:soy|soya|soybean|tofu|edamame|tempeh|miso|tamari)(?:s|es)?\b/i,
  sesame: /\b(?:sesame|tahini|hummus|halva|halvah)(?:s|es)?\b/i,
  'red meat': /\b(?:beef|steak|pork|bacon|ham|prosciutto|sausage|salami|pepperoni|lamb|veal|venison|bison|chorizo|pancetta|meatball|hamburger)(?:s|es)?\b/i,
  pork: /\b(?:pork|bacon|ham|prosciutto|sausage|salami|pepperoni|chorizo|pancetta|spam)(?:s|es)?\b/i,
};

// Common free-text variants → canonical key.
const ALLERGEN_ALIASES: Record<string, string> = {
  peanut: 'peanuts',
  'tree nut': 'tree nuts',
  treenuts: 'tree nuts',
  milk: 'dairy',
  egg: 'eggs',
  wheat: 'gluten',
  soya: 'soy',
};

// Returns true if any ingredient name matches any of the kid's allergies.
// Known allergens (and their aliases) use the curated pattern map; unknown
// free-text allergies fall back to a substring check so we never lose coverage.
// Defense in depth — the AI prompts repeat the rule, but this is the reliable guard.
export function ingredientsContainAllergen(ingredients: Ingredient[], allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const names = ingredients.map((ing) => ing.name.toLowerCase());

  return allergies.some((raw) => {
    const allergy = raw.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!allergy) return false;

    const canonical = ALLERGEN_PATTERNS[allergy] ? allergy : ALLERGEN_ALIASES[allergy];
    const pattern = canonical ? ALLERGEN_PATTERNS[canonical] : undefined;

    if (pattern) return names.some((n) => pattern.test(n));
    return names.some((n) => n.includes(allergy));
  });
}

// Row shape Supabase returns for `recipes` joined to its tags.
type RecipeRow = {
  id: string;
  name: string;
  description: string | null;
  prep_notes: string;
  ingredients: Ingredient[];
  meal_type: RecipeMealType;
  is_packaged: boolean;
  source: 'curated' | 'ai' | 'user';
  source_url: string | null;
  source_attribution: string | null;
  prep_time_minutes: number | null;
  created_by: string | null;
  recipe_tag_assignments?: Array<{
    recipe_tags: { name: string } | null;
  }> | null;
};

function rowToRecipe(row: RecipeRow): RecipeWithTags {
  const tags = (row.recipe_tag_assignments ?? [])
    .map((a) => a.recipe_tags?.name)
    .filter((n): n is string => typeof n === 'string');
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    prepNotes: row.prep_notes,
    ingredients: row.ingredients,
    mealType: row.meal_type,
    isPackaged: row.is_packaged,
    source: row.source,
    sourceUrl: row.source_url,
    sourceAttribution: row.source_attribution,
    prepTimeMinutes: row.prep_time_minutes,
    createdBy: row.created_by,
    tags,
  };
}

// Stage 1: pull the candidate pool the AI will pick from.
//   1. RLS scopes to global + user-owned recipes.
//   2. Exclude recipes the user disliked.
//   3. Exclude recipes whose ingredients hit any kid allergy.
//   4. Filter by dietary flags via tags.
//   5. Boost favorites and on-hand-ingredient matches, then trim to ~50.
export async function getCandidateRecipes(
  db: SupabaseClient,
  kid: Kid,
  _parentPrefs: ParentPrefs,
  session: ParsedSession
): Promise<RecipeWithTags[]> {
  const [recipesRes, feedbackRes] = await Promise.all([
    db
      .from('recipes')
      .select(
        'id, name, description, prep_notes, ingredients, meal_type, is_packaged, source, source_url, source_attribution, prep_time_minutes, created_by, recipe_tag_assignments(recipe_tags(name))'
      ),
    db.from('recipe_feedback').select('recipe_id, reaction'),
  ]);

  if (recipesRes.error) throw new Error(`Failed to load recipes: ${recipesRes.error.message}`);
  if (feedbackRes.error) throw new Error(`Failed to load recipe feedback: ${feedbackRes.error.message}`);

  const feedbackByRecipe = new Map<string, RecipeReaction>();
  for (const f of feedbackRes.data ?? []) {
    feedbackByRecipe.set(f.recipe_id as string, f.reaction as RecipeReaction);
  }

  const rows = (recipesRes.data ?? []) as unknown as RecipeRow[];

  const filtered = rows
    .map(rowToRecipe)
    .filter((r) => feedbackByRecipe.get(r.id) !== 'dislike')
    .filter((r) => !ingredientsContainAllergen(r.ingredients, kid.allergies))
    .filter((r) => {
      if (kid.isVegan) return r.tags.includes('vegan');
      if (kid.isVegetarian) return r.tags.includes('vegetarian') || r.tags.includes('vegan');
      return true;
    });

  const onHand = session.ingredientsOnHand.map((s) => s.toLowerCase()).filter(Boolean);

  const scored = filtered.map((r) => {
    let score = 0;
    if (feedbackByRecipe.get(r.id) === 'favorite') score += 2;
    if (onHand.length > 0) {
      const recipeNames = r.ingredients.map((i) => i.name.toLowerCase()).join(' | ');
      if (onHand.some((term) => recipeNames.includes(term))) score += 1;
    }
    return { r, score };
  });

  // Shuffle within each score tier so the candidate pool varies across runs.
  // Without this, same-score recipes always arrive in DB order and the model
  // picks the same top-30 mains / top-20 snacks every generation.
  for (let i = scored.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scored[i], scored[j]] = [scored[j], scored[i]];
  }
  scored.sort((a, b) => b.score - a.score);

  const mains: RecipeWithTags[] = [];
  const snacks: RecipeWithTags[] = [];
  const sides: RecipeWithTags[] = [];
  for (const { r } of scored) {
    if (r.mealType === 'main' && mains.length < TARGET_MAINS) mains.push(r);
    else if (r.mealType === 'snack' && snacks.length < TARGET_SNACKS) snacks.push(r);
    else if (r.mealType === 'side' && sides.length < TARGET_SIDES) sides.push(r);
    if (mains.length >= TARGET_MAINS && snacks.length >= TARGET_SNACKS && sides.length >= TARGET_SIDES) break;
  }

  return [...mains, ...snacks, ...sides];
}

// Stage 3: persist an AI-invented recipe to the user's private catalog.
// Returns the saved row hydrated with its tag names so callers can hand it to
// `recipeToDish` and treat it like any catalog recipe.
export async function saveAIRecipe(db: SupabaseClient, userId: string, args: {
  name: string;
  description: string;
  prepNotes: string;
  ingredients: Ingredient[];
  mealType: RecipeMealType;
  isPackaged?: boolean;
  tags: string[];
}): Promise<RecipeWithTags> {
  const insertRes = await db
    .from('recipes')
    .insert({
      name: args.name,
      description: args.description,
      prep_notes: args.prepNotes,
      ingredients: args.ingredients,
      meal_type: args.mealType,
      is_packaged: args.isPackaged ?? false,
      source: 'ai',
      created_by: userId,
    })
    .select(
      'id, name, description, prep_notes, ingredients, meal_type, is_packaged, source, source_url, source_attribution, prep_time_minutes, created_by'
    )
    .single();

  if (insertRes.error || !insertRes.data) {
    throw new Error(`Failed to save AI recipe: ${insertRes.error?.message ?? 'no row returned'}`);
  }

  const recipeId = insertRes.data.id as string;
  const savedTags: string[] = [];

  if (args.tags.length > 0) {
    const tagRes = await db
      .from('recipe_tags')
      .select('id, name')
      .in('name', args.tags);

    if (tagRes.error) {
      throw new Error(`Failed to load recipe tags: ${tagRes.error.message}`);
    }

    const tagRows = (tagRes.data ?? []) as Array<{ id: string; name: string }>;
    if (tagRows.length > 0) {
      const assignments = tagRows.map((t) => ({ recipe_id: recipeId, tag_id: t.id }));
      const assignRes = await db.from('recipe_tag_assignments').insert(assignments);
      if (assignRes.error) {
        throw new Error(`Failed to assign recipe tags: ${assignRes.error.message}`);
      }
      savedTags.push(...tagRows.map((t) => t.name));
    }
  }

  const row = insertRes.data as Omit<RecipeRow, 'recipe_tag_assignments'>;
  return {
    ...rowToRecipe({ ...row, recipe_tag_assignments: [] }),
    tags: savedTags,
  };
}

// Hydrate a catalog recipe into the existing client-side Dish shape. Per the
// `Dish.id` convention, we stamp a fresh uuid here so each plan instance has a
// unique id even when two days reuse the same underlying recipe.
export function recipeToDish(recipe: RecipeWithTags): Dish {
  return {
    id: uuidv4(),
    name: recipe.name,
    description: recipe.description ?? '',
    prepNotes: recipe.prepNotes,
    ingredients: recipe.ingredients,
    isPackaged: recipe.isPackaged,
    prepTimeMinutes: recipe.prepTimeMinutes,
    sourceUrl: recipe.sourceUrl,
    sourceAttribution: recipe.sourceAttribution,
  };
}

export async function getRecipesForPicker(
  db: SupabaseClient,
  mealType: RecipeMealType,
  kid: Kid
): Promise<RecipeWithTags[]> {
  const { data, error } = await db
    .from('recipes')
    .select(
      'id, name, description, prep_notes, ingredients, meal_type, is_packaged, source, source_url, source_attribution, prep_time_minutes, created_by, recipe_tag_assignments(recipe_tags(name))'
    )
    .eq('meal_type', mealType)
    .order('name');

  if (error) throw new Error(`Failed to load recipes: ${error.message}`);

  const rows = (data ?? []) as unknown as RecipeRow[];

  return rows
    .map(rowToRecipe)
    .filter((r) => !ingredientsContainAllergen(r.ingredients, kid.allergies))
    .filter((r) => {
      if (kid.isVegan) return r.tags.includes('vegan');
      if (kid.isVegetarian) return r.tags.includes('vegetarian') || r.tags.includes('vegan');
      return true;
    });
}

export type RecipeWithFeedback = RecipeWithTags & { reaction: RecipeReaction | null };

// Fetch all recipes with the current user's feedback for the browse/library view.
// RLS on recipe_feedback scopes feedback rows to the signed-in user automatically.
export async function getRecipesForBrowse(db: SupabaseClient): Promise<RecipeWithFeedback[]> {
  const [recipesRes, feedbackRes] = await Promise.all([
    db
      .from('recipes')
      .select(
        'id, name, description, prep_notes, ingredients, meal_type, is_packaged, source, source_url, source_attribution, prep_time_minutes, created_by, recipe_tag_assignments(recipe_tags(name))'
      )
      .order('name'),
    db.from('recipe_feedback').select('recipe_id, reaction'),
  ]);

  if (recipesRes.error) throw new Error(`Failed to load recipes: ${recipesRes.error.message}`);
  if (feedbackRes.error) throw new Error(`Failed to load feedback: ${feedbackRes.error.message}`);

  const feedbackMap = new Map<string, RecipeReaction>();
  for (const f of feedbackRes.data ?? []) {
    feedbackMap.set(f.recipe_id as string, f.reaction as RecipeReaction);
  }

  const rows = (recipesRes.data ?? []) as unknown as RecipeRow[];
  return rows.map((row) => ({
    ...rowToRecipe(row),
    reaction: feedbackMap.get(row.id) ?? null,
  }));
}

// Upsert or clear a recipe feedback reaction.
// If `newReaction` matches the current stored reaction, it is toggled off (deleted).
// Returns the resulting reaction (null = cleared).
export async function upsertRecipeFeedback(
  db: SupabaseClient,
  userId: string,
  recipeId: string,
  currentReaction: RecipeReaction | null,
  newReaction: RecipeReaction
): Promise<RecipeReaction | null> {
  if (currentReaction === newReaction) {
    await db.from('recipe_feedback').delete().eq('recipe_id', recipeId);
    return null;
  }
  const { error } = await db
    .from('recipe_feedback')
    .upsert(
      { user_id: userId, recipe_id: recipeId, reaction: newReaction },
      { onConflict: 'user_id,recipe_id' }
    );
  if (error) throw new Error(`Failed to save feedback: ${error.message}`);
  return newReaction;
}
