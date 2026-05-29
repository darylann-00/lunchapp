import type { WeeklyPlan, LunchItem } from '../types';
import { getTodayDayName, isCurrentWeek } from '../lib/dateUtils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

const DAY_THEMES: Record<string, { badge: string; rowToday: string }> = {
  Monday:    { badge: 'bg-moku-coral',   rowToday: 'bg-moku-coral/10 border-l-4 border-l-moku-coral' },
  Tuesday:   { badge: 'bg-moku-peach',   rowToday: 'bg-moku-peach/15 border-l-4 border-l-moku-peach' },
  Wednesday: { badge: 'bg-moku-yellow',  rowToday: 'bg-moku-yellow/15 border-l-4 border-l-moku-yellow' },
  Thursday:  { badge: 'bg-moku-blue',    rowToday: 'bg-moku-blue/10 border-l-4 border-l-moku-blue' },
  Friday:    { badge: 'bg-emerald-500',  rowToday: 'bg-emerald-500/10 border-l-4 border-l-emerald-500' },
};

type Props = {
  plan: WeeklyPlan | null;
  weekStartDate: string;
  onEditDay: (item: LunchItem) => void;
  onGenerateClick: () => void;
};

export default function LunchPlanTab({ plan, weekStartDate, onEditDay, onGenerateClick }: Props) {
  const today = getTodayDayName();
  const showTodayHighlight = isCurrentWeek(weekStartDate);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <span className="text-5xl">🍱</span>
        <div className="text-center">
          <p className="font-fredoka text-base font-bold text-moku-dark">No plan for this week</p>
          <p className="text-sm text-slate-500 mt-1">Tap the button below to generate one with BentoBot!</p>
        </div>
        <button
          onClick={onGenerateClick}
          className="bg-moku-yellow text-moku-dark font-fredoka font-bold text-sm px-6 py-3 rounded-2xl moku-border moku-shadow moku-press"
        >
          ✨ Generate This Week
        </button>
      </div>
    );
  }

  const getItem = (day: string): LunchItem | undefined =>
    plan.items.find((i) => i.day === day);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white moku-border rounded-3xl moku-shadow overflow-hidden">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-moku-blue text-white font-fredoka text-xs tracking-wider border-b-[3px] border-moku-dark select-none">
              <th className="p-2 border-r-[3px] border-moku-dark w-[22%] text-center font-bold">DAY</th>
              <th className="p-2 border-r-[3px] border-moku-dark w-[39%] text-left font-bold">🍱 LUNCH</th>
              <th className="p-2 w-[39%] text-left font-bold">🍎 SNACKS</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => {
              const item = getItem(day);
              const theme = DAY_THEMES[day];
              const isToday = showTodayHighlight && day === today;
              const rowClass = isToday ? theme.rowToday : 'hover:bg-slate-50/50';

              return (
                <tr
                  key={day}
                  className={`${rowClass} border-b-[2.5px] border-moku-dark/20 last:border-b-0 transition-colors`}
                >
                  {/* Day badge */}
                  <td className="p-2 border-r-[2.5px] border-moku-dark/20 text-center align-middle select-none">
                    <span
                      className={`${theme.badge} text-white font-fredoka font-bold text-xs px-2 py-1 rounded-xl border-2 border-moku-dark block moku-shadow-sm -rotate-2`}
                    >
                      {day.slice(0, 3).toUpperCase()}
                    </span>
                  </td>

                  {/* Lunch cell */}
                  <td
                    onClick={() => item && onEditDay(item)}
                    className={`p-3 border-r-[2.5px] border-moku-dark/20 align-middle ${item ? 'cursor-pointer hover:bg-moku-blue/5 group' : ''}`}
                  >
                    {item && item.lunches.length > 0 ? (
                      <div>
                        <span className="font-fredoka text-sm text-moku-dark font-semibold leading-tight group-hover:text-moku-coral transition-colors line-clamp-2">
                          {item.lunches[0].name}
                        </span>
                        {item.lunches.length > 1 && (
                          <span className="text-xs text-moku-blue font-semibold block mt-0.5">
                            +{item.lunches.length - 1} more
                          </span>
                        )}
                        {(item.sides ?? []).length > 0 && (
                          <span className="text-xs text-slate-400 block mt-0.5 leading-tight line-clamp-1">
                            🥕 {(item.sides ?? []).map((s) => s.name).join(' · ')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 italic">—</span>
                    )}
                  </td>

                  {/* Snacks cell */}
                  <td
                    onClick={() => item && onEditDay(item)}
                    className={`p-3 align-middle ${item ? 'cursor-pointer hover:bg-moku-yellow/5 group' : ''}`}
                  >
                    {item && item.snacks.length > 0 ? (
                      <div>
                        <span className="font-fredoka text-sm text-moku-dark font-semibold leading-tight group-hover:text-moku-peach transition-colors line-clamp-2">
                          {item.snacks[0].name}
                        </span>
                        {item.snacks.length > 1 && (
                          <span className="text-xs text-moku-blue font-semibold block mt-0.5">
                            +{item.snacks.length - 1} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 italic">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-center text-slate-400 font-medium tracking-wide select-none">
        💡 Tap any row to edit lunches or snacks for that day
      </p>

      <div className="bg-moku-blue/10 border-2 border-dashed border-moku-blue rounded-2xl p-3 flex items-center justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-fredoka text-sm font-bold text-moku-dark">Want to customize this week?</h4>
          <p className="text-xs text-slate-500 leading-tight mt-0.5">
            Tap ✨ New Plan below to regenerate with BentoBot.
          </p>
        </div>
        <span className="text-2xl animate-pulse">✨</span>
      </div>
    </div>
  );
}
