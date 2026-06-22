import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAI } from '../hooks/useAI';
import type { GroceryItem } from '../types';
import { getMondayISO, addWeeks, formatWeekRange } from '../lib/dateUtils';
import FoodIcon from './FoodIcon';

const CATEGORY_ICON: Partial<Record<GroceryItem['category'], string>> = {
  produce: 'arugula',
  protein: 'roast-chicken',
  dairy: 'cheese',
  grains: 'bread',
};

const CATEGORY_TEXT: Record<GroceryItem['category'], string> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  grains: 'Grains',
  packaged: 'Packaged',
  condiments: 'Condiments',
  other: 'Other',
};

const CATEGORY_EMOJI: Partial<Record<GroceryItem['category'], string>> = {
  packaged: '📦',
  condiments: '🫙',
  other: '🛒',
};

const CATEGORY_LABELS_TEXT: Record<GroceryItem['category'], string> = {
  produce: '🥦 Produce',
  protein: '🍗 Protein',
  dairy: '🧀 Dairy',
  grains: '🍞 Grains',
  packaged: '📦 Packaged',
  condiments: '🫙 Condiments',
  other: '🛒 Other',
};

type Props = {
  showToast: (msg: string) => void;
};

export default function GroceryTab({ showToast }: Props) {
  const { plans, setGroceryList } = useApp();
  const { generateGrocery } = useAI();

  const thisMonday = getMondayISO(new Date());
  const [fromWeek, setFromWeek] = useState(thisMonday);
  const [toWeek, setToWeek] = useState(thisMonday);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const selectedPlans = useMemo(() => {
    return plans.filter((p) => p.weekStartDate >= fromWeek && p.weekStartDate <= toWeek);
  }, [plans, fromWeek, toWeek]);

  // Get the grocery list for a single selected plan (auto-generated on finalize or fetch from DB)
  const groceryList: GroceryItem[] | null = useMemo(() => {
    if (selectedPlans.length === 1 && selectedPlans[0].groceryList) {
      return selectedPlans[0].groceryList;
    }
    return null;
  }, [selectedPlans]);

  const toggleCheck = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerateGrocery = async () => {
    if (selectedPlans.length !== 1) return;
    const plan = selectedPlans[0];
    if (plan.status !== 'final' || plan.groceryList) return;

    const list = await generateGrocery.call(plan);
    if (list) {
      setGroceryList(plan.id, list);
      showToast('✨ Grocery list generated!');
    }
  };

  const copyToClipboard = () => {
    if (!groceryList || selectedPlans.length === 0) return;
    let text = '🍱 BENTOBOT GROCERY LIST\n\n';
    const byCategory = groceryList.reduce<Record<string, GroceryItem[]>>((acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    }, {});
    for (const [cat, items] of Object.entries(byCategory)) {
      text += `[ ${CATEGORY_LABELS_TEXT[cat as GroceryItem['category']] ?? cat} ]\n`;
      items.forEach((i) => {
        const done = checked[i.name] ? '✔️' : '[ ]';
        text += `${done} ${i.qty} ${i.unit} ${i.name}\n`;
      });
      text += '\n';
    }
    navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to clipboard!'));
  };

  const weekOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    let w = addWeeks(thisMonday, -4);
    for (let i = 0; i < 10; i++) {
      options.push({ value: w, label: formatWeekRange(w) });
      w = addWeeks(w, 1);
    }
    return options;
  }, [thisMonday]);

  return (
    <div className="flex flex-col gap-3">
      {/* Date range selector */}
      <div className="bg-white luncharoo-border rounded-2xl luncharoo-shadow-sm p-3">
        <h3 className="font-fredoka text-sm font-bold text-luncharoo-dark mb-2 flex items-center gap-1.5">
          📅 Select Date Range
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <label className="block font-fredoka text-xs text-slate-500 mb-1 font-bold">FROM WEEK</label>
            <select
              value={fromWeek}
              onChange={(e) => {
                setFromWeek(e.target.value);
                if (e.target.value > toWeek) setToWeek(e.target.value);
              }}
              className="w-full luncharoo-border rounded-xl px-2 py-1.5 bg-white text-xs font-fredoka text-luncharoo-dark focus:outline-none"
            >
              {weekOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-fredoka text-xs text-slate-500 mb-1 font-bold">TO WEEK</label>
            <select
              value={toWeek}
              onChange={(e) => setToWeek(e.target.value)}
              className="w-full luncharoo-border rounded-xl px-2 py-1.5 bg-white text-xs font-fredoka text-luncharoo-dark focus:outline-none"
            >
              {weekOptions.filter((o) => o.value >= fromWeek).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          {selectedPlans.length === 0
            ? 'No plans found for this range.'
            : `${selectedPlans.length} plan${selectedPlans.length > 1 ? 's' : ''} found`}
        </p>
      </div>

      {selectedPlans.length === 0 ? (
        <div className="bg-luncharoo-beige luncharoo-border rounded-2xl p-6 text-center">
          <p className="text-2xl mb-2">🛒</p>
          <p className="font-fredoka text-sm text-luncharoo-dark font-bold">No plans in this range</p>
          <p className="text-xs text-slate-500 mt-1">Generate a lunch plan first, then come back here.</p>
        </div>
      ) : (
        <div className="bg-white luncharoo-border rounded-2xl luncharoo-shadow overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-luncharoo-dark/10">
            <h3 className="font-fredoka text-sm font-bold text-luncharoo-dark flex items-center gap-1.5">
              🧺 Groceries
            </h3>
            <div className="flex gap-1.5">
              {selectedPlans.length === 1 && selectedPlans[0].status === 'final' && !groceryList && (
                <button
                  onClick={handleGenerateGrocery}
                  disabled={generateGrocery.loading}
                  className="bg-luncharoo-blue text-white font-fredoka text-xs px-2 py-1 rounded-lg luncharoo-border luncharoo-shadow-sm luncharoo-press disabled:opacity-50 font-bold"
                >
                  {generateGrocery.loading ? '...' : '✨ Generate'}
                </button>
              )}
              {groceryList && (
                <button
                  onClick={copyToClipboard}
                  className="bg-luncharoo-beige text-luncharoo-dark font-fredoka text-xs px-2 py-1 rounded-lg border border-luncharoo-dark luncharoo-press font-bold"
                >
                  📋 Copy
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-3 max-h-[400px] overflow-y-auto space-y-3">
            {generateGrocery.loading ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">Generating grocery list...</p>
              </div>
            ) : generateGrocery.error ? (
              <div className="py-8 text-center">
                <p className="text-sm text-luncharoo-coral font-bold">Error generating list</p>
                <p className="text-xs text-slate-500 mt-1">{generateGrocery.error}</p>
              </div>
            ) : groceryList ? (
              // Categorized grocery list
              Object.entries(
                groceryList.reduce<Record<string, GroceryItem[]>>((acc, item) => {
                  (acc[item.category] ??= []).push(item);
                  return acc;
                }, {})
              ).map(([cat, items]) => (
                <div key={cat}>
                  <h4 className="font-fredoka text-xs font-bold text-luncharoo-coral mb-1.5 flex items-center gap-1">
                    {CATEGORY_ICON[cat as GroceryItem['category']]
                      ? <FoodIcon name={CATEGORY_ICON[cat as GroceryItem['category']]!} size={14} />
                      : CATEGORY_EMOJI[cat as GroceryItem['category']] ?? null}
                    {CATEGORY_TEXT[cat as GroceryItem['category']] ?? cat}
                  </h4>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const key = item.name;
                      return (
                        <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!checked[key]}
                            onChange={() => toggleCheck(key)}
                            className="w-4 h-4 accent-luncharoo-coral"
                          />
                          <span className={`text-sm ${checked[key] ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {item.qty} {item.unit} <span className="font-semibold">{item.name}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No grocery list yet</p>
                {selectedPlans.length === 1 && selectedPlans[0].status === 'draft' && (
                  <p className="text-xs text-slate-400 mt-1">Finalize your plan to generate a list.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
