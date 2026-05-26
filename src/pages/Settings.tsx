import { useKid } from '../hooks/useKid';
import { useParentPrefs } from '../hooks/useParentPrefs';
import { useApp } from '../context/AppContext';
import Onboarding from './Onboarding';

export default function Settings() {
  const { kid } = useKid();
  const { parentPrefs } = useParentPrefs();
  const { clearAll } = useApp();

  const handleClearAll = () => {
    if (window.confirm('Clear all data? This will delete your kid profile, preferences, and all plan history. This cannot be undone.')) {
      clearAll();
      window.location.href = '/onboarding';
    }
  };

  return (
    <div>
      <Onboarding prefillKid={kid ?? undefined} prefillPrefs={parentPrefs ?? undefined} />
      <div className="page" style={{ paddingTop: 0 }}>
        <hr className="section-divider" />
        <h2 style={{ color: 'var(--color-danger)' }}>Danger zone</h2>
        <button className="danger" onClick={handleClearAll}>Clear all data</button>
      </div>
    </div>
  );
}
