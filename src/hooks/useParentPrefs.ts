import { useApp } from '../context/AppContext';

export function useParentPrefs() {
  const { parentPrefs, saveParentPrefs } = useApp();
  return { parentPrefs, saveParentPrefs };
}
