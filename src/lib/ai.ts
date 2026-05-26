import { v4 as uuidv4 } from 'uuid';
import type { Kid, ParentPrefs, WeeklyPlan, LunchItem, GroceryItem, Dish, ParsedSession } from '../types';

// ── Utilities ────────────────────────────────────────────────────────────────

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

async function callAnthropic(body: object): Promise<string> {
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  // extract text from first content block
  const content = (data as { content: { type: string; text: string }[] }).content;
  return content.find((c) => c.type === 'text')?.text ?? '';
}

async function callWithRetry<T>(
  buildBody: (corrective?: string) => object,
  validate?: (parsed: T) => boolean
): Promise<T> {
  const body = buildBody();
  const raw = await callAnthropic(body);
  const parsed = safeParseJson<T>(raw);
  if (parsed !== null && (!validate || validate(parsed))) return parsed;

  // one retry with corrective prompt
  const retryBody = buildBody('Your last response was not valid JSON. Output only JSON, no preamble, no markdown.');
  const raw2 = await callAnthropic(retryBody);
  const parsed2 = safeParseJson<T>(raw2);
  if (parsed2 !== null && (!validate || validate(parsed2))) return parsed2;

  throw new Error('Failed to parse AI response after retry');
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
    system: `You are helping a parent plan school/camp lunches for their kid. The parent has shared free-text notes about this week. Extract a structured summary.

Output ONLY a valid JSON object, no preamble, no markdown:
{
  "daysNeeded": ["Monday", ...],
  "ingredientsOnHand": ["string", ...],
  "specialNotes": "string",
  "prepTimeAvailable": "low" | "medium" | "high"
}

Use the day checkboxes provided as the source of truth for daysNeeded — only override if the user explicitly contradicts them in their notes. Default prepTimeAvailable to "medium" if not stated. specialNotes captures anything not covered by the other fields (activities, things the kid asked for, repetition preferences for this specific week).`,
    messages: [
      ...(corrective
        ? [{ role: 'user' as const, content: corrective }]
        : []),
      {
        role: 'user' as const,
        content: `Days selected: ${days.join(', ')}
Kid: ${kid.name}, age ${kid.age}
Parent's notes: ${notes || '(none)'}`,
      },
    ],
  });

  const result = await callWithRetry<ParsedSession>(buildBody);
  return result;
}

export async function generateWeeklyPlan(
  session: ParsedSession,
  kid: Kid,
  parentPrefs: ParentPrefs
): Promise<{ days: string[]; items: LunchItem[] }> {
  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: `You are a meal planning assistant for busy parents packing school and camp lunches. Generate a complete weekly lunch plan. Do NOT generate a grocery list — that happens in a separate step.

Rules (in priority order):
1. SAFETY: Never include any allergen listed in the kid's allergies. Respect school/camp rules (e.g. nut-free facilities) absolutely.
2. Respect dietary flags (vegetarian, vegan).
3. The kid's saved repetition preference is a baseline. If this week's parent notes conflict with it, the parent's notes for this week override the baseline.
4. Respect the parent's prep-time constraint for this week.
5. Stay within budget if provided.
6. Cap packaged snacks at the daily maximum.
7. Provide approximately the configured number of snacks per day, but the snacks array can flex as long as total food volume is appropriate for the kid's age.
8. Default style: practical, nutritious, well-rounded, kid-friendly. Not creative-for-its-own-sake. Assume minimal cooking — favor assembly over recipes. Aim for things the kid will actually eat.
9. Use ingredients the parent mentioned having on hand when possible.
10. Each lunch and snack must include name, one-sentence description, full prep steps in prepNotes, and ingredients with quantities and units.

Output ONLY a valid JSON object, no preamble, no markdown:
{
  "days": ["Monday", ...],
  "items": [
    {
      "kidId": "string",
      "day": "string",
      "mainLunch": { "id": "uuid", "name": "string", "description": "string", "prepNotes": "string", "isPackaged": false, "ingredients": [{ "name": "string", "quantity": "string", "unit": "string" }] },
      "snacks": [ /* same shape */ ]
    }
  ]
}`,
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
- Days: ${session.daysNeeded.join(', ')}
- On hand: ${session.ingredientsOnHand.join(', ') || 'nothing specified'}
- Prep time: ${session.prepTimeAvailable}
- Notes: ${session.specialNotes || 'none'}`,
      },
    ],
  });

  const validate = (parsed: { days: string[]; items: LunchItem[] }) => {
    if (!Array.isArray(parsed.days) || !Array.isArray(parsed.items)) return false;
    const requestedDays = new Set(session.daysNeeded);
    const returnedDays = new Set(parsed.days);
    for (const d of requestedDays) {
      if (!returnedDays.has(d)) return false;
    }
    return true;
  };

  const result = await callWithRetry<{ days: string[]; items: LunchItem[] }>(buildBody, validate);

  // stamp UUIDs on items and dishes
  result.items = result.items.map((item) => ({
    ...item,
    id: uuidv4(),
    mainLunch: { ...item.mainLunch, id: item.mainLunch.id || uuidv4() },
    snacks: item.snacks.map((s) => ({ ...s, id: s.id || uuidv4() })),
  }));

  return result;
}

export async function generateGroceryList(
  plan: WeeklyPlan,
  kid: Kid,
  _parentPrefs: ParentPrefs
): Promise<GroceryItem[]> {
  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are building a grocery shopping list from an approved weekly lunch plan. The plan is final — your job is aggregation, not planning.

Rules:
1. Walk every ingredient in every dish (mainLunch and all snacks) across all days.
2. Deduplicate by name. When the same ingredient appears multiple times, sum quantities where units match. When units don't match, list separate entries.
3. Assign each item one category: produce, dairy, protein, grains, packaged, condiments, or other.
4. Use sensible store-shopping quantities — round up to the nearest practical purchase unit (e.g. "1 bunch" of cilantro, not "3 sprigs").
5. forKids should list the kid's name for every item in v0.

Output ONLY a valid JSON array, no preamble, no markdown:
[
  { "name": "string", "quantity": "string", "unit": "string", "category": "string", "forKids": ["string"] }
]`,
    messages: [
      ...(corrective
        ? [{ role: 'user' as const, content: corrective }]
        : []),
      {
        role: 'user' as const,
        content: `Kid: ${kid.name}
Plan:
${JSON.stringify(plan.items, null, 2)}`,
      },
    ],
  });

  return callWithRetry<GroceryItem[]>(buildBody);
}

export async function regenerateDish(args: {
  kid: Kid;
  parentPrefs: ParentPrefs;
  sessionNotes: string;
  day: string;
  mealType: 'main' | 'snack';
  currentDish: Dish;
  userNote: string;
  otherDishesThisWeek: Dish[];
}): Promise<Dish> {
  const { kid, parentPrefs, sessionNotes, day, mealType, currentDish, userNote, otherDishesThisWeek } = args;

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a meal planning assistant. Generate ONE replacement dish only. The week's session notes and other dishes are provided for context — match the prep-time constraint, respect activities mentioned for this day, and avoid duplicating other dishes already in the plan unless the kid's repetition preference allows it.

Same safety rules apply:
1. Never include allergens listed in the kid's allergies.
2. Respect school/camp rules absolutely.
3. Respect dietary flags (vegetarian, vegan).

Output the Dish JSON object directly — no wrapper, no array, no preamble:
{ "id": "uuid", "name": "string", "description": "string", "prepNotes": "string", "isPackaged": false, "ingredients": [{ "name": "string", "quantity": "string", "unit": "string" }] }`,
    messages: [
      ...(corrective
        ? [{ role: 'user' as const, content: corrective }]
        : []),
      {
        role: 'user' as const,
        content: `Kid: ${kid.name}, age ${kid.age}
Day: ${day}
Meal type: ${mealType}
Item being replaced: ${currentDish.name} — ${currentDish.description}
Parent's request: ${userNote || 'no specific reason — just make it different'}

Kid profile: ${JSON.stringify(kid)}
Parent prefs: ${JSON.stringify(parentPrefs)}

This week's session notes: ${sessionNotes || 'none'}

Other dishes already in the plan this week:
${JSON.stringify(otherDishesThisWeek, null, 2)}`,
      },
    ],
  });

  const dish = await callWithRetry<Dish>(buildBody);
  return { ...dish, id: dish.id || uuidv4() };
}
