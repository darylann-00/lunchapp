import { useState, useEffect, useMemo } from 'react';
import type { SlotCategory, ComponentReaction } from '../types';
import { SLOT_LABELS, SLOT_ICON } from '../types';
import FoodIcon from './FoodIcon';
import UiIcon from './UiIcon';
import { supabase } from '../lib/supabase';
import { getComponentsForBrowse, upsertComponentFeedback, type ComponentWithFeedback } from '../lib/components';

const CATEGORY_COLORS: Record<SlotCategory, string> = {
  protein: 'bg-luncharoo-coral/20 text-luncharoo-coral',
  carb: 'bg-luncharoo-yellow/20 text-luncharoo-dark',
  fruit: 'bg-emerald-100 text-emerald-700',
  veggie: 'bg-luncharoo-blue/20 text-luncharoo-blue',
  fun: 'bg-purple-100 text-purple-700',
};

// ── Component detail modal ────────────────────────────────────────────────────

type DetailModalProps = {
  component: ComponentWithFeedback;
  onClose: () => void;
  onToggleFeedback: (componentId: string, current: ComponentReaction | null, next: ComponentReaction) => void;
};

function ComponentDetailModal({ component: c, onClose, onToggleFeedback }: DetailModalProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-luncharoo-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 bg-white luncharoo-border rounded-3xl w-full max-w-sm luncharoo-shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-luncharoo-blue px-4 pt-4 pb-5 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-fredoka font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 flex items-center gap-1 ${CATEGORY_COLORS[c.category]}`}>
                  <FoodIcon name={SLOT_ICON[c.category]} size={12} /> {SLOT_LABELS[c.category]}
                </span>
                {c.canBeSnack && (
                  <span className="text-[10px] font-fredoka font-bold text-white/80 flex items-center gap-1">
                    <FoodIcon name="cookie" size={12} /> Snack
                  </span>
                )}
              </div>
              <p className="font-fredoka text-white text-base font-bold leading-snug">
                {c.name}
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

            {/* Note */}
            {c.note && (
              <p className="text-xs text-luncharoo-dark/70 font-medium leading-relaxed">{c.note}</p>
            )}

            {/* Tags */}
            {(c.tags.prep?.length || c.tags.dietary?.length || c.tags.format?.length) && (
              <div className="flex flex-wrap gap-1.5">
                {c.tags.prep?.map((tag) => (
                  <span key={tag} className="text-[10px] font-fredoka font-bold uppercase bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
                {c.tags.dietary?.map((tag) => (
                  <span key={tag} className="text-[10px] font-fredoka font-bold uppercase bg-green-100 text-green-700 px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
                {c.tags.format?.map((tag) => (
                  <span key={tag} className="text-[10px] font-fredoka font-bold uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ingredients */}
            {c.ingredients.length > 0 && (
              <div className="bg-luncharoo-beige/50 border border-luncharoo-dark/15 rounded-xl p-2.5">
                <p className="text-[10px] font-semibold text-luncharoo-dark/60 uppercase tracking-wider mb-1.5">
                  <UiIcon name="basket" size={12} className="mr-1" /> Ingredients
                </p>
                <ul className="space-y-1">
                  {c.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-xs text-luncharoo-dark/90">
                      <span className="font-semibold text-luncharoo-dark whitespace-nowrap">
                        {[ing.qty, ing.unit].filter(Boolean).join(' ')}
                      </span>
                      <span className="font-medium">{ing.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Also fills */}
            {c.alsoFills && c.alsoFills.length > 0 && (
              <div className="bg-luncharoo-beige/50 border border-luncharoo-dark/15 rounded-xl p-2.5">
                <p className="text-[10px] font-semibold text-luncharoo-dark/60 uppercase tracking-wider mb-1.5">
                  <UiIcon name="layers" size={12} className="mr-1" /> Also fills
                </p>
                <div className="flex flex-wrap gap-2">
                  {c.alsoFills.map((cat) => (
                    <span key={cat} className={`text-[10px] font-fredoka font-bold rounded-lg px-2 py-1 flex items-center gap-1 ${CATEGORY_COLORS[cat]}`}>
                      <FoodIcon name={SLOT_ICON[cat]} size={12} /> {SLOT_LABELS[cat]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source */}
            {c.source && (
              <p className="text-[10px] text-luncharoo-dark/40 font-medium text-center pb-1">
                Source: <span className="capitalize">{c.source}</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer — feedback buttons */}
        <div className="px-4 pb-4 pt-3 flex gap-2">
          <button
            onClick={() => onToggleFeedback(c.id, c.reaction, 'favorite')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm font-fredoka font-bold text-sm luncharoo-press ${
              c.reaction === 'favorite' ? 'bg-luncharoo-coral text-white' : 'bg-white text-luncharoo-dark/70'
            }`}
          >
            <UiIcon name={c.reaction === 'favorite' ? 'heart' : 'heart-o'} size={16} /> Favorite
          </button>
          <button
            onClick={() => onToggleFeedback(c.id, c.reaction, 'dislike')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm font-fredoka font-bold text-sm luncharoo-press ${
              c.reaction === 'dislike' ? 'bg-slate-200 text-slate-600' : 'bg-white text-luncharoo-dark/70'
            }`}
          >
            <UiIcon name={c.reaction === 'dislike' ? 'yuk' : 'yuk-o'} size={16} /> {c.reaction === 'dislike' ? 'Unhide' : 'Hide'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main pane ─────────────────────────────────────────────────────────────

export default function ComponentBrowser() {
  const [components, setComponents] = useState<ComponentWithFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SlotCategory | 'all'>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentWithFeedback | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await supabase.auth.getSession();
        if (!session.data.session?.user?.id) throw new Error('Not authenticated');
        setUserId(session.data.session.user.id);
        setComponents(await getComponentsForBrowse(supabase));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load components');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredComponents = useMemo(() => {
    return components
      .filter((c) => (c.reaction === 'dislike' && !showHidden ? false : true))
      .filter((c) => selectedCategory === 'all' || c.category === selectedCategory)
      .filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.note?.toLowerCase().includes(q) ?? false);
      });
  }, [components, showHidden, selectedCategory, searchQuery]);

  const handleToggleFeedback = async (
    componentId: string,
    currentReaction: ComponentReaction | null,
    newReaction: ComponentReaction
  ) => {
    if (!userId) return;
    try {
      const result = await upsertComponentFeedback(supabase, userId, componentId, currentReaction, newReaction);
      setComponents((prev) => prev.map((c) => (c.id === componentId ? { ...c, reaction: result } : c)));
      setSelectedComponent((prev) => (prev?.id === componentId ? { ...prev, reaction: result } : prev));
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
        <p className="text-sm text-luncharoo-dark text-center font-fredoka font-bold"><UiIcon name="warning" size={16} className="mr-1" /> {error}</p>
      </div>
    );
  }

  const categories: (SlotCategory | 'all')[] = ['all', 'protein', 'carb', 'fruit', 'veggie', 'fun'];

  return (
    <div className="h-full flex flex-col relative">
      {/* Filter bar */}
      <div className="bg-white luncharoo-border-b px-3 py-3 flex flex-col gap-3 flex-shrink-0">
        <input
          type="text"
          placeholder="Search components…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border-2 border-luncharoo-dark/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-luncharoo-blue"
        />
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as SlotCategory | 'all')}
              className={`font-fredoka font-bold text-xs rounded-lg px-3 py-1 luncharoo-press transition-colors ${
                selectedCategory === cat ? 'bg-luncharoo-dark text-white' : 'bg-luncharoo-beige text-luncharoo-dark/70'
              }`}
            >
              {cat === 'all' ? 'All' : <><FoodIcon name={SLOT_ICON[cat as SlotCategory]} size={14} /> {SLOT_LABELS[cat as SlotCategory]}</>}
            </button>
          ))}
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pt-3 pb-4 flex flex-col gap-3">
        {filteredComponents.length === 0 ? (
          <p className="text-xs text-slate-400 text-center mt-4">No components match your filters.</p>
        ) : (
          filteredComponents.map((component) => (
            <button
              key={component.id}
              onClick={() => setSelectedComponent(component)}
              className={`bg-white luncharoo-border rounded-2xl luncharoo-shadow-sm p-3 flex flex-col gap-1.5 text-left w-full luncharoo-press ${
                component.reaction === 'dislike' ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-fredoka font-bold text-sm text-luncharoo-dark flex-1">{component.name}</h3>
                {component.canBeSnack && (
                  <span className="bg-luncharoo-beige luncharoo-border text-[10px] font-fredoka font-bold text-luncharoo-dark/70 rounded-lg px-2 py-0.5 flex-shrink-0 flex items-center gap-1">
                    <FoodIcon name="cookie" size={12} /> Snack
                  </span>
                )}
              </div>

              {component.reaction === 'dislike' ? (
                <span className="text-[9px] font-fredoka font-bold uppercase tracking-wider bg-slate-200 text-slate-600 rounded-md px-1.5 py-0.5 w-fit">
                  Hidden
                </span>
              ) : component.note ? (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{component.note}</p>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className={`text-[9px] font-fredoka font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 flex items-center gap-1 ${CATEGORY_COLORS[component.category]}`}>
                  <FoodIcon name={SLOT_ICON[component.category]} size={12} /> {SLOT_LABELS[component.category]}
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleFeedback(component.id, component.reaction, 'favorite')}
                    className={`text-lg luncharoo-press transition-colors ${component.reaction === 'favorite' ? 'text-luncharoo-coral' : 'text-slate-300'}`}
                    aria-label={component.reaction === 'favorite' ? 'Remove favorite' : 'Add favorite'}
                  >
                    <UiIcon name={component.reaction === 'favorite' ? 'heart' : 'heart-o'} size={18} />
                  </button>
                  <button
                    onClick={() => handleToggleFeedback(component.id, component.reaction, 'dislike')}
                    className={`text-lg luncharoo-press transition-colors ${component.reaction === 'dislike' ? 'text-slate-400' : 'text-slate-300'}`}
                    aria-label={component.reaction === 'dislike' ? 'Show component' : 'Hide component'}
                  >
                    <UiIcon name={component.reaction === 'dislike' ? 'yuk' : 'yuk-o'} size={18} />
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
          {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Detail modal */}
      {selectedComponent && (
        <ComponentDetailModal
          component={selectedComponent}
          onClose={() => setSelectedComponent(null)}
          onToggleFeedback={handleToggleFeedback}
        />
      )}
    </div>
  );
}
