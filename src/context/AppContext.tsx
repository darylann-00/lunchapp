import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Kid, ParentPrefs, WeeklyPlan, LunchItem, GroceryItem } from '../types';
import * as storage from '../lib/storage';

type AppContextValue = {
  kids: Kid[];
  parentPrefs: ParentPrefs | null;
  plans: WeeklyPlan[];
  saveKid: (kid: Kid) => void;
  saveParentPrefs: (prefs: ParentPrefs) => void;
  savePlan: (weekStartDate: string, days: string[], sessionNotes: string, items: LunchItem[]) => WeeklyPlan;
  updatePlanItems: (planId: string, items: LunchItem[]) => void;
  setGroceryList: (planId: string, list: GroceryItem[]) => void;
  deletePlan: (planId: string) => void;
  clearAll: () => void;
  storageError: string | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [kids, setKids] = useState<Kid[]>(() => storage.getKids());
  const [parentPrefs, setParentPrefs] = useState<ParentPrefs | null>(() => storage.getParentPrefs());
  const [plans, setPlans] = useState<WeeklyPlan[]>(() => storage.getPlans());
  const [storageError, setStorageError] = useState<string | null>(null);

  const persist = useCallback(<T,>(fn: () => T): T => {
    try {
      const result = fn();
      setStorageError(null);
      return result;
    } catch (e) {
      if (e instanceof Error && e.message === 'QUOTA_EXCEEDED') {
        setStorageError('Storage is full. Delete old plans in Settings to free space.');
      }
      throw e;
    }
  }, []);

  const saveKid = useCallback((kid: Kid) => {
    persist(() => storage.saveKid(kid));
    setKids(storage.getKids());
  }, [persist]);

  const saveParentPrefs = useCallback((prefs: ParentPrefs) => {
    persist(() => storage.saveParentPrefs(prefs));
    setParentPrefs(prefs);
  }, [persist]);

  const savePlan = useCallback((weekStartDate: string, days: string[], sessionNotes: string, items: LunchItem[]): WeeklyPlan => {
    // replace any existing plan for this week
    const existing = storage.getPlans().find((p) => p.weekStartDate === weekStartDate);
    if (existing) storage.deletePlan(existing.id);

    const plan: WeeklyPlan = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      weekStartDate,
      status: 'final',
      days,
      items,
      groceryList: null,
      sessionNotes,
    };
    persist(() => storage.savePlan(plan));
    setPlans(storage.getPlans());
    return plan;
  }, [persist]);

  const updatePlanItems = useCallback((planId: string, items: LunchItem[]) => {
    const allPlans = storage.getPlans();
    const plan = allPlans.find((p) => p.id === planId);
    if (!plan) return;
    persist(() => storage.savePlan({ ...plan, items }));
    setPlans(storage.getPlans());
  }, [persist]);

  const setGroceryList = useCallback((planId: string, list: GroceryItem[]) => {
    const allPlans = storage.getPlans();
    const plan = allPlans.find((p) => p.id === planId);
    if (!plan) return;
    persist(() => storage.savePlan({ ...plan, groceryList: list }));
    setPlans(storage.getPlans());
  }, [persist]);

  const deletePlan = useCallback((planId: string) => {
    storage.deletePlan(planId);
    setPlans(storage.getPlans());
  }, []);

  const clearAll = useCallback(() => {
    storage.clearAll();
    setKids([]);
    setParentPrefs(null);
    setPlans([]);
  }, []);

  return (
    <AppContext.Provider value={{
      kids,
      parentPrefs,
      plans,
      saveKid,
      saveParentPrefs,
      savePlan,
      updatePlanItems,
      setGroceryList,
      deletePlan,
      clearAll,
      storageError,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
