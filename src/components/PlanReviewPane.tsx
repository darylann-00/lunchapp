import { useState, useCallback } from 'react';
import type { WeeklyPlan, DayPlan, SlotCategory, ComponentReaction } from '../types';
import { SLOT_ICON, SLOT_LABELS } from '../types';
import FoodIcon from './FoodIcon';
import { getFoodIcon } from '../lib/foodIconMap';
import { getDayDate } from '../lib/dateUtils';
import { useApp } from '../context/AppContext';
import { useKid } from '../hooks/useKid';
import { useParentPrefs } from '../hooks/useParentPrefs';
import { useSlotRegenerate } from '../hooks/useAI';
import { saveAIComponent, upsertComponentFeedback } from '../lib/components';
import { supabase } from '../lib/supabase';

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

type Props = {
  plan: WeeklyPlan;
  onClose: () => void;
};

export default function PlanReviewPane({ plan, onClose }: Props) {
  const { finalizePlan } = useApp();
  const { kid } = useKid();
  const { parentPrefs: prefs } = useParentPrefs();
  const { loadingIds, errorIds, regenerate } = useSlotRegenerate();

  const [draft, setDraft] = useState<Record<string, DayPlan>>(() =>
    JSON.parse(JSON.stringify(plan.items)) as Record<string, DayPlan>
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, ComponentReaction | null>>({});

  const handleFeedback = useCallback(
    async (componentId: string, newReaction: ComponentReaction) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      const current = feedback[componentId] ?? null;
      try {
        const result = await upsertComponentFeedback(
          supabase, user.user.id, componentId, current, newReaction,
        );
        setFeedback((prev) => ({ ...prev, [componentId]: result }));
      } catch (err) {
        console.error('Failed to save feedback:', err);
      }
    },
    [feedback],
  );

  // Collect all component names in the plan for regeneration context
  const getAllComponentNames = useCallback((): string[] => {
    const names: string[] = [];
    Object.values(draft).forEach((dayPlan) => {
      Object.values(dayPlan.lunchbox).forEach((slot) => {
        if (slot?.name && !names.includes(slot.name)) {
          names.push(slot.name);
        }
      });
      dayPlan.snacks.forEach((snack) => {
        if (snack?.name && !names.includes(snack.name)) {
          names.push(snack.name);
        }
      });
    });
    return names;
  }, [draft]);

  const handleRegenerateSlot = useCallback(
    async (day: string, category: SlotCategory, slotKey: string) => {
      if (!kid || !prefs) return;

      const dayPlan = draft[day];
      if (!dayPlan) return;

      const slot = dayPlan.lunchbox[category];
      if (!slot) return;

      const otherComponentNames = getAllComponentNames().filter((n) => n !== slot.name);

      const result = await regenerate(slotKey, {
        kid,
        parentPrefs: prefs,
        sessionNotes: plan.sessionNotes,
        day,
        slotCategory: category,
        currentName: slot.name,
        userNote: '',
        otherComponentNames,
      });

      if (result) {
        // Save the new component to DB
        const { data: user } = await supabase.auth.getUser();
        if (!user.user?.id) throw new Error('Not authenticated');

        const savedComponent = await saveAIComponent(supabase, user.user.id, {
          name: result.name,
          category: result.category,
          ingredients: result.ingredients,
          alsoFills: result.alsoFills,
          canBeSnack: result.canBeSnack,
          note: result.note,
          tags: result.tags,
        });

        // Update the draft with the new component
        setDraft((prev) => ({
          ...prev,
          [day]: {
            ...prev[day],
            lunchbox: {
              ...prev[day].lunchbox,
              [category]: {
                component_id: savedComponent.id,
                name: savedComponent.name,
              },
            },
          },
        }));
      }
    },
    [draft, kid, prefs, plan.sessionNotes, regenerate, getAllComponentNames]
  );

  const handleRegenerateSnack = useCallback(
    async (day: string, snackIndex: number, slotKey: string) => {
      if (!kid || !prefs) return;

      const dayPlan = draft[day];
      if (!dayPlan || !dayPlan.snacks[snackIndex]) return;

      const snack = dayPlan.snacks[snackIndex];
      const otherComponentNames = getAllComponentNames().filter((n) => n !== snack.name);

      const result = await regenerate(slotKey, {
        kid,
        parentPrefs: prefs,
        sessionNotes: plan.sessionNotes,
        day,
        slotCategory: 'snack',
        currentName: snack.name,
        userNote: '',
        otherComponentNames,
      });

      if (result) {
        // Save the new component to DB
        const { data: user } = await supabase.auth.getUser();
        if (!user.user?.id) throw new Error('Not authenticated');

        const savedComponent = await saveAIComponent(supabase, user.user.id, {
          name: result.name,
          category: result.category,
          ingredients: result.ingredients,
          alsoFills: result.alsoFills,
          canBeSnack: result.canBeSnack,
          note: result.note,
          tags: result.tags,
        });

        // Update the draft with the new component
        setDraft((prev) => ({
          ...prev,
          [day]: {
            ...prev[day],
            snacks: prev[day].snacks.map((s, i) =>
              i === snackIndex
                ? {
                    component_id: savedComponent.id,
                    name: savedComponent.name,
                  }
                : s
            ),
          },
        }));
      }
    },
    [draft, kid, prefs, plan.sessionNotes, regenerate, getAllComponentNames]
  );

  const handleFinalize = async () => {
    setSaving(true);
    try {
      await finalizePlan(plan.id, draft);
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
        <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
      </div>

      {/* Scrollable day list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {plan.days.map((day) => {
          const dayColor = DAY_COLORS[day] ?? 'bg-luncharoo-blue';
          const past = isDayPast(plan.weekStartDate, day);
          const dateStr = formatDayDate(plan.weekStartDate, day);
          const dayPlan = draft[day];

          if (!dayPlan) return null;

          const slotCategories = Object.keys(dayPlan.lunchbox) as SlotCategory[];

          return (
            <div key={day} className={`mb-4 ${past ? 'opacity-50' : ''}`}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  className={`${dayColor} text-white font-fredoka font-bold text-[10px] px-2.5 py-1 rounded-lg border-2 border-luncharoo-dark luncharoo-shadow-sm`}
                >
                  {day.slice(0, 3).toUpperCase()}
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
              </div>

              {/* Lunchbox slots */}
              <div className="space-y-1 mb-2 pl-2">
                {slotCategories.map((category) => {
                  const slot = dayPlan.lunchbox[category];
                  if (!slot) return null;

                  const slotKey = `${day}-lunchbox-${category}`;
                  const isLoading = !!loadingIds[slotKey];
                  const error = errorIds[slotKey];

                  return (
                    <div
                      key={slotKey}
                      className="flex items-center gap-2 text-[11px] font-fredoka bg-luncharoo-beige/60 rounded-lg px-2 py-1.5"
                    >
                      <FoodIcon name={getFoodIcon(slot.name) ?? SLOT_ICON[category]} size={18} className="flex-shrink-0" />
                      <span className="font-bold text-luncharoo-dark min-w-[80px]">
                        {SLOT_LABELS[category]}
                      </span>
                      <span className="flex-1 text-luncharoo-dark/80">{slot.name}</span>
                      <button
                        onClick={() => handleFeedback(slot.component_id, 'favorite')}
                        className={`flex-shrink-0 text-sm luncharoo-press ${
                          feedback[slot.component_id] === 'favorite' ? 'text-luncharoo-coral' : 'text-slate-300'
                        }`}
                        aria-label="Favorite"
                      >
                        {feedback[slot.component_id] === 'favorite' ? '♥' : '♡'}
                      </button>
                      <button
                        onClick={() => handleFeedback(slot.component_id, 'dislike')}
                        className={`flex-shrink-0 text-sm luncharoo-press ${
                          feedback[slot.component_id] === 'dislike' ? 'text-slate-500' : 'text-slate-300'
                        }`}
                        aria-label="Hide"
                      >
                        {feedback[slot.component_id] === 'dislike' ? '⊘' : '○'}
                      </button>
                      <button
                        onClick={() => handleRegenerateSlot(day, category, slotKey)}
                        disabled={isLoading}
                        className="flex-shrink-0 px-2 py-1 rounded bg-luncharoo-coral/80 text-white hover:bg-luncharoo-coral disabled:opacity-50 font-bold text-xs"
                      >
                        {isLoading ? '⏳' : '🔄'}
                      </button>
                      {error && (
                        <span className="text-[9px] text-red-600 flex-shrink-0">
                          ⚠️
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Snacks */}
              {dayPlan.snacks.length > 0 && (
                <div className="space-y-1 pl-2">
                  {dayPlan.snacks.map((snack, snackIndex) => {
                    const slotKey = `${day}-snack-${snackIndex}`;
                    const isLoading = !!loadingIds[slotKey];
                    const error = errorIds[slotKey];

                    return (
                      <div
                        key={slotKey}
                        className="flex items-center gap-2 text-[11px] font-fredoka bg-luncharoo-yellow/20 rounded-lg px-2 py-1.5"
                      >
                        <FoodIcon name={getFoodIcon(snack.name) ?? 'apple'} size={18} className="flex-shrink-0" />
                        <span className="font-bold text-luncharoo-dark min-w-[80px]">
                          Snack
                        </span>
                        <span className="flex-1 text-luncharoo-dark/80">{snack.name}</span>
                        <button
                          onClick={() => handleFeedback(snack.component_id, 'favorite')}
                          className={`flex-shrink-0 text-sm luncharoo-press ${
                            feedback[snack.component_id] === 'favorite' ? 'text-luncharoo-coral' : 'text-slate-300'
                          }`}
                          aria-label="Favorite"
                        >
                          {feedback[snack.component_id] === 'favorite' ? '♥' : '♡'}
                        </button>
                        <button
                          onClick={() => handleFeedback(snack.component_id, 'dislike')}
                          className={`flex-shrink-0 text-sm luncharoo-press ${
                            feedback[snack.component_id] === 'dislike' ? 'text-slate-500' : 'text-slate-300'
                          }`}
                          aria-label="Hide"
                        >
                          {feedback[snack.component_id] === 'dislike' ? '⊘' : '○'}
                        </button>
                        <button
                          onClick={() => handleRegenerateSnack(day, snackIndex, slotKey)}
                          disabled={isLoading}
                          className="flex-shrink-0 px-2 py-1 rounded bg-luncharoo-coral/80 text-white hover:bg-luncharoo-coral disabled:opacity-50 font-bold text-xs"
                        >
                          {isLoading ? '⏳' : '🔄'}
                        </button>
                        {error && (
                          <span className="text-[9px] text-red-600 flex-shrink-0">
                            ⚠️
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
