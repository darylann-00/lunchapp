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
};

export type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
};

export type Dish = {
  id: string;
  name: string;
  description: string;
  prepNotes: string;
  ingredients: Ingredient[];
  isPackaged: boolean;
};

export type LunchItem = {
  id: string;
  kidId: string;
  day: string;
  lunches: Dish[];
  sides: Dish[];
  snacks: Dish[];
};

export type GroceryItem = {
  name: string;
  quantity: string;
  unit: string;
  category: 'produce' | 'dairy' | 'protein' | 'grains' | 'packaged' | 'condiments' | 'other';
  forKids: string[];
};

export type WeeklyPlan = {
  id: string;
  createdAt: string;
  weekStartDate: string;
  status: 'draft' | 'final';
  days: string[];
  items: LunchItem[];
  groceryList: GroceryItem[] | null;
  sessionNotes: string;
  prepProgress: Record<string, number[]>;
};

export type ParsedSession = {
  daysNeeded: string[];
  ingredientsOnHand: string[];
  specialNotes: string;
  prepTimeAvailable: 'low' | 'medium' | 'high';
};

export type RecipeSource = 'curated' | 'ai' | 'user';
export type RecipeMealType = 'main' | 'snack' | 'side';
export type RecipeReaction = 'like' | 'dislike' | 'favorite';
export type TagCategory = 'dietary' | 'format' | 'ingredient' | 'occasion';

export type Recipe = {
  id: string;
  name: string;
  description: string | null;
  prepNotes: string;
  ingredients: Ingredient[];
  mealType: RecipeMealType;
  isPackaged: boolean;
  source: RecipeSource;
  sourceUrl: string | null;
  sourceAttribution: string | null;
  prepTimeMinutes: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeTag = {
  id: string;
  name: string;
  category: TagCategory;
};

export type RecipeTagAssignment = {
  recipeId: string;
  tagId: string;
};

export type RecipeFeedback = {
  userId: string;
  recipeId: string;
  reaction: RecipeReaction;
  createdAt: string;
};
