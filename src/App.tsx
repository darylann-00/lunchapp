import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { useKid } from './hooks/useKid';
import { useParentPrefs } from './hooks/useParentPrefs';
import Onboarding from './pages/Onboarding';
import LunchPlanTab from './components/LunchPlanTab';
import GroceryTab from './components/GroceryTab';
import ProfileTab from './components/ProfileTab';
import WizardOverlay from './components/WizardOverlay';
import EditDayModal from './components/EditDayModal';
import { getMondayISO, addWeeks, formatWeekRange, weekRelativeLabel } from './lib/dateUtils';
import type { LunchItem } from './types';
import './index.css';

type Tab = 'lunch' | 'grocery' | 'profile';

function RequireKid({ children }: { children: React.ReactNode }) {
  const { kids } = useApp();
  if (kids.length === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function BentoShell() {
  const { plans, savePlan, updatePlanItems, storageError } = useApp();
  const { kid } = useKid();
  const { parentPrefs: prefs } = useParentPrefs();

  const [activeTab, setActiveTab] = useState<Tab>('lunch');
  const [weekStart, setWeekStart] = useState(getMondayISO(new Date()));
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LunchItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.weekStartDate === weekStart) ?? null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleCommitPlan = (weekStartDate: string, days: string[], notes: string, items: LunchItem[]) => {
    savePlan(weekStartDate, days, notes, items);
    setWizardOpen(false);
    setActiveTab('lunch');
    showToast('✨ Plan saved for this week!');
  };

  const handleSaveItem = (updated: LunchItem) => {
    if (!activePlan) return;
    const newItems = activePlan.items.map((i) => (i.id === updated.id ? updated : i));
    updatePlanItems(activePlan.id, newItems);
    showToast('✅ Day updated!');
  };

  // All dishes across the week (for regenerate context)
  const allOtherDishes = activePlan
    ? activePlan.items.flatMap((i) => [...i.lunches, ...i.snacks])
    : [];

  const TAB_BTNS: { id: Tab; icon: string; label: string }[] = [
    { id: 'lunch', icon: '🍱', label: 'Lunch Plan' },
    { id: 'grocery', icon: '🛒', label: 'Grocery' },
    { id: 'profile', icon: '⚙️', label: 'Profile' },
  ];

  // Bounce animation for FAB
  const [fabBounce, setFabBounce] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setFabBounce(false), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="craft-bg min-h-screen flex justify-center items-center p-2 sm:p-4 overflow-x-hidden antialiased">
      <div className="w-full max-w-md h-[92vh] sm:h-[820px] bg-moku-beige flex flex-col relative shadow-2xl moku-border rounded-[32px] overflow-hidden">

        {/* Announcement strip */}
        <div className="bg-moku-coral text-white font-fredoka font-bold text-[10px] py-1.5 px-3 text-center tracking-wider border-b-2 border-moku-dark relative z-30 select-none">
          🌈 AI LUNCH BOX ASSISTANT FOR KIDS
        </div>

        {/* Header */}
        <header className="bg-moku-blue moku-border-b relative pt-3 pb-6 px-4 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Logo */}
              <div className="bg-moku-yellow moku-border rounded-xl p-1.5 moku-shadow-sm flex items-center justify-center -rotate-3">
                <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="15" y="25" width="70" height="60" rx="15" fill="#f36c57" stroke="#134e9e" strokeWidth="7" />
                  <rect x="35" y="10" width="30" height="15" rx="5" fill="#f9a65d" stroke="#134e9e" strokeWidth="7" />
                  <rect x="25" y="35" width="50" height="40" rx="8" fill="#fff" stroke="#134e9e" strokeWidth="4" />
                  <circle cx="40" cy="50" r="5.5" fill="#134e9e" />
                  <circle cx="60" cy="50" r="5.5" fill="#134e9e" />
                  <path d="M43,62 Q50,67 57,62" stroke="#134e9e" strokeWidth="4" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <div>
                <h1 className="font-fredoka text-xl font-bold text-white tracking-wide drop-shadow-[1.5px_1.5px_0px_#134e9e]">
                  BentoBot!
                </h1>
                {kid && (
                  <span className="text-[9px] font-fredoka text-moku-dark bg-white/95 px-2 py-0.5 rounded-full inline-block font-semibold">
                    👧 {kid.name}
                  </span>
                )}
              </div>
            </div>

            {/* Week nav (only show on lunch tab) */}
            {activeTab === 'lunch' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setWeekStart((w) => addWeeks(w, -1))}
                  className="w-8 h-8 bg-moku-blue/80 border-2 border-white/50 text-white rounded-xl flex items-center justify-center font-bold moku-press hover:bg-white/20 text-sm"
                >
                  ‹
                </button>
                <div className="text-center min-w-[90px]">
                  <p className="text-[8px] font-fredoka font-bold text-moku-coral uppercase tracking-wider leading-none">
                    {weekRelativeLabel(weekStart)}
                  </p>
                  <p className="font-fredoka text-[11px] font-bold text-white leading-tight">
                    {formatWeekRange(weekStart)}
                  </p>
                </div>
                <button
                  onClick={() => setWeekStart((w) => addWeeks(w, 1))}
                  className="w-8 h-8 bg-moku-blue/80 border-2 border-white/50 text-white rounded-xl flex items-center justify-center font-bold moku-press hover:bg-white/20 text-sm"
                >
                  ›
                </button>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-3.5 scallop-wave" />
        </header>

        {/* Storage error banner */}
        {storageError && (
          <div className="bg-red-100 border-b-2 border-red-400 px-4 py-2 text-xs text-red-700 font-semibold z-20">
            ⚠️ {storageError}
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-20 z-10">
          {activeTab === 'lunch' && (
            <LunchPlanTab
              plan={activePlan}
              weekStartDate={weekStart}
              onEditDay={setEditingItem}
              onGenerateClick={() => setWizardOpen(true)}
            />
          )}
          {activeTab === 'grocery' && (
            <GroceryTab showToast={showToast} />
          )}
          {activeTab === 'profile' && (
            <ProfileTab
              kid={kid}
              prefs={prefs}
              onSaved={() => showToast('✅ Profile saved!')}
            />
          )}
        </div>

        {/* FAB */}
        {activeTab === 'lunch' && (
          <button
            onClick={() => setWizardOpen(true)}
            className={`absolute bottom-20 right-4 z-30 bg-moku-yellow text-moku-dark moku-border rounded-full px-4 py-3 moku-shadow moku-press flex items-center gap-2 font-fredoka text-xs font-bold hover:bg-amber-400 ${fabBounce ? 'animate-bounce' : ''}`}
          >
            <span>✨</span>
            <span>New Plan</span>
          </button>
        )}

        {/* Bottom nav */}
        <nav className="bg-white moku-border-t h-16 flex items-center justify-around px-4 relative z-20 select-none">
          {TAB_BTNS.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                activeTab === id
                  ? 'text-moku-dark bg-moku-beige/60 font-bold scale-105'
                  : 'text-slate-400'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-[9px] font-fredoka font-bold tracking-wide">{label}</span>
            </button>
          ))}
        </nav>

        {/* Wizard overlay */}
        {wizardOpen && kid && prefs && (
          <WizardOverlay
            weekStartDate={weekStart}
            kid={kid}
            prefs={prefs}
            onClose={() => setWizardOpen(false)}
            onCommit={handleCommitPlan}
          />
        )}

        {/* Edit day modal */}
        {editingItem && kid && prefs && activePlan && (
          <EditDayModal
            item={editingItem}
            kid={kid}
            prefs={prefs}
            sessionNotes={activePlan.sessionNotes}
            otherDishes={allOtherDishes.filter(
              (d) => !editingItem.lunches.find((l) => l.id === d.id) &&
                     !editingItem.snacks.find((s) => s.id === d.id)
            )}
            onSave={handleSaveItem}
            onClose={() => setEditingItem(null)}
          />
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-moku-dark text-white text-[10px] font-fredoka font-bold py-2 px-4 rounded-full border-2 border-white shadow-xl z-50 flex items-center gap-2 whitespace-nowrap">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<RequireKid><BentoShell /></RequireKid>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
