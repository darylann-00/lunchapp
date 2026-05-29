import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext';
import type { Kid, ParentPrefs } from '../types';

export const DIETARY_OPTIONS = [
  { id: 'peanut-free', label: 'Peanut-free', allergen: 'peanuts' },
  { id: 'tree-nut-free', label: 'Tree-nut-free', allergen: 'tree nuts' },
  { id: 'dairy-free', label: 'Dairy-free', allergen: 'dairy' },
  { id: 'gluten-free', label: 'Gluten-free', allergen: 'gluten' },
  { id: 'egg-free', label: 'Egg-free', allergen: 'eggs' },
  { id: 'fish-free', label: 'Fish-free', allergen: 'fish' },
  { id: 'shellfish-free', label: 'Shellfish-free', allergen: 'shellfish' },
  { id: 'soy-free', label: 'Soy-free', allergen: 'soy' },
  { id: 'sesame-free', label: 'Sesame-free', allergen: 'sesame' },
  { id: 'red-meat-free', label: 'Red meat-free', allergen: 'red meat' },
  { id: 'pork-free', label: 'Pork-free', allergen: 'pork' },
  { id: 'vegetarian', label: 'Vegetarian', special: 'vegetarian' as const },
  { id: 'vegan', label: 'Vegan', special: 'vegan' as const },
] as const;

type DietaryOption = (typeof DIETARY_OPTIONS)[number];

function ageFromBirth(month: number, year: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month) age--;
  return Math.max(1, age);
}

function buildInitialRestrictions(kid?: Kid): Set<string> {
  if (!kid) return new Set();
  const s = new Set<string>();
  for (const opt of DIETARY_OPTIONS) {
    if ('allergen' in opt && kid.allergies.includes((opt as { allergen: string }).allergen)) {
      s.add(opt.id);
    }
    if ('special' in opt) {
      const o = opt as { id: string; special: 'vegetarian' | 'vegan' };
      if (o.special === 'vegetarian' && kid.isVegetarian) s.add(opt.id);
      if (o.special === 'vegan' && kid.isVegan) s.add(opt.id);
    }
  }
  return s;
}

function parseCSV(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
  prefillKid?: Kid;
  prefillPrefs?: ParentPrefs;
  onSaved?: () => void;
  compact?: boolean;
};

function ProgressIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center">
          {n > 1 && (
            <div
              className={`w-8 h-0.5 ${n <= step ? 'bg-luncharoo-dark' : 'bg-luncharoo-dark/20'}`}
            />
          )}
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-fredoka font-bold border-[2.5px] transition-all ${
              n < step
                ? 'bg-luncharoo-dark text-white border-luncharoo-dark'
                : n === step
                ? 'bg-luncharoo-yellow text-luncharoo-dark border-luncharoo-dark shadow-[2px_2px_0px_#134e9e]'
                : 'bg-white text-luncharoo-dark/30 border-luncharoo-dark/25'
            }`}
          >
            {n < step ? '✓' : n}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Onboarding({ prefillKid, prefillPrefs, onSaved, compact }: Props) {
  const { saveKid, saveParentPrefs } = useApp();
  const navigate = useNavigate();
  const isEdit = !!prefillKid;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState(prefillKid?.name ?? '');
  const currentYear = new Date().getFullYear();
  const [birthMonth, setBirthMonth] = useState<number>(1);
  const [birthYear, setBirthYear] = useState<number>(
    prefillKid ? currentYear - prefillKid.age : currentYear - 6,
  );

  // Step 2
  const [restrictions, setRestrictions] = useState<Set<string>>(
    () => buildInitialRestrictions(prefillKid),
  );

  // Step 3
  const [likesRaw, setLikesRaw] = useState(prefillKid?.likes.join(', ') ?? '');
  const [dislikesRaw, setDislikesRaw] = useState(prefillKid?.dislikes.join(', ') ?? '');
  const [schoolRules, setSchoolRules] = useState(prefillKid?.schoolOrCampRules ?? '');
  const [needsSnacks, setNeedsSnacks] = useState(prefillKid?.needsSnacks ?? true);

  const toggleRestriction = (id: string) => {
    setRestrictions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFinish = async () => {
    const allergyOpts = DIETARY_OPTIONS.filter(
      (opt): opt is DietaryOption & { allergen: string } =>
        'allergen' in opt && restrictions.has(opt.id),
    );
    const allergies = allergyOpts.map((o) => o.allergen);
    const isVegan = restrictions.has('vegan');
    const isVegetarian = restrictions.has('vegetarian') || isVegan;

    const finalKid: Kid = {
      id: prefillKid?.id ?? uuidv4(),
      name: name.trim(),
      age: ageFromBirth(birthMonth, birthYear),
      allergies,
      dislikes: parseCSV(dislikesRaw),
      likes: parseCSV(likesRaw),
      repetitionPreference: prefillKid?.repetitionPreference ?? 'some-variety',
      needsSnacks,
      snacksPerDay: prefillKid?.snacksPerDay ?? 2,
      maxPackagedSnacksPerDay: prefillKid?.maxPackagedSnacksPerDay ?? 1,
      isVegetarian,
      isVegan,
      schoolOrCampRules: schoolRules,
      otherDietaryNotes: prefillKid?.otherDietaryNotes ?? '',
    };

    const finalPrefs: ParentPrefs = prefillPrefs ?? {
      weeklyBudget: null,
      householdSize: 2,
      stores: [],
      organic: 'when-possible',
      otherNotes: '',
    };

    setSaving(true);
    try {
      await saveKid(finalKid);
      await saveParentPrefs(finalPrefs);
      if (onSaved) onSaved();
      else navigate('/');
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 =
    name.trim().length > 0 && birthYear >= 2005 && birthYear <= currentYear;

  const yearOptions = Array.from({ length: 20 }, (_, i) => currentYear - i);

  // ── Step panels ──────────────────────────────────────────────────────────

  const step1 = (
    <div className="flex flex-col gap-4">
      <h2 className="font-fredoka text-xl font-bold text-luncharoo-dark text-center leading-tight">
        {isEdit ? "Update your kid's info" : "Tell us about your kid!"}
      </h2>

      <div className="bg-white rounded-2xl luncharoo-border luncharoo-shadow p-4 flex flex-col gap-4">
        {/* Avatar + name row */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-luncharoo-blue/25 luncharoo-border flex-shrink-0 flex items-center justify-center text-2xl select-none">
            🧒
          </div>
          <div className="flex-1">
            <label className="block text-xs font-fredoka font-bold text-luncharoo-dark mb-1">
              Kid's name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mia"
              className="w-full rounded-xl border-2 border-luncharoo-dark/30 focus:border-luncharoo-dark outline-none px-3 py-2 text-sm font-fredoka font-semibold text-luncharoo-dark placeholder:text-slate-300 bg-luncharoo-beige/40"
            />
          </div>
        </div>

        {/* Birth date */}
        <div>
          <label className="block text-xs font-fredoka font-bold text-luncharoo-dark mb-1.5">
            Date of birth
          </label>
          <div className="flex gap-2">
            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(Number(e.target.value))}
              className="flex-1 rounded-xl border-2 border-luncharoo-dark/30 focus:border-luncharoo-dark outline-none px-3 py-2 text-sm font-fredoka font-semibold text-luncharoo-dark bg-luncharoo-beige/40 appearance-none cursor-pointer"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(Number(e.target.value))}
              className="w-28 rounded-xl border-2 border-luncharoo-dark/30 focus:border-luncharoo-dark outline-none px-3 py-2 text-sm font-fredoka font-semibold text-luncharoo-dark bg-luncharoo-beige/40 appearance-none cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {name && canProceedStep1 && (
            <p className="mt-1.5 text-xs text-slate-400 font-fredoka">
              {name} is {ageFromBirth(birthMonth, birthYear)} years old
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const step2 = (
    <div className="flex flex-col gap-4">
      <h2 className="font-fredoka text-xl font-bold text-luncharoo-dark text-center leading-tight">
        Any dietary restrictions?{' '}
        <span className="font-normal text-slate-400 text-base">(optional)</span>
      </h2>

      <div className="bg-white rounded-2xl luncharoo-border luncharoo-shadow p-4">
        <div className="grid grid-cols-3 gap-2">
          {DIETARY_OPTIONS.map((opt) => {
            const selected = restrictions.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleRestriction(opt.id)}
                className={`rounded-xl border-2 px-2 py-2.5 text-xs font-fredoka font-bold leading-tight text-center transition-all luncharoo-press ${
                  selected
                    ? 'bg-luncharoo-dark text-white border-luncharoo-dark shadow-[2px_2px_0px_rgba(19,78,158,0.4)]'
                    : 'bg-luncharoo-beige/50 text-luncharoo-dark border-luncharoo-dark/25 hover:border-luncharoo-dark/60'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const step3 = (
    <div className="flex flex-col gap-4">
      <h2 className="font-fredoka text-xl font-bold text-luncharoo-dark text-center leading-tight">
        A few more details
        <br />
        <span className="font-normal text-slate-400 text-base">about {name || 'your kid'}!</span>
      </h2>

      <div className="bg-white rounded-2xl luncharoo-border luncharoo-shadow p-4 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-fredoka font-bold text-luncharoo-dark mb-1">
            Favourite foods
            <span className="font-normal text-slate-400 ml-1">(comma-separated, optional)</span>
          </label>
          <input
            type="text"
            value={likesRaw}
            onChange={(e) => setLikesRaw(e.target.value)}
            placeholder="e.g. pasta, strawberries, hummus"
            className="w-full rounded-xl border-2 border-luncharoo-dark/30 focus:border-luncharoo-dark outline-none px-3 py-2 text-sm font-fredoka text-luncharoo-dark placeholder:text-slate-300 bg-luncharoo-beige/40"
          />
        </div>

        <div>
          <label className="block text-xs font-fredoka font-bold text-luncharoo-dark mb-1">
            Foods to avoid
            <span className="font-normal text-slate-400 ml-1">(comma-separated, optional)</span>
          </label>
          <input
            type="text"
            value={dislikesRaw}
            onChange={(e) => setDislikesRaw(e.target.value)}
            placeholder="e.g. mushrooms, onions"
            className="w-full rounded-xl border-2 border-luncharoo-dark/30 focus:border-luncharoo-dark outline-none px-3 py-2 text-sm font-fredoka text-luncharoo-dark placeholder:text-slate-300 bg-luncharoo-beige/40"
          />
        </div>

        <div>
          <label className="block text-xs font-fredoka font-bold text-luncharoo-dark mb-1">
            School / camp rules
            <span className="font-normal text-slate-400 ml-1">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={schoolRules}
            onChange={(e) => setSchoolRules(e.target.value)}
            placeholder="e.g. nut-free, no glass, no microwave"
            className="w-full rounded-xl border-2 border-luncharoo-dark/30 focus:border-luncharoo-dark outline-none px-3 py-2 text-sm font-fredoka text-luncharoo-dark placeholder:text-slate-300 bg-luncharoo-beige/40 resize-none"
          />
        </div>

        {/* Snacks toggle */}
        <button
          type="button"
          onClick={() => setNeedsSnacks((v) => !v)}
          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm font-fredoka font-bold transition-all luncharoo-press ${
            needsSnacks
              ? 'bg-luncharoo-yellow/30 border-luncharoo-yellow text-luncharoo-dark'
              : 'bg-luncharoo-beige/50 border-luncharoo-dark/25 text-slate-400'
          }`}
        >
          <span className="text-lg">{needsSnacks ? '🍎' : '➕'}</span>
          <span>{needsSnacks ? 'Pack snacks too!' : 'Add snacks'}</span>
          <span
            className={`ml-auto w-10 h-5 rounded-full border-2 border-luncharoo-dark/30 relative transition-colors ${
              needsSnacks ? 'bg-luncharoo-dark' : 'bg-luncharoo-dark/15'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white border border-luncharoo-dark/30 shadow transition-all ${
                needsSnacks ? 'left-[calc(100%-1rem)]' : 'left-0.5'
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );

  const stepContent = [step1, step2, step3][step - 1];

  const isLastStep = step === 3;
  const canProceed = step === 1 ? canProceedStep1 : true;

  // ── Nav buttons ───────────────────────────────────────────────────────────

  const navButtons = (
    <div className={`flex gap-3 ${step === 1 ? 'justify-center' : ''}`}>
      {step > 1 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="flex-1 rounded-full border-[2.5px] border-luncharoo-dark bg-white text-luncharoo-dark font-fredoka font-bold text-base py-3 luncharoo-press hover:bg-luncharoo-beige"
        >
          Back
        </button>
      )}
      <button
        type="button"
        disabled={!canProceed || saving}
        onClick={() => {
          if (isLastStep) handleFinish();
          else setStep((s) => s + 1);
        }}
        className={`flex-1 rounded-full border-[2.5px] border-luncharoo-dark font-fredoka font-bold text-base py-3 luncharoo-press transition-opacity ${
          canProceed && !saving
            ? 'bg-luncharoo-yellow text-luncharoo-dark luncharoo-shadow'
            : 'bg-luncharoo-yellow/40 text-luncharoo-dark/40 cursor-not-allowed'
        }`}
      >
        {saving ? 'Saving…' : isLastStep ? (isEdit ? 'Save changes' : 'Get started!') : 'Next'}
      </button>
    </div>
  );

  // ── Compact mode (embedded in ProfileTab) ────────────────────────────────

  if (compact) {
    return (
      <div className="flex flex-col gap-4">
        <ProgressIndicator step={step} />
        {stepContent}
        {navButtons}
      </div>
    );
  }

  // ── Full-screen onboarding ────────────────────────────────────────────────

  return (
    <div className="craft-bg min-h-screen flex flex-col">
      {/* Logo */}
      <div className="flex justify-center pt-8 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-luncharoo-yellow luncharoo-border rounded-xl p-1.5 luncharoo-shadow-sm flex items-center justify-center -rotate-3">
            <svg className="w-7 h-7" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="25" width="70" height="60" rx="15" fill="#f36c57" stroke="#134e9e" strokeWidth="7" />
              <rect x="35" y="10" width="30" height="15" rx="5" fill="#f9a65d" stroke="#134e9e" strokeWidth="7" />
              <rect x="25" y="35" width="50" height="40" rx="8" fill="#fff" stroke="#134e9e" strokeWidth="4" />
              <circle cx="40" cy="50" r="5.5" fill="#134e9e" />
              <circle cx="60" cy="50" r="5.5" fill="#134e9e" />
              <path d="M43,62 Q50,67 57,62" stroke="#134e9e" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <h1 className="font-fredoka text-2xl font-bold text-luncharoo-dark tracking-wide">
            Luncharoo
          </h1>
        </div>
      </div>

      {/* Progress */}
      <div className="flex justify-center mb-6">
        <ProgressIndicator step={step} />
      </div>

      {/* Teal content area */}
      <div className="flex-1 bg-luncharoo-blue/20 rounded-t-[2rem] mx-0 px-5 pt-6 pb-8 flex flex-col gap-6">
        {stepContent}
        {navButtons}
      </div>
    </div>
  );
}
