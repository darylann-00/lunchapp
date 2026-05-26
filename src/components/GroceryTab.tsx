import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAI } from '../hooks/useAI';
import { useKid } from '../hooks/useKid';
import { useParentPrefs } from '../hooks/useParentPrefs';
import type { WeeklyPlan, GroceryItem, Ingredient } from '../types';
import { getMondayISO, addWeeks, formatWeekRange } from '../lib/dateUtils';

const CATEGORY_LABELS: Record<GroceryItem['category'], string> = {
  produce: '🥦 Produce',
  protein: '🍗 Protein',
  dairy: '🧀 Dairy',
  grains: '🍞 Grains',
  packaged: '📦 Packaged',
  condiments: '🫙 Condiments',
  other: '🛒 Other',
};

function aggregateIngredients(plans: WeeklyPlan[]): (Ingredient & { days: string[] })[] {
  const map = new Map<string, Ingredient & { days: string[] }>();
  for (const plan of plans) {
    for (const item of plan.items) {
      const allDishes = [...item.lunches, ...item.snacks];
      for (const dish of allDishes) {
        for (const ing of dish.ingredients) {
          const key = ing.name.toLowerCase().trim();
          if (map.has(key)) {
            const existing = map.get(key)!;
            if (!existing.days.includes(item.day)) existing.days.push(item.day);
          } else {
            map.set(key, { ...ing, days: [item.day] });
          }
        }
      }
    }
  }
  return Array.from(map.values());
}

type Props = {
  showToast: (msg: string) => void;
};

export default function GroceryTab({ showToast }: Props) {
  const { plans, setGroceryList } = useApp();
  const { kid } = useKid();
  const { parentPrefs: prefs } = useParentPrefs();
  const { generateGrocery } = useAI();

  const thisMonday = getMondayISO(new Date());
  const [fromWeek, setFromWeek] = useState(thisMonday);
  const [toWeek, setToWeek] = useState(thisMonday);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);

  const selectedPlans = useMemo(() => {
    return plans.filter((p) => p.weekStartDate >= fromWeek && p.weekStartDate <= toWeek);
  }, [plans, fromWeek, toWeek]);

  // Use AI-generated grocery list if available and only one plan selected, otherwise aggregate
  const aiList: GroceryItem[] | null = useMemo(() => {
    if (selectedPlans.length === 1 && selectedPlans[0].groceryList) {
      return selectedPlans[0].groceryList;
    }
    return null;
  }, [selectedPlans]);

  const rawIngredients = useMemo(() => aggregateIngredients(selectedPlans), [selectedPlans]);

  const toggleCheck = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerateAI = async () => {
    if (!kid || !prefs || selectedPlans.length === 0) return;
    setGenerating(true);
    const list = await generateGrocery.call(selectedPlans, kid, prefs);
    if (list && selectedPlans.length === 1) {
      setGroceryList(selectedPlans[0].id, list);
      showToast('✨ Smart grocery list generated!');
    }
    setGenerating(false);
  };

  const copyToClipboard = () => {
    if (selectedPlans.length === 0) return;
    let text = '🍱 BENTOBOT GROCERY LIST\n\n';
    if (aiList) {
      const byCategory = aiList.reduce<Record<string, GroceryItem[]>>((acc, item) => {
        (acc[item.category] ??= []).push(item);
        return acc;
      }, {});
      for (const [cat, items] of Object.entries(byCategory)) {
        text += `[ ${CATEGORY_LABELS[cat as GroceryItem['category']] ?? cat} ]\n`;
        items.forEach((i) => {
          const done = checked[`ai-${i.name}`] ? '✔️' : '[ ]';
          text += `${done} ${i.quantity} ${i.unit} ${i.name}\n`;
        });
        text += '\n';
      }
    } else {
      rawIngredients.forEach((i) => {
        const done = checked[`raw-${i.name}`] ? '✔️' : '[ ]';
        text += `${done} ${i.quantity} ${i.unit} ${i.name}\n`;
      });
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
      <div className="bg-white moku-border rounded-2xl moku-shadow-sm p-3">
        <h3 className="font-fredoka text-sm font-bold text-moku-dark mb-2 flex items-center gap-1.5">
          📅 Select Date Range
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block font-fredoka text-[10px] text-slate-500 mb-1 font-bold">FROM WEEK</label>
            <select
              value={fromWeek}
              onChange={(e) => {
                setFromWeek(e.target.value);
                if (e.target.value > toWeek) setToWeek(e.target.value);
              }}
              className="w-full moku-border rounded-xl px-2 py-1.5 bg-white text-[11px] font-fredoka text-moku-dark focus:outline-none"
            >
              {weekOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-fredoka text-[10px] text-slate-500 mb-1 font-bold">TO WEEK</label>
            <select
              value={toWeek}
              onChange={(e) => setToWeek(e.target.value)}
              className="w-full moku-border rounded-xl px-2 py-1.5 bg-white text-[11px] font-fredoka text-moku-dark focus:outline-none"
            >
              {weekOptions.filter((o) => o.value >= fromWeek).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[9px] text-slate-400 mt-1.5">
          {selectedPlans.length === 0
            ? 'No plans found for this range.'
            : `${selectedPlans.length} plan${selectedPlans.length > 1 ? 's' : ''} found`}
        </p>
      </div>

      {selectedPlans.length === 0 ? (
        <div className="bg-moku-beige moku-border rounded-2xl p-6 text-center">
          <p className="text-2xl mb-2">🛒</p>
          <p className="font-fredoka text-sm text-moku-dark font-bold">No plans in this range</p>
          <p className="text-[10px] text-slate-500 mt-1">Generate a lunch plan first, then come back here.</p>
        </div>
      ) : (
        <div className="bg-white moku-border rounded-2xl moku-shadow overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-moku-dark/10">
            <h3 className="font-fredoka text-sm font-bold text-moku-dark flex items-center gap-1.5">
              🧺 Ingredients
            </h3>
            <div className="flex gap-1.5">
              {selectedPlans.length === 1 && !aiList && kid && prefs && (
                <button
                  onClick={handleGenerateAI}
                  disabled={generating}
                  className="bg-moku-blue text-white font-fredoka text-[9px] px-2 py-1 rounded-lg moku-border moku-shadow-sm moku-press disabled:opacity-50 font-bold"
                >
                  {generating ? '...' : '✨ Smart List'}
                </button>
              )}
              <button
                onClick={copyToClipboard}
                className="bg-moku-beige text-moku-dark font-fredoka text-[9px] px-2 py-1 rounded-lg border border-moku-dark moku-press font-bold"
              >
                📋 Copy
              </button>
            </div>
          </div>

          <div className="px-4 py-3 max-h-[400px] overflow-y-auto space-y-3">
            {aiList ? (
              // AI-generated categorized list
              Object.entries(
                aiList.reduce<Record<string, GroceryItem[]>>((acc, item) => {
                  (acc[item.category] ??= []).push(item);
                  return acc;
                }, {})
              ).map(([cat, items]) => (
                <div key={cat}>
                  <h4 className="font-fredoka text-[10px] font-bold text-moku-coral mb-1.5">
                    {CATEGORY_LABELS[cat as GroceryItem['category']] ?? cat}
                  </h4>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const key = `ai-${item.name}`;
                      return (
                        <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!checked[key]}
                            onChange={() => toggleCheck(key)}
                            className="w-4 h-4 accent-moku-coral"
                          />
                          <span className={`text-xs ${checked[key] ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {item.quantity} {item.unit} <span className="font-semibold">{item.name}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              // Raw aggregated ingredients
              <div className="space-y-1">
                {rawIngredients.map((ing) => {
                  const key = `raw-${ing.name}`;
                  return (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!checked[key]}
                        onChange={() => toggleCheck(key)}
                        className="w-4 h-4 accent-moku-coral"
                      />
                      <span className={`text-xs ${checked[key] ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {ing.quantity} {ing.unit} <span className="font-semibold">{ing.name}</span>
                      </span>
                      <span className="text-[9px] text-slate-400 ml-auto">{ing.days.join(', ')}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
