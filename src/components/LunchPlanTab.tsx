import type { WeeklyPlan, LunchItem } from '../types';
import { getTodayDayName, isCurrentWeek } from '../lib/dateUtils';
import { isDishPrepped } from '../lib/prepSteps';
import DoneStamp from './DoneStamp';

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
  onPrepDay: (item: LunchItem) => void;
  onGenerateClick: () => void;
};

export default function LunchPlanTab({ plan, weekStartDate, onEditDay, onPrepDay, onGenerateClick }: Props) {
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
              <th className="p-2 border-r-[3px] border-moku-dark w-[39%] text-left font-bold">🍱 MAIN LUNCH</th>
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
                  <td className="p-2 border-r-[2.5px] border-moku-dark/20 text-center align-top select-none">
                    <button
                      onClick={() => item && onPrepDay(item)}
                      disabled={!item}
                      className={`${theme.badge} text-white font-fredoka font-bold text-xs px-2 py-1 rounded-xl border-2 border-moku-dark block moku-shadow-sm -rotate-2 mx-auto ${
                        item ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'
                      }`}
                    >
                      {day.slice(0, 3).toUpperCase()}
                    </button>
                  </td>

                  {/* Main lunch cell */}
                  <td
                    onClick={() => item && onEditDay(item)}
                    className={`p-3 border-r-[2.5px] border-moku-dark/20 align-top ${item ? 'cursor-pointer hover:bg-moku-blue/5 group' : ''}`}
                  >
                    {item && item.lunches.length > 0 ? (
                      <div className="space-y-0.5">
                        {item.lunches.map((lunch) => {
                          const done = isDishPrepped(lunch.id, lunch.name, lunch.prepNotes, plan.prepProgress);
                          return (
                            <div key={lunch.id} className="relative">
                              <span
                                className={`font-fredoka text-sm sm:text-[15px] font-bold text-moku-dark block ${
                                  done ? 'line-through decoration-moku-dark/40 opacity-65' : ''
                                }`}
                              >
                                {lunch.name}
                              </span>
                              {done && (
                                <DoneStamp className="w-9 h-9 absolute -top-3 -right-2 rotate-12 pointer-events-none drop-shadow" />
                              )}
                            </div>
                          );
                        })}
                        {(item.sides ?? []).length > 0 && (
                          <div className="border-t border-dashed border-moku-dark/15 pt-1.5 mt-1.5 space-y-0.5">
                            {item.sides.map((side) => {
                              const done = isDishPrepped(side.id, side.name, side.prepNotes, plan.prepProgress);
                              return (
                                <div key={side.id} className="relative">
                                  <span
                                    className={`text-xs sm:text-[12.5px] text-moku-dark/60 font-semibold block ${
                                      done ? 'line-through decoration-moku-dark/40 opacity-65' : ''
                                    }`}
                                  >
                                    🥕 {side.name}
                                  </span>
                                  {done && (
                                    <DoneStamp className="w-7 h-7 absolute -top-2 -right-1 rotate-12 pointer-events-none drop-shadow" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 italic">—</span>
                    )}
                  </td>

                  {/* Snacks cell */}
                  <td
                    onClick={() => item && onEditDay(item)}
                    className={`p-3 align-top ${item ? 'cursor-pointer hover:bg-moku-yellow/5 group' : ''}`}
                  >
                    {item && item.snacks.length > 0 ? (
                      <div className="space-y-1.5">
                        {item.snacks.map((snack) => {
                          const done = isDishPrepped(snack.id, snack.name, snack.prepNotes, plan.prepProgress);
                          return (
                            <div
                              key={snack.id}
                              className="bg-moku-beige/50 rounded-lg p-2 border border-moku-dark/20 relative"
                            >
                              <span
                                className={`font-fredoka text-sm font-semibold text-moku-dark block ${
                                  done ? 'line-through decoration-moku-dark/40 opacity-65' : ''
                                }`}
                              >
                                {snack.name}
                              </span>
                              {done && (
                                <DoneStamp className="w-7 h-7 absolute -top-2 -right-1 rotate-12 pointer-events-none drop-shadow" />
                              )}
                            </div>
                          );
                        })}
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

      <button
        onClick={onGenerateClick}
        className="w-full bg-moku-yellow text-moku-dark font-fredoka font-bold text-sm py-3 rounded-2xl moku-border moku-shadow moku-press flex items-center justify-center gap-2"
      >
        <span>✨</span><span>Regenerate Week</span>
      </button>
    </div>
  );
}
