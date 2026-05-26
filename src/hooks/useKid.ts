import { useApp } from '../context/AppContext';
import type { Kid } from '../types';

export function useKid() {
  const { kids, saveKid } = useApp();
  const kid = kids[0] ?? null;

  const updateKid = (updates: Partial<Kid>) => {
    if (!kid) return;
    saveKid({ ...kid, ...updates });
  };

  return { kid, saveKid, updateKid };
}
