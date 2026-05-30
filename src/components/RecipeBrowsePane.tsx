import { useState, useEffect, useMemo } from 'react';
import type { RecipeMealType, RecipeReaction } from '../types';
import { supabase } from '../lib/supabase';
import { getRecipesForBrowse, upsertRecipeFeedback, type RecipeWithFeedback } from '../lib/recipes';

export default function RecipeBrowsePane() {
  const [recipes, setRecipes] = useState<RecipeWithFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<RecipeMealType | 'all'>('all');
  const [selectedPrepTime, setSelectedPrepTime] = useState<string>('any');
  const [showHidden, setShowHidden] = useState(false);

  // Fetch recipes and user ID on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const session = await supabase.auth.getSession();
        if (!session.data.session?.user?.id) {
          throw new Error('Not authenticated');
        }
        setUserId(session.data.session.user.id);

        const fetchedRecipes = await getRecipesForBrowse(supabase);
        setRecipes(fetchedRecipes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recipes');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter recipes based on search, meal type, prep time, and hidden status
  const filteredRecipes = useMemo(() => {
    return recipes
      .filter((r) => {
        // Hide recipes with dislike reaction unless "Show hidden" is toggled
        if (r.reaction === 'dislike' && !showHidden) return false;
        return true;
      })
      .filter((r) => {
        if (selectedMealType === 'all') return true;
        return r.mealType === selectedMealType;
      })
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
        const query = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesDesc = r.description?.toLowerCase().includes(query) ?? false;
        return matchesName || matchesDesc;
      });
  }, [recipes, showHidden, selectedMealType, selectedPrepTime, searchQuery]);

  const handleToggleFeedback = async (
    recipeId: string,
    currentReaction: RecipeReaction | null,
    newReaction: RecipeReaction
  ) => {
    if (!userId) return;

    try {
      const resultReaction = await upsertRecipeFeedback(
        supabase,
        userId,
        recipeId,
        currentReaction,
        newReaction
      );

      // Optimistically update local state
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipeId ? { ...r, reaction: resultReaction } : r
        )
      );
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
        <p className="text-sm text-luncharoo-dark text-center font-fredoka font-bold">
          ⚠️ {error}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="bg-white luncharoo-border-b px-3 py-3 flex flex-col gap-3">
        {/* Search input */}
        <input
          type="text"
          placeholder="Search recipes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border-2 border-luncharoo-dark/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-luncharoo-blue"
        />

        {/* Meal type chips */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'main', 'snack', 'side'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedMealType(type as RecipeMealType | 'all')}
              className={`font-fredoka font-bold text-xs rounded-lg px-3 py-1 luncharoo-press transition-colors ${
                selectedMealType === type
                  ? 'bg-luncharoo-dark text-white'
                  : 'bg-luncharoo-beige text-luncharoo-dark/70'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Prep time chips */}
        <div className="flex gap-2 flex-wrap">
          {(['any', '≤10', '11–25', '25+'] as const).map((time) => (
            <button
              key={time}
              onClick={() => setSelectedPrepTime(time)}
              className={`font-fredoka font-bold text-xs rounded-lg px-3 py-1 luncharoo-press transition-colors ${
                selectedPrepTime === time
                  ? 'bg-luncharoo-blue text-white'
                  : 'bg-luncharoo-beige text-luncharoo-dark/70'
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
          <p className="text-xs text-slate-400 text-center mt-4">
            No recipes match your filters.
          </p>
        ) : (
          filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className={`bg-white luncharoo-border rounded-2xl luncharoo-shadow-sm p-3 flex flex-col gap-1.5 ${
                recipe.reaction === 'dislike' ? 'opacity-50' : ''
              }`}
            >
              {/* Top row: name + prep time */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-fredoka font-bold text-sm text-luncharoo-dark flex-1">
                  {recipe.name}
                </h3>
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
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {recipe.description}
                </p>
              ) : null}

              {/* Meal type badge + action buttons */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span
                  className={`text-[9px] font-fredoka font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                    recipe.mealType === 'main'
                      ? 'bg-luncharoo-coral/20 text-luncharoo-coral'
                      : recipe.mealType === 'snack'
                        ? 'bg-luncharoo-yellow/30 text-luncharoo-dark'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {recipe.mealType}
                </span>

                <div className="flex gap-1">
                  {/* Favorite button */}
                  <button
                    onClick={() => handleToggleFeedback(recipe.id, recipe.reaction, 'favorite')}
                    className="text-lg luncharoo-press transition-colors"
                    aria-label={
                      recipe.reaction === 'favorite' ? 'Remove favorite' : 'Add favorite'
                    }
                  >
                    {recipe.reaction === 'favorite' ? '♥' : '♡'}
                  </button>

                  {/* Hide button */}
                  <button
                    onClick={() => handleToggleFeedback(recipe.id, recipe.reaction, 'dislike')}
                    className={`text-lg luncharoo-press transition-colors ${
                      recipe.reaction === 'dislike' ? 'text-slate-400' : 'text-slate-300'
                    }`}
                    style={{
                      color: recipe.reaction === 'dislike' ? '#9ca3af' : '#d1d5db',
                    }}
                    aria-label={
                      recipe.reaction === 'dislike' ? 'Show recipe' : 'Hide recipe'
                    }
                  >
                    {recipe.reaction === 'dislike' ? '⊘' : '○'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="bg-white luncharoo-border-t px-4 py-3 flex items-center justify-between">
        {/* Show hidden toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`w-8 h-4 rounded-full border-2 border-luncharoo-dark/30 relative flex-shrink-0 ${
              showHidden ? 'bg-luncharoo-dark' : 'bg-luncharoo-dark/15'
            } luncharoo-press`}
          >
            <span
              className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white border border-luncharoo-dark/20 shadow transition-all ${
                showHidden ? 'left-[calc(100%-0.75rem)]' : 'left-0.5'
              }`}
            />
          </button>
          <span className="text-xs font-fredoka font-semibold text-luncharoo-dark/70">
            {showHidden ? 'Show hidden' : 'Hide hidden'}
          </span>
        </div>

        {/* Recipe count */}
        <span className="text-xs font-fredoka text-slate-400">
          {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
