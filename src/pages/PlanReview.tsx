import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useKid } from '../hooks/useKid';
import { useParentPrefs } from '../hooks/useParentPrefs';
import { usePlan } from '../hooks/usePlan';
import { useItemRegenerate } from '../hooks/useAI';
import { useApp } from '../context/AppContext';
import { generateGroceryList, generateWeeklyPlan, parseWeeklyNotes } from '../lib/ai';
import type { Dish, LunchItem, WeeklyPlan } from '../types';

type DishCardProps = {
  dish: Dish;
  label: string;
  readonly?: boolean;
  isLoading?: boolean;
  error?: string;
  onEdit?: (updated: Dish) => void;
  onRegenerate?: (note: string) => void;
};

function DishCard({ dish, label, readonly, isLoading, error, onEdit, onRegenerate }: DishCardProps) {
  const [showPrep, setShowPrep] = useState(false);
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenNote, setRegenNote] = useState('');
  const [editName, setEditName] = useState(dish.name);
  const [editDesc, setEditDesc] = useState(dish.description);
  const [editPrep, setEditPrep] = useState(dish.prepNotes);

  const handleSaveEdit = () => {
    onEdit?.({ ...dish, name: editName, description: editDesc, prepNotes: editPrep });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="card" style={{ marginBottom: '0.5rem' }}>
        <p className="muted" style={{ marginBottom: '0.5rem' }}>{label}</p>
        <div className="field">
          <label>Name</label>
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={2} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
        </div>
        <div className="field">
          <label>Prep notes</label>
          <textarea rows={5} value={editPrep} onChange={(e) => setEditPrep(e.target.value)} />
        </div>
        <div className="row">
          <button onClick={() => setEditing(false)}>Cancel</button>
          <button className="primary" onClick={handleSaveEdit}>Save</button>
        </div>
      </div>
    );
  }

  if (regenerating) {
    return (
      <div className="card" style={{ marginBottom: '0.5rem' }}>
        <p className="muted" style={{ marginBottom: '0.5rem' }}>{label} — {dish.name}</p>
        <div className="field">
          <label>What would you prefer? <span className="muted">(optional)</span></label>
          <textarea rows={2} value={regenNote} onChange={(e) => setRegenNote(e.target.value)}
            placeholder="e.g. something with less bread this week" />
        </div>
        <div className="row">
          <button onClick={() => setRegenerating(false)}>Cancel</button>
          <button className="primary" disabled={isLoading} onClick={() => {
            onRegenerate?.(regenNote);
            setRegenerating(false);
            setRegenNote('');
          }}>
            {isLoading ? <><span className="spinner" />Regenerating…</> : 'Regenerate'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '0.5rem', paddingLeft: label.startsWith('Snack') ? '0.5rem' : 0 }}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div style={{ flex: 1 }}>
          <strong>{dish.name}</strong>
          <span className="muted" style={{ marginLeft: '0.4rem', fontSize: '0.85rem' }}>{label}</span>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', margin: '0.1rem 0' }}>{dish.description}</p>
          <button type="button" onClick={() => setShowPrep((v) => !v)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.85rem', color: 'var(--color-primary)', cursor: 'pointer' }}>
            {showPrep ? '▾ Hide prep' : '▸ Show prep'}
          </button>
          {showPrep && (
            <p style={{ fontSize: '0.85rem', marginTop: '0.3rem', whiteSpace: 'pre-wrap', color: 'var(--color-muted)' }}>
              {dish.prepNotes}
            </p>
          )}
        </div>
        {!readonly && (
          <div className="row" style={{ gap: '0.25rem', flexShrink: 0 }}>
            {isLoading
              ? <span className="spinner" />
              : <>
                  <button title="Edit" onClick={() => { setEditing(true); setEditName(dish.name); setEditDesc(dish.description); setEditPrep(dish.prepNotes); }}>✏️</button>
                  <button title="Regenerate" onClick={() => setRegenerating(true)}>🔄</button>
                </>
            }
          </div>
        )}
      </div>
      {error && <p className="error-banner" style={{ marginTop: '0.3rem' }}>{error}</p>}
    </div>
  );
}

type ReviewGridProps = {
  plan: WeeklyPlan;
  readonly?: boolean;
  onUpdateItem?: (item: LunchItem) => void;
  onRegenDish?: (item: LunchItem, dishId: string, mealType: 'main' | 'snack', note: string) => void;
  loadingIds?: Record<string, boolean>;
  errorIds?: Record<string, string>;
};

function ReviewGrid({ plan, readonly, onUpdateItem, onRegenDish, loadingIds = {}, errorIds = {} }: ReviewGridProps) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sorted = [...plan.items].sort(
    (a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {sorted.map((item) => (
        <div key={item.id} className="card">
          <h2 style={{ marginTop: 0 }}>{item.day}</h2>
          <DishCard
            dish={item.mainLunch}
            label="Lunch"
            readonly={readonly}
            isLoading={loadingIds[item.mainLunch.id]}
            error={errorIds[item.mainLunch.id]}
            onEdit={(updated) => onUpdateItem?.({ ...item, mainLunch: updated })}
            onRegenerate={(note) => onRegenDish?.(item, item.mainLunch.id, 'main', note)}
          />
          {item.snacks.map((snack, i) => (
            <DishCard
              key={snack.id}
              dish={snack}
              label={`Snack ${i + 1}`}
              readonly={readonly}
              isLoading={loadingIds[snack.id]}
              error={errorIds[snack.id]}
              onEdit={(updated) => onUpdateItem?.({ ...item, snacks: item.snacks.map((s) => s.id === snack.id ? updated : s) })}
              onRegenerate={(note) => onRegenDish?.(item, snack.id, 'snack', note)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type Props = { readonly?: boolean; plan?: WeeklyPlan };

export default function PlanReview({ readonly, plan: propPlan }: Props) {
  const navigate = useNavigate();
  const { kid } = useKid();
  const { parentPrefs } = useParentPrefs();
  const { draftPlan, updateItem, updatePlanItems } = usePlan();
  const { setGroceryList: saveGroceryList } = useApp();
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [finalizingLoading, setFinalizingLoading] = useState(false);
  const [regenAllConfirm, setRegenAllConfirm] = useState(false);

  const plan = propPlan ?? draftPlan;
  const { loadingIds, errorIds, regenerate } = useItemRegenerate(plan?.items ?? []);

  if (!plan) {
    return (
      <div className="page">
        <p>No plan found. <Link to="/plan/new">Start a new plan</Link></p>
      </div>
    );
  }

  const allDishes = plan.items.flatMap((item) => [item.mainLunch, ...item.snacks]);

  const handleRegenDish = async (item: LunchItem, dishId: string, mealType: 'main' | 'snack', note: string) => {
    if (!kid || !parentPrefs) return;
    const currentDish = mealType === 'main' ? item.mainLunch : item.snacks.find((s) => s.id === dishId)!;
    const others = allDishes.filter((d) => d.id !== dishId);

    const result = await regenerate(dishId, {
      kid,
      parentPrefs,
      sessionNotes: plan.sessionNotes,
      day: item.day,
      mealType,
      currentDish,
      userNote: note,
      otherDishesThisWeek: others,
    });

    if (!result) return;

    const updatedItem = mealType === 'main'
      ? { ...item, mainLunch: result }
      : { ...item, snacks: item.snacks.map((s) => s.id === dishId ? result : s) };

    updateItem(plan.id, updatedItem);
  };

  const handleFinalize = async () => {
    if (!kid || !parentPrefs) return;
    setFinalizingLoading(true);
    setGenerateError(null);
    try {
      const list = await generateGroceryList(plan, kid, parentPrefs);
      saveGroceryList(plan.id, list);
      navigate('/plan/grocery');
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate grocery list — try again');
    } finally {
      setFinalizingLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>{readonly ? 'Plan — read only' : 'Review your plan'}</h1>
      {readonly && plan.createdAt && (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          {new Date(plan.createdAt).toLocaleDateString()}
        </p>
      )}

      {generateError && <div className="error-banner">{generateError}</div>}

      <ReviewGrid
        plan={plan}
        readonly={readonly}
        onUpdateItem={(item) => updateItem(plan.id, item)}
        onRegenDish={handleRegenDish}
        loadingIds={loadingIds}
        errorIds={errorIds}
      />

      {readonly && plan.groceryList && (
        <>
          <hr className="section-divider" />
          <h2>Grocery list</h2>
          <GroceryReadOnly items={plan.groceryList} />
        </>
      )}

      {!readonly && (
        <div className="sticky-footer">
          {regenAllConfirm ? (
            <>
              <span className="muted" style={{ marginRight: 'auto', alignSelf: 'center', fontSize: '0.85rem' }}>
                Discard all edits and regenerate?
              </span>
              <button onClick={() => setRegenAllConfirm(false)}>Cancel</button>
              <button className="danger" onClick={async () => {
                setRegenAllConfirm(false);
                if (!kid || !parentPrefs) return;
                const session = await parseWeeklyNotes(plan.sessionNotes, plan.days, kid, parentPrefs);
                const result = await generateWeeklyPlan(session, kid, parentPrefs);
                updatePlanItems(plan.id, result.items);
              }}>Regenerate all</button>
            </>
          ) : (
            <>
              <button onClick={() => setRegenAllConfirm(true)}>🔄 Regenerate entire plan</button>
              <button className="primary" disabled={finalizingLoading} onClick={handleFinalize}>
                {finalizingLoading ? <><span className="spinner" />Building list…</> : 'Finalize plan →'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GroceryReadOnly({ items }: { items: import('../types').GroceryItem[] }) {
  const order = ['produce', 'protein', 'dairy', 'grains', 'condiments', 'packaged', 'other'] as const;
  const grouped = order.reduce((acc, cat) => {
    const matching = items.filter((i) => i.category === cat);
    if (matching.length) acc[cat] = matching;
    return acc;
  }, {} as Partial<Record<string, typeof items>>);

  return (
    <div>
      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: '0.25rem' }}>{cat}</p>
          {catItems!.map((item, i) => (
            <p key={i} style={{ fontSize: '0.9rem', paddingLeft: '0.75rem' }}>
              {item.quantity} {item.unit} {item.name}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
