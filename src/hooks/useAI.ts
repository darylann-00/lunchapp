import { useState } from 'react';
import type { Kid, ParentPrefs, WeeklyPlan, ParsedSession, LunchItem, Dish } from '../types';
import * as ai from '../lib/ai';

type AIState = {
  loading: boolean;
  error: string | null;
};

function useAICall<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  const [state, setState] = useState<AIState>({ loading: false, error: null });

  const call = async (...args: TArgs): Promise<TResult | null> => {
    setState({ loading: true, error: null });
    try {
      const result = await fn(...args);
      setState({ loading: false, error: null });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong — try again';
      setState({ loading: false, error: msg });
      return null;
    }
  };

  return { ...state, call };
}

export function useAI() {
  const parseNotes = useAICall(
    (notes: string, days: string[], kid: Kid, prefs: ParentPrefs) =>
      ai.parseWeeklyNotes(notes, days, kid, prefs)
  );

  const generatePlan = useAICall(
    (session: ParsedSession, kid: Kid, prefs: ParentPrefs) =>
      ai.generateWeeklyPlan(session, kid, prefs)
  );

  const generateGrocery = useAICall(
    (plans: WeeklyPlan[], kid: Kid, prefs: ParentPrefs) =>
      ai.generateGroceryList(plans, kid, prefs)
  );

  const regenerateDish = useAICall(
    (args: {
      kid: Kid;
      parentPrefs: ParentPrefs;
      sessionNotes: string;
      day: string;
      mealType: 'lunch' | 'snack' | 'side';
      currentDish: Dish;
      userNote: string;
      otherDishesThisWeek: Dish[];
    }) => ai.regenerateDish(args)
  );

  return { parseNotes, generatePlan, generateGrocery, regenerateDish };
}

export function useItemRegenerate(_planItems: LunchItem[]) {
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});

  const regenerate = async (
    dishId: string,
    args: Parameters<typeof ai.regenerateDish>[0]
  ): Promise<Dish | null> => {
    setLoadingIds((prev) => ({ ...prev, [dishId]: true }));
    setErrorIds((prev) => { const n = { ...prev }; delete n[dishId]; return n; });
    try {
      const result = await ai.regenerateDish(args);
      setLoadingIds((prev) => ({ ...prev, [dishId]: false }));
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Regenerate failed';
      setLoadingIds((prev) => ({ ...prev, [dishId]: false }));
      setErrorIds((prev) => ({ ...prev, [dishId]: msg }));
      return null;
    }
  };

  return { loadingIds, errorIds, regenerate };
}
