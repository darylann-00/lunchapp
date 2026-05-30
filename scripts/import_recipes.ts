#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { Ingredient } from '../src/types.ts';

// Resolve paths from this script's location
const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse optional --csv=<path> flag from process.argv
function resolveCsvPath(): string {
  const csvArg = process.argv.find((arg) => arg.startsWith('--csv='));
  if (csvArg) {
    const csvPath = csvArg.slice('--csv='.length);
    return isAbsolute(csvPath) ? csvPath : resolve(process.cwd(), csvPath);
  }
  return resolve(__dirname, 'seed/lunchbox_snack_recipes_ALL.csv');
}

const CSV_PATH = resolveCsvPath();
const JSON_OUT_PATH = resolve(__dirname, 'seed/recipes_seed.json');
const FAILURES_PATH = resolve(__dirname, 'seed/recipes_seed.failures.json');

const SOURCE_ATTRIBUTION_BY_DOMAIN: Record<string, string> = {
  'yummytoddlerfood.com': 'Yummy Toddler Food',
  'weelicious.com': 'Weelicious',
  'momables.com': 'MOMables',
};

// Tag category lookup: maps each tag to its category
const TAG_CATEGORY_MAP: Record<string, 'dietary' | 'format' | 'ingredient' | 'occasion'> = {
  // DIETARY
  'dairy-free': 'dietary',
  'nut-free': 'dietary',
  'peanut-free': 'dietary',
  'tree-nut-free': 'dietary',
  'egg-free': 'dietary',
  'gluten-free': 'dietary',
  vegetarian: 'dietary',
  vegan: 'dietary',
  'contains-pork': 'dietary',
  'contains-shellfish': 'dietary',
  'contains-fish': 'dietary',
  // FORMAT
  sandwich: 'format',
  wrap: 'format',
  pasta: 'format',
  muffin: 'format',
  bar: 'format',
  ball: 'format',
  meatball: 'format',
  'finger-food': 'format',
  dip: 'format',
  salad: 'format',
  soup: 'format',
  quesadilla: 'format',
  baked: 'format',
  'no-cook': 'format',
  frozen: 'format',
  'thermos-friendly': 'format',
  // INGREDIENT
  'has-peanut-butter': 'ingredient',
  'has-tree-nuts': 'ingredient',
  'has-eggs': 'ingredient',
  'has-dairy': 'ingredient',
  'has-wheat': 'ingredient',
  'has-soy': 'ingredient',
  'has-seafood': 'ingredient',
  'has-chicken': 'ingredient',
  'has-turkey': 'ingredient',
  'has-beef': 'ingredient',
  'has-pork': 'ingredient',
  'has-cheese': 'ingredient',
  'has-bread': 'ingredient',
  'has-pasta': 'ingredient',
  'has-fruit': 'ingredient',
  'has-vegetables': 'ingredient',
  'has-chocolate': 'ingredient',
  'has-honey': 'ingredient',
  // OCCASION
  quick: 'occasion',
  'make-ahead': 'occasion',
  'freezer-friendly': 'occasion',
};

const VALID_TAGS = new Set(Object.keys(TAG_CATEGORY_MAP));

type CleanedRecipe = {
  name: string;
  description: string;
  prep_notes: string;
  ingredients: Ingredient[];
  meal_type: 'main' | 'snack';
  prep_time_minutes: number | null;
  tags: string[];
  source_url: string;
  source_attribution: string;
};

type RecipeRow = {
  recipe_name: string;
  ingredients: string;
  instructions: string;
  prep_time: string;
  source: string;
};

type FailureRecord = {
  row_index: number;
  recipe_name: string;
  error: string;
  raw_row: RecipeRow;
};

async function parseRecipesWithClaude(
  rows: RecipeRow[],
  opts: {
    existingRecipes: CleanedRecipe[];
    doneSources: Set<string>;
    flush: (recipes: CleanedRecipe[], failures: FailureRecord[]) => void;
  },
): Promise<{
  recipes: CleanedRecipe[];
  failures: FailureRecord[];
}> {
  const client = new Anthropic();
  // Seed recipes with anything already cleaned in a prior (possibly interrupted)
  // run so the incremental flush always writes the complete set. Failures start
  // fresh — a previously-failed row isn't in doneSources, so it gets retried.
  const recipes: CleanedRecipe[] = [...opts.existingRecipes];
  const failures: FailureRecord[] = [];

  const CLAUDE_PROMPT = `You are cleaning a single kid-friendly recipe to import into a database. The input CSV row may represent ONE recipe or MULTIPLE variants (signaled by "||" separators in the ingredients string, e.g. "TURKEY: ... || NUTELLA: ..."). Split multi-variants into separate recipes.

For each output recipe, produce this exact JSON shape:
{
  "name": "string — short, no variant prefixes like 'TURKEY-CHEESE:'",
  "description": "string — ONE sentence, fresh prose, what this is",
  "prep_notes": "string — full instructions, cleaned up; for variants, only the relevant subset of steps",
  "ingredients": [{ "name": "string", "quantity": "string", "unit": "string" }],
  "meal_type": "main" | "snack",
  "prep_time_minutes": integer | null,
  "tags": ["string", ...]
}

Rules for ingredients:
- Parse quantity and unit separately. "1 pound ground chicken" → { name: "ground chicken", quantity: "1", unit: "pound" }.
- For ranges like "1–2 tablespoons", use the higher end: quantity "2", unit "tablespoons".
- For "optional" items, keep them but append " (optional)" to the name.
- Empty/unknown quantity or unit → "" (empty string), never null.

Rules for meal_type:
- 'main' = the centerpiece of a lunchbox (sandwiches, wraps, pasta, quesadillas, meatballs, soup, salads, lunchables)
- 'snack' = sides, treats, dips, baked goods, finger foods (muffins, granola bars, hummus, popcorn, fruit dips, energy bites, cheese bites, crackers, pickles)
- When ambiguous, lean toward 'snack' for baked goods and dips; 'main' for anything that anchors a meal.

Rules for tags — pick from this CONTROLLED VOCABULARY ONLY (do not invent new tags):

DIETARY: dairy-free, nut-free, peanut-free, tree-nut-free, egg-free, gluten-free, vegetarian, vegan, contains-pork, contains-shellfish, contains-fish

FORMAT: sandwich, wrap, pasta, muffin, bar, ball, meatball, finger-food, dip, salad, soup, quesadilla, baked, no-cook, frozen, thermos-friendly

INGREDIENT: has-peanut-butter, has-tree-nuts, has-eggs, has-dairy, has-wheat, has-soy, has-seafood, has-chicken, has-turkey, has-beef, has-pork, has-cheese, has-bread, has-pasta, has-fruit, has-vegetables, has-chocolate, has-honey

OCCASION: quick, make-ahead, freezer-friendly

Apply tags ACCURATELY. If the recipe has peanut butter, tag has-peanut-butter AND do NOT tag peanut-free. If no dairy ingredients, tag dairy-free. If under 6 minutes prep, tag quick. Be exhaustive about ingredient and dietary tags — they drive safety filtering.

OUTPUT ONLY a JSON array (even for a single recipe). No preamble, no markdown, no fences. Just the array.`;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    // Resume support: skip rows whose source was already cleaned in a prior run.
    if (opts.doneSources.has(row.source)) {
      console.log(`  ⏭  [${i + 1}/${rows.length}] ${row.recipe_name} (already done, skipping)`);
      continue;
    }
    try {
      const userMessage = `
recipe_name: ${row.recipe_name}
ingredients: ${row.ingredients}
instructions: ${row.instructions}
prep_time: ${row.prep_time}
source: ${row.source}
`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: CLAUDE_PROMPT,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse the JSON response
      const cleanedData = parseClaudeJson(content.text) as Array<Omit<CleanedRecipe, 'source_url' | 'source_attribution'>>;

      // Extract source attribution
      const sourceUrl = row.source;
      const sourceAttribution = extractSourceAttribution(sourceUrl);

      // Add source info to each recipe and validate tags
      for (const recipe of cleanedData) {
        const cleanedRecipe: CleanedRecipe = {
          ...recipe,
          source_url: sourceUrl,
          source_attribution: sourceAttribution,
          tags: recipe.tags.filter((tag) => {
            if (!VALID_TAGS.has(tag)) {
              console.warn(
                `  ⚠️  Row ${i + 1} (${row.recipe_name}): Unknown tag "${tag}" dropped (not in controlled vocab).`,
              );
              return false;
            }
            return true;
          }),
        };
        recipes.push(cleanedRecipe);
      }

      console.log(`  ✓ [${i + 1}/${rows.length}] ${row.recipe_name} → ${cleanedData.length} recipe(s)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failures.push({
        row_index: i + 1,
        recipe_name: row.recipe_name,
        error: errorMsg,
        raw_row: row,
      });
      console.error(`  ✗ [${i + 1}/${rows.length}] ${row.recipe_name}: ${errorMsg}`);
    }
    // Persist after every row so an interrupted run never loses progress (and a
    // re-run skips what's already done — see doneSources above).
    opts.flush(recipes, failures);
  }

  return { recipes, failures };
}

function parseClaudeJson(text: string): unknown {
  // Strip markdown fences and comments
  let cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  cleaned = cleaned.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(cleaned);
}

function extractSourceAttribution(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    const domain = url.hostname.replace('www.', '');
    return SOURCE_ATTRIBUTION_BY_DOMAIN[domain] || domain;
  } catch {
    return sourceUrl;
  }
}

async function defaultMode(): Promise<void> {
  console.log('📖 Reading CSV...');
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as RecipeRow[];

  console.log(`Found ${rows.length} recipes. Calling Claude...\n`);

  // Resume: load any recipes/failures from a prior interrupted run. We key on
  // source_url — re-running re-attempts only rows that were never cleaned.
  let existingRecipes: CleanedRecipe[] = [];
  if (existsSync(JSON_OUT_PATH)) {
    existingRecipes = JSON.parse(readFileSync(JSON_OUT_PATH, 'utf-8')) as CleanedRecipe[];
  }
  const doneSources = new Set(existingRecipes.map((r) => r.source_url));
  if (doneSources.size > 0) {
    console.log(`↻ Resuming: ${existingRecipes.length} recipes from ${doneSources.size} sources already cleaned.\n`);
  }

  const flush = (recipes: CleanedRecipe[], failures: FailureRecord[]): void => {
    writeFileSync(JSON_OUT_PATH, JSON.stringify(recipes, null, 2), 'utf-8');
    if (failures.length > 0) {
      writeFileSync(FAILURES_PATH, JSON.stringify(failures, null, 2), 'utf-8');
    }
  };

  const { recipes, failures } = await parseRecipesWithClaude(rows, {
    existingRecipes,
    doneSources,
    flush,
  });

  console.log(`\n📝 Writing ${recipes.length} recipes to ${JSON_OUT_PATH}...`);
  writeFileSync(JSON_OUT_PATH, JSON.stringify(recipes, null, 2), 'utf-8');

  if (failures.length > 0) {
    console.log(`⚠️  ${failures.length} failures. Writing to ${FAILURES_PATH}...`);
    writeFileSync(FAILURES_PATH, JSON.stringify(failures, null, 2), 'utf-8');
  }

  console.log(`\n✅ Done! Review the recipes, then run:\n   npm run import-recipes:apply\n`);
}

async function applyMode(): Promise<void> {
  if (!existsSync(JSON_OUT_PATH)) {
    console.error(`❌ ${JSON_OUT_PATH} not found. Run 'npm run import-recipes' first.`);
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var. Check .env.example and set these.',
    );
    process.exit(1);
  }

  console.log('📥 Reading recipes...');
  const recipesJson = JSON.parse(readFileSync(JSON_OUT_PATH, 'utf-8')) as CleanedRecipe[];

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Connecting to Supabase (${supabaseUrl})...`);

  // Step 1: Collect unique tags and upsert
  const allTags = new Set<string>();
  for (const recipe of recipesJson) {
    for (const tag of recipe.tags) {
      allTags.add(tag);
    }
  }

  console.log(`\n🏷️  Upserting ${allTags.size} tags...`);
  const tagIdMap = new Map<string, string>();

  for (const tagName of allTags) {
    const category = TAG_CATEGORY_MAP[tagName];
    if (!category) {
      console.warn(`  ⚠️  Unknown tag category for "${tagName}" — skipping`);
      continue;
    }

    const { data, error } = await client
      .from('recipe_tags')
      .upsert(
        { name: tagName, category },
        { onConflict: 'name' },
      )
      .select('id')
      .single();

    if (error) {
      console.error(`  ✗ Failed to upsert tag "${tagName}": ${error.message}`);
      process.exit(1);
    }

    if (data) {
      tagIdMap.set(tagName, data.id);
    }
  }

  console.log(`  ✓ ${tagIdMap.size} tags ready`);

  // Step 2: Insert recipes and their tag assignments together (one pass).
  // We collect assignments in a single array and bulk-insert at the end.
  // Critical: do NOT key by recipe name — multi-variant recipes can collide.
  console.log(`\n📚 Inserting ${recipesJson.length} recipes...`);
  const assignments: { recipe_id: string; tag_id: string }[] = [];
  let insertedRecipes = 0;

  for (let i = 0; i < recipesJson.length; i++) {
    const r = recipesJson[i]!;
    // DB columns are snake_case; the TS Recipe type uses camelCase for client code.
    // We insert with snake_case directly so PostgREST writes the right columns.
    const recipePayload = {
      name: r.name,
      description: r.description,
      prep_notes: r.prep_notes,
      ingredients: r.ingredients,
      meal_type: r.meal_type,
      is_packaged: false,
      source: 'curated' as const,
      source_url: r.source_url,
      source_attribution: r.source_attribution,
      prep_time_minutes: r.prep_time_minutes,
      created_by: null,
    };

    const { data, error } = await client
      .from('recipes')
      .insert(recipePayload)
      .select('id')
      .single();

    if (error || !data) {
      console.error(`  ✗ Failed to insert recipe "${r.name}": ${error?.message ?? 'no data returned'}`);
      process.exit(1);
    }

    const recipeId = data.id;
    insertedRecipes += 1;
    console.log(`  ✓ [${i + 1}/${recipesJson.length}] ${r.name}`);

    // Stage this recipe's tag assignments for bulk insert below.
    for (const tagName of r.tags) {
      const tagId = tagIdMap.get(tagName);
      if (!tagId) {
        console.warn(`  ⚠️  Tag "${tagName}" not in tag map — skipping for "${r.name}"`);
        continue;
      }
      assignments.push({ recipe_id: recipeId, tag_id: tagId });
    }
  }

  // Step 3: Bulk-insert all tag assignments.
  if (assignments.length > 0) {
    console.log(`\n🔗 Inserting ${assignments.length} tag assignments...`);
    const { error } = await client.from('recipe_tag_assignments').insert(assignments);

    if (error) {
      console.error(`  ✗ Failed to insert tag assignments: ${error.message}`);
      process.exit(1);
    }

    console.log(`  ✓ ${assignments.length} assignments created`);
  }

  console.log(
    `\n✅ Done! Inserted ${insertedRecipes} recipes, ${tagIdMap.size} tags, ${assignments.length} tag assignments.\n`,
  );
}

const apply = process.argv.includes('--apply');

if (apply) {
  applyMode().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  defaultMode().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
