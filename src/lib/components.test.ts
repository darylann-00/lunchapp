import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ingredient, Kid, ParentPrefs, ParsedSession } from '../types';
import { ingredientsContainAllergen, getCandidateComponents, saveAIComponent } from './components';

const mockFrom = vi.fn();
const mockDb = { from: mockFrom } as unknown as SupabaseClient;

const KID: Kid = {
  id: 'kid-1',
  name: 'Sky',
  age: 7,
  allergies: [],
  dislikes: [],
  likes: [],
  repetitionPreference: 'some-variety',
  needsSnacks: true,
  snacksPerDay: 2,
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

const SESSION: ParsedSession = {
  daysNeeded: ['Monday', 'Tuesday'],
  ingredientsOnHand: [],
  specialNotes: '',
  prepTimeAvailable: 'medium',
};

function componentRow(args: {
  id: string;
  name: string;
  category?: 'protein' | 'carb' | 'fruit' | 'veggie' | 'fun';
  ingredients?: Ingredient[];
  can_be_snack?: boolean;
  tags?: { prep?: string[]; dietary?: string[]; format?: string[] };
}) {
  return {
    id: args.id,
    name: args.name,
    category: args.category ?? 'protein',
    ingredients: args.ingredients ?? [{ name: 'bread', qty: '2', unit: 'slices' }],
    also_fills: null,
    can_be_snack: args.can_be_snack ?? false,
    note: null,
    tags: args.tags ?? {},
    source: 'curated' as const,
    created_by: null,
  };
}

function stubQueries(opts: {
  components: ReturnType<typeof componentRow>[];
  feedback?: { component_id: string; reaction: 'like' | 'dislike' | 'favorite' }[];
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'components') {
      return {
        select: vi.fn().mockResolvedValue({ data: opts.components, error: null }),
      };
    }
    if (table === 'component_feedback') {
      return {
        select: vi.fn().mockResolvedValue({ data: opts.feedback ?? [], error: null }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

describe('getCandidateComponents', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('excludes components the user disliked', async () => {
    stubQueries({
      components: [
        componentRow({ id: 'c1', name: 'Ham wrap' }),
        componentRow({ id: 'c2', name: 'Cheese quesadilla' }),
      ],
      feedback: [{ component_id: 'c1', reaction: 'dislike' }],
    });

    const result = await getCandidateComponents(mockDb, KID, PREFS, SESSION);
    const allIds = Object.values(result.byCategory).flat().map((c) => c.id);
    expect(allIds).toContain('c2');
    expect(allIds).not.toContain('c1');
  });

  it('excludes components containing a kid allergy', async () => {
    stubQueries({
      components: [
        componentRow({
          id: 'c1',
          name: 'PB & J',
          ingredients: [{ name: 'peanut butter', qty: '2', unit: 'tbsp' }],
        }),
        componentRow({
          id: 'c2',
          name: 'Turkey roll',
          ingredients: [{ name: 'turkey', qty: '2', unit: 'slices' }],
        }),
      ],
    });

    const kidWithAllergy = { ...KID, allergies: ['peanut'] };
    const result = await getCandidateComponents(mockDb, kidWithAllergy, PREFS, SESSION);
    const allIds = Object.values(result.byCategory).flat().map((c) => c.id);
    expect(allIds).not.toContain('c1');
    expect(allIds).toContain('c2');
  });

  it('keeps only components tagged vegan when isVegan is set', async () => {
    stubQueries({
      components: [
        componentRow({ id: 'c1', name: 'Tofu wrap', tags: { dietary: ['vegan', 'vegetarian'] } }),
        componentRow({ id: 'c2', name: 'Veggie sandwich', tags: { dietary: ['vegetarian'] } }),
        componentRow({ id: 'c3', name: 'Chicken wrap', tags: {} }),
      ],
    });

    const veganKid = { ...KID, isVegan: true };
    const result = await getCandidateComponents(mockDb, veganKid, PREFS, SESSION);
    const allIds = Object.values(result.byCategory).flat().map((c) => c.id);
    expect(allIds).toEqual(['c1']);
  });

  it('populates snack pool with can_be_snack components', async () => {
    stubQueries({
      components: [
        componentRow({ id: 'c1', name: 'Turkey', can_be_snack: false }),
        componentRow({ id: 'c2', name: 'String Cheese', can_be_snack: true }),
        componentRow({ id: 'c3', name: 'Goldfish', category: 'carb', can_be_snack: true }),
      ],
    });

    const result = await getCandidateComponents(mockDb, KID, PREFS, SESSION);
    const snackIds = result.snacks.map((c) => c.id);
    expect(snackIds).toContain('c2');
    expect(snackIds).toContain('c3');
    expect(snackIds).not.toContain('c1');
  });
});

describe('saveAIComponent', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('writes source=ai with created_by=userId', async () => {
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'new-comp-1',
            name: 'Pea quesadilla',
            category: 'protein',
            ingredients: [{ name: 'peas', qty: '1', unit: 'cup' }],
            also_fills: ['carb'],
            can_be_snack: false,
            note: null,
            tags: { prep: ['make-ahead'], dietary: ['vegetarian'] },
            source: 'ai',
            created_by: 'user-42',
          },
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'components') return { insert: insertSpy };
      throw new Error(`Unexpected table ${table}`);
    });

    const saved = await saveAIComponent(mockDb, 'user-42', {
      name: 'Pea quesadilla',
      category: 'protein',
      ingredients: [{ name: 'peas', qty: '1', unit: 'cup' }],
      alsoFills: ['carb'],
      tags: { prep: ['make-ahead'], dietary: ['vegetarian'] },
    });

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ai', created_by: 'user-42' })
    );
    expect(saved.source).toBe('ai');
    expect(saved.alsoFills).toEqual(['carb']);
  });
});

describe('ingredientsContainAllergen', () => {
  const ing = (name: string): Ingredient => ({ name, qty: '1', unit: 'x' });

  it('blocks allergen-containing ingredients (real onboarding values)', () => {
    expect(ingredientsContainAllergen([ing('peanut butter')], ['peanuts'])).toBe(true);
    expect(ingredientsContainAllergen([ing('cheddar cheese')], ['dairy'])).toBe(true);
    expect(ingredientsContainAllergen([ing('whole milk')], ['dairy'])).toBe(true);
    expect(ingredientsContainAllergen([ing('butter')], ['dairy'])).toBe(true);
    expect(ingredientsContainAllergen([ing('greek yogurt')], ['dairy'])).toBe(true);
    expect(ingredientsContainAllergen([ing('buttermilk')], ['dairy'])).toBe(true);
    expect(ingredientsContainAllergen([ing('egg')], ['eggs'])).toBe(true);
    expect(ingredientsContainAllergen([ing('mayonnaise')], ['eggs'])).toBe(true);
    expect(ingredientsContainAllergen([ing('whole wheat bread')], ['gluten'])).toBe(true);
    expect(ingredientsContainAllergen([ing('pasta')], ['gluten'])).toBe(true);
    expect(ingredientsContainAllergen([ing('almonds')], ['tree nuts'])).toBe(true);
    expect(ingredientsContainAllergen([ing('cashews')], ['tree nuts'])).toBe(true);
    expect(ingredientsContainAllergen([ing('almond milk')], ['tree nuts'])).toBe(true);
    expect(ingredientsContainAllergen([ing('shrimp')], ['shellfish'])).toBe(true);
    expect(ingredientsContainAllergen([ing('salmon fillet')], ['fish'])).toBe(true);
    expect(ingredientsContainAllergen([ing('tofu')], ['soy'])).toBe(true);
    expect(ingredientsContainAllergen([ing('edamame')], ['soy'])).toBe(true);
    expect(ingredientsContainAllergen([ing('tahini')], ['sesame'])).toBe(true);
    expect(ingredientsContainAllergen([ing('hummus')], ['sesame'])).toBe(true);
    expect(ingredientsContainAllergen([ing('bacon')], ['pork'])).toBe(true);
    expect(ingredientsContainAllergen([ing('ham')], ['pork'])).toBe(true);
    expect(ingredientsContainAllergen([ing('ground beef')], ['red meat'])).toBe(true);
  });

  it('does not over-filter safe lookalikes', () => {
    expect(ingredientsContainAllergen([ing('eggplant')], ['eggs'])).toBe(false);
    expect(ingredientsContainAllergen([ing('graham cracker')], ['pork'])).toBe(false);
    expect(ingredientsContainAllergen([ing('peanut butter')], ['dairy'])).toBe(false);
    expect(ingredientsContainAllergen([ing('sunflower seed butter')], ['dairy'])).toBe(false);
    expect(ingredientsContainAllergen([ing('almond milk')], ['dairy'])).toBe(false);
    expect(ingredientsContainAllergen([ing('coconut')], ['tree nuts'])).toBe(false);
    expect(ingredientsContainAllergen([ing('coconut milk')], ['tree nuts'])).toBe(false);
    expect(ingredientsContainAllergen([ing('peas')], ['peanuts'])).toBe(false);
    expect(ingredientsContainAllergen([ing('shrimp')], ['fish'])).toBe(false);
    expect(ingredientsContainAllergen([ing('salmon')], ['shellfish'])).toBe(false);
  });

  it('normalizes alias allergen names', () => {
    expect(ingredientsContainAllergen([ing('peanut butter')], ['peanut'])).toBe(true);
    expect(ingredientsContainAllergen([ing('cheese')], ['milk'])).toBe(true);
    expect(ingredientsContainAllergen([ing('mayonnaise')], ['egg'])).toBe(true);
    expect(ingredientsContainAllergen([ing('bread')], ['wheat'])).toBe(true);
  });

  it('falls back to substring for unknown allergens', () => {
    expect(ingredientsContainAllergen([ing('kiwi slices')], ['kiwi'])).toBe(true);
    expect(ingredientsContainAllergen([ing('apple')], ['kiwi'])).toBe(false);
  });

  it('returns false for empty allergies list', () => {
    expect(ingredientsContainAllergen([ing('anything')], [])).toBe(false);
  });
});
