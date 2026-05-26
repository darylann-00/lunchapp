import { useApp } from '../context/AppContext';
import type { LunchItem, GroceryItem } from '../types';

export function usePlan() {
  const { plans, createDraftPlan, updatePlanItems, setGroceryList, finalizePlan, discardDraft } = useApp();

  const draftPlan = plans.find((p) => p.status === 'draft') ?? null;
  const finalizedPlans = plans.filter((p) => p.status === 'final').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const updateItem = (planId: string, updatedItem: LunchItem) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    const items = plan.items.map((item) => (item.id === updatedItem.id ? updatedItem : item));
    updatePlanItems(planId, items);
  };

  const saveGroceryList = (planId: string, list: GroceryItem[]) => {
    setGroceryList(planId, list);
  };

  return {
    draftPlan,
    finalizedPlans,
    plans,
    createDraftPlan,
    updateItem,
    updatePlanItems,
    saveGroceryList,
    finalizePlan,
    discardDraft,
  };
}
