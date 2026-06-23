import { useState } from 'react';
import type { Kid, ParentPrefs } from '../types';
import { SLOT_LABELS, SLOT_ICON } from '../types';
import FoodIcon from './FoodIcon';
import UiIcon from './UiIcon';
import Onboarding, { DIETARY_OPTIONS } from '../pages/Onboarding';

type Props = {
  kid: Kid | null;
  prefs: ParentPrefs | null;
  onSaved: () => void;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-fredoka font-bold text-luncharoo-dark/50 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-fredoka font-semibold text-luncharoo-dark">
        {value || <span className="text-slate-300 font-normal">—</span>}
      </span>
    </div>
  );
}

export default function ProfileTab({ kid, prefs, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSaved = () => {
    setSavedFlash(true);
    setEditing(false);
    onSaved();
    setTimeout(() => setSavedFlash(false), 2500);
  };

  if (!kid) {
    return (
      <div className="bg-white luncharoo-border rounded-2xl luncharoo-shadow p-6 text-center">
        <p className="font-fredoka text-luncharoo-dark/50 text-sm">No profile set up yet.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-white luncharoo-border rounded-2xl luncharoo-shadow overflow-hidden">
          <div className="bg-luncharoo-yellow/20 px-4 py-3 border-b-2 border-luncharoo-dark/20 flex items-center justify-between">
            <h2 className="font-fredoka text-base font-bold text-luncharoo-dark">Edit profile</h2>
            <button
              onClick={() => setEditing(false)}
              className="text-xs font-fredoka font-bold text-slate-400 hover:text-luncharoo-dark"
            >
              Cancel
            </button>
          </div>
          <div className="px-4 py-4">
            <Onboarding
              prefillKid={kid}
              prefillPrefs={prefs ?? undefined}
              onSaved={handleSaved}
              compact
            />
          </div>
        </div>
      </div>
    );
  }

  // Active dietary restrictions
  const activeRestrictions = DIETARY_OPTIONS.filter((opt) => {
    if ('allergen' in opt) return kid.allergies.includes((opt as { allergen: string }).allergen);
    if ('special' in opt) {
      const o = opt as { special: 'vegetarian' | 'vegan' };
      if (o.special === 'vegan') return kid.isVegan;
      if (o.special === 'vegetarian') return kid.isVegetarian;
    }
    return false;
  });

  return (
    <div className="flex flex-col gap-3">
      {savedFlash && (
        <div className="bg-green-50 luncharoo-border border-green-400 rounded-2xl px-4 py-2.5 text-xs font-fredoka font-bold text-green-700 flex items-center gap-2">
          <UiIcon name="check" size={16} /> Profile saved!
        </div>
      )}

      {/* Header card */}
      <div className="bg-white luncharoo-border rounded-2xl luncharoo-shadow overflow-hidden">
        <div className="bg-luncharoo-blue/20 px-4 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-luncharoo-blue/30 luncharoo-border flex-shrink-0 flex items-center justify-center select-none">
            <UiIcon name="kid" size={30} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-fredoka text-lg font-bold text-luncharoo-dark leading-tight truncate">
              {kid.name}
            </p>
            <p className="text-xs font-fredoka text-luncharoo-dark/60">
              {kid.age} year{kid.age !== 1 ? 's' : ''} old
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="flex-shrink-0 bg-luncharoo-yellow luncharoo-border rounded-xl px-3 py-1.5 text-xs font-fredoka font-bold text-luncharoo-dark luncharoo-shadow-sm luncharoo-press"
          >
            Edit
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4 border-t-2 border-luncharoo-dark/10">
          {/* Dietary restrictions */}
          <div>
            <span className="text-[10px] font-fredoka font-bold text-luncharoo-dark/50 uppercase tracking-wider block mb-2">
              Dietary restrictions
            </span>
            {activeRestrictions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeRestrictions.map((opt) => (
                  <span
                    key={opt.id}
                    className="bg-luncharoo-dark text-white text-xs font-fredoka font-bold px-2.5 py-1 rounded-lg"
                  >
                    {opt.label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm font-fredoka text-slate-300">None</span>
            )}
          </div>

          {/* Likes / dislikes */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow
              label="Favourite foods"
              value={kid.likes.join(', ')}
            />
            <InfoRow
              label="Foods to avoid"
              value={kid.dislikes.join(', ')}
            />
          </div>

          {/* School rules */}
          {kid.schoolOrCampRules && (
            <InfoRow label="School / camp rules" value={kid.schoolOrCampRules} />
          )}

          {/* Lunchbox slots */}
          {prefs && (
            <div>
              <span className="text-[10px] font-fredoka font-bold text-luncharoo-dark/50 uppercase tracking-wider block mb-2">
                Lunchbox slots
              </span>
              <div className="flex flex-wrap gap-1.5">
                {prefs.lunchboxSlots.map((slot) => (
                  <span
                    key={slot}
                    className="bg-luncharoo-dark text-white text-xs font-fredoka font-bold px-2.5 py-1 rounded-lg"
                  >
                    <FoodIcon name={SLOT_ICON[slot]} size={14} /> {SLOT_LABELS[slot]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Thermos + Snacks */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-4 rounded-full border-2 border-luncharoo-dark/30 relative flex-shrink-0 ${
                  prefs?.hasThermos ? 'bg-luncharoo-dark' : 'bg-luncharoo-dark/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white border border-luncharoo-dark/20 shadow transition-all ${
                    prefs?.hasThermos ? 'left-[calc(100%-0.75rem)]' : 'left-0.5'
                  }`}
                />
              </span>
              <span className="text-xs font-fredoka font-semibold text-luncharoo-dark/70">
                {prefs?.hasThermos ? <><FoodIcon name="miso-soup" size={14} /> Thermos</> : 'No thermos'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-4 rounded-full border-2 border-luncharoo-dark/30 relative flex-shrink-0 ${
                  kid.needsSnacks ? 'bg-luncharoo-dark' : 'bg-luncharoo-dark/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white border border-luncharoo-dark/20 shadow transition-all ${
                    kid.needsSnacks ? 'left-[calc(100%-0.75rem)]' : 'left-0.5'
                  }`}
                />
              </span>
              <span className="text-xs font-fredoka font-semibold text-luncharoo-dark/70">
                {kid.needsSnacks ? <><FoodIcon name="apple" size={14} /> Snacks</> : 'No snacks'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-luncharoo-beige luncharoo-border rounded-2xl px-4 py-3 text-xs text-slate-500 text-center">
        Changes apply to the{' '}
        <span className="font-bold text-luncharoo-dark">next plan</span> you generate.
      </div>
    </div>
  );
}
