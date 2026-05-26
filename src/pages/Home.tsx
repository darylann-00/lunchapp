import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useKid } from '../hooks/useKid';
import { usePlan } from '../hooks/usePlan';
import { useApp } from '../context/AppContext';
import PlanReview from './PlanReview';
import type { WeeklyPlan } from '../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function DraftSummary({ plan, onContinue, onDiscard }: { plan: WeeklyPlan; onContinue: () => void; onDiscard: () => void }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sorted = [...plan.items].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <strong>Draft plan</strong>
        <span className="muted" style={{ marginLeft: '0.5rem' }}>started {formatDate(plan.createdAt)}</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.day}</td>
              <td style={{ padding: '0.35rem 0', color: 'var(--color-muted)' }}>{item.mainLunch.name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmDiscard ? (
        <div>
          <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Discard this plan and start over?
          </p>
          <div className="row">
            <button onClick={() => setConfirmDiscard(false)}>Keep it</button>
            <button className="danger" onClick={onDiscard}>Discard</button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="primary" onClick={onContinue}>
            {plan.groceryList ? 'View grocery list →' : 'Continue planning →'}
          </button>
          <button onClick={() => setConfirmDiscard(true)}>Start over</button>
        </div>
      )}
    </div>
  );
}

type HistoryView = { planId: string } | null;

export default function Home() {
  const navigate = useNavigate();
  const { kid } = useKid();
  const { draftPlan, finalizedPlans } = usePlan();
  const { discardDraft: ctxDiscard } = useApp();
  const [historyView, setHistoryView] = useState<HistoryView>(null);

  const viewedPlan = historyView
    ? finalizedPlans.find((p) => p.id === historyView.planId)
    : null;

  if (viewedPlan) {
    return (
      <div>
        <div className="page" style={{ paddingBottom: '1rem' }}>
          <button onClick={() => setHistoryView(null)} style={{ marginBottom: '1rem' }}>← Back</button>
        </div>
        <PlanReview readonly plan={viewedPlan} />
      </div>
    );
  }

  const handleContinueDraft = () => {
    if (!draftPlan) return;
    if (draftPlan.groceryList) {
      navigate('/plan/grocery');
    } else {
      navigate('/plan/review');
    }
  };

  const handleDiscardDraft = () => {
    ctxDiscard();
  };

  const handleStartNew = () => {
    if (draftPlan) return; // handled by DraftSummary
    navigate('/plan/new');
  };

  return (
    <div className="page">
      {kid && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="row">
            <div>
              <strong>{kid.name}</strong>
              <span className="muted" style={{ marginLeft: '0.5rem' }}>age {kid.age}</span>
            </div>
            <Link to="/settings" style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>Edit</Link>
          </div>
          {kid.allergies.length > 0 && (
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
              Allergies: {kid.allergies.join(', ')}
            </p>
          )}
        </div>
      )}

      {draftPlan ? (
        <DraftSummary
          plan={draftPlan}
          onContinue={handleContinueDraft}
          onDiscard={handleDiscardDraft}
        />
      ) : (
        <button className="primary" onClick={handleStartNew} style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}>
          Start this week's plan →
        </button>
      )}

      {finalizedPlans.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Plan history</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {finalizedPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setHistoryView({ planId: plan.id })}
                style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>{plan.days.slice(0, 3).join(', ')}{plan.days.length > 3 ? '…' : ''}</span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>{formatDate(plan.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
