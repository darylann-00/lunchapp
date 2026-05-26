import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext';
import type { Kid, ParentPrefs } from '../types';

function parseList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

type KidDraft = Omit<Kid, 'id'>;
type PrefsDraft = ParentPrefs;

const defaultKid: KidDraft = {
  name: '',
  age: 5,
  allergies: [],
  dislikes: [],
  likes: [],
  repetitionPreference: 'some-variety',
  needsSnacks: true,
  snacksPerDay: 2,
  maxPackagedSnacksPerDay: 1,
  isVegetarian: false,
  isVegan: false,
  schoolOrCampRules: '',
  otherDietaryNotes: '',
};

const defaultPrefs: PrefsDraft = {
  weeklyBudget: null,
  stores: [],
  organic: 'when-possible',
  otherNotes: '',
};

type Props = { prefillKid?: Kid; prefillPrefs?: ParentPrefs };

export default function Onboarding({ prefillKid, prefillPrefs }: Props) {
  const { saveKid, saveParentPrefs } = useApp();
  const navigate = useNavigate();

  const isEdit = !!prefillKid;

  const [kid, setKid] = useState<KidDraft>(prefillKid ?? defaultKid);
  const [prefs, setPrefs] = useState<PrefsDraft>(prefillPrefs ?? defaultPrefs);
  const [allergiesRaw, setAllergiesRaw] = useState(prefillKid?.allergies.join(', ') ?? '');
  const [dislikesRaw, setDislikesRaw] = useState(prefillKid?.dislikes.join(', ') ?? '');
  const [likesRaw, setLikesRaw] = useState(prefillKid?.likes.join(', ') ?? '');
  const [storesRaw, setStoresRaw] = useState(prefillPrefs?.stores.join(', ') ?? '');

  const setKidField = <K extends keyof KidDraft>(key: K, val: KidDraft[K]) =>
    setKid((prev) => ({ ...prev, [key]: val }));

  const setPrefsField = <K extends keyof PrefsDraft>(key: K, val: PrefsDraft[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalKid: Kid = {
      ...kid,
      id: prefillKid?.id ?? uuidv4(),
      allergies: parseList(allergiesRaw),
      dislikes: parseList(dislikesRaw),
      likes: parseList(likesRaw),
    };
    const finalPrefs: ParentPrefs = {
      ...prefs,
      stores: parseList(storesRaw),
    };
    saveKid(finalKid);
    saveParentPrefs(finalPrefs);
    navigate(isEdit ? '/settings' : '/');
  };

  return (
    <div className="page">
      <h1>{isEdit ? 'Edit profile' : "Let's get set up"}</h1>
      <form onSubmit={handleSubmit}>
        <h2>About your kid</h2>

        <div className="field">
          <label>Name</label>
          <input type="text" required value={kid.name} onChange={(e) => setKidField('name', e.target.value)} />
        </div>

        <div className="field">
          <label>Age</label>
          <input type="number" required min={1} max={18} value={kid.age}
            onChange={(e) => setKidField('age', Number(e.target.value))} style={{ maxWidth: 80 }} />
        </div>

        <div className="field">
          <label>Allergies <span className="muted">(comma-separated)</span></label>
          <input type="text" value={allergiesRaw} onChange={(e) => setAllergiesRaw(e.target.value)}
            placeholder="e.g. peanuts, tree nuts" />
        </div>

        <div className="field">
          <label>Dislikes <span className="muted">(comma-separated)</span></label>
          <input type="text" value={dislikesRaw} onChange={(e) => setDislikesRaw(e.target.value)}
            placeholder="e.g. mushrooms, onions" />
        </div>

        <div className="field">
          <label>Likes <span className="muted">(comma-separated)</span></label>
          <input type="text" value={likesRaw} onChange={(e) => setLikesRaw(e.target.value)}
            placeholder="e.g. pasta, apples, hummus" />
        </div>

        <div className="field">
          <label>Repetition preference</label>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            {(['same-every-day', 'some-variety', 'never-repeat'] as const).map((v) => (
              <label key={v} style={{ fontWeight: 'normal', display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="radio" name="repetition" value={v} checked={kid.repetitionPreference === v}
                  onChange={() => setKidField('repetitionPreference', v)} />
                {v === 'same-every-day' ? 'Same every day' : v === 'some-variety' ? 'Some variety' : 'Never repeat'}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label style={{ fontWeight: 'normal', display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={kid.isVegetarian}
              onChange={(e) => setKidField('isVegetarian', e.target.checked)} />
            Vegetarian
          </label>
        </div>

        <div className="field">
          <label style={{ fontWeight: 'normal', display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={kid.isVegan}
              onChange={(e) => setKidField('isVegan', e.target.checked)} />
            Vegan
          </label>
        </div>

        <div className="field">
          <label style={{ fontWeight: 'normal', display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={kid.needsSnacks}
              onChange={(e) => setKidField('needsSnacks', e.target.checked)} />
            Pack snacks
          </label>
        </div>

        {kid.needsSnacks && (
          <>
            <div className="field">
              <label>Snacks per day</label>
              <input type="number" min={1} max={5} value={kid.snacksPerDay}
                onChange={(e) => setKidField('snacksPerDay', Number(e.target.value))} style={{ maxWidth: 80 }} />
            </div>
            <div className="field">
              <label>Max packaged snacks per day</label>
              <input type="number" min={0} max={5} value={kid.maxPackagedSnacksPerDay}
                onChange={(e) => setKidField('maxPackagedSnacksPerDay', Number(e.target.value))} style={{ maxWidth: 80 }} />
            </div>
          </>
        )}

        <div className="field">
          <label>School / camp rules <span className="muted">(optional)</span></label>
          <textarea rows={2} value={kid.schoolOrCampRules}
            onChange={(e) => setKidField('schoolOrCampRules', e.target.value)}
            placeholder="e.g. nut-free facility, no glass containers, no microwave access" />
        </div>

        <div className="field">
          <label>Other dietary notes <span className="muted">(optional)</span></label>
          <textarea rows={2} value={kid.otherDietaryNotes}
            onChange={(e) => setKidField('otherDietaryNotes', e.target.value)} />
        </div>

        <hr className="section-divider" />
        <h2>Your preferences</h2>

        <div className="field">
          <label>Weekly budget <span className="muted">(optional, in $)</span></label>
          <input type="number" min={0} value={prefs.weeklyBudget ?? ''}
            onChange={(e) => setPrefsField('weeklyBudget', e.target.value ? Number(e.target.value) : null)}
            style={{ maxWidth: 120 }} placeholder="no limit" />
        </div>

        <div className="field">
          <label>Stores <span className="muted">(comma-separated)</span></label>
          <input type="text" value={storesRaw} onChange={(e) => setStoresRaw(e.target.value)}
            placeholder="e.g. Trader Joe's, Costco" />
        </div>

        <div className="field">
          <label>Organic preference</label>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            {(['always', 'when-possible', 'doesnt-matter', 'never'] as const).map((v) => (
              <label key={v} style={{ fontWeight: 'normal', display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="radio" name="organic" value={v} checked={prefs.organic === v}
                  onChange={() => setPrefsField('organic', v)} />
                {v === 'always' ? 'Always' : v === 'when-possible' ? 'When possible' : v === 'doesnt-matter' ? "Doesn't matter" : 'Never'}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Other notes <span className="muted">(optional)</span></label>
          <textarea rows={2} value={prefs.otherNotes}
            onChange={(e) => setPrefsField('otherNotes', e.target.value)} />
        </div>

        <button type="submit" className="primary">
          {isEdit ? 'Save changes' : 'Get started →'}
        </button>
      </form>
    </div>
  );
}
