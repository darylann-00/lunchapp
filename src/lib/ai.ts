import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import type { Kid, ParentPrefs, WeeklyPlan, LunchItem, GroceryItem, Dish, ParsedSession } from '../types';
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
    system: [{ type: 'text' as const, text: `You are helping a parent plan school/camp lunches for their kid. The parent has shared free-text notes about this week. Extract a structured summary.

Output ONLY a valid JSON object, no preamble, no markdown:
{
  "daysNeeded": ["Monday", ...],
  "ingredientsOnHand": ["string", ...],
  "specialNotes": "string",
  "prepTimeAvailable": "low" | "medium" | "high"
}

Use the day checkboxes provided as the source of truth for daysNeeded — only override if the user explicitly contradicts them in their notes. Default prepTimeAvailable to "medium" if not stated. specialNotes captures anything not covered by the other fields (activities, things the kid asked for, repetition preferences for this specific week).`, cache_control: { type: 'ephemeral' as const } }],
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
): Promise<{ days: string[]; items: LunchItem[] }> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error('Not authenticated');
  return orchestrateWeeklyPlan(callAnthropic, supabase, userData.user.id, session, kid, parentPrefs);
}

export async function generateGroceryList(
  plans: WeeklyPlan[],
  kid: Kid,
  _parentPrefs: ParentPrefs
): Promise<GroceryItem[]> {
  const allItems = plans.flatMap((p) => p.items);

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [{ type: 'text' as const, text: `You are building a grocery shopping list from approved weekly lunch plans. Walk every ingredient in every dish (lunches, sides, and snacks) across all days.

Rules:
1. Deduplicate by ingredient name. Sum quantities where units match; list separate entries when units differ.
2. Assign each item one category: produce, dairy, protein, grains, packaged, condiments, or other.
3. Use sensible store-shopping quantities — round up to the nearest practical purchase unit.
4. forKids should list the kid's name for every item.

Output ONLY a valid JSON array, no preamble, no markdown:
[
  { "name": "string", "quantity": "string", "unit": "string", "category": "string", "forKids": ["string"] }
]`, cache_control: { type: 'ephemeral' as const } }],
    messages: [
      ...(corrective
        ? [{ role: 'user' as const, content: corrective }]
        : []),
      {
        role: 'user' as const,
        content: `Kid: ${kid.name}
Plan items:
${JSON.stringify(allItems, null, 2)}`,
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
  mealType: 'lunch' | 'snack' | 'side';
  currentDish: Dish;
  userNote: string;
  otherDishesThisWeek: Dish[];
}): Promise<Dish> {
  const { kid, parentPrefs, sessionNotes, day, mealType, currentDish, userNote, otherDishesThisWeek } = args;

  const buildBody = (corrective?: string) => ({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [{ type: 'text' as const, text: `You are a meal planning assistant. Generate ONE replacement dish only. The week's session notes and other dishes are provided for context — match the prep-time constraint, respect activities mentioned for this day, and avoid duplicating other dishes already in the plan unless the kid's repetition preference allows it. Strongly prefer using ingredients that already appear elsewhere in the week's plan to minimize grocery waste for a small household.

Same safety rules apply:
1. Never include allergens listed in the kid's allergies.
2. Respect school/camp rules absolutely.
3. Respect dietary flags (vegetarian, vegan).

Output the Dish JSON object directly — no wrapper, no array, no preamble:
{ "id": "uuid", "name": "string", "description": "string", "prepNotes": "string", "isPackaged": false, "ingredients": [{ "name": "string", "quantity": "string", "unit": "string" }] }`, cache_control: { type: 'ephemeral' as const } }],
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
