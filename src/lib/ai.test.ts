import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Kid, ParentPrefs, ParsedSession } from '../types';
import type { RecipeWithTags } from './recipes';

const { getCandidateRecipesMock, saveAIRecipeMock, sessionMock } = vi.hoisted(() => ({
  getCandidateRecipesMock: vi.fn(),
  saveAIRecipeMock: vi.fn(),
  sessionMock: { access_token: 'tok' },
}));

vi.mock('./recipes', async () => {
  const actual = await vi.importActual<typeof import('./recipes')>('./recipes');
  return {
    ...actual,
    getCandidateRecipes: getCandidateRecipesMock,
    saveAIRecipe: saveAIRecipeMock,
  };
});

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: sessionMock } }),
    },
  },
}));

import { safeParseJson, generateWeeklyPlan } from './ai';

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    const result = safeParseJson<{ foo: string }>('{"foo":"bar"}');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('parses JSON wrapped in markdown fences', () => {
    const result = safeParseJson<{ foo: string }>('```json\n{"foo":"bar"}\n```');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('parses JSON with trailing commas and // comments', () => {
    const input = `{
      "foo": "bar", // this is a comment
      "baz": 42,
    }`;
    const result = safeParseJson<{ foo: string; baz: number }>(input);
    expect(result).toEqual({ foo: 'bar', baz: 42 });
  });

  it('returns null on unrecoverable garbage', () => {
    const result = safeParseJson('this is not json at all }{');
    expect(result).toBeNull();
  });
});

// ── generateWeeklyPlan orchestration ───────────────────────────────────────

const KID: Kid = {
  id: 'kid-1',
  name: 'Sky',
  age: 7,
  allergies: [],
  dislikes: [],
  likes: [],
  repetitionPreference: 'some-variety',
  needsSnacks: true,
  snacksPerDay: 1,
  maxPackagedSnacksPerDay: 1,
  isVegetarian: false,
  isVegan: false,
  schoolOrCampRules: '',
  otherDietaryNotes: '',
};

const PREFS: ParentPrefs = {
  weeklyBudget: null,
  householdSize: 3,
  stores: [],
  organic: 'doesnt-matter',
  otherNotes: '',
};

function candidate(id: string, name: string, mealType: 'main' | 'snack'): RecipeWithTags {
  return {
    id,
    name,
    description: '',
    prepNotes: 'steps',
    ingredients: [{ name: 'bread', quantity: '1', unit: 'slice' }],
    mealType,
    isPackaged: false,
    source: 'curated',
    sourceUrl: null,
    sourceAttribution: null,
    prepTimeMinutes: null,
    createdBy: null,
    tags: [],
  };
}

function stubAnthropic(responses: string[]) {
  const queue = [...responses];
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    const text = queue.shift() ?? '';
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text }] }),
    } as Response;
  });
}

describe('generateWeeklyPlan', () => {
  beforeEach(() => {
    getCandidateRecipesMock.mockReset();
    saveAIRecipeMock.mockReset();
  });

  it('hydrates picks from the candidate pool when no gaps', async () => {
    getCandidateRecipesMock.mockResolvedValue([
      candidate('m1', 'Turkey wrap', 'main'),
      candidate('m2', 'Cheese quesadilla', 'main'),
      candidate('s1', 'Apple slices', 'snack'),
      candidate('s2', 'Cheddar cubes', 'snack'),
    ]);

    stubAnthropic([
      JSON.stringify({
        days: [
          { day: 'Monday', mainRecipeId: 'm1', snackRecipeIds: ['s1'] },
          { day: 'Tuesday', mainRecipeId: 'm2', snackRecipeIds: ['s2'] },
        ],
      }),
    ]);

    const session: ParsedSession = {
      daysNeeded: ['Monday', 'Tuesday'],
      ingredientsOnHand: [],
      specialNotes: '',
      prepTimeAvailable: 'medium',
    };

    const { days, items } = await generateWeeklyPlan(session, KID, PREFS);

    expect(days).toEqual(['Monday', 'Tuesday']);
    expect(items.map((i) => i.day)).toEqual(['Monday', 'Tuesday']);
    expect(items[0]!.lunches[0]!.name).toBe('Turkey wrap');
    expect(items[0]!.snacks[0]!.name).toBe('Apple slices');
    expect(items[1]!.lunches[0]!.name).toBe('Cheese quesadilla');
    expect(saveAIRecipeMock).not.toHaveBeenCalled();
  });

  it('treats hallucinated recipe IDs as gaps and invokes Stage 3', async () => {
    getCandidateRecipesMock.mockResolvedValue([candidate('m1', 'Turkey wrap', 'main')]);

    saveAIRecipeMock.mockImplementation(async ({ name }) => ({
      id: 'saved-1',
      name,
      description: '',
      prepNotes: 'AI prep',
      ingredients: [{ name: 'peas', quantity: '1', unit: 'cup' }],
      mealType: 'main' as const,
      isPackaged: false,
      source: 'ai' as const,
      sourceUrl: null,
      sourceAttribution: null,
      prepTimeMinutes: null,
      createdBy: 'user-42',
      tags: [],
    }));

    stubAnthropic([
      // Stage 2: Monday uses a valid pool id; Tuesday uses a hallucinated id.
      JSON.stringify({
        days: [
          { day: 'Monday', mainRecipeId: 'm1', snackRecipeIds: [] },
          { day: 'Tuesday', mainRecipeId: 'not-in-pool', snackRecipeIds: [] },
        ],
      }),
      // Stage 3 order matches generateWeeklyPlan: per-day, main-then-snacks.
      // Monday main is in the pool, so first gap is Monday's snack.
      JSON.stringify({
        name: 'Mon snack',
        description: '',
        prepNotes: 'Open bag',
        ingredients: [{ name: 'crackers', quantity: '1', unit: 'oz' }],
      }),
      // Then Tuesday's main (hallucinated id → gap).
      JSON.stringify({
        name: 'Pea pasta',
        description: 'Quick pasta',
        prepNotes: 'Boil and stir',
        ingredients: [{ name: 'peas', quantity: '1', unit: 'cup' }],
      }),
      // Then Tuesday's snack.
      JSON.stringify({
        name: 'Tue snack',
        description: '',
        prepNotes: 'Open bag',
        ingredients: [{ name: 'crackers', quantity: '1', unit: 'oz' }],
      }),
    ]);

    const session: ParsedSession = {
      daysNeeded: ['Monday', 'Tuesday'],
      ingredientsOnHand: ['peas'],
      specialNotes: 'we have peas',
      prepTimeAvailable: 'medium',
    };

    const { items } = await generateWeeklyPlan(session, KID, PREFS);

    expect(items[0]!.lunches[0]!.name).toBe('Turkey wrap');
    expect(items[1]!.lunches[0]!.name).toBe('Pea pasta');
    // saveAIRecipe should be called 3 times (1 main gap + 2 snack gaps).
    expect(saveAIRecipeMock).toHaveBeenCalledTimes(3);
    // Order: Mon snack, Tue main, Tue snack — per-day, main-then-snacks.
    expect(saveAIRecipeMock.mock.calls.map((c) => c[0].mealType)).toEqual([
      'snack',
      'main',
      'snack',
    ]);
  });
});
