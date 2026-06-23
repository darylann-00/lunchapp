import { useState, useCallback } from 'react';
import type { WeeklyPlan, DayPlan, SlotCategory, ComponentReaction } from '../types';
import UiIcon from './UiIcon';
import { useApp } from '../context/AppContext';
import { useKid } from '../hooks/useKid';
import { useParentPrefs } from '../hooks/useParentPrefs';
import { useSlotRegenerate } from '../hooks/useAI';
import { saveAIComponent, upsertComponentFeedback } from '../lib/components';
import { supabase } from '../lib/supabase';
import { getDayDate } from '../lib/dateUtils';
import LunchboxCard from './LunchboxCard';

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

        setDraft((prev) => ({
          ...prev,
          [day]: {
            ...prev[day],
            snacks: prev[day].snacks.map((s, i) =>
              i === snackIndex
                ? { component_id: savedComponent.id, name: savedComponent.name }
                : s
            ),
          },
        }));
      }
    },
    [draft, kid, prefs, plan.sessionNotes, regenerate, getAllComponentNames]
  );

  const handleRenameSlot = useCallback(
    (day: string, category: SlotCategory, newName: string) => {
      setDraft((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          lunchbox: {
            ...prev[day].lunchbox,
            [category]: {
              ...prev[day].lunchbox[category]!,
              name: newName,
            },
          },
        },
      }));
    },
    [],
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
  const activeSlots = prefs?.lunchboxSlots ?? [];

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-luncharoo-blue luncharoo-border-b relative pt-3 pb-5 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isNewPlan ? <UiIcon name="sparkle" size={18} /> : <UiIcon name="edit" size={18} />}</span>
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
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {plan.days.map((day) => {
          const dayPlan = draft[day];
          if (!dayPlan) return null;

          const past = isDayPast(plan.weekStartDate, day);

          return (
            <LunchboxCard
              key={day}
              day={day}
              dayPlan={dayPlan}
              weekStartDate={plan.weekStartDate}
              isPast={past}
              editable
              activeSlots={activeSlots}
              feedback={feedback}
              loadingIds={loadingIds}
              errorIds={errorIds}
              onFeedback={handleFeedback}
              onRegenerateSlot={handleRegenerateSlot}
              onRegenerateSnack={handleRegenerateSnack}
              onRenameSlot={handleRenameSlot}
            />
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
