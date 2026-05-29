import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Kid, ParentPrefs, LunchItem, Dish } from '../types';
import { useItemRegenerate } from '../hooks/useAI';

const DAY_COLORS: Record<string, string> = {
  Monday: 'bg-luncharoo-coral',
  Tuesday: 'bg-luncharoo-peach',
  Wednesday: 'bg-luncharoo-yellow',
  Thursday: 'bg-luncharoo-blue',
  Friday: 'bg-emerald-500',
};

type Props = {
  item: LunchItem;
  kid: Kid;
  prefs: ParentPrefs;
  sessionNotes: string;
  otherDishes: Dish[];
  onSave: (updated: LunchItem) => void;
  onClose: () => void;
};

export default function EditDayModal({ item, kid, prefs, sessionNotes, otherDishes, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<LunchItem>(() => JSON.parse(JSON.stringify(item)));
  const [activeType, setActiveType] = useState<'lunches' | 'sides' | 'snacks'>('lunches');
  const [regenPrompts, setRegenPrompts] = useState<Record<string, string>>({});
  const { loadingIds, errorIds, regenerate } = useItemRegenerate([]);

  const dishes = draft[activeType];

  const updateDish = (idx: number, field: keyof Dish, value: string | boolean) => {
    setDraft((prev) => {
      const updated = [...prev[activeType]];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, [activeType]: updated };
    });
  };

  const removeDish = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      [activeType]: prev[activeType].filter((_, i) => i !== idx),
    }));
  };

  const addDish = () => {
    const blank: Dish = {
      id: uuidv4(),
      name: '',
      description: '',
      prepNotes: '',
      ingredients: [],
      isPackaged: false,
    };
    setDraft((prev) => ({ ...prev, [activeType]: [...prev[activeType], blank] }));
  };

  const handleRegenerate = async (dish: Dish, idx: number) => {
    const userNote = regenPrompts[dish.id] ?? '';
    const result = await regenerate(dish.id, {
      kid,
      parentPrefs: prefs,
      sessionNotes,
      day: item.day,
      mealType: activeType === 'lunches' ? 'lunch' : activeType === 'sides' ? 'side' : 'snack',
      currentDish: dish,
      userNote,
      otherDishesThisWeek: otherDishes,
    });
    if (result) {
      setDraft((prev) => {
        const updated = [...prev[activeType]];
        updated[idx] = result;
        return { ...prev, [activeType]: updated };
      });
    }
  };

  const dayColor = DAY_COLORS[item.day] ?? 'bg-luncharoo-blue';

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
                <p className="font-fredoka text-white text-xs font-bold opacity-80 uppercase tracking-wider">{item.day}</p>
                <p className="font-fredoka text-white text-sm font-bold">Edit Meals</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30">
              ✕
            </button>
          </div>
          {/* Tab selector */}
          <div className="flex gap-2 mt-3">
            {(['lunches', 'sides', 'snacks'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`flex-1 font-fredoka text-xs font-bold py-1.5 rounded-xl border-2 border-white/50 luncharoo-press transition-colors ${
                  activeType === t ? 'bg-white text-luncharoo-dark' : 'bg-white/20 text-white'
                }`}
              >
                {t === 'lunches' ? '🍱 Lunch' : t === 'sides' ? '🥕 Sides' : '🍎 Snacks'} ({draft[t].length})
              </button>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
        </div>

        {/* Dish list */}
        <div className="px-4 pt-4 pb-2 max-h-72 overflow-y-auto space-y-3">
          {dishes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No {activeType} — tap + to add one</p>
          ) : (
            dishes.map((dish, idx) => (
              <div key={dish.id} className="bg-luncharoo-beige/50 rounded-xl border border-luncharoo-dark/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={dish.name}
                    onChange={(e) => updateDish(idx, 'name', e.target.value)}
                    placeholder="Dish name"
                    className="flex-1 luncharoo-border rounded-xl px-2.5 py-1.5 text-sm font-fredoka text-luncharoo-dark focus:outline-none bg-white"
                  />
                  <button
                    onClick={() => removeDish(idx)}
                    className="w-6 h-6 flex items-center justify-center text-luncharoo-coral hover:bg-luncharoo-coral/10 rounded-lg text-sm"
                  >
                    ×
                  </button>
                </div>
                {/* AI tweak row */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={regenPrompts[dish.id] ?? ''}
                    onChange={(e) => setRegenPrompts((p) => ({ ...p, [dish.id]: e.target.value }))}
                    placeholder="AI tweak, e.g. make it nut-free"
                    className="flex-1 bg-white luncharoo-border rounded-lg px-2 py-1 text-xs focus:outline-none text-luncharoo-dark"
                  />
                  <button
                    onClick={() => handleRegenerate(dish, idx)}
                    disabled={!!loadingIds[dish.id]}
                    className="bg-luncharoo-blue text-white font-fredoka text-xs px-2 py-1 rounded-lg luncharoo-border luncharoo-shadow-sm luncharoo-press disabled:opacity-50 font-bold"
                  >
                    {loadingIds[dish.id] ? '...' : '✨'}
                  </button>
                </div>
                {errorIds[dish.id] && (
                  <p className="text-xs text-red-500">{errorIds[dish.id]}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add button */}
        <div className="px-4 pb-2">
          <button
            onClick={addDish}
            className="w-full border-2 border-dashed border-luncharoo-dark/30 rounded-xl py-2 text-xs font-fredoka text-luncharoo-dark/50 hover:border-luncharoo-blue hover:text-luncharoo-blue transition-colors"
          >
            + Add {activeType === 'lunches' ? 'lunch' : activeType === 'sides' ? 'side' : 'snack'}
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border-2 border-luncharoo-dark/30 text-slate-500 font-fredoka text-sm py-2.5 rounded-xl luncharoo-press"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(draft); onClose(); }}
            className="flex-[1.5] bg-luncharoo-yellow text-luncharoo-dark font-fredoka text-sm py-2.5 rounded-xl luncharoo-border luncharoo-shadow-sm luncharoo-press font-bold"
          >
            Save Changes 🍱
          </button>
        </div>
      </div>
    </div>
  );
}
