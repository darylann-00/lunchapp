import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Kid, ParentPrefs, WeeklyPlan, LunchItem, Dish } from '../types';
import type { RecipeWithTags } from '../lib/recipes';
import { getRecipesForPicker } from '../lib/recipes';
import { getDayDate } from '../lib/dateUtils';
import { DishRow } from './DishRow';
import { useItemRegenerate } from '../hooks/useAI';

const DAY_COLORS: Record<string, string> = {
  Monday: 'bg-luncharoo-coral',
  Tuesday: 'bg-luncharoo-peach',
  Wednesday: 'bg-luncharoo-yellow',
  Thursday: 'bg-luncharoo-blue',
  Friday: 'bg-emerald-500',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayDate(mondayISO: string, dayName: string): string {
  const iso = getDayDate(mondayISO, dayName);
  const d = new Date(iso + 'T12:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function isDayPast(mondayISO: string, dayName: string): boolean {
  const iso = getDayDate(mondayISO, dayName);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + 'T12:00:00') < today;
}

function totalPrepMinutes(item: LunchItem): number {
  const all = [...item.lunches, ...item.sides, ...item.snacks];
  return all.reduce((sum, d) => sum + (d.prepTimeMinutes ?? 0), 0);
}

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
  const [swapSource, setSwapSource] = useState<string | null>(null);
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

  const removeDish = useCallback(
    (itemId: string, category: 'lunches' | 'sides' | 'snacks', dishIndex: number) => {
      setDraft((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, [category]: item[category].filter((_, i) => i !== dishIndex) };
        })
      );
    },
    []
  );

  const swapDays = useCallback((dayA: string, dayB: string) => {
    setDraft((prev) => {
      const itemA = prev.find((i) => i.day === dayA);
      const itemB = prev.find((i) => i.day === dayB);
      if (!itemA || !itemB) return prev;
      return prev.map((item) => {
        if (item.id === itemA.id) return { ...item, day: dayB, lunches: itemB.lunches, sides: itemB.sides, snacks: itemB.snacks };
        if (item.id === itemB.id) return { ...item, day: dayA, lunches: itemA.lunches, sides: itemA.sides, snacks: itemA.snacks };
        return item;
      });
    });
  }, []);

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

  const handleSwapClick = (day: string) => {
    if (!swapSource) {
      setSwapSource(day);
    } else if (swapSource === day) {
      setSwapSource(null);
    } else {
      swapDays(swapSource, day);
      setSwapSource(null);
    }
  };

  const isNewPlan = plan.status === 'draft';

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-luncharoo-blue luncharoo-border-b relative pt-3 pb-5 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isNewPlan ? '✨' : '✏️'}</span>
            <h2 className="font-fredoka text-sm text-white font-bold drop-shadow-[1px_1px_0px_#134e9e]">
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
        {swapSource && (
          <p className="text-[10px] text-white/80 font-fredoka mt-1">
            Tap another day to swap with {swapSource}
          </p>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
      </div>

      {/* Scrollable day list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {draft.map((item) => {
          const dayColor = DAY_COLORS[item.day] ?? 'bg-luncharoo-blue';
          const past = isDayPast(plan.weekStartDate, item.day);
          const dateStr = formatDayDate(plan.weekStartDate, item.day);
          const totalPrep = totalPrepMinutes(item);
          const isSwapSelected = swapSource === item.day;

          return (
            <div key={item.id} className={`mb-4 ${past ? 'opacity-50' : ''}`}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-1.5">
                <button
                  onClick={() => handleSwapClick(item.day)}
                  title="Tap to swap with another day"
                  className={`${dayColor} text-white font-fredoka font-bold text-[10px] px-2.5 py-1 rounded-lg border-2 luncharoo-press transition-all ${
                    isSwapSelected
                      ? 'border-white ring-2 ring-luncharoo-dark scale-110'
                      : 'border-luncharoo-dark luncharoo-shadow-sm'
                  }`}
                >
                  {item.day.slice(0, 3).toUpperCase()}
                </button>
                <span className="text-[10px] text-slate-400 font-fredoka font-bold">
                  {dateStr}
                </span>
                {past && (
                  <span className="text-[9px] bg-slate-200 text-slate-500 font-fredoka font-bold px-1.5 py-0.5 rounded">
                    PAST
                  </span>
                )}
                <div className="flex-1 h-[2px] bg-luncharoo-dark/10 rounded-full" />
                {totalPrep > 0 && (
                  <span className="text-[10px] text-slate-400 font-fredoka font-bold flex-shrink-0">
                    ⏱ {totalPrep}m
                  </span>
                )}
                <button
                  onClick={() => handleSwapClick(item.day)}
                  title="Swap day"
                  className={`text-[10px] font-fredoka font-bold px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                    isSwapSelected
                      ? 'bg-luncharoo-blue text-white'
                      : 'text-luncharoo-dark/30 hover:text-luncharoo-blue'
                  }`}
                >
                  ⇄
                </button>
              </div>

              {/* Lunches */}
              {item.lunches.map((dish, idx) => (
                <DishRow
                  key={dish.id}
                  categoryLabel="LUNCH"
                  dish={dish}
                  recipes={recipes.main}
                  onUpdateDish={(d) => updateDish(item.id, 'lunches', idx, d)}
                  onRemove={() => removeDish(item.id, 'lunches', idx)}
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
                  onRemove={() => removeDish(item.id, 'sides', idx)}
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
                  onRemove={() => removeDish(item.id, 'snacks', idx)}
                  onRegenerate={() => handleRegenerate(item, 'snacks', idx)}
                  isRegenerating={!!loadingIds[dish.id]}
                  regenError={errorIds[dish.id]}
                />
              ))}

              {/* Add buttons */}
              <div className="flex gap-1.5 mt-1 pl-[52px]">
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
                      className="text-[9px] font-fredoka font-bold text-luncharoo-dark/30 border border-dashed border-luncharoo-dark/15 rounded-md px-1.5 py-0.5 hover:border-luncharoo-blue hover:text-luncharoo-blue transition-colors"
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
