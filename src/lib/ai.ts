import { supabase } from './supabase';
import type {
  Kid,
  ParentPrefs,
  WeeklyPlan,
  GroceryItem,
  ParsedSession,
  DayPlan,
  SlotCategory,
  Ingredient,
  ComponentTags,
} from '../types';
import {
  orchestrateWeeklyPlan,
  callWithRetry as callWithRetryEngine,
} from './planEngine';

// Re-export utilities for backward compatibility (tests, other importers).
export { stripFences, safeParseJson } from './planEngine';

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

async function callAnthropic(body: object): Promise<string> {
  const authHeader = await getAuthHeader();
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const content = (data as { content: { type: string; text: string }[] }).content;
  return content.find((c) => c.type === 'text')?.text ?? '';
}

// Thin browser-side wrapper: one retry via the /api/anthropic proxy.
async function callWithRetry<T>(
  buildBody: (corrective?: string) => object,
  validate?: (parsed: T) => boolean
): Promise<T> {
  return callWithRetryEngine<T>(callAnthropic, buildBody, validate);
}

// ── AI Functions ─────────────────────────────────────────────────────────────

export async function parseWeeklyNotes(
  notes: string,
  days: string[],
  kid: Kid,
  _parentPrefs: ParentPrefs
): Promise<ParsedSession> {
  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text' as const,
        text: `You are helping a parent plan school/camp lunches for their kid. The parent has shared free-text notes about this week. Extract a structured summary.

Output ONLY a valid JSON object, no preamble, no markdown:
{
  "daysNeeded": ["Monday", ...],
  "ingredientsOnHand": ["string", ...],
  "specialNotes": "string",
  "prepTimeAvailable": "low" | "medium" | "high"
}

Use the day checkboxes provided as the source of truth for daysNeeded — only override if the user explicitly contradicts them in their notes. Default prepTimeAvailable to "medium" if not stated. specialNotes captures anything not covered by the other fields (activities, things the kid asked for, repetition preferences for this specific week).`,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      ...(corrective ? [{ role: 'user' as const, content: corrective }] : []),
      {
        role: 'user' as const,
        content: `Days selected: ${days.join(', ')}
Kid: ${kid.name}, age ${kid.age}
Parent's notes: ${notes || '(none)'}`,
      },
    ],
  });

  return callWithRetry<ParsedSession>(buildBody);
}

// ── Weekly plan generation ─────────────────────────────────────────────────
// The 3-stage orchestration (candidate retrieval → AI selection → gap filling)
// now lives in planEngine.ts. This wrapper injects browser-side transport
// (callAnthropic) and the browser Supabase singleton so the engine runs
// identically here and on the server.

export async function generateWeeklyPlan(
  session: ParsedSession,
  kid: Kid,
  parentPrefs: ParentPrefs
): Promise<{ days: string[]; items: Record<string, DayPlan> }> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error('Not authenticated');
  return orchestrateWeeklyPlan(callAnthropic, supabase, userData.user.id, session, kid, parentPrefs);
}

// ── Grocery list aggregation ───────────────────────────────────────────────
// Pure function that aggregates ingredients from all components in a plan.
// Deduplicates by ingredient name and accounts for quantity scaling across days.

function categorizeIngredient(name: string): GroceryItem['category'] {
  const n = name.toLowerCase();
  if (
    /apple|banana|grape|strawberr|blueberr|watermelon|mandarin|mango|berr|orange|fruit|lemon|tomato|cucumber|carrot|celery|broccoli|pepper|pea|edamame|lettuce|spinach/.test(
      n
    )
  )
    return 'produce';
  if (/cheese|yogurt|cream|milk|butter/.test(n)) return 'dairy';
  if (/chicken|turkey|ham|egg|tuna|salmon|beef|pork|bacon/.test(n)) return 'protein';
  if (/bread|tortilla|bagel|pasta|rice|cracker|pretzel|granola|cereal|wheat/.test(n))
    return 'grains';
  if (
    /goldfish|animal cracker|cookie|muffin|chocolate|gumm|fruit leather|fruit snack|trail mix|popcorn|chip|rice cake/.test(
      n
    )
  )
    return 'packaged';
  if (
    /mayo|jelly|peanut butter|sunflower|hummus|olive oil|sauce|mustard|dressing|honey/.test(n)
  )
    return 'condiments';
  return 'other';
}

export async function aggregateGroceryList(plan: WeeklyPlan): Promise<GroceryItem[]> {
  // Collect all unique component_ids from the plan
  const componentIds = new Set<string>();
  for (const dayPlan of Object.values(plan.items)) {
    for (const slot of Object.values(dayPlan.lunchbox)) {
      if (slot) componentIds.add(slot.component_id);
    }
    for (const snack of dayPlan.snacks) {
      componentIds.add(snack.component_id);
    }
  }

  if (componentIds.size === 0) return [];

  // Fetch component ingredients from DB
  const { data, error } = await supabase
    .from('components')
    .select('id, ingredients')
    .in('id', [...componentIds]);

  if (error) throw new Error(`Failed to load components: ${error.message}`);

  // Count how many times each component appears across days (for quantity scaling)
  const componentDayCount = new Map<string, number>();
  for (const dayPlan of Object.values(plan.items)) {
    const dayIds = new Set<string>();
    for (const slot of Object.values(dayPlan.lunchbox)) {
      if (slot) dayIds.add(slot.component_id);
    }
    for (const snack of dayPlan.snacks) {
      dayIds.add(snack.component_id);
    }
    for (const id of dayIds) {
      componentDayCount.set(id, (componentDayCount.get(id) ?? 0) + 1);
    }
  }

  // Aggregate ingredients by name
  const ingredientMap = new Map<
    string,
    { qty: string; unit: string; category: GroceryItem['category'] }
  >();

  for (const comp of data ?? []) {
    const ingredients = (comp.ingredients as Ingredient[]) ?? [];
    const dayCount = componentDayCount.get((comp.id as string) ?? '') ?? 1;

    for (const ing of ingredients) {
      const key = ing.name.toLowerCase().trim();
      const existing = ingredientMap.get(key);
      if (existing) {
        // Simple: just note the quantity × days — exact math on mixed-unit strings is fragile
        existing.qty = `${existing.qty}, ${ing.qty}${ing.unit ? ' ' + ing.unit : ''} × ${dayCount} days`;
      } else {
        const qtyStr =
          dayCount > 1
            ? `${ing.qty}${ing.unit ? ' ' + ing.unit : ''} × ${dayCount} days`
            : `${ing.qty}${ing.unit ? ' ' + ing.unit : ''}`;
        ingredientMap.set(key, {
          qty: qtyStr,
          unit: ing.unit ?? '',
          category: categorizeIngredient(ing.name),
        });
      }
    }
  }

  return [...ingredientMap.entries()].map(([name, info]) => ({
    name,
    qty: info.qty,
    unit: info.unit,
    category: info.category,
  }));
}

// ── Slot regeneration ──────────────────────────────────────────────────────
// Generate a single replacement component for a slot, with AI context.

export async function regenerateSlot(args: {
  kid: Kid;
  parentPrefs: ParentPrefs;
  sessionNotes: string;
  day: string;
  slotCategory: SlotCategory | 'snack';
  currentName: string;
  userNote: string;
  otherComponentNames: string[];
}): Promise<{
  name: string;
  category: SlotCategory;
  ingredients: Ingredient[];
  alsoFills?: SlotCategory[];
  canBeSnack: boolean;
  note?: string;
  tags: ComponentTags;
}> {
  const {
    kid,
    parentPrefs,
    sessionNotes,
    day,
    slotCategory,
    currentName,
    userNote,
    otherComponentNames,
  } = args;

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [
      {
        type: 'text' as const,
        text: `You are a meal planning assistant. Generate ONE replacement component only. The week's session notes and other components are provided for context — match the prep-time constraint, respect activities mentioned for this day, and avoid duplicating other components already in the plan unless the kid's repetition preference allows it. Strongly prefer using ingredients that already appear elsewhere in the week's plan to minimize grocery waste for a small household.

Same safety rules apply:
1. SAFETY FIRST: Never include allergens listed in the kid's allergies.
2. Respect school/camp rules absolutely.
3. Respect dietary flags (vegetarian, vegan).
4. If the parent does not have a thermos (hasThermos=false), do NOT suggest hot items.

Output the component JSON object directly — no wrapper, no array, no preamble:
{
  "name": "string",
  "category": "protein" | "carb" | "fruit" | "veggie" | "fun",
  "ingredients": [{ "name": "string", "qty": "string", "unit": "string" }],
  "also_fills": ["SlotCategory", ...],
  "can_be_snack": false,
  "note": "string",
  "tags": {
    "prep": ["make-ahead" | "packaged" | "fresh" | "freezer-friendly"],
    "dietary": ["nut-free" | "dairy-free" | "gluten-free" | "vegetarian" | "vegan" | "egg-free"],
    "format": ["hot" | "cold" | "room-temp"]
  }
}`,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      ...(corrective ? [{ role: 'user' as const, content: corrective }] : []),
      {
        role: 'user' as const,
        content: `Kid: ${kid.name}, age ${kid.age}
Day: ${day}
Slot being replaced: ${slotCategory} (currently: ${currentName})
Parent's request: ${userNote || 'no specific reason — just make it different'}

Kid profile:
- Allergies: ${kid.allergies.join(', ') || 'none'}
- Dislikes: ${kid.dislikes.join(', ') || 'none'}
- Likes: ${kid.likes.join(', ') || 'none'}
- Repetition preference: ${kid.repetitionPreference}
- Vegetarian: ${kid.isVegetarian}
- Vegan: ${kid.isVegan}
- School/camp rules: ${kid.schoolOrCampRules || 'none'}
- Other dietary notes: ${kid.otherDietaryNotes || 'none'}

Parent preferences:
- Has thermos: ${parentPrefs.hasThermos}
- Household size: ${parentPrefs.householdSize}
- Stores available: ${parentPrefs.stores.join(', ') || 'standard'}
- Organic preference: ${parentPrefs.organic}
- Other notes: ${parentPrefs.otherNotes || 'none'}

This week's session notes: ${sessionNotes || 'none'}

Other components already in the plan this week:
${otherComponentNames.map((name) => `- ${name}`).join('\n')}`,
      },
    ],
  });

  const response = await callWithRetry<{
    name: string;
    category: SlotCategory;
    ingredients: Ingredient[];
    also_fills?: SlotCategory[];
    can_be_snack: boolean;
    note?: string;
    tags: ComponentTags;
  }>(buildBody, (parsed) => {
    // Validate required fields
    return !!(parsed.name && parsed.category && Array.isArray(parsed.ingredients));
  });

  // Map snake_case from AI to camelCase for return
  return {
    name: response.name,
    category: response.category,
    ingredients: response.ingredients,
    alsoFills: response.also_fills,
    canBeSnack: response.can_be_snack,
    note: response.note,
    tags: response.tags,
  };
}
