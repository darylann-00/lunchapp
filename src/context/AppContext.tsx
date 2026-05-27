import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Kid, ParentPrefs, WeeklyPlan, LunchItem, GroceryItem } from '../types';
import { supabase } from '../lib/supabase';

type AppContextValue = {
  kids: Kid[];
  parentPrefs: ParentPrefs | null;
  plans: WeeklyPlan[];
  loading: boolean;
  saveKid: (kid: Kid) => Promise<void>;
  saveParentPrefs: (prefs: ParentPrefs) => Promise<void>;
  savePlan: (weekStartDate: string, days: string[], sessionNotes: string, items: LunchItem[]) => Promise<WeeklyPlan>;
  updatePlanItems: (planId: string, items: LunchItem[]) => Promise<void>;
  setGroceryList: (planId: string, list: GroceryItem[]) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  storageError: string | null;
};

const AppContext = createContext<AppContextValue | null>(null);

type DbPlan = {
  id: string;
  user_id: string;
  week_start_date: string;
  status: 'draft' | 'final';
  days: string[];
  items: LunchItem[];
  grocery_list: GroceryItem[] | null;
  session_notes: string;
  created_at: string;
};

function dbPlanToWeeklyPlan(row: DbPlan): WeeklyPlan {
  return {
    id: row.id,
    createdAt: row.created_at,
    weekStartDate: row.week_start_date,
    status: row.status,
    days: row.days,
    items: row.items,
    groceryList: row.grocery_list,
    sessionNotes: row.session_notes,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [kids, setKids] = useState<Kid[]>([]);
  const [parentPrefs, setParentPrefs] = useState<ParentPrefs | null>(null);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Track auth session; load data when user signs in, clear when they sign out.
  useEffect(() => {
    let active = true;

    const loadForUser = async (uid: string) => {
      setLoading(true);
      try {
        const [{ data: profile, error: profErr }, { data: planRows, error: plansErr }] = await Promise.all([
          supabase.from('profiles').select('kid, parent_prefs').eq('id', uid).maybeSingle(),
          supabase.from('weekly_plans').select('*').eq('user_id', uid).order('week_start_date', { ascending: false }),
        ]);
        if (!active) return;
        if (profErr) throw profErr;
        if (plansErr) throw plansErr;

        setKids(profile?.kid ? [profile.kid as Kid] : []);
        setParentPrefs((profile?.parent_prefs as ParentPrefs | undefined) ?? null);
        setPlans((planRows ?? []).map((r) => dbPlanToWeeklyPlan(r as DbPlan)));
        setStorageError(null);
      } catch (e) {
        if (active) setStorageError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) loadForUser(uid);
      else setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        loadForUser(uid);
      } else {
        setKids([]);
        setParentPrefs(null);
        setPlans([]);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const wrap = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      const result = await fn();
      setStorageError(null);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      setStorageError(msg);
      throw e;
    }
  }, []);

  const saveKid = useCallback(async (kid: Kid) => {
    if (!userId) throw new Error('Not signed in');
    await wrap(async () => {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, kid, updated_at: new Date().toISOString() });
      if (error) throw error;
    });
    setKids([kid]);
  }, [userId, wrap]);

  const saveParentPrefs = useCallback(async (prefs: ParentPrefs) => {
    if (!userId) throw new Error('Not signed in');
    await wrap(async () => {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, parent_prefs: prefs, updated_at: new Date().toISOString() });
      if (error) throw error;
    });
    setParentPrefs(prefs);
  }, [userId, wrap]);

  const savePlan = useCallback(async (
    weekStartDate: string,
    days: string[],
    sessionNotes: string,
    items: LunchItem[]
  ): Promise<WeeklyPlan> => {
    if (!userId) throw new Error('Not signed in');
    const row = await wrap(async () => {
      const { data, error } = await supabase
        .from('weekly_plans')
        .upsert({
          user_id: userId,
          week_start_date: weekStartDate,
          status: 'final' as const,
          days,
          items,
          grocery_list: null,
          session_notes: sessionNotes,
        }, { onConflict: 'user_id,week_start_date' })
        .select()
        .single();
      if (error) throw error;
      return data as DbPlan;
    });
    const plan = dbPlanToWeeklyPlan(row);
    setPlans((prev) => [plan, ...prev.filter((p) => p.weekStartDate !== weekStartDate)]);
    return plan;
  }, [userId, wrap]);

  const updatePlanItems = useCallback(async (planId: string, items: LunchItem[]) => {
    await wrap(async () => {
      const { error } = await supabase.from('weekly_plans').update({ items }).eq('id', planId);
      if (error) throw error;
    });
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, items } : p)));
  }, [wrap]);

  const setGroceryList = useCallback(async (planId: string, list: GroceryItem[]) => {
    await wrap(async () => {
      const { error } = await supabase.from('weekly_plans').update({ grocery_list: list }).eq('id', planId);
      if (error) throw error;
    });
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, groceryList: list } : p)));
  }, [wrap]);

  const deletePlan = useCallback(async (planId: string) => {
    await wrap(async () => {
      const { error } = await supabase.from('weekly_plans').delete().eq('id', planId);
      if (error) throw error;
    });
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }, [wrap]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await wrap(async () => {
      const [{ error: planErr }, { error: profErr }] = await Promise.all([
        supabase.from('weekly_plans').delete().eq('user_id', userId),
        supabase.from('profiles').delete().eq('id', userId),
      ]);
      if (planErr) throw planErr;
      if (profErr) throw profErr;
    });
    setKids([]);
    setParentPrefs(null);
    setPlans([]);
  }, [userId, wrap]);

  return (
    <AppContext.Provider value={{
      kids,
      parentPrefs,
      plans,
      loading,
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

