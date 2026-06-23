import type { WeeklyPlan } from '../types';
import { getTodayDayName, isCurrentWeek } from '../lib/dateUtils';
import { useApp } from '../context/AppContext';
import FoodIcon from './FoodIcon';
import UiIcon from './UiIcon';
import LunchboxCard from './LunchboxCard';

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
        <FoodIcon name="sandwich" size={48} />
        <div className="text-center">
          <p className="font-fredoka text-base font-bold text-luncharoo-dark">No plan for this week</p>
          <p className="text-sm text-slate-500 mt-1">Tap the button below to generate one with Luncharoo</p>
        </div>
        <button
          onClick={onGenerateClick}
          className="bg-luncharoo-yellow text-luncharoo-dark font-fredoka font-bold text-sm px-6 py-3 rounded-2xl luncharoo-border luncharoo-shadow luncharoo-press"
        >
          <UiIcon name="sparkle" size={16} className="mr-1" /> Generate This Week
        </button>
      </div>
    );
  }

  const isDraft = plan.status === 'draft';
  const activeSlots = parentPrefs?.lunchboxSlots ?? [];

  return (
    <div className="flex flex-col gap-2.5">
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

      {plan.days.map((day) => {
        const dayPlan = plan.items[day];
        if (!dayPlan) return null;

        return (
          <LunchboxCard
            key={day}
            day={day}
            dayPlan={dayPlan}
            weekStartDate={weekStartDate}
            isToday={showTodayHighlight && day === today}
            activeSlots={activeSlots}
          />
        );
      })}

      <button
        onClick={onGenerateClick}
        className="w-full bg-luncharoo-yellow text-luncharoo-dark font-fredoka font-bold text-sm py-3 rounded-2xl luncharoo-border luncharoo-shadow luncharoo-press flex items-center justify-center gap-2"
      >
        <UiIcon name="sparkle" size={16} /><span>Regenerate Week</span>
      </button>
    </div>
  );
}
