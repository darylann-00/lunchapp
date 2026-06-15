// Plan orchestration engine — pure logic with no browser dependencies.
// Both the browser (ai.ts) and server (api/generate-plan.ts) inject their
// own `CallModel` (proxy vs direct) and Supabase client (browser singleton
// vs user-token-scoped), so this module never imports ./supabase or touches
// fetch('/api/...').

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Kid,
  ParentPrefs,
  ParsedSession,
  Ingredient,
  SlotCategory,
  DayPlan,
  LunchboxSlot,
  SnackSlot,
  ComponentTags,
} from '../types';
import { getCandidateComponents, saveAIComponent, type CandidatePool } from './components.js';

// ── Shared types ────────────────────────────────────────────────────────────

/** Send a message body to the model, return the text response. */
export type CallModel = (body: object) => Promise<string>;

type Stage2DayPick = {
  day: string;
  lunchbox: Partial<Record<SlotCategory, LunchboxSlot>>;
  snacks: SnackSlot[];
  gap?: string;
};

type Stage2Response = { days: Stage2DayPick[] };

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
  candidates: CandidatePool
): Promise<Stage2Response> {
  const compactPool = {
    byCategory: Object.fromEntries(
      Object.entries(candidates.byCategory).map(([cat, comps]) => [
        cat,
        comps.map((c) => ({
          id: c.id,
          name: c.name,
          also_fills: c.alsoFills ?? [],
          tags: c.tags,
        })),
      ])
    ),
    snacks: candidates.snacks.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      tags: c.tags,
    })),
  };

  const snacksPerDay = kid.needsSnacks ? kid.snacksPerDay : 0;
  const activeSlots = parentPrefs.lunchboxSlots.join(', ');
  const thermoNote = parentPrefs.hasThermos ? '' : ' Exclude hot-format components.';

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text' as const,
        text: `You are a lunchbox component planner. Select components from a candidate pool to fill ${snacksPerDay > 0 ? `lunchboxes (${activeSlots}) plus ${snacksPerDay} snack(s)` : `lunchboxes (${activeSlots})`} for each day of the week. Do NOT invent new components — only use IDs from the pool.${thermoNote}

## Selection rules (in priority order)

1. SAFETY first: never pick a component with allergens. Pool is pre-filtered but stay alert.
2. Each day's lunchbox must fill all active slots from parentPrefs.lunchboxSlots: [${activeSlots}].
3. Combo items: A component with "also_fills" covers multiple slots. E.g. a turkey sandwich might have also_fills: ["carb"]. Both slots in output should reference the same component_id.
4. **Minimum 3 distinct physical components per lunchbox** — a combo can fill 2–3 slots, but remaining slots each need their own component.
5. Snacks are separate from the lunchbox. Pick ${snacksPerDay} snacks per day from the snack pool.
6. Respect kid.repetitionPreference (${kid.repetitionPreference}):
   - "same-every-day": ~1–2 sides and ~1–2 snacks for the whole week.
   - "some-variety": ~2–3 sides and ~2–3 snacks, each repeating across 2–3 days.
   - "never-repeat": vary freely — accept the larger grocery list.
7. Minimize unique ingredients across the week.

## Gap handling

If you can't fill a slot — no good candidate exists for that category on that day — return that slot empty and add a "gap" reason to that day's object (e.g., "gap": "no protein candidates for vegan"). We will invent a component to fill it in the next step.

## Output

Output ONLY a valid JSON object, no preamble, no markdown:
{
  "days": [
    {
      "day": "Monday",
      "lunchbox": {
        "protein": { "component_id": "uuid", "name": "Turkey Sandwich" },
        "carb": { "component_id": "same-uuid", "name": "Turkey Sandwich" },
        "fruit": { "component_id": "uuid2", "name": "Apple Slices" },
        "veggie": { "component_id": "uuid3", "name": "Baby Carrots" },
        "fun": { "component_id": "uuid4", "name": "Chocolate Chips" }
      },
      "snacks": [
        { "component_id": "uuid5", "name": "Goldfish Crackers" }
      ]
    }
  ]
}`,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      ...(corrective ? [{ role: 'user' as const, content: corrective }] : []),
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

Candidate component pool (pick by id):
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
    // Check minimum 3 distinct components per lunchbox
    for (const dp of parsed.days) {
      const uniqueIds = new Set(
        Object.values(dp.lunchbox)
          .filter((s): s is LunchboxSlot => s != null)
          .map((s) => s.component_id)
      );
      if (uniqueIds.size < 3) return false;
    }
    return true;
  };

  return callWithRetry<Stage2Response>(callModel, buildBody, validate);
}

// ── Stage 3: invent a component for a gap ───────────────────────────────────

export async function generateComponentForGap(
  callModel: CallModel,
  args: {
    kid: Kid;
    parentPrefs: ParentPrefs;
    session: ParsedSession;
    day: string;
    category: SlotCategory | 'snack';
    gapReason: string;
  }
): Promise<{
  name: string;
  category: SlotCategory;
  ingredients: Ingredient[];
  alsoFills?: SlotCategory[];
  canBeSnack: boolean;
  note?: string;
  tags: ComponentTags;
}> {
  const { kid, parentPrefs, session, day, category, gapReason } = args;

  type GapResponse = {
    name: string;
    category: SlotCategory;
    ingredients: Ingredient[];
    also_fills?: SlotCategory[];
    can_be_snack: boolean;
    note?: string;
    tags: ComponentTags;
  };

  const categoryLabel =
    category === 'snack'
      ? 'snack component (can be stand-alone or fill a slot)'
      : `lunchbox component for the ${category} slot`;

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [
      {
        type: 'text' as const,
        text: `You are inventing ONE ${categoryLabel} to fill a gap the catalog couldn't cover. Real life, not Pinterest. Assembly/prep under 10 minutes if possible.

## Rules (in priority order)
1. SAFETY: never include any allergen from kid.allergies. Respect school/camp rules absolutely.
2. Respect dietary flags (isVegetarian, isVegan).
3. Address the gap reason — that's why the catalog didn't have a fit.
4. Match the parent's prep-time constraint.
5. If category is "snack": pick a sensible SlotCategory (e.g. "fruit", "fun") and set can_be_snack: true. The component should work standalone.
6. If category is one of [protein, carb, fruit, veggie, fun]: fill that slot. Set can_be_snack based on whether it could reasonably be eaten as a snack alone.
7. If also_fills is relevant (e.g. a sandwich fills both "protein" and "carb"), include it. Otherwise omit or set to empty array.

Output ONLY a valid JSON object, no preamble, no markdown:
{ "name": "string", "category": "protein|carb|fruit|veggie|fun", "ingredients": [{ "name": "string", "qty": "string", "unit": "string" }], "also_fills": [], "can_be_snack": false, "note": "optional prep note", "tags": { "prep": [...], "dietary": [...], "format": [...] } }`,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      ...(corrective ? [{ role: 'user' as const, content: corrective }] : []),
      {
        role: 'user' as const,
        content: `Kid: ${kid.name}, age ${kid.age}
Day: ${day}
Slot/category: ${category}
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
    typeof parsed?.category === 'string' &&
    Array.isArray(parsed?.ingredients) &&
    typeof parsed?.can_be_snack === 'boolean';

  const parsed = await callWithRetry<GapResponse>(callModel, buildBody, validate);
  return {
    name: parsed.name,
    category: parsed.category,
    ingredients: parsed.ingredients,
    alsoFills: parsed.also_fills,
    canBeSnack: parsed.can_be_snack,
    note: parsed.note,
    tags: parsed.tags,
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
): Promise<{ days: string[]; items: Record<string, DayPlan> }> {
  // Stage 1 — retrieve candidate pool.
  const candidates = await getCandidateComponents(db, kid, parentPrefs, session);

  // Build lookup map of all components by ID
  const componentById = new Map(
    [
      ...Object.entries(candidates.byCategory).flatMap(([_, comps]) => comps),
      ...candidates.snacks,
    ].map((c) => [c.id, c])
  );

  // Stage 2 — let the model pick from the pool.
  const selection = await runPlanSelection(callModel, session, kid, parentPrefs, candidates);

  // Stage 3 — fill any gaps and assemble the final Record<string, DayPlan>.
  const items: Record<string, DayPlan> = {};

  for (const day of session.daysNeeded) {
    const pick = selection.days.find((d) => d.day === day);
    if (!pick) continue;

    const lunchbox: Partial<Record<SlotCategory, LunchboxSlot>> = {};
    const snacks: SnackSlot[] = [];

    // Fill lunchbox slots
    for (const slot of parentPrefs.lunchboxSlots) {
      const picked = pick.lunchbox[slot];

      if (picked && componentById.has(picked.component_id)) {
        // Use the picked component from the pool
        lunchbox[slot] = picked;
      } else {
        // Gap fill: invent a component
        const reason = pick.gap || `no candidate selected for ${slot}`;
        const invented = await generateComponentForGap(callModel, {
          kid,
          parentPrefs,
          session,
          day,
          category: slot,
          gapReason: reason,
        });

        const saved = await saveAIComponent(db, userId, {
          name: invented.name,
          category: invented.category,
          ingredients: invented.ingredients,
          alsoFills: invented.alsoFills,
          canBeSnack: invented.canBeSnack,
          note: invented.note,
          tags: invented.tags,
        });

        lunchbox[slot] = {
          component_id: saved.id,
          name: saved.name,
        };
      }
    }

    // Fill snacks
    for (const snackPick of pick.snacks) {
      if (snackPick && componentById.has(snackPick.component_id)) {
        snacks.push(snackPick);
      } else {
        // Gap fill a snack
        const reason = pick.gap || 'no snack candidate selected';
        const invented = await generateComponentForGap(callModel, {
          kid,
          parentPrefs,
          session,
          day,
          category: 'snack',
          gapReason: reason,
        });

        const saved = await saveAIComponent(db, userId, {
          name: invented.name,
          category: invented.category,
          ingredients: invented.ingredients,
          alsoFills: invented.alsoFills,
          canBeSnack: invented.canBeSnack,
          note: invented.note,
          tags: invented.tags,
        });

        snacks.push({
          component_id: saved.id,
          name: saved.name,
        });
      }
    }

    items[day] = { lunchbox, snacks };
  }

  return { days: session.daysNeeded, items };
}
