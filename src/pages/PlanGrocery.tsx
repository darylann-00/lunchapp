import { useNavigate, Link } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import { useApp } from '../context/AppContext';
import type { GroceryItem } from '../types';

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'grains', 'condiments', 'packaged', 'other'] as const;

function formatList(items: GroceryItem[]): string {
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const matching = items.filter((i) => i.category === cat);
    if (matching.length) acc[cat] = matching;
    return acc;
  }, {} as Partial<Record<string, GroceryItem[]>>);

  return Object.entries(grouped)
    .map(([cat, catItems]) => {
      const header = cat.charAt(0).toUpperCase() + cat.slice(1);
      const rows = catItems!.map((i) => `  ${i.quantity} ${i.unit} ${i.name}`.trim()).join('\n');
      return `${header}\n${rows}`;
    })
    .join('\n\n');
}

export default function PlanGrocery() {
  const navigate = useNavigate();
  const { draftPlan } = usePlan();
  const { finalizePlan: ctxFinalize } = useApp();

  const plan = draftPlan;

  if (!plan || !plan.groceryList) {
    return (
      <div className="page">
        <p>No grocery list yet. <Link to="/plan/review">Go back to your plan</Link></p>
      </div>
    );
  }

  const items = plan.groceryList;

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const matching = items.filter((i) => i.category === cat);
    if (matching.length) acc[cat] = matching;
    return acc;
  }, {} as Partial<Record<string, GroceryItem[]>>);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatList(items));
  };

  const handleDownload = () => {
    const text = formatList(items);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grocery-list.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveDone = () => {
    ctxFinalize(plan.id);
    navigate('/');
  };

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Grocery list</h1>
        <button onClick={handleCopy} style={{ marginLeft: 'auto' }}>📋 Copy</button>
        <button onClick={handleDownload}>⬇ Download</button>
      </div>

      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ textTransform: 'capitalize', marginTop: 0 }}>{cat}</h2>
          {catItems!.map((item, i) => (
            <p key={i} style={{ paddingLeft: '0.75rem', marginBottom: '0.2rem' }}>
              {item.quantity} {item.unit} {item.name}
            </p>
          ))}
        </div>
      ))}

      <div className="sticky-footer">
        <Link to="/plan/review" style={{ alignSelf: 'center', fontSize: '0.9rem' }}>← Back to plan</Link>
        <button className="primary" onClick={handleSaveDone}>Save &amp; done ✓</button>
      </div>
    </div>
  );
}
