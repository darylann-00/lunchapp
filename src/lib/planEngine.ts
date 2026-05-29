// Plan orchestration engine — pure logic with no browser dependencies.
// Both the browser (ai.ts) and server (api/generate-plan.ts) inject their
// own `CallModel` (proxy vs direct) and Supabase client (browser singleton
// vs user-token-scoped), so this module never imports ./supabase or touches
// fetch('/api/...').

import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Kid, ParentPrefs, LunchItem, Dish, ParsedSession, Ingredient, RecipeMealType } from '../types';
import {
  getCandidateRecipes,
  saveAIRecipe,
  recipeToDish,
  autoTagRecipe,
  type RecipeWithTags,
} from './recipes';

// ── Shared types ────────────────────────────────────────────────────────────

/** Send a message body to the model, return the text response. */
export type CallModel = (body: object) => Promise<string>;

type DayPick = {
  day: string;
  mainRecipeId: string | null;
  sideRecipeIds: string[];
  snackRecipeIds: string[];
  gap?: string;
};

type Stage2Response = { days: DayPick[] };

// ── Constants ───────────────────────────────────────────────────────────────

const SIDES_PER_DAY = 2;

// ── Pure utilities ──────────────────────────────────────────────────────────

export function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

export function safeParseJson<T>(text: string): T | null {
  try {
    const stripped = stripFences(text);
    // strip // line comments
    const noComments = stripped.replace(/\/\/[^\n]*/g, '');
    // strip trailing commas before } or ]
    const noTrailing = noComments.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(noTrailing) as T;
  } catch {
    return null;
  }
}

export async function callWithRetry<T>(
  callModel: CallModel,
  buildBody: (corrective?: string) => object,
  validate?: (parsed: T) => boolean
): Promise<T> {
  const body = buildBody();
  const raw = await callModel(body);
  const parsed = safeParseJson<T>(raw);
  if (parsed !== null && (!validate || validate(parsed))) return parsed;

  const retryBody = buildBody('Your last response was not valid JSON. Output only JSON, no preamble, no markdown.');
  const raw2 = await callModel(retryBody);
  const parsed2 = safeParseJson<T>(raw2);
  if (parsed2 !== null && (!validate || validate(parsed2))) return parsed2;

  throw new Error('Failed to parse AI response after retry');
}

// ── Stage 2: AI selection from the candidate pool ───────────────────────────

async function runPlanSelection(
  callModel: CallModel,
  session: ParsedSession,
  kid: Kid,
  parentPrefs: ParentPrefs,
  candidates: RecipeWithTags[]
): Promise<Stage2Response> {
  const compactPool = candidates.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    mealType: r.mealType,
    tags: r.tags,
  }));

  const snacksPerDay = kid.needsSnacks ? kid.snacksPerDay : 0;

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [{ type: 'text' as const, text: `You are a meal planning assistant. Pick recipes from a candidate pool to fill a week of lunches. Do NOT invent new recipes — only use IDs from the pool. Do NOT generate a grocery list.

## Selection rules (in priority order)

1. SAFETY first: never pick a recipe whose tags or name conflict with the kid's allergies, school/camp rules, or dietary flags. The pool has been pre-filtered but stay alert.
2. Match the kid's repetition preference and the parent's prep-time constraint for the week.
3. Use ingredients the parent mentioned having on hand when possible — the pool is already sorted with those boosted.
4. Beat the sandwich rut: rotate formats across the week unless the repetition preference says otherwise. Tag categories like "format" and "ingredient" will help.
5. Minimize unique ingredients across the week. Reuse proteins/produce/dairy across days when sensible (household size: ${parentPrefs.householdSize}).
6. Each day must have exactly one main, ${SIDES_PER_DAY} side(s), and ${snacksPerDay} snack(s) (or report a gap).
7. Sides and snacks come from grocery packages that cover many servings (a bag of apples, a box of crackers, a tub of yogurt), so a single purchase naturally spans several days. Don't pick a brand-new side/snack for every day — that buys far more than gets eaten. Instead choose a small rotating set and reuse each item across 2–3 days, sized to how the kid tolerates repetition:
   - "same-every-day": ~1–2 sides and ~1–2 snacks for the whole week.
   - "some-variety" (or unspecified): ~2–3 sides and ~2–3 snacks for the week, each repeating across 2–3 days, so the kid sees variety without a different item daily.
   - "never-repeat": vary freely — accept the larger grocery list, that's the explicit preference.
   Respect maxPackagedSnacksPerDay regardless. Keep the kid's repetition preference (field: repetitionPreference="${kid.repetitionPreference}") as the deciding factor.
8. For sides, pick items that complement the main and round out the lunchbox — add fruit, veg, dairy, or crackers the main is missing nutritionally.

## Gap handling
If you can't find a good main for a day — for example the parent mentioned a specific ingredient and no pool recipe uses it as the anchor — return that day as { "day": "...", "mainRecipeId": null, "sideRecipeIds": [...], "snackRecipeIds": [...], "gap": "short reason, e.g. 'no candidate uses peas as anchor'" }. We will invent a recipe to fill it in a follow-up step. Gap snack or side slots are fine — just leave those arrays shorter for that day with a gap reason mentioning snacks/sides.

## Output

Output ONLY a valid JSON object, no preamble, no markdown:
{
  "days": [
    { "day": "Monday", "mainRecipeId": "uuid-from-pool", "sideRecipeIds": ["uuid", "uuid"], "snackRecipeIds": ["uuid", "uuid"] }
  ]
}`, cache_control: { type: 'ephemeral' as const } }],
    messages: [
      ...(corrective
        ? [{ role: 'user' as const, content: corrective }]
        : []),
      {
        role: 'user' as const,
        content: `Kid profile:
${JSON.stringify(kid, null, 2)}

Parent preferences:
${JSON.stringify(parentPrefs, null, 2)}

This week's context:
- Days to plan: ${session.daysNeeded.join(', ')}
- On hand: ${session.ingredientsOnHand.join(', ') || 'nothing specified'}
- Prep time: ${session.prepTimeAvailable}
- Notes: ${session.specialNotes || 'none'}
- Snacks per day: ${snacksPerDay}

Candidate recipe pool (pick by id):
${JSON.stringify(compactPool, null, 2)}`,
      },
    ],
  });

  const validate = (parsed: Stage2Response) => {
    if (!parsed || !Array.isArray(parsed.days)) return false;
    const returned = new Set(parsed.days.map((d) => d.day));
    for (const d of session.daysNeeded) {
      if (!returned.has(d)) return false;
    }
    return true;
  };

  return callWithRetry<Stage2Response>(callModel, buildBody, validate);
}

// ── Stage 3: invent a recipe for a gap ──────────────────────────────────────

export async function generateRecipeForGap(
  callModel: CallModel,
  args: {
    kid: Kid;
    parentPrefs: ParentPrefs;
    session: ParsedSession;
    day: string;
    mealType: RecipeMealType;
    gapReason: string;
  }
): Promise<{ name: string; description: string; prepNotes: string; ingredients: Ingredient[]; mealType: RecipeMealType }> {
  const { kid, parentPrefs, session, day, mealType, gapReason } = args;

  type GapResponse = {
    name: string;
    description: string;
    prepNotes: string;
    ingredients: Ingredient[];
  };

  const mealTypeLabel = mealType === 'main' ? 'lunch main' : mealType === 'side' ? 'lunchbox side' : 'snack';

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [{ type: 'text' as const, text: `You are inventing ONE ${mealTypeLabel} to fill a gap the catalog couldn't cover. Real life, not Pinterest. Assembly under 10 minutes if possible.

## Rules (in priority order)
1. SAFETY: never include any allergen listed in the kid's allergies. Respect school/camp rules absolutely.
2. Respect dietary flags (vegetarian, vegan).
3. Address the gap reason — that's why the catalog didn't have a fit.
4. Match the parent's prep-time constraint for the week.
5. Output one recipe, with name, one-sentence description, full prep steps in prepNotes, and ingredients with quantities and units.

Output ONLY a valid JSON object, no preamble, no markdown:
{ "name": "string", "description": "string", "prepNotes": "string", "ingredients": [{ "name": "string", "quantity": "string", "unit": "string" }] }`, cache_control: { type: 'ephemeral' as const } }],
    messages: [
      ...(corrective
        ? [{ role: 'user' as const, content: corrective }]
        : []),
      {
        role: 'user' as const,
        content: `Kid: ${kid.name}, age ${kid.age}
Day: ${day}
Meal type: ${mealType}
Gap reason: ${gapReason}

Kid profile: ${JSON.stringify(kid)}
Parent prefs: ${JSON.stringify(parentPrefs)}

This week's context:
- On hand: ${session.ingredientsOnHand.join(', ') || 'nothing specified'}
- Prep time: ${session.prepTimeAvailable}
- Notes: ${session.specialNotes || 'none'}`,
      },
    ],
  });

  const validate = (parsed: GapResponse) =>
    typeof parsed?.name === 'string' &&
    typeof parsed?.prepNotes === 'string' &&
    Array.isArray(parsed?.ingredients);

  const parsed = await callWithRetry<GapResponse>(callModel, buildBody, validate);
  return {
    name: parsed.name,
    description: parsed.description ?? '',
    prepNotes: parsed.prepNotes,
    ingredients: parsed.ingredients,
    mealType,
  };
}

// ── Full 3-stage orchestration ──────────────────────────────────────────────
// Callers inject their own transport (CallModel) and DB client so this
// function runs identically in the browser and on the server.

export async function orchestrateWeeklyPlan(
  callModel: CallModel,
  db: SupabaseClient,
  userId: string,
  session: ParsedSession,
  kid: Kid,
  parentPrefs: ParentPrefs
): Promise<{ days: string[]; items: LunchItem[] }> {
  // Stage 1 — retrieve candidate pool.
  const candidates = await getCandidateRecipes(db, kid, parentPrefs, session);
  const candidateById = new Map(candidates.map((r) => [r.id, r]));

  // Stage 2 — let the model pick from the pool.
  const selection = await runPlanSelection(callModel, session, kid, parentPrefs, candidates);

  // Stage 3 — fill any gaps and assemble the final LunchItem[].
  // Order: per-day, within each day main first then snacks. Gap fills are
  // sequential so the API call order is deterministic and matches test stubs.
  const snacksPerDay = kid.needsSnacks ? kid.snacksPerDay : 0;
  const items: LunchItem[] = [];

  for (const day of session.daysNeeded) {
    const pick = selection.days.find((d) => d.day === day);

    const lunches: Dish[] = [];
    const snacks: Dish[] = [];

    const mainCandidate = pick?.mainRecipeId ? candidateById.get(pick.mainRecipeId) : undefined;
    if (mainCandidate) {
      lunches.push(recipeToDish(mainCandidate));
    } else {
      const reason = pick?.gap || (pick?.mainRecipeId ? 'AI returned an unknown recipe id' : 'no candidate selected');
      const invented = await generateRecipeForGap(callModel, {
        kid,
        parentPrefs,
        session,
        day,
        mealType: 'main',
        gapReason: reason,
      });
      const saved = await saveAIRecipe(db, userId, {
        name: invented.name,
        description: invented.description,
        prepNotes: invented.prepNotes,
        ingredients: invented.ingredients,
        mealType: 'main',
        tags: autoTagRecipe(invented.ingredients),
      });
      lunches.push(recipeToDish(saved));
    }

    const pickedSides = (pick?.sideRecipeIds ?? [])
      .map((id) => candidateById.get(id))
      .filter((r): r is RecipeWithTags => Boolean(r))
      .slice(0, SIDES_PER_DAY);

    const sides: Dish[] = [];
    for (const s of pickedSides) sides.push(recipeToDish(s));

    while (sides.length < SIDES_PER_DAY) {
      const invented = await generateRecipeForGap(callModel, {
        kid,
        parentPrefs,
        session,
        day,
        mealType: 'side',
        gapReason: 'not enough sides selected from the pool',
      });
      const saved = await saveAIRecipe(db, userId, {
        name: invented.name,
        description: invented.description,
        prepNotes: invented.prepNotes,
        ingredients: invented.ingredients,
        mealType: 'side',
        tags: autoTagRecipe(invented.ingredients),
      });
      sides.push(recipeToDish(saved));
    }

    const pickedSnacks = (pick?.snackRecipeIds ?? [])
      .map((id) => candidateById.get(id))
      .filter((r): r is RecipeWithTags => Boolean(r))
      .slice(0, snacksPerDay);

    for (const s of pickedSnacks) snacks.push(recipeToDish(s));

    while (snacks.length < snacksPerDay) {
      const invented = await generateRecipeForGap(callModel, {
        kid,
        parentPrefs,
        session,
        day,
        mealType: 'snack',
        gapReason: pick?.gap ? `snack gap: ${pick.gap}` : 'not enough snacks selected from the pool',
      });
      const saved = await saveAIRecipe(db, userId, {
        name: invented.name,
        description: invented.description,
        prepNotes: invented.prepNotes,
        ingredients: invented.ingredients,
        mealType: 'snack',
        tags: autoTagRecipe(invented.ingredients),
      });
      snacks.push(recipeToDish(saved));
    }

    items.push({
      id: uuidv4(),
      kidId: kid.id,
      day,
      lunches,
      sides,
      snacks,
    });
  }

  return { days: session.daysNeeded, items };
}
