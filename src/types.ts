// ── Slot / Component types ─────────────────────────────────────────────────

export type SlotCategory = 'protein' | 'carb' | 'fruit' | 'veggie' | 'fun';

export const SLOT_LABELS: Record<SlotCategory, string> = {
  protein: 'Protein',
  carb: 'Energy Carb',
  fruit: 'Fruit',
  veggie: 'Veggie',
  fun: 'Fun Bite',
};

export const SLOT_ICON: Record<SlotCategory, string> = {
  protein: 'steak',
  carb: 'bread',
  fruit: 'apple',
  veggie: 'carrot',
  fun: 'chocolate-bar',
};

export type Ingredient = {
  name: string;
  qty: string;
  unit?: string;
};

export type ComponentTags = {
  prep?: ('make-ahead' | 'packaged' | 'fresh' | 'freezer-friendly')[];
  dietary?: ('nut-free' | 'dairy-free' | 'gluten-free' | 'vegetarian' | 'vegan' | 'egg-free')[];
  format?: ('hot' | 'cold' | 'room-temp')[];
};

export type ComponentSource = 'curated' | 'ai' | 'user';
export type ComponentReaction = 'like' | 'dislike' | 'favorite';

export type Component = {
  id: string;
  name: string;
  category: SlotCategory;
  alsoFills?: SlotCategory[];
  canBeSnack: boolean;
  ingredients: Ingredient[];
  note?: string;
  tags: ComponentTags;
  source: ComponentSource;
  createdBy?: string | null;
};

// ── Plan types ─────────────────────────────────────────────────────────────

export type LunchboxSlot = {
  component_id: string;
  name: string;
};

export type SnackSlot = {
  component_id: string;
  name: string;
};

export type DayPlan = {
  lunchbox: Partial<Record<SlotCategory, LunchboxSlot>>;
  snacks: SnackSlot[];
};

// ── Kid / Parent / Plan ────────────────────────────────────────────────────

export type Kid = {
  id: string;
  name: string;
  age: number;
  allergies: string[];
  dislikes: string[];
  likes: string[];
  repetitionPreference: 'same-every-day' | 'never-repeat' | 'some-variety';
  needsSnacks: boolean;
  snacksPerDay: number;
  maxPackagedSnacksPerDay: number;
  isVegetarian: boolean;
  isVegan: boolean;
  schoolOrCampRules: string;
  otherDietaryNotes: string;
};

export type ParentPrefs = {
  weeklyBudget: number | null;
  householdSize: number;
  stores: string[];
  organic: 'always' | 'never' | 'when-possible' | 'doesnt-matter';
  otherNotes: string;
  lunchboxSlots: SlotCategory[];
  hasThermos: boolean;
};

export type GroceryItem = {
  name: string;
  qty: string;
  unit: string;
  category: 'produce' | 'dairy' | 'protein' | 'grains' | 'packaged' | 'condiments' | 'other';
};

export type WeeklyPlan = {
  id: string;
  createdAt: string;
  weekStartDate: string;
  status: 'draft' | 'final';
  days: string[];
  items: Record<string, DayPlan>;
  groceryList: GroceryItem[] | null;
  sessionNotes: string;
};

export type ParsedSession = {
  daysNeeded: string[];
  ingredientsOnHand: string[];
  specialNotes: string;
  prepTimeAvailable: 'low' | 'medium' | 'high';
};
