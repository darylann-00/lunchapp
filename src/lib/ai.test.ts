import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Kid, ParentPrefs, ParsedSession, Component } from '../types';

const { getCandidateComponentsMock, saveAIComponentMock, sessionMock } = vi.hoisted(() => ({
  getCandidateComponentsMock: vi.fn(),
  saveAIComponentMock: vi.fn(),
  sessionMock: { access_token: 'tok' },
}));

vi.mock('./components', async () => {
  const actual = await vi.importActual<typeof import('./components')>('./components');
  return {
    ...actual,
    getCandidateComponents: getCandidateComponentsMock,
    saveAIComponent: saveAIComponentMock,
  };
});

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: sessionMock } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-42' } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
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
  lunchboxSlots: ['protein', 'carb', 'fruit', 'veggie', 'fun'],
  hasThermos: false,
};

function comp(id: string, name: string, category: Component['category'], canBeSnack = false): Component {
  return {
    id,
    name,
    category,
    ingredients: [{ name: 'bread', qty: '1', unit: 'slice' }],
    canBeSnack,
    tags: {},
    source: 'curated',
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
    getCandidateComponentsMock.mockReset();
    saveAIComponentMock.mockReset();
  });

  it('hydrates picks from the candidate pool when no gaps', async () => {
    getCandidateComponentsMock.mockResolvedValue({
      byCategory: {
        protein: [comp('p1', 'Turkey wrap', 'protein')],
        carb: [comp('c1', 'Crackers', 'carb', true)],
        fruit: [comp('f1', 'Apple slices', 'fruit', true)],
        veggie: [comp('v1', 'Baby carrots', 'veggie', true)],
        fun: [comp('fn1', 'Chocolate chips', 'fun', true)],
      },
      snacks: [comp('c1', 'Crackers', 'carb', true)],
    });

    stubAnthropic([
      JSON.stringify({
        days: [
          {
            day: 'Monday',
            lunchbox: {
              protein: { component_id: 'p1', name: 'Turkey wrap' },
              carb: { component_id: 'c1', name: 'Crackers' },
              fruit: { component_id: 'f1', name: 'Apple slices' },
              veggie: { component_id: 'v1', name: 'Baby carrots' },
              fun: { component_id: 'fn1', name: 'Chocolate chips' },
            },
            snacks: [{ component_id: 'c1', name: 'Crackers' }],
          },
        ],
      }),
    ]);

    const session: ParsedSession = {
      daysNeeded: ['Monday'],
      ingredientsOnHand: [],
      specialNotes: '',
      prepTimeAvailable: 'medium',
    };

    const { days, items } = await generateWeeklyPlan(session, KID, PREFS);

    expect(days).toEqual(['Monday']);
    expect(items['Monday']).toBeDefined();
    expect(items['Monday']!.lunchbox.protein?.name).toBe('Turkey wrap');
    expect(items['Monday']!.lunchbox.fruit?.name).toBe('Apple slices');
    expect(items['Monday']!.snacks[0]?.name).toBe('Crackers');
    expect(saveAIComponentMock).not.toHaveBeenCalled();
  });

  it('fills gaps when AI returns unknown component IDs', async () => {
    getCandidateComponentsMock.mockResolvedValue({
      byCategory: {
        protein: [comp('p1', 'Turkey wrap', 'protein')],
        carb: [],
        fruit: [comp('f1', 'Apple slices', 'fruit', true)],
        veggie: [comp('v1', 'Baby carrots', 'veggie', true)],
        fun: [comp('fn1', 'Chocolate chips', 'fun', true)],
      },
      snacks: [comp('f1', 'Apple slices', 'fruit', true)],
    });

    saveAIComponentMock.mockImplementation(async (_db: unknown, _userId: string, { name }: { name: string }) => ({
      id: `saved-${name}`,
      name,
      category: 'carb',
      ingredients: [{ name: 'pasta', qty: '1', unit: 'cup' }],
      canBeSnack: false,
      tags: {},
      source: 'ai',
    }));

    stubAnthropic([
      // Stage 2: carb slot references an unknown ID
      JSON.stringify({
        days: [
          {
            day: 'Monday',
            lunchbox: {
              protein: { component_id: 'p1', name: 'Turkey wrap' },
              carb: { component_id: 'not-in-pool', name: 'Unknown' },
              fruit: { component_id: 'f1', name: 'Apple slices' },
              veggie: { component_id: 'v1', name: 'Baby carrots' },
              fun: { component_id: 'fn1', name: 'Chocolate chips' },
            },
            snacks: [{ component_id: 'f1', name: 'Apple slices' }],
          },
        ],
      }),
      // Stage 3: gap fill for carb slot
      JSON.stringify({
        name: 'Pasta salad',
        category: 'carb',
        ingredients: [{ name: 'pasta', qty: '1', unit: 'cup' }],
        also_fills: [],
        can_be_snack: false,
        note: 'Make ahead',
        tags: { prep: ['make-ahead'], dietary: ['vegetarian'], format: ['cold'] },
      }),
    ]);

    const session: ParsedSession = {
      daysNeeded: ['Monday'],
      ingredientsOnHand: [],
      specialNotes: '',
      prepTimeAvailable: 'medium',
    };

    const { items } = await generateWeeklyPlan(session, KID, PREFS);

    expect(items['Monday']!.lunchbox.protein?.name).toBe('Turkey wrap');
    expect(items['Monday']!.lunchbox.carb?.name).toBe('Pasta salad');
    expect(saveAIComponentMock).toHaveBeenCalledTimes(1);
  });
});
