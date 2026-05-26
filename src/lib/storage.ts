import type { Kid, ParentPrefs, WeeklyPlan } from '../types';

const KEYS = {
  kids: 'lunchplanner:kids',
  parentPrefs: 'lunchplanner:parentPrefs',
  plans: 'lunchplanner:plans',
} as const;

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('QUOTA_EXCEEDED');
    }
    throw e;
  }
}

export function getKids(): Kid[] {
  return get<Kid[]>(KEYS.kids) ?? [];
}

export function saveKids(kids: Kid[]): void {
  set(KEYS.kids, kids);
}

export function getKid(id: string): Kid | null {
  return getKids().find((k) => k.id === id) ?? null;
}

export function saveKid(kid: Kid): void {
  const kids = getKids();
  const idx = kids.findIndex((k) => k.id === kid.id);
  if (idx >= 0) {
    kids[idx] = kid;
  } else {
    kids.push(kid);
  }
  saveKids(kids);
}

export function getParentPrefs(): ParentPrefs | null {
  return get<ParentPrefs>(KEYS.parentPrefs);
}

export function saveParentPrefs(prefs: ParentPrefs): void {
  set(KEYS.parentPrefs, prefs);
}

export function getPlans(): WeeklyPlan[] {
  return get<WeeklyPlan[]>(KEYS.plans) ?? [];
}

export function savePlans(plans: WeeklyPlan[]): void {
  set(KEYS.plans, plans);
}

export function getDraftPlan(): WeeklyPlan | null {
  return getPlans().find((p) => p.status === 'draft') ?? null;
}

export function savePlan(plan: WeeklyPlan): void {
  const plans = getPlans();
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) {
    plans[idx] = plan;
  } else {
    plans.push(plan);
  }
  savePlans(plans);
}

export function deletePlan(id: string): void {
  savePlans(getPlans().filter((p) => p.id !== id));
}

export function clearAll(): void {
  localStorage.removeItem(KEYS.kids);
  localStorage.removeItem(KEYS.parentPrefs);
  localStorage.removeItem(KEYS.plans);
}
