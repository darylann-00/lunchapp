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
  mainLunch: Dish;
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
  status: 'draft' | 'final';
  days: string[];
  items: LunchItem[];
  groceryList: GroceryItem[] | null;
  sessionNotes: string;
};

export type ParsedSession = {
  daysNeeded: string[];
  ingredientsOnHand: string[];
  specialNotes: string;
  prepTimeAvailable: 'low' | 'medium' | 'high';
};
