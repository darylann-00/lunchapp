import type { Dish } from '../types';
import type { RecipeWithTags } from '../lib/recipes';
import { recipeToDish } from '../lib/recipes';
import { RecipePicker } from './RecipePicker';

type Props = {
  categoryLabel: string;
  dish: Dish;
  recipes: RecipeWithTags[];
  onUpdateDish: (dish: Dish) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  regenError?: string;
};

export function DishRow({
  categoryLabel,
  dish,
  recipes,
  onUpdateDish,
  onRegenerate,
  isRegenerating,
  regenError,
}: Props) {
  const handleSelectRecipe = (recipe: RecipeWithTags) => {
    const newDish = recipeToDish(recipe);
    onUpdateDish(newDish);
  };

  const handleCustomName = (customName: string) => {
    onUpdateDish({
      ...dish,
      name: customName,
      prepTimeMinutes: null,
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 py-2">
        {/* Category label */}
        <div className="w-[70px] flex-shrink-0">
          <span className="text-xs font-bold uppercase text-luncharoo-coral font-fredoka">
            {categoryLabel}
          </span>
        </div>

        {/* Recipe picker */}
        <div className="flex-1">
          <RecipePicker
            value={dish.name}
            recipes={recipes}
            onSelectRecipe={handleSelectRecipe}
            onCustomName={handleCustomName}
          />
        </div>

        {/* Regenerate button */}
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="w-9 h-9 bg-luncharoo-blue text-white rounded-xl luncharoo-border luncharoo-shadow-sm luncharoo-press flex items-center justify-center text-sm disabled:opacity-50 flex-shrink-0"
        >
          {isRegenerating ? (
            <div className="w-3 h-3 border-2 border-luncharoo-dark/30 border-t-luncharoo-dark rounded-full animate-spin" />
          ) : (
            '✨'
          )}
        </button>

        {/* Prep time */}
        <div className="w-[50px] flex-shrink-0 text-right">
          <span className="text-xs text-slate-400 font-fredoka font-bold">
            {dish.prepTimeMinutes ? `PREP ${dish.prepTimeMinutes}m` : '—'}
          </span>
        </div>
      </div>

      {/* Error message */}
      {regenError && (
        <div className="text-xs text-red-600 pl-[70px]">
          {regenError}
        </div>
      )}
    </div>
  );
}
