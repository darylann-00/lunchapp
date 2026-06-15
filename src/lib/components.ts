import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Component,
  ComponentReaction,
  ComponentTags,
  Ingredient,
  Kid,
  ParentPrefs,
  ParsedSession,
  SlotCategory,
} from '../types';

// ── Allergen detection ────────────────────────────────────────────────────────

const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  peanuts: /\bpeanut/i,
  'tree nuts': /\b(?:almond|walnut|pecan|cashew|hazelnut|pistachio|macadamia|brazil nut|pine nut|praline|marzipan|nutella)(?:s|es)?\b|tree\s*nuts?/i,
  dairy: /\b(?:cheese|cheddar|mozzarella|parmesan|yogurt|yoghurt|cream|custard|ghee|whey|casein|dairy|buttermilk)(?:s|es)?\b|(?<!(?:almond|oat|soy|coconut|rice|cashew|hemp|pea)\s)\bmilk\b|(?<!(?:almond|cashew|peanut|sunflower|seed|soy|coconut)\s)\bbutter\b/i,
  eggs: /\begg(?!plant)|mayonnaise|\bmayo\b|aioli|meringue|frittata|omelet|quiche/i,
  gluten: /\b(?:wheat|flour|bread|breadcrumb|pasta|noodle|cracker|tortilla|bun|bagel|pita|cereal|barley|rye|couscous|gluten|pretzel|crouton)(?:s|es)?\b/i,
  fish: /\b(?:fish|salmon|tuna|cod|tilapia|halibut|trout|haddock|mackerel|sardine|anchovy|anchovies)(?:s|es)?\b/i,
  shellfish: /\b(?:shellfish|shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|crayfish|squid|calamari)(?:s|es)?\b/i,
  soy: /\b(?:soy|soya|soybean|tofu|edamame|tempeh|miso|tamari)(?:s|es)?\b/i,
  sesame: /\b(?:sesame|tahini|hummus|halva|halvah)(?:s|es)?\b/i,
  'red meat': /\b(?:beef|steak|pork|bacon|ham|prosciutto|sausage|salami|pepperoni|lamb|veal|venison|bison|chorizo|pancetta|meatball|hamburger)(?:s|es)?\b/i,
  pork: /\b(?:pork|bacon|ham|prosciutto|sausage|salami|pepperoni|chorizo|pancetta|spam)(?:s|es)?\b/i,
};

const ALLERGEN_ALIASES: Record<string, string> = {
  peanut: 'peanuts',
  'tree nut': 'tree nuts',
  treenuts: 'tree nuts',
  milk: 'dairy',
  egg: 'eggs',
  wheat: 'gluten',
  soya: 'soy',
};

export function ingredientsContainAllergen(ingredients: Ingredient[], allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const names = ingredients.map((ing) => ing.name.toLowerCase());

  return allergies.some((raw) => {
    const allergy = raw.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!allergy) return false;

    const canonical = ALLERGEN_PATTERNS[allergy] ? allergy : ALLERGEN_ALIASES[allergy];
    const pattern = canonical ? ALLERGEN_PATTERNS[canonical] : undefined;

    if (pattern) return names.some((n) => pattern.test(n));
    return names.some((n) => n.includes(allergy));
  });
}

export { ALLERGEN_PATTERNS, ALLERGEN_ALIASES };

// ── DB row shape ──────────────────────────────────────────────────────────────

type ComponentRow = {
  id: string;
  name: string;
  category: SlotCategory;
  ingredients: Ingredient[];
  also_fills: SlotCategory[] | null;
  can_be_snack: boolean;
  note: string | null;
  tags: ComponentTags;
  source: 'curated' | 'ai' | 'user';
  created_by: string | null;
};

function rowToComponent(row: ComponentRow): Component {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    ingredients: row.ingredients,
    alsoFills: row.also_fills ?? undefined,
    canBeSnack: row.can_be_snack,
    note: row.note ?? undefined,
    tags: row.tags,
    source: row.source,
    createdBy: row.created_by,
  };
}

// ── Candidate pool for plan generation (Stage 1) ─────────────────────────────

const TARGET_PER_CATEGORY = 15;
const TARGET_SNACKS = 15;

export type CandidatePool = {
  byCategory: Record<SlotCategory, Component[]>;
  snacks: Component[];
};

export async function getCandidateComponents(
  db: SupabaseClient,
  kid: Kid,
  _parentPrefs: ParentPrefs,
  session: ParsedSession
): Promise<CandidatePool> {
  const [componentsRes, feedbackRes] = await Promise.all([
    db.from('components').select('id, name, category, ingredients, also_fills, can_be_snack, note, tags, source, created_by'),
    db.from('component_feedback').select('component_id, reaction'),
  ]);

  if (componentsRes.error) throw new Error(`Failed to load components: ${componentsRes.error.message}`);
  if (feedbackRes.error) throw new Error(`Failed to load component feedback: ${feedbackRes.error.message}`);

  const feedbackByComponent = new Map<string, ComponentReaction>();
  for (const f of feedbackRes.data ?? []) {
    feedbackByComponent.set(f.component_id as string, f.reaction as ComponentReaction);
  }

  const rows = (componentsRes.data ?? []) as unknown as ComponentRow[];

  const filtered = rows
    .map(rowToComponent)
    .filter((c) => feedbackByComponent.get(c.id) !== 'dislike')
    .filter((c) => !ingredientsContainAllergen(c.ingredients, kid.allergies))
    .filter((c) => {
      if (kid.isVegan) return c.tags.dietary?.includes('vegan') ?? false;
      if (kid.isVegetarian) {
        const d = c.tags.dietary ?? [];
        return d.includes('vegetarian') || d.includes('vegan');
      }
      return true;
    });

  const onHand = session.ingredientsOnHand.map((s) => s.toLowerCase()).filter(Boolean);

  const scored = filtered.map((c) => {
    let score = 0;
    if (feedbackByComponent.get(c.id) === 'favorite') score += 2;
    if (onHand.length > 0) {
      const ingredientNames = c.ingredients.map((i) => i.name.toLowerCase()).join(' | ');
      if (onHand.some((term) => ingredientNames.includes(term))) score += 1;
    }
    return { c, score };
  });

  for (let i = scored.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scored[i], scored[j]] = [scored[j], scored[i]];
  }
  scored.sort((a, b) => b.score - a.score);

  const byCategory: Record<SlotCategory, Component[]> = {
    protein: [],
    carb: [],
    fruit: [],
    veggie: [],
    fun: [],
  };
  const snacks: Component[] = [];

  for (const { c } of scored) {
    const cat = byCategory[c.category];
    if (cat.length < TARGET_PER_CATEGORY) cat.push(c);
    if (c.canBeSnack && snacks.length < TARGET_SNACKS) snacks.push(c);
  }

  return { byCategory, snacks };
}

// ── Save AI-generated component ──────────────────────────────────────────────

export async function saveAIComponent(db: SupabaseClient, userId: string, args: {
  name: string;
  category: SlotCategory;
  ingredients: Ingredient[];
  alsoFills?: SlotCategory[];
  canBeSnack?: boolean;
  note?: string;
  tags: ComponentTags;
}): Promise<Component> {
  const { data, error } = await db
    .from('components')
    .insert({
      name: args.name,
      category: args.category,
      ingredients: args.ingredients,
      also_fills: args.alsoFills ?? null,
      can_be_snack: args.canBeSnack ?? false,
      note: args.note ?? null,
      tags: args.tags,
      source: 'ai',
      created_by: userId,
    })
    .select('id, name, category, ingredients, also_fills, can_be_snack, note, tags, source, created_by')
    .single();

  if (error || !data) {
    throw new Error(`Failed to save AI component: ${error?.message ?? 'no row returned'}`);
  }

  return rowToComponent(data as unknown as ComponentRow);
}

// ── Component picker (filtered by category + allergens) ──────────────────────

export async function getComponentsForPicker(
  db: SupabaseClient,
  category: SlotCategory,
  kid: Kid
): Promise<Component[]> {
  const { data, error } = await db
    .from('components')
    .select('id, name, category, ingredients, also_fills, can_be_snack, note, tags, source, created_by')
    .eq('category', category)
    .order('name');

  if (error) throw new Error(`Failed to load components: ${error.message}`);

  const rows = (data ?? []) as unknown as ComponentRow[];

  return rows
    .map(rowToComponent)
    .filter((c) => !ingredientsContainAllergen(c.ingredients, kid.allergies))
    .filter((c) => {
      if (kid.isVegan) return c.tags.dietary?.includes('vegan') ?? false;
      if (kid.isVegetarian) {
        const d = c.tags.dietary ?? [];
        return d.includes('vegetarian') || d.includes('vegan');
      }
      return true;
    });
}

// ── Browse / library view ────────────────────────────────────────────────────

export type ComponentWithFeedback = Component & { reaction: ComponentReaction | null };

export async function getComponentsForBrowse(db: SupabaseClient): Promise<ComponentWithFeedback[]> {
  const [componentsRes, feedbackRes] = await Promise.all([
    db
      .from('components')
      .select('id, name, category, ingredients, also_fills, can_be_snack, note, tags, source, created_by')
      .order('name'),
    db.from('component_feedback').select('component_id, reaction'),
  ]);

  if (componentsRes.error) throw new Error(`Failed to load components: ${componentsRes.error.message}`);
  if (feedbackRes.error) throw new Error(`Failed to load feedback: ${feedbackRes.error.message}`);

  const feedbackMap = new Map<string, ComponentReaction>();
  for (const f of feedbackRes.data ?? []) {
    feedbackMap.set(f.component_id as string, f.reaction as ComponentReaction);
  }

  const rows = (componentsRes.data ?? []) as unknown as ComponentRow[];
  return rows.map((row) => ({
    ...rowToComponent(row),
    reaction: feedbackMap.get(row.id) ?? null,
  }));
}

// ── Feedback upsert (toggle) ─────────────────────────────────────────────────

export async function upsertComponentFeedback(
  db: SupabaseClient,
  userId: string,
  componentId: string,
  currentReaction: ComponentReaction | null,
  newReaction: ComponentReaction
): Promise<ComponentReaction | null> {
  if (currentReaction === newReaction) {
    await db.from('component_feedback').delete().eq('component_id', componentId);
    return null;
  }
  const { error } = await db
    .from('component_feedback')
    .upsert(
      { user_id: userId, component_id: componentId, reaction: newReaction },
      { onConflict: 'user_id,component_id' }
    );
  if (error) throw new Error(`Failed to save feedback: ${error.message}`);
  return newReaction;
}
