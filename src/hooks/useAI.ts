import { useState } from 'react';
import type { Kid, ParentPrefs, WeeklyPlan, ParsedSession, SlotCategory, Ingredient, ComponentTags } from '../types';
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

type RegenerateResult = {
  name: string;
  category: SlotCategory;
  ingredients: Ingredient[];
  alsoFills?: SlotCategory[];
  canBeSnack: boolean;
  note?: string;
  tags: ComponentTags;
};

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
    (plan: WeeklyPlan) => ai.aggregateGroceryList(plan)
  );

  const regenerateSlot = useAICall(
    (args: Parameters<typeof ai.regenerateSlot>[0]) => ai.regenerateSlot(args)
  );

  return { parseNotes, generatePlan, generateGrocery, regenerateSlot };
}

export function useSlotRegenerate() {
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});

  const regenerate = async (
    slotKey: string,
    args: Parameters<typeof ai.regenerateSlot>[0]
  ): Promise<RegenerateResult | null> => {
    setLoadingIds((prev) => ({ ...prev, [slotKey]: true }));
    setErrorIds((prev) => { const n = { ...prev }; delete n[slotKey]; return n; });
    try {
      const result = await ai.regenerateSlot(args);
      setLoadingIds((prev) => ({ ...prev, [slotKey]: false }));
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Regenerate failed';
      setLoadingIds((prev) => ({ ...prev, [slotKey]: false }));
      setErrorIds((prev) => ({ ...prev, [slotKey]: msg }));
      return null;
    }
  };

  return { loadingIds, errorIds, regenerate };
}
