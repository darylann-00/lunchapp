import { useState, useEffect, useMemo } from 'react';
import type { RecipeMealType, RecipeReaction } from '../types';
import { supabase } from '../lib/supabase';
import { getRecipesForBrowse, upsertRecipeFeedback, type RecipeWithFeedback } from '../lib/recipes';

const MEAL_TYPE_STYLES: Record<RecipeMealType, string> = {
  main: 'bg-luncharoo-coral/20 text-luncharoo-coral',
  snack: 'bg-luncharoo-yellow/30 text-luncharoo-dark',
  side: 'bg-emerald-100 text-emerald-700',
};

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
      // Keep detail view in sync
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

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selectedRecipe) {
    const r = selectedRecipe;
    const prepLines = r.prepNotes
      ? r.prepNotes.split(/\n/).map((l) => l.trim()).filter(Boolean)
      : [];

    return (
      <div className="h-full flex flex-col">
        {/* Detail header */}
        <div className="bg-white luncharoo-border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSelectedRecipe(null)}
            className="flex items-center gap-1.5 text-luncharoo-dark/60 font-fredoka font-bold text-sm luncharoo-press hover:text-luncharoo-dark"
          >
            ‹ Back
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-fredoka font-bold text-sm text-luncharoo-dark truncate">{r.name}</p>
          </div>
        </div>

        {/* Detail body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-4 pb-4 flex flex-col gap-4">
          {/* Title + badges */}
          <div className="flex flex-col gap-2">
            <h2 className="font-fredoka font-bold text-xl text-luncharoo-dark leading-tight">{r.name}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-fredoka font-bold uppercase tracking-wider rounded-md px-2 py-0.5 ${MEAL_TYPE_STYLES[r.mealType]}`}>
                {r.mealType}
              </span>
              {r.prepTimeMinutes !== null && (
                <span className="bg-luncharoo-beige luncharoo-border text-[10px] font-fredoka font-bold text-luncharoo-dark/70 rounded-lg px-2 py-0.5">
                  {r.prepTimeMinutes} min
                </span>
              )}
              {r.reaction === 'favorite' && (
                <span className="text-[10px] font-fredoka font-bold text-luncharoo-coral">♥ Favorited</span>
              )}
              {r.reaction === 'dislike' && (
                <span className="text-[9px] font-fredoka font-bold uppercase tracking-wider bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5">
                  Hidden
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {r.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{r.description}</p>
          )}

          {/* Ingredients */}
          {r.ingredients.length > 0 && (
            <div className="bg-white luncharoo-border rounded-2xl luncharoo-shadow-sm overflow-hidden">
              <div className="bg-luncharoo-beige px-4 py-2.5 luncharoo-border-b">
                <h3 className="font-fredoka font-bold text-sm text-luncharoo-dark">Ingredients</h3>
              </div>
              <ul className="px-4 py-3 flex flex-col gap-2">
                {r.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="font-fredoka font-bold text-luncharoo-dark min-w-[3rem] text-right flex-shrink-0">
                      {ing.quantity}{ing.unit ? ` ${ing.unit}` : ''}
                    </span>
                    <span className="text-slate-600">{ing.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prep notes */}
          {prepLines.length > 0 && (
            <div className="bg-white luncharoo-border rounded-2xl luncharoo-shadow-sm overflow-hidden">
              <div className="bg-luncharoo-beige px-4 py-2.5 luncharoo-border-b">
                <h3 className="font-fredoka font-bold text-sm text-luncharoo-dark">Prep notes</h3>
              </div>
              <ol className="px-4 py-3 flex flex-col gap-2.5 list-decimal list-inside">
                {prepLines.map((line, i) => (
                  <li key={i} className="text-sm text-slate-600 leading-snug">{line}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Source attribution */}
          {r.sourceAttribution && (
            <p className="text-[10px] text-slate-400 font-fredoka text-center">
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

        {/* Detail footer — feedback actions */}
        <div className="bg-white luncharoo-border-t px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => handleToggleFeedback(r.id, r.reaction, 'favorite')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm font-fredoka font-bold text-sm luncharoo-press ${
              r.reaction === 'favorite'
                ? 'bg-luncharoo-coral text-white'
                : 'bg-white text-luncharoo-dark/70'
            }`}
          >
            {r.reaction === 'favorite' ? '♥' : '♡'} Favorite
          </button>
          <button
            onClick={() => handleToggleFeedback(r.id, r.reaction, 'dislike')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm font-fredoka font-bold text-sm luncharoo-press ${
              r.reaction === 'dislike'
                ? 'bg-slate-200 text-slate-600'
                : 'bg-white text-luncharoo-dark/70'
            }`}
          >
            {r.reaction === 'dislike' ? '⊘' : '○'} Hide
          </button>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
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
              {/* Top row: name + prep time */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-fredoka font-bold text-sm text-luncharoo-dark flex-1">{recipe.name}</h3>
                {recipe.prepTimeMinutes !== null && (
                  <span className="bg-luncharoo-beige luncharoo-border text-[10px] font-fredoka font-bold text-luncharoo-dark/70 rounded-lg px-2 py-0.5 flex-shrink-0">
                    {recipe.prepTimeMinutes} min
                  </span>
                )}
              </div>

              {/* Description or hidden badge */}
              {recipe.reaction === 'dislike' ? (
                <span className="text-[9px] font-fredoka font-bold uppercase tracking-wider bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5 w-fit">
                  Hidden
                </span>
              ) : recipe.description ? (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{recipe.description}</p>
              ) : null}

              {/* Meal type badge + action buttons */}
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
    </div>
  );
}
