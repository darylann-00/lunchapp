import { useState, useCallback } from 'react';
import type { DayPlan, SlotCategory, ComponentReaction } from '../types';
import { SLOT_ICON } from '../types';
import FoodIcon from './FoodIcon';
import { getFoodIcon } from '../lib/foodIconMap';
import { getDayDate } from '../lib/dateUtils';

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

type DisplayItem = {
  componentId: string;
  name: string;
  slotCategories: SlotCategory[];
  group: 'main' | 'side' | 'treat';
};

function groupLunchboxItems(
  lunchbox: DayPlan['lunchbox'],
  activeSlots: SlotCategory[],
): DisplayItem[] {
  const seen = new Map<string, DisplayItem>();

  for (const cat of activeSlots) {
    const slot = lunchbox[cat];
    if (!slot) continue;

    const existing = seen.get(slot.component_id);
    if (existing) {
      existing.slotCategories.push(cat);
      continue;
    }

    let group: DisplayItem['group'] = 'side';
    if (cat === 'protein') group = 'main';
    else if (cat === 'fun') group = 'treat';

    seen.set(slot.component_id, {
      componentId: slot.component_id,
      name: slot.name,
      slotCategories: [cat],
      group,
    });
  }

  return Array.from(seen.values());
}

type Props = {
  day: string;
  dayPlan: DayPlan;
  weekStartDate: string;
  isToday?: boolean;
  isPast?: boolean;
  editable?: boolean;
  activeSlots: SlotCategory[];
  feedback?: Record<string, ComponentReaction | null>;
  loadingIds?: Record<string, boolean>;
  errorIds?: Record<string, string | undefined>;
  onFeedback?: (componentId: string, reaction: ComponentReaction) => void;
  onRegenerateSlot?: (day: string, category: SlotCategory, slotKey: string) => void;
  onRegenerateSnack?: (day: string, snackIndex: number, slotKey: string) => void;
  onRenameSlot?: (day: string, category: SlotCategory, newName: string) => void;
};

function SlotItem({
  item,
  editable,
  isMain,
  isTreat,
  feedback,
  loadingId,
  hasError,
  onFeedback,
  onRegenerate,
  onRename,
}: {
  item: DisplayItem;
  editable?: boolean;
  isMain?: boolean;
  isTreat?: boolean;
  feedback?: ComponentReaction | null;
  loadingId?: boolean;
  hasError?: boolean;
  onFeedback?: (componentId: string, reaction: ComponentReaction) => void;
  onRegenerate?: () => void;
  onRename?: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.name);

  const handleStartEdit = useCallback(() => {
    if (!editable || !onRename) return;
    setEditValue(item.name);
    setEditing(true);
  }, [editable, onRename, item.name]);

  const handleConfirmEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.name && onRename) {
      onRename(trimmed);
    }
    setEditing(false);
  }, [editValue, item.name, onRename]);

  const iconName = getFoodIcon(item.name) ?? SLOT_ICON[item.slotCategories[0]];

  const forceFullWidth = editable || isMain || isTreat;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 ${
        forceFullWidth ? 'col-span-2' : ''
      } ${isMain ? 'border-b-[1.5px] border-luncharoo-dark/8' : ''
      } ${isTreat ? 'border-t-[1.5px] border-dashed border-luncharoo-dark/10' : ''
      } ${!isMain && !isTreat ? 'border-b border-luncharoo-dark/5' : ''}`}
    >
      <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center flex-shrink-0 bg-white border-[1.5px] border-luncharoo-dark/10">
        <FoodIcon name={iconName} size={20} />
      </div>

      {(isMain || isTreat) && (
        <span className={`font-fredoka text-[11px] font-bold uppercase tracking-wide ${
          isMain ? 'text-luncharoo-dark/40' : 'text-luncharoo-dark/40'
        }`}>
          {isMain ? 'Main' : 'Treat'}
        </span>
      )}

      {editing ? (
        <>
          <input
            className="flex-1 text-[12px] font-medium text-luncharoo-dark border-b-2 border-luncharoo-blue bg-luncharoo-blue/10 px-1 py-0.5 rounded-t outline-none font-sans"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
          <button
            onClick={handleConfirmEdit}
            className="w-[22px] h-[22px] rounded-[7px] border-[1.5px] border-emerald-500 bg-white flex items-center justify-center text-emerald-500 luncharoo-press"
            aria-label="Confirm"
          >
            <span className="text-[11px] font-bold">✓</span>
          </button>
        </>
      ) : (
        <>
          <span
            className={`flex-1 text-[12px] font-medium text-luncharoo-dark leading-tight ${
              editable && onRename ? 'cursor-pointer hover:underline hover:decoration-dashed hover:underline-offset-2 hover:decoration-luncharoo-dark/30' : ''
            }`}
            onClick={handleStartEdit}
          >
            {item.name}
          </span>

          {editable && (
            <div className="flex gap-1 items-center flex-shrink-0">
              {onFeedback && (
                <button
                  onClick={() => onFeedback(item.componentId, 'favorite')}
                  className={`w-[22px] h-[22px] rounded-[7px] border-[1.5px] flex items-center justify-center luncharoo-press ${
                    feedback === 'favorite'
                      ? 'text-luncharoo-coral border-luncharoo-coral bg-luncharoo-coral/10'
                      : 'text-slate-300 border-luncharoo-dark/15 bg-white'
                  }`}
                  aria-label="Favorite"
                >
                  <span className="text-[11px]">{feedback === 'favorite' ? '♥' : '♡'}</span>
                </button>
              )}
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  disabled={loadingId}
                  className="w-[22px] h-[22px] rounded-[7px] border-[1.5px] border-luncharoo-coral/80 bg-luncharoo-coral text-white flex items-center justify-center luncharoo-press disabled:opacity-50"
                  aria-label="Swap"
                >
                  <span className="text-[10px] font-bold">{loadingId ? '⏳' : '↻'}</span>
                </button>
              )}
              {hasError && <span className="text-[9px] text-red-600">⚠️</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LunchboxCard({
  day,
  dayPlan,
  weekStartDate,
  isToday,
  isPast,
  editable,
  activeSlots,
  feedback,
  loadingIds,
  errorIds,
  onFeedback,
  onRegenerateSlot,
  onRegenerateSnack,
  onRenameSlot,
}: Props) {
  const dayColor = DAY_COLORS[day] ?? 'bg-luncharoo-blue';
  const dateStr = formatDayDate(weekStartDate, day);

  const items = groupLunchboxItems(dayPlan.lunchbox, activeSlots);
  const mainItems = items.filter((i) => i.group === 'main');
  const sideItems = items.filter((i) => i.group === 'side');
  const treatItems = items.filter((i) => i.group === 'treat');

  const cardBorder = isToday
    ? 'border-luncharoo-yellow shadow-[4px_4px_0px_#c48a0a]'
    : 'luncharoo-shadow';

  return (
    <div
      className={`bg-white luncharoo-border rounded-[20px] overflow-hidden ${cardBorder} ${
        isPast ? 'opacity-45' : ''
      }`}
    >
      {/* Day header */}
      <div className={`flex items-center gap-2 px-2.5 py-[7px] border-b-[2.5px] border-luncharoo-dark ${
        isToday ? 'bg-amber-50' : 'bg-luncharoo-beige'
      }`}>
        <button
          disabled
          className={`${dayColor} text-white font-fredoka font-bold text-[11px] px-2.5 py-[3px] rounded-[10px] border-2 border-luncharoo-dark luncharoo-shadow-sm -rotate-2 cursor-default`}
        >
          {day.slice(0, 3).toUpperCase()}
        </button>
        <span className="font-fredoka text-[11px] text-slate-400 font-semibold">{dateStr}</span>
        {isToday && (
          <span className="font-fredoka text-[11px] text-white bg-luncharoo-dark px-1.5 py-0.5 rounded-md font-semibold">
            TODAY
          </span>
        )}
        <div className="flex-1" />
      </div>

      {/* Lunchbox grid */}
      <div className="grid grid-cols-2">
        {/* Main items */}
        {mainItems.map((item) => {
          const slotKey = `${day}-lunchbox-${item.slotCategories[0]}`;
          return (
            <SlotItem
              key={item.componentId}
              item={item}
              editable={editable}
              isMain
              feedback={feedback?.[item.componentId]}
              loadingId={loadingIds?.[slotKey]}
              hasError={!!errorIds?.[slotKey]}
              onFeedback={onFeedback}
              onRegenerate={
                onRegenerateSlot
                  ? () => onRegenerateSlot(day, item.slotCategories[0], slotKey)
                  : undefined
              }
              onRename={
                onRenameSlot
                  ? (newName) => onRenameSlot(day, item.slotCategories[0], newName)
                  : undefined
              }
            />
          );
        })}

        {/* Side items */}
        {sideItems.map((item) => {
          const slotKey = `${day}-lunchbox-${item.slotCategories[0]}`;
          return (
            <SlotItem
              key={item.componentId}
              item={item}
              editable={editable}
              feedback={feedback?.[item.componentId]}
              loadingId={loadingIds?.[slotKey]}
              hasError={!!errorIds?.[slotKey]}
              onFeedback={onFeedback}
              onRegenerate={
                onRegenerateSlot
                  ? () => onRegenerateSlot(day, item.slotCategories[0], slotKey)
                  : undefined
              }
              onRename={
                onRenameSlot
                  ? (newName) => onRenameSlot(day, item.slotCategories[0], newName)
                  : undefined
              }
            />
          );
        })}

        {/* Treat items */}
        {treatItems.map((item) => {
          const slotKey = `${day}-lunchbox-${item.slotCategories[0]}`;
          return (
            <SlotItem
              key={item.componentId}
              item={item}
              editable={editable}
              isTreat
              feedback={feedback?.[item.componentId]}
              loadingId={loadingIds?.[slotKey]}
              hasError={!!errorIds?.[slotKey]}
              onFeedback={onFeedback}
              onRegenerate={
                onRegenerateSlot
                  ? () => onRegenerateSlot(day, item.slotCategories[0], slotKey)
                  : undefined
              }
              onRename={
                onRenameSlot
                  ? (newName) => onRenameSlot(day, item.slotCategories[0], newName)
                  : undefined
              }
            />
          );
        })}

        {/* Add item row (edit mode only) */}
        {editable && (
          <div className="col-span-2 flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-slate-300 hover:text-luncharoo-dark border-t border-dashed border-luncharoo-dark/10">
            <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center border-[1.5px] border-dashed border-luncharoo-dark/20">
              <span className="text-sm">+</span>
            </div>
            <span className="text-[12px] italic">Add an item</span>
          </div>
        )}
      </div>

      {/* Snack tray */}
      {dayPlan.snacks.length > 0 && (
        <div className="bg-luncharoo-beige/50 px-2.5 py-[6px] border-t-[2px] border-luncharoo-dark/12 flex items-center gap-1.5 flex-wrap">
          <span className="font-fredoka text-[11px] font-bold uppercase tracking-wide text-slate-400 flex-shrink-0">
            Snacks
          </span>
          {dayPlan.snacks.map((snack, i) => {
            const snackIcon = getFoodIcon(snack.name) ?? 'apple';
            const slotKey = `${day}-snack-${i}`;
            const isLoading = loadingIds?.[slotKey];

            return (
              <span
                key={snack.component_id}
                className="bg-white border-[1.5px] border-luncharoo-dark/18 rounded-[10px] px-2 py-[3px] text-[12px] text-luncharoo-dark font-medium inline-flex items-center gap-1.5"
              >
                <FoodIcon name={snackIcon} size={14} />
                {snack.name}
                {editable && onRegenerateSnack && (
                  <button
                    onClick={() => onRegenerateSnack(day, i, slotKey)}
                    disabled={!!isLoading}
                    className="w-4 h-4 rounded-[5px] border-[1.5px] border-luncharoo-coral/80 bg-luncharoo-coral text-white flex items-center justify-center luncharoo-press disabled:opacity-50 ml-0.5"
                    aria-label="Swap snack"
                  >
                    <span className="text-[9px] font-bold">{isLoading ? '⏳' : '↻'}</span>
                  </button>
                )}
              </span>
            );
          })}
          {editable && (
            <span className="border-[1.5px] border-dashed border-luncharoo-dark/18 rounded-[10px] px-2 py-[3px] text-[12px] text-slate-300 cursor-pointer hover:text-luncharoo-dark inline-flex items-center gap-1">
              <span className="text-[11px]">+</span> Add
            </span>
          )}
        </div>
      )}
    </div>
  );
}
