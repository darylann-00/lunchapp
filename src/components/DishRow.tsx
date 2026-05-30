import type { Dish } from '../types';
import type { RecipeWithTags } from '../lib/recipes';
import { recipeToDish } from '../lib/recipes';
import { RecipePicker } from './RecipePicker';

type Props = {
  categoryLabel: string;
  dish: Dish;
  recipes: RecipeWithTags[];
  onUpdateDish: (dish: Dish) => void;
  onRemove: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  regenError?: string;
};

export function DishRow({
  categoryLabel,
  dish,
  recipes,
  onUpdateDish,
  onRemove,
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
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 py-1">
        {/* Category label */}
        <div className="w-[52px] flex-shrink-0">
          <span className="text-[10px] font-bold uppercase text-luncharoo-coral font-fredoka">
            {categoryLabel}
          </span>
        </div>

        {/* Recipe picker */}
        <div className="flex-1 min-w-0">
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
          className="w-7 h-7 bg-luncharoo-blue text-white rounded-lg luncharoo-border luncharoo-shadow-sm luncharoo-press flex items-center justify-center text-xs disabled:opacity-50 flex-shrink-0"
        >
          {isRegenerating ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            '✨'
          )}
        </button>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="w-7 h-7 text-luncharoo-coral/60 hover:text-luncharoo-coral hover:bg-luncharoo-coral/10 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-colors"
        >
          ×
        </button>

        {/* Prep time */}
        <div className="w-[36px] flex-shrink-0 text-right">
          <span className="text-[10px] text-slate-400 font-fredoka font-bold">
            {dish.prepTimeMinutes ? `${dish.prepTimeMinutes}m` : '—'}
          </span>
        </div>
      </div>

      {regenError && (
        <div className="text-[10px] text-red-600 pl-[52px]">
          {regenError}
        </div>
      )}
    </div>
  );
}
