import type { LunchItem } from '../types';
import { dishSteps, isDishPrepped } from '../lib/prepSteps';
import DoneStamp from './DoneStamp';

const DAY_COLORS: Record<string, string> = {
  Monday: 'bg-luncharoo-coral',
  Tuesday: 'bg-luncharoo-peach',
  Wednesday: 'bg-luncharoo-yellow',
  Thursday: 'bg-luncharoo-blue',
  Friday: 'bg-emerald-500',
};

type Props = {
  item: LunchItem;
  prepProgress: Record<string, number[]>;
  onToggleStep: (dishId: string, stepIndex: number) => void;
  onClose: () => void;
};

export default function PrepModal({ item, prepProgress, onToggleStep, onClose }: Props) {
  const dayColor = DAY_COLORS[item.day] ?? 'bg-luncharoo-blue';

  const lunches = item.lunches ?? [];
  const sides = item.sides ?? [];
  const snacks = item.snacks ?? [];
  const allDishes = [...lunches, ...sides, ...snacks];

  const getDishCategory = (dishId: string): 'lunch' | 'side' | 'snack' => {
    if (lunches.some((d) => d.id === dishId)) return 'lunch';
    if (sides.some((d) => d.id === dishId)) return 'side';
    return 'snack';
  };

  const categoryLabel = (category: 'lunch' | 'side' | 'snack'): string => {
    return category === 'lunch' ? 'Main' : category === 'side' ? 'Side' : 'Snack';
  };

  const menuSummary = () => {
    const parts: string[] = [];
    if (lunches.length > 0) {
      parts.push(lunches.map((d) => d.name).join(', '));
    }
    if (sides.length > 0) {
      parts.push(sides.map((d) => d.name).join(', '));
    }
    if (snacks.length > 0) {
      parts.push(snacks.map((d) => d.name).join(', '));
    }
    return parts.join(', ');
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-luncharoo-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 bg-white luncharoo-border rounded-3xl w-full max-w-sm luncharoo-shadow-lg overflow-hidden">
        {/* Header */}
        <div className={`${dayColor} px-4 pt-4 pb-5 relative`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/30 luncharoo-border flex items-center justify-center font-fredoka text-white font-bold text-sm">
                {item.day[0]}
              </div>
              <div>
                <p className="font-fredoka text-white text-xs font-bold opacity-80 uppercase tracking-wider">
                  {item.day}
                </p>
                <p className="font-fredoka text-white text-sm font-bold">Kitchen Prep</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30"
            >
              ✕
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
        </div>

        {/* Scrollable content area */}
        <div className="max-h-[80vh] overflow-y-auto">
          {/* Menu summary box */}
          <div className="bg-luncharoo-beige/50 rounded-xl border border-luncharoo-dark/15 p-3 m-4 mb-2">
            <p className="text-xs font-semibold text-luncharoo-dark mb-1">📦 ON THE MENU TODAY</p>
            <p className="text-xs font-semibold text-luncharoo-dark">{menuSummary()}</p>
          </div>

          {/* Merged checklist */}
          <div className="px-4 pb-2 space-y-4">
            {allDishes.map((dish) => {
              const steps = dishSteps(dish.name, dish.prepNotes);
              const isPrepped = isDishPrepped(dish.id, dish.name, dish.prepNotes, prepProgress);
              const category = getDishCategory(dish.id);

              return (
                <div key={dish.id}>
                  {/* Group header */}
                  <div className="relative flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <p
                        className={`font-fredoka text-sm font-bold text-luncharoo-dark ${
                          isPrepped ? 'line-through opacity-65' : ''
                        }`}
                      >
                        {dish.name}
                      </p>
                      <p className="text-xs text-luncharoo-dark/50 font-medium">{categoryLabel(category)}</p>
                    </div>
                    {isPrepped && <DoneStamp className="w-9 h-9" />}
                  </div>

                  {/* Ingredients */}
                  {dish.ingredients.length > 0 && (
                    <div className="bg-luncharoo-beige/50 border border-luncharoo-dark/15 rounded-xl p-2.5 mb-2">
                      <p className="text-[10px] font-semibold text-luncharoo-dark/60 uppercase tracking-wider mb-1.5">
                        🧺 Ingredients
                      </p>
                      <ul className="space-y-1">
                        {dish.ingredients.map((ing, i) => (
                          <li key={i} className="flex items-baseline gap-2 text-xs text-luncharoo-dark/90">
                            <span className="font-semibold text-luncharoo-dark whitespace-nowrap">
                              {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                            </span>
                            <span className="font-medium">{ing.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Checkbox rows */}
                  <div className="space-y-1.5">
                    {steps.map((step, stepIndex) => {
                      const isChecked = (prepProgress[dish.id] ?? []).includes(stepIndex);
                      return (
                        <label
                          key={stepIndex}
                          className="flex items-start gap-3 bg-luncharoo-beige/35 border border-luncharoo-dark/10 p-2.5 rounded-xl cursor-pointer hover:bg-luncharoo-yellow/5"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggleStep(dish.id, stepIndex)}
                            className="w-5 h-5 mt-0.5 rounded border-2 border-luncharoo-dark accent-luncharoo-coral flex-shrink-0"
                          />
                          <span
                            className={`text-xs text-luncharoo-dark/95 font-medium leading-relaxed select-none ${
                              isChecked ? 'line-through opacity-65' : ''
                            }`}
                          >
                            {step}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={onClose}
            className="w-full bg-luncharoo-yellow text-luncharoo-dark font-fredoka text-sm py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm luncharoo-press font-bold"
          >
            Done Prepping! 🎒
          </button>
        </div>
      </div>
    </div>
  );
}
