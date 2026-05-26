import { useState } from 'react';
import type { Kid, ParentPrefs } from '../types';
import Onboarding from '../pages/Onboarding';

type Props = {
  kid: Kid | null;
  prefs: ParentPrefs | null;
  onSaved: () => void;
};

export default function ProfileTab({ kid, prefs, onSaved }: Props) {
  const [saved, setSaved] = useState(false);

  const handleSaved = () => {
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white moku-border rounded-2xl moku-shadow overflow-hidden">
        <div className="bg-moku-yellow/20 px-4 py-3 border-b-2 border-moku-dark/20">
          <h2 className="font-fredoka text-base font-bold text-moku-dark flex items-center gap-2">
            <span className="text-lg">⚙️</span> Kid Profile & Preferences
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            These settings shape every lunch plan BentoBot generates.
          </p>
        </div>

        <div className="px-4 py-4">
          {saved && (
            <div className="mb-3 bg-green-50 border-2 border-green-400 rounded-xl px-3 py-2 text-xs font-fredoka font-bold text-green-700 flex items-center gap-2">
              ✅ Profile saved!
            </div>
          )}
          <Onboarding
            prefillKid={kid ?? undefined}
            prefillPrefs={prefs ?? undefined}
            onSaved={handleSaved}
          />
        </div>
      </div>

      {kid && (
        <div className="bg-moku-beige moku-border rounded-2xl px-4 py-3 text-xs text-slate-500 text-center">
          Changes apply to the <span className="font-bold text-moku-dark">next plan</span> you generate — existing plans are not affected.
        </div>
      )}
    </div>
  );
}
