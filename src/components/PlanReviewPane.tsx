import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Kid, ParentPrefs, WeeklyPlan, LunchItem, Dish } from '../types';
import type { RecipeWithTags } from '../lib/recipes';
import { getRecipesForPicker } from '../lib/recipes';
import { DishRow } from './DishRow';
import { useItemRegenerate } from '../hooks/useAI';

const DAY_COLORS: Record<string, string> = {
  Monday: 'bg-luncharoo-coral',
  Tuesday: 'bg-luncharoo-peach',
  Wednesday: 'bg-luncharoo-yellow',
  Thursday: 'bg-luncharoo-blue',
  Friday: 'bg-emerald-500',
};

type Props = {
  plan: WeeklyPlan;
  kid: Kid;
  prefs: ParentPrefs;
  onFinalize: (planId: string, items: LunchItem[]) => Promise<void>;
  onClose: () => void;
};

type RecipeCache = {
  main: RecipeWithTags[];
  side: RecipeWithTags[];
  snack: RecipeWithTags[];
};

export default function PlanReviewPane({ plan, kid, prefs, onFinalize, onClose }: Props) {
  const [draft, setDraft] = useState<LunchItem[]>(() =>
    JSON.parse(JSON.stringify(plan.items))
  );
  const [recipes, setRecipes] = useState<RecipeCache>({ main: [], side: [], snack: [] });
  const [saving, setSaving] = useState(false);
  const { loadingIds, errorIds, regenerate } = useItemRegenerate([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getRecipesForPicker('main', kid),
      getRecipesForPicker('side', kid),
      getRecipesForPicker('snack', kid),
    ]).then(([mains, sides, snacks]) => {
      if (!cancelled) setRecipes({ main: mains, side: sides, snack: snacks });
    });
    return () => { cancelled = true; };
  }, [kid]);

  const updateDish = useCallback(
    (itemId: string, category: 'lunches' | 'sides' | 'snacks', dishIndex: number, newDish: Dish) => {
      setDraft((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const updated = [...item[category]];
          updated[dishIndex] = newDish;
          return { ...item, [category]: updated };
        })
      );
    },
    []
  );

  const handleRegenerate = useCallback(
    async (item: LunchItem, category: 'lunches' | 'sides' | 'snacks', dishIndex: number) => {
      const dish = item[category][dishIndex];
      const mealType = category === 'lunches' ? 'lunch' : category === 'sides' ? 'side' : 'snack';
      const allDishes = draft.flatMap((i) => [...i.lunches, ...i.sides, ...i.snacks]);
      const otherDishes = allDishes.filter((d) => d.id !== dish.id);

      const result = await regenerate(dish.id, {
        kid,
        parentPrefs: prefs,
        sessionNotes: plan.sessionNotes,
        day: item.day,
        mealType,
        currentDish: dish,
        userNote: '',
        otherDishesThisWeek: otherDishes,
      });
      if (result) {
        updateDish(item.id, category, dishIndex, result);
      }
    },
    [draft, kid, prefs, plan.sessionNotes, regenerate, updateDish]
  );

  const handleFinalize = async () => {
    setSaving(true);
    try {
      await onFinalize(plan.id, draft);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const isNewPlan = plan.status === 'draft';

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-luncharoo-blue luncharoo-border-b relative pt-3 pb-5 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{isNewPlan ? '✨' : '✏️'}</span>
            <h2 className="font-fredoka text-base text-white font-bold drop-shadow-[1px_1px_0px_#134e9e]">
              {isNewPlan ? 'Review Your Plan' : 'Edit Plan'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 text-sm"
          >
            ✕
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
      </div>

      {/* Scrollable day list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {draft.map((item) => {
          const dayColor = DAY_COLORS[item.day] ?? 'bg-luncharoo-blue';

          return (
            <div key={item.id} className="mb-6">
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`${dayColor} text-white font-fredoka font-bold text-xs px-3 py-1.5 rounded-xl border-2 border-luncharoo-dark luncharoo-shadow-sm`}
                >
                  {item.day.toUpperCase()}
                </div>
                <div className="flex-1 h-[3px] bg-luncharoo-dark/15 rounded-full" />
              </div>

              {/* Lunches */}
              {item.lunches.map((dish, idx) => (
                <DishRow
                  key={dish.id}
                  categoryLabel="LUNCH"
                  dish={dish}
                  recipes={recipes.main}
                  onUpdateDish={(d) => updateDish(item.id, 'lunches', idx, d)}
                  onRegenerate={() => handleRegenerate(item, 'lunches', idx)}
                  isRegenerating={!!loadingIds[dish.id]}
                  regenError={errorIds[dish.id]}
                />
              ))}

              {/* Sides */}
              {item.sides.map((dish, idx) => (
                <DishRow
                  key={dish.id}
                  categoryLabel="SIDES"
                  dish={dish}
                  recipes={recipes.side}
                  onUpdateDish={(d) => updateDish(item.id, 'sides', idx, d)}
                  onRegenerate={() => handleRegenerate(item, 'sides', idx)}
                  isRegenerating={!!loadingIds[dish.id]}
                  regenError={errorIds[dish.id]}
                />
              ))}

              {/* Snacks */}
              {item.snacks.map((dish, idx) => (
                <DishRow
                  key={dish.id}
                  categoryLabel="SNACKS"
                  dish={dish}
                  recipes={recipes.snack}
                  onUpdateDish={(d) => updateDish(item.id, 'snacks', idx, d)}
                  onRegenerate={() => handleRegenerate(item, 'snacks', idx)}
                  isRegenerating={!!loadingIds[dish.id]}
                  regenError={errorIds[dish.id]}
                />
              ))}

              {/* Add buttons */}
              <div className="flex gap-2 mt-2 pl-[70px]">
                {(['lunches', 'sides', 'snacks'] as const).map((cat) => {
                  const label = cat === 'lunches' ? '+ Lunch' : cat === 'sides' ? '+ Side' : '+ Snack';
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        const blank: Dish = {
                          id: uuidv4(),
                          name: '',
                          description: '',
                          prepNotes: '',
                          ingredients: [],
                          isPackaged: false,
                        };
                        setDraft((prev) =>
                          prev.map((i) =>
                            i.id === item.id ? { ...i, [cat]: [...i[cat], blank] } : i
                          )
                        );
                      }}
                      className="text-[10px] font-fredoka font-bold text-luncharoo-dark/40 border border-dashed border-luncharoo-dark/20 rounded-lg px-2 py-1 hover:border-luncharoo-blue hover:text-luncharoo-blue transition-colors"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 bg-luncharoo-beige luncharoo-border-t">
        <button
          onClick={handleFinalize}
          disabled={saving}
          className="w-full bg-luncharoo-yellow text-luncharoo-dark font-fredoka font-bold text-sm py-3 rounded-xl luncharoo-border luncharoo-shadow luncharoo-press disabled:opacity-50"
        >
          {saving
            ? '⏳ Saving…'
            : isNewPlan
              ? '✅ Approve Plan'
              : '💾 Save Changes'}
        </button>
      </div>
    </div>
  );
}
