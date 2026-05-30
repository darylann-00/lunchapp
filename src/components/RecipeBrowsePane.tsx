import { useState, useEffect, useMemo } from 'react';
import type { RecipeMealType, RecipeReaction } from '../types';
import { supabase } from '../lib/supabase';
import { getRecipesForBrowse, upsertRecipeFeedback, type RecipeWithFeedback } from '../lib/recipes';
import { dishSteps } from '../lib/prepSteps';

const MEAL_TYPE_STYLES: Record<RecipeMealType, string> = {
  main: 'bg-luncharoo-coral/20 text-luncharoo-coral',
  snack: 'bg-luncharoo-yellow/30 text-luncharoo-dark',
  side: 'bg-emerald-100 text-emerald-700',
};

// ── Recipe detail modal ────────────────────────────────────────────────────

type DetailModalProps = {
  recipe: RecipeWithFeedback;
  onClose: () => void;
  onToggleFeedback: (recipeId: string, current: RecipeReaction | null, next: RecipeReaction) => void;
};

function RecipeDetailModal({ recipe: r, onClose, onToggleFeedback }: DetailModalProps) {
  const steps = dishSteps(r.name, r.prepNotes);

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-luncharoo-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 bg-white luncharoo-border rounded-3xl w-full max-w-sm luncharoo-shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-luncharoo-blue px-4 pt-4 pb-5 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-fredoka font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${MEAL_TYPE_STYLES[r.mealType]}`}>
                  {r.mealType}
                </span>
                {r.prepTimeMinutes !== null && (
                  <span className="text-[10px] font-fredoka font-bold text-white/80">
                    {r.prepTimeMinutes} min
                  </span>
                )}
              </div>
              <p className="font-fredoka text-white text-base font-bold leading-snug">
                {r.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 flex-shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
        </div>

        {/* Scrollable body */}
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="px-4 pt-4 pb-2 space-y-4">

            {/* Description */}
            {r.description && (
              <p className="text-xs text-luncharoo-dark/70 font-medium leading-relaxed">{r.description}</p>
            )}

            {/* Ingredients */}
            {r.ingredients.length > 0 && (
              <div className="bg-luncharoo-beige/50 border border-luncharoo-dark/15 rounded-xl p-2.5">
                <p className="text-[10px] font-semibold text-luncharoo-dark/60 uppercase tracking-wider mb-1.5">
                  🧺 Ingredients
                </p>
                <ul className="space-y-1">
                  {r.ingredients.map((ing, i) => (
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

            {/* Prep steps */}
            {steps.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-luncharoo-dark/60 uppercase tracking-wider mb-1.5">
                  👩‍🍳 Prep notes
                </p>
                <div className="space-y-1.5">
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-luncharoo-beige/35 border border-luncharoo-dark/10 p-2.5 rounded-xl"
                    >
                      <span className="w-5 h-5 mt-0.5 rounded border-2 border-luncharoo-dark/20 bg-white flex items-center justify-center text-[10px] font-fredoka font-bold text-luncharoo-dark/40 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-luncharoo-dark/95 font-medium leading-relaxed">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source */}
            {r.sourceAttribution && (
              <p className="text-[10px] text-luncharoo-dark/40 font-medium text-center pb-1">
                via{' '}
                {r.sourceUrl ? (
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {r.sourceAttribution}
                  </a>
                ) : (
                  r.sourceAttribution
                )}
              </p>
            )}
          </div>
        </div>

        {/* Footer — feedback actions */}
        <div className="px-4 pb-4 pt-3 flex gap-2">
          <button
            onClick={() => onToggleFeedback(r.id, r.reaction, 'favorite')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm font-fredoka font-bold text-sm luncharoo-press ${
              r.reaction === 'favorite' ? 'bg-luncharoo-coral text-white' : 'bg-white text-luncharoo-dark/70'
            }`}
          >
            {r.reaction === 'favorite' ? '♥' : '♡'} Favorite
          </button>
          <button
            onClick={() => onToggleFeedback(r.id, r.reaction, 'dislike')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm font-fredoka font-bold text-sm luncharoo-press ${
              r.reaction === 'dislike' ? 'bg-slate-200 text-slate-600' : 'bg-white text-luncharoo-dark/70'
            }`}
          >
            {r.reaction === 'dislike' ? '⊘ Unhide' : '○ Hide'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main pane ─────────────────────────────────────────────────────────────

export default function RecipeBrowsePane() {
  const [recipes, setRecipes] = useState<RecipeWithFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<RecipeMealType | 'all'>('all');
  const [selectedPrepTime, setSelectedPrepTime] = useState<string>('any');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithFeedback | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await supabase.auth.getSession();
        if (!session.data.session?.user?.id) throw new Error('Not authenticated');
        setUserId(session.data.session.user.id);
        setRecipes(await getRecipesForBrowse(supabase));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recipes');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredRecipes = useMemo(() => {
    return recipes
      .filter((r) => (r.reaction === 'dislike' && !showHidden ? false : true))
      .filter((r) => selectedMealType === 'all' || r.mealType === selectedMealType)
      .filter((r) => {
        if (selectedPrepTime === 'any') return true;
        if (r.prepTimeMinutes === null) return false;
        if (selectedPrepTime === '≤10') return r.prepTimeMinutes <= 10;
        if (selectedPrepTime === '11–25') return r.prepTimeMinutes >= 11 && r.prepTimeMinutes <= 25;
        if (selectedPrepTime === '25+') return r.prepTimeMinutes > 25;
        return true;
      })
      .filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return r.name.toLowerCase().includes(q) || (r.description?.toLowerCase().includes(q) ?? false);
      });
  }, [recipes, showHidden, selectedMealType, selectedPrepTime, searchQuery]);

  const handleToggleFeedback = async (
    recipeId: string,
    currentReaction: RecipeReaction | null,
    newReaction: RecipeReaction
  ) => {
    if (!userId) return;
    try {
      const result = await upsertRecipeFeedback(supabase, userId, recipeId, currentReaction, newReaction);
      setRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, reaction: result } : r)));
      setSelectedRecipe((prev) => (prev?.id === recipeId ? { ...prev, reaction: result } : prev));
    } catch (err) {
      console.error('Failed to update feedback:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-luncharoo-dark/20 border-t-luncharoo-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <p className="text-sm text-luncharoo-dark text-center font-fredoka font-bold">⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Filter bar */}
      <div className="bg-white luncharoo-border-b px-3 py-3 flex flex-col gap-3 flex-shrink-0">
        <input
          type="text"
          placeholder="Search recipes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border-2 border-luncharoo-dark/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-luncharoo-blue"
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'main', 'snack', 'side'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedMealType(type as RecipeMealType | 'all')}
              className={`font-fredoka font-bold text-xs rounded-lg px-3 py-1 luncharoo-press transition-colors ${
                selectedMealType === type ? 'bg-luncharoo-dark text-white' : 'bg-luncharoo-beige text-luncharoo-dark/70'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['any', '≤10', '11–25', '25+'] as const).map((time) => (
            <button
              key={time}
              onClick={() => setSelectedPrepTime(time)}
              className={`font-fredoka font-bold text-xs rounded-lg px-3 py-1 luncharoo-press transition-colors ${
                selectedPrepTime === time ? 'bg-luncharoo-blue text-white' : 'bg-luncharoo-beige text-luncharoo-dark/70'
              }`}
            >
              {time === 'any' ? 'Any time' : `${time} min`}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pt-3 pb-4 flex flex-col gap-3">
        {filteredRecipes.length === 0 ? (
          <p className="text-xs text-slate-400 text-center mt-4">No recipes match your filters.</p>
        ) : (
          filteredRecipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className={`bg-white luncharoo-border rounded-2xl luncharoo-shadow-sm p-3 flex flex-col gap-1.5 text-left w-full luncharoo-press ${
                recipe.reaction === 'dislike' ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-fredoka font-bold text-sm text-luncharoo-dark flex-1">{recipe.name}</h3>
                {recipe.prepTimeMinutes !== null && (
                  <span className="bg-luncharoo-beige luncharoo-border text-[10px] font-fredoka font-bold text-luncharoo-dark/70 rounded-lg px-2 py-0.5 flex-shrink-0">
                    {recipe.prepTimeMinutes} min
                  </span>
                )}
              </div>

              {recipe.reaction === 'dislike' ? (
                <span className="text-[9px] font-fredoka font-bold uppercase tracking-wider bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5 w-fit">
                  Hidden
                </span>
              ) : recipe.description ? (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{recipe.description}</p>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className={`text-[9px] font-fredoka font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${MEAL_TYPE_STYLES[recipe.mealType]}`}>
                  {recipe.mealType}
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleFeedback(recipe.id, recipe.reaction, 'favorite')}
                    className={`text-lg luncharoo-press transition-colors ${recipe.reaction === 'favorite' ? 'text-luncharoo-coral' : 'text-slate-300'}`}
                    aria-label={recipe.reaction === 'favorite' ? 'Remove favorite' : 'Add favorite'}
                  >
                    {recipe.reaction === 'favorite' ? '♥' : '♡'}
                  </button>
                  <button
                    onClick={() => handleToggleFeedback(recipe.id, recipe.reaction, 'dislike')}
                    className={`text-lg luncharoo-press transition-colors ${recipe.reaction === 'dislike' ? 'text-slate-400' : 'text-slate-300'}`}
                    aria-label={recipe.reaction === 'dislike' ? 'Show recipe' : 'Hide recipe'}
                  >
                    {recipe.reaction === 'dislike' ? '⊘' : '○'}
                  </button>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="bg-white luncharoo-border-t px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`w-8 h-4 rounded-full border-2 border-luncharoo-dark/30 relative flex-shrink-0 luncharoo-press ${
              showHidden ? 'bg-luncharoo-dark' : 'bg-luncharoo-dark/15'
            }`}
          >
            <span
              className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white border border-luncharoo-dark/20 shadow transition-all ${
                showHidden ? 'left-[calc(100%-0.75rem)]' : 'left-0.5'
              }`}
            />
          </button>
          <span className="text-xs font-fredoka font-semibold text-luncharoo-dark/70">Show hidden</span>
        </div>
        <span className="text-xs font-fredoka text-slate-400">
          {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Detail modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onToggleFeedback={handleToggleFeedback}
        />
      )}
    </div>
  );
}
