import type { WeeklyPlan, SlotCategory, DayPlan } from '../types';
import { SLOT_EMOJI } from '../types';
import { getTodayDayName, isCurrentWeek } from '../lib/dateUtils';
import { useApp } from '../context/AppContext';

const DAY_THEMES: Record<string, { badge: string; rowToday: string }> = {
  Monday:    { badge: 'bg-luncharoo-coral',   rowToday: 'bg-luncharoo-coral/10 border-l-4 border-l-luncharoo-coral' },
  Tuesday:   { badge: 'bg-luncharoo-peach',   rowToday: 'bg-luncharoo-peach/15 border-l-4 border-l-luncharoo-peach' },
  Wednesday: { badge: 'bg-luncharoo-yellow',  rowToday: 'bg-luncharoo-yellow/15 border-l-4 border-l-luncharoo-yellow' },
  Thursday:  { badge: 'bg-luncharoo-blue',    rowToday: 'bg-luncharoo-blue/10 border-l-4 border-l-luncharoo-blue' },
  Friday:    { badge: 'bg-emerald-500',  rowToday: 'bg-emerald-500/10 border-l-4 border-l-emerald-500' },
};

type Props = {
  plan: WeeklyPlan | null;
  weekStartDate: string;
  onEditPlan: () => void;
  onGenerateClick: () => void;
};

export default function LunchPlanTab({ plan, weekStartDate, onEditPlan, onGenerateClick }: Props) {
  const { parentPrefs } = useApp();
  const today = getTodayDayName();
  const showTodayHighlight = isCurrentWeek(weekStartDate);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <span className="text-5xl">🍱</span>
        <div className="text-center">
          <p className="font-fredoka text-base font-bold text-luncharoo-dark">No plan for this week</p>
          <p className="text-sm text-slate-500 mt-1">Tap the button below to generate one with Luncharoo</p>
        </div>
        <button
          onClick={onGenerateClick}
          className="bg-luncharoo-yellow text-luncharoo-dark font-fredoka font-bold text-sm px-6 py-3 rounded-2xl luncharoo-border luncharoo-shadow luncharoo-press"
        >
          ✨ Generate This Week
        </button>
      </div>
    );
  }

  const isDraft = plan.status === 'draft';

  // Helper to group lunchbox slots by component_id and render them once with combined emojis
  const renderLunchboxSlots = (dayPlan: DayPlan) => {
    if (!parentPrefs || parentPrefs.lunchboxSlots.length === 0) {
      return <span className="text-xs text-slate-300 italic">—</span>;
    }

    // Map component_id -> list of slot categories that contain it
    const componentToSlots = new Map<string, SlotCategory[]>();
    for (const slotCategory of parentPrefs.lunchboxSlots) {
      const slot = dayPlan.lunchbox[slotCategory];
      if (slot) {
        if (!componentToSlots.has(slot.component_id)) {
          componentToSlots.set(slot.component_id, []);
        }
        componentToSlots.get(slot.component_id)!.push(slotCategory);
      }
    }

    if (componentToSlots.size === 0) {
      return <span className="text-xs text-slate-300 italic">—</span>;
    }

    return (
      <div className="space-y-1">
        {Array.from(componentToSlots.entries()).map(([componentId, slotCategories]) => {
          const slot = dayPlan.lunchbox[slotCategories[0]];
          if (!slot) return null;

          // Build emoji + label string from slot categories
          const emojis = slotCategories.map((cat) => SLOT_EMOJI[cat]).join('');

          return (
            <div key={componentId} className="flex items-start gap-2">
              <span className="font-fredoka text-sm font-bold text-luncharoo-dark flex-shrink-0">
                {emojis}
              </span>
              <span className="font-fredoka text-sm font-bold text-luncharoo-dark">
                {slot.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSnacks = (dayPlan: DayPlan) => {
    if (dayPlan.snacks.length === 0) {
      return <span className="text-xs text-slate-300 italic">—</span>;
    }

    return (
      <div className="space-y-1">
        {dayPlan.snacks.map((snack) => (
          <div
            key={snack.component_id}
            className="bg-luncharoo-beige/50 rounded-lg p-2 border border-luncharoo-dark/20"
          >
            <span className="font-fredoka text-sm font-semibold text-luncharoo-dark block">
              🍎 {snack.name}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Draft banner */}
      {isDraft && (
        <div className="bg-luncharoo-yellow/20 luncharoo-border rounded-2xl p-3 flex items-center justify-between">
          <div>
            <p className="font-fredoka text-sm font-bold text-luncharoo-dark">New plan ready!</p>
            <p className="text-xs text-slate-500">Review and approve before it goes live.</p>
          </div>
          <button
            onClick={onEditPlan}
            className="bg-luncharoo-yellow text-luncharoo-dark font-fredoka font-bold text-xs px-4 py-2 rounded-xl luncharoo-border luncharoo-shadow-sm luncharoo-press"
          >
            Review Plan
          </button>
        </div>
      )}

      <div className="bg-white luncharoo-border rounded-3xl luncharoo-shadow overflow-hidden relative">
        {/* Edit pencil (finalized plans) */}
        {!isDraft && (
          <button
            onClick={onEditPlan}
            className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/90 luncharoo-border rounded-xl luncharoo-shadow-sm luncharoo-press flex items-center justify-center text-sm hover:bg-luncharoo-blue/10"
          >
            ✏️
          </button>
        )}
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-luncharoo-blue text-white font-fredoka text-xs tracking-wider border-b-[3px] border-luncharoo-dark select-none">
              <th className="p-2 border-r-[3px] border-luncharoo-dark w-[22%] text-center font-bold">DAY</th>
              <th className="p-2 border-r-[3px] border-luncharoo-dark w-[39%] text-left font-bold">🍱 MAIN LUNCH</th>
              <th className="p-2 w-[39%] text-left font-bold">🍎 SNACKS</th>
            </tr>
          </thead>
          <tbody>
            {plan.days.map((day) => {
              const dayPlan = plan.items[day];
              const theme = DAY_THEMES[day];
              const isToday = showTodayHighlight && day === today;
              const rowClass = isToday ? theme.rowToday : 'hover:bg-slate-50/50';

              return (
                <tr
                  key={day}
                  className={`${rowClass} border-b-[2.5px] border-luncharoo-dark/20 last:border-b-0 transition-colors`}
                >
                  {/* Day badge */}
                  <td className="p-2 border-r-[2.5px] border-luncharoo-dark/20 text-center align-top select-none">
                    <button
                      disabled
                      className={`${theme.badge} text-white font-fredoka font-bold text-xs px-2 py-1 rounded-xl border-2 border-luncharoo-dark block luncharoo-shadow-sm -rotate-2 mx-auto cursor-default`}
                    >
                      {day.slice(0, 3).toUpperCase()}
                    </button>
                  </td>

                  {/* Main lunch cell */}
                  <td className="p-3 border-r-[2.5px] border-luncharoo-dark/20 align-top">
                    {dayPlan ? renderLunchboxSlots(dayPlan) : <span className="text-xs text-slate-300 italic">—</span>}
                  </td>

                  {/* Snacks cell */}
                  <td className="p-3 align-top">
                    {dayPlan ? renderSnacks(dayPlan) : <span className="text-xs text-slate-300 italic">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={onGenerateClick}
        className="w-full bg-luncharoo-yellow text-luncharoo-dark font-fredoka font-bold text-sm py-3 rounded-2xl luncharoo-border luncharoo-shadow luncharoo-press flex items-center justify-center gap-2"
      >
        <span>✨</span><span>Regenerate Week</span>
      </button>
    </div>
  );
}
