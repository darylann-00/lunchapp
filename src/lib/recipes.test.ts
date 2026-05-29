import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ingredient, Kid, ParentPrefs, ParsedSession } from '../types';
import { autoTagRecipe, getCandidateRecipes, ingredientsContainAllergen, saveAIRecipe } from './recipes';

// Mock db object — tests configure `mockFrom` per-case via `stubQueries`.
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
};

const SESSION: ParsedSession = {
  daysNeeded: ['Monday', 'Tuesday'],
  ingredientsOnHand: [],
  specialNotes: '',
  prepTimeAvailable: 'medium',
};

// Build a Supabase row shape for the recipes select with joined tag names.
function row(args: {
  id: string;
  name: string;
  mealType?: 'main' | 'snack';
  ingredients?: Ingredient[];
  tags?: string[];
}) {
  return {
    id: args.id,
    name: args.name,
    description: null,
    prep_notes: 'steps',
    ingredients: args.ingredients ?? [{ name: 'bread', quantity: '2', unit: 'slices' }],
    meal_type: args.mealType ?? 'main',
    is_packaged: false,
    source: 'curated' as const,
    source_url: null,
    source_attribution: null,
    prep_time_minutes: null,
    created_by: null,
    recipe_tag_assignments: (args.tags ?? []).map((name) => ({
      recipe_tags: { name },
    })),
  };
}

function stubQueries(opts: {
  recipes: ReturnType<typeof row>[];
  feedback?: { recipe_id: string; reaction: 'like' | 'dislike' | 'favorite' }[];
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'recipes') {
      return {
        select: vi.fn().mockResolvedValue({ data: opts.recipes, error: null }),
      };
    }
    if (table === 'recipe_feedback') {
      return {
        select: vi.fn().mockResolvedValue({ data: opts.feedback ?? [], error: null }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

describe('autoTagRecipe', () => {
  it('tags peanut butter and skips peanut-free', () => {
    const tags = autoTagRecipe([
      { name: 'peanut butter', quantity: '2', unit: 'tbsp' },
      { name: 'whole wheat bread', quantity: '2', unit: 'slices' },
    ]);
    expect(tags).toContain('has-peanut-butter');
    expect(tags).toContain('has-wheat');
    expect(tags).not.toContain('peanut-free');
  });

  it('adds dairy-free, peanut-free, egg-free when nothing matches', () => {
    const tags = autoTagRecipe([
      { name: 'apple slices', quantity: '1', unit: 'cup' },
      { name: 'sunflower seed butter', quantity: '1', unit: 'tbsp' },
    ]);
    expect(tags).toEqual(expect.arrayContaining(['dairy-free', 'peanut-free', 'egg-free', 'tree-nut-free']));
  });

  it('infers vegetarian when no animal-protein tags fire', () => {
    const tags = autoTagRecipe([
      { name: 'black beans', quantity: '1', unit: 'cup' },
      { name: 'cheese', quantity: '1', unit: 'oz' },
    ]);
    expect(tags).toContain('vegetarian');
    // dairy present → not vegan
    expect(tags).not.toContain('vegan');
  });

  it('infers vegan only when no animal proteins and no eggs/dairy', () => {
    const tags = autoTagRecipe([
      { name: 'hummus', quantity: '2', unit: 'tbsp' },
      { name: 'carrot sticks', quantity: '1', unit: 'cup' },
    ]);
    expect(tags).toContain('vegan');
    expect(tags).toContain('vegetarian');
  });
});

describe('getCandidateRecipes', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('excludes recipes the user disliked', async () => {
    stubQueries({
      recipes: [
        row({ id: 'r1', name: 'Ham wrap' }),
        row({ id: 'r2', name: 'Cheese quesadilla' }),
      ],
      feedback: [{ recipe_id: 'r1', reaction: 'dislike' }],
    });

    const result = await getCandidateRecipes(mockDb, KID, PREFS, SESSION);
    expect(result.map((r) => r.id)).toEqual(['r2']);
  });

  it('excludes recipes containing a kid allergy via ingredient name substring', async () => {
    stubQueries({
      recipes: [
        row({
          id: 'r1',
          name: 'PB & J',
          ingredients: [{ name: 'peanut butter', quantity: '2', unit: 'tbsp' }],
        }),
        row({
          id: 'r2',
          name: 'Turkey roll',
          ingredients: [{ name: 'turkey', quantity: '2', unit: 'slices' }],
        }),
      ],
    });

    const kidWithAllergy = { ...KID, allergies: ['peanut'] };
    const result = await getCandidateRecipes(mockDb, kidWithAllergy, PREFS, SESSION);
    expect(result.map((r) => r.id)).toEqual(['r2']);
  });

  it('keeps only recipes tagged vegan when isVegan is set', async () => {
    stubQueries({
      recipes: [
        row({ id: 'r1', name: 'Tofu wrap', tags: ['vegan', 'vegetarian'] }),
        row({ id: 'r2', name: 'Veggie sandwich', tags: ['vegetarian'] }),
        row({ id: 'r3', name: 'Chicken wrap', tags: [] }),
      ],
    });

    const veganKid = { ...KID, isVegan: true };
    const result = await getCandidateRecipes(mockDb, veganKid, PREFS, SESSION);
    expect(result.map((r) => r.id)).toEqual(['r1']);
  });

  it('boosts favorites and on-hand-ingredient matches before trimming', async () => {
    stubQueries({
      recipes: [
        row({ id: 'r1', name: 'Plain sandwich' }),
        row({
          id: 'r2',
          name: 'Pea pasta',
          ingredients: [{ name: 'frozen peas', quantity: '1', unit: 'cup' }],
        }),
        row({ id: 'r3', name: 'Cheese bites' }),
      ],
      feedback: [{ recipe_id: 'r3', reaction: 'favorite' }],
    });

    const sessionWithPeas: ParsedSession = { ...SESSION, ingredientsOnHand: ['peas'] };
    const result = await getCandidateRecipes(mockDb, KID, PREFS, sessionWithPeas);
    // Favorite (+2) sorts ahead of on-hand match (+1) which sorts ahead of plain (0).
    expect(result.map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
  });

  it('splits the pool into mains and snacks', async () => {
    stubQueries({
      recipes: [
        row({ id: 'm1', name: 'Main 1', mealType: 'main' }),
        row({ id: 'm2', name: 'Main 2', mealType: 'main' }),
        row({ id: 's1', name: 'Snack 1', mealType: 'snack' }),
      ],
    });

    const result = await getCandidateRecipes(mockDb, KID, PREFS, SESSION);
    expect(result.filter((r) => r.mealType === 'main').length).toBe(2);
    expect(result.filter((r) => r.mealType === 'snack').length).toBe(1);
  });
});

describe('saveAIRecipe', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('writes source=ai with created_by=userId and attaches matching tags', async () => {
    const recipeInsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi
          .fn()
          .mockResolvedValue({
            data: {
              id: 'new-recipe-1',
              name: 'Pea quesadilla',
              description: 'Quick',
              prep_notes: 'Cook',
              ingredients: [{ name: 'peas', quantity: '1', unit: 'cup' }],
              meal_type: 'main',
              is_packaged: false,
              source: 'ai',
              source_url: null,
              source_attribution: null,
              prep_time_minutes: null,
              created_by: 'user-42',
            },
            error: null,
          }),
      }),
    });
    const tagSelectIn = vi
      .fn()
      .mockResolvedValue({ data: [{ id: 'tag-quesadilla', name: 'quesadilla' }], error: null });
    const assignmentInsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'recipes') return { insert: recipeInsertSpy };
      if (table === 'recipe_tags') return { select: vi.fn().mockReturnValue({ in: tagSelectIn }) };
      if (table === 'recipe_tag_assignments') return { insert: assignmentInsertSpy };
      throw new Error(`Unexpected table ${table}`);
    });

    const saved = await saveAIRecipe(mockDb, 'user-42', {
      name: 'Pea quesadilla',
      description: 'Quick',
      prepNotes: 'Cook',
      ingredients: [{ name: 'peas', quantity: '1', unit: 'cup' }],
      mealType: 'main',
      tags: ['quesadilla', 'unknown-tag'],
    });

    expect(recipeInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ai', created_by: 'user-42' })
    );
    expect(assignmentInsertSpy).toHaveBeenCalledWith([
      { recipe_id: 'new-recipe-1', tag_id: 'tag-quesadilla' },
    ]);
    expect(saved.tags).toEqual(['quesadilla']);
    expect(saved.source).toBe('ai');
  });

  it('passes userId through to the insert as created_by', async () => {
    const recipeInsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'r-1',
            name: 'X',
            description: '',
            prep_notes: '',
            ingredients: [],
            meal_type: 'main',
            is_packaged: false,
            source: 'ai',
            source_url: null,
            source_attribution: null,
            prep_time_minutes: null,
            created_by: 'custom-uid',
          },
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'recipes') return { insert: recipeInsertSpy };
      if (table === 'recipe_tags') return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      throw new Error(`Unexpected table ${table}`);
    });

    await saveAIRecipe(mockDb, 'custom-uid', {
      name: 'X',
      description: '',
      prepNotes: '',
      ingredients: [],
      mealType: 'main',
      tags: [],
    });

    expect(recipeInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'custom-uid' })
    );
  });
});

describe('ingredientsContainAllergen', () => {
  const ing = (name: string): Ingredient => ({ name, quantity: '1', unit: 'x' });

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
