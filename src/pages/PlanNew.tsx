import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKid } from '../hooks/useKid';
import { useParentPrefs } from '../hooks/useParentPrefs';
import { usePlan } from '../hooks/usePlan';
import { useAI } from '../hooks/useAI';
import type { ParsedSession } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday',
};

type Phase = 'input' | 'confirm' | 'generating';

export default function PlanNew() {
  const navigate = useNavigate();
  const { kid } = useKid();
  const { parentPrefs } = useParentPrefs();
  const { createDraftPlan } = usePlan();
  const { parseNotes, generatePlan } = useAI();

  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [session, setSession] = useState<ParsedSession | null>(null);
  const [correction, setCorrection] = useState('');

  // Voice recording state
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = { current: null as MediaRecorder | null };
  const chunksRef = { current: [] as Blob[] };
  const timerRef = { current: null as ReturnType<typeof setInterval> | null };

  const mediaRecorderSupported = typeof window !== 'undefined' && !!window.MediaRecorder;

  const toggleDay = (d: string) =>
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const fullDays = selectedDays.map((d) => DAY_FULL[d]);

  // ── Phase A → B: parse notes ──────────────────────────────────────────────

  const handleContinue = async () => {
    if (!kid || !parentPrefs) return;

    if (!notes.trim()) {
      // skip parse, jump straight to minimal confirm
      const minimal: ParsedSession = {
        daysNeeded: fullDays,
        ingredientsOnHand: [],
        specialNotes: '',
        prepTimeAvailable: 'medium',
      };
      setSession(minimal);
      setPhase('confirm');
      return;
    }

    setPhase('confirm'); // show loading state in confirm phase
    const result = await parseNotes.call(notes, fullDays, kid, parentPrefs);
    if (result) {
      setSession(result);
    }
  };

  // ── Phase B → C: apply correction if any, then generate ──────────────────

  const handleGenerate = async () => {
    if (!kid || !parentPrefs || !session) return;

    let finalSession = session;

    if (correction.trim()) {
      setPhase('confirm');
      const updated = await parseNotes.call(
        `Original notes: ${notes}\n\nCorrection: ${correction}`,
        fullDays, kid, parentPrefs
      );
      if (updated) {
        setSession(updated);
        finalSession = updated;
      }
    }

    setPhase('generating');
    const result = await generatePlan.call(finalSession, kid, parentPrefs);
    if (!result) {
      return;
    }

    createDraftPlan(
      finalSession.daysNeeded,
      notes + (correction ? `\nCorrection: ${correction}` : ''),
      result.items
    );
    navigate('/plan/review');
  };

  // ── Voice input ───────────────────────────────────────────────────────────

  const startRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingState('recording');
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setVoiceError('Microphone access denied — type your notes instead.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (timerRef.current) clearInterval(timerRef.current);
    recorder.onstop = async () => {
      setRecordingState('transcribing');
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      try {
        const form = new FormData();
        form.append('audio', blob, 'recording.webm');
        const res = await fetch('/api/transcribe', { method: 'POST', body: form });
        if (!res.ok) throw new Error();
        const data = await res.json() as { transcript: string };
        setNotes((prev) => prev ? `${prev} ${data.transcript}` : data.transcript);
      } catch {
        setVoiceError("Couldn't transcribe — try again or type your notes.");
      } finally {
        setRecordingState('idle');
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
    };
    recorder.stop();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'generating') {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <span className="spinner" style={{ width: '2rem', height: '2rem', borderWidth: 3 }} />
        <p style={{ marginTop: '1rem' }}>Planning lunches for {kid?.name}…</p>
        {generatePlan.error && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="error-banner">{generatePlan.error}</div>
            <div className="row" style={{ justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleGenerate}>Retry</button>
              <button onClick={() => setPhase('confirm')}>← Back to notes</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'confirm') {
    const isLoadingParse = parseNotes.loading && !session;

    return (
      <div className="page">
        <h1>Confirm your plan</h1>

        {isLoadingParse ? (
          <div className="card">
            <span className="spinner" /> Reading your notes…
          </div>
        ) : session ? (
          <div className="card">
            <p><strong>Days needed:</strong> {session.daysNeeded.join(', ')}</p>
            {session.ingredientsOnHand.length > 0 && (
              <p><strong>On hand:</strong> {session.ingredientsOnHand.join(', ')}</p>
            )}
            {session.specialNotes && (
              <p><strong>Notes:</strong> {session.specialNotes}</p>
            )}
            <p><strong>Prep time:</strong> {session.prepTimeAvailable}</p>
          </div>
        ) : null}

        {parseNotes.error && <div className="error-banner">{parseNotes.error}</div>}

        {session && (
          <>
            <div className="field" style={{ marginTop: '1rem' }}>
              <label>Anything to fix? <span className="muted">(optional)</span></label>
              <textarea rows={2} value={correction} onChange={(e) => setCorrection(e.target.value)}
                placeholder="e.g. no sandwiches this week" />
            </div>
            <div className="row">
              <button onClick={() => { setPhase('input'); setSession(null); }}>← Back</button>
              <button className="primary" onClick={handleGenerate} disabled={generatePlan.loading}>
                {generatePlan.loading ? <><span className="spinner" />Generating…</> : 'Generate plan →'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Phase A — input
  return (
    <div className="page">
      <h1>This week's lunches</h1>

      <div className="field">
        <label>Days needed</label>
        <div className="row">
          {DAYS.map((d) => (
            <label key={d} style={{ fontWeight: 'normal', display: 'flex', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedDays.includes(d)} onChange={() => toggleDay(d)} />
              {d}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>
          What's going on this week? <span className="muted">(optional)</span>
        </label>
        <p className="muted" style={{ marginBottom: '0.4rem', fontSize: '0.85rem' }}>
          Leftovers to use up, things you already have, busy days, stuff {kid?.name ?? 'they'}'ve been asking for — anything helps. Or leave blank and I'll go off your saved preferences.
        </p>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={recordingState === 'transcribing' ? 'Transcribing…' : recordingState === 'recording' ? `Recording… ${recordingSeconds}s` : 'e.g. We have leftover rotisserie chicken. Wednesday is a swim day…'}
          disabled={recordingState !== 'idle'}
        />
      </div>

      {voiceError && <div className="error-banner">{voiceError}</div>}

      <div className="row">
        {mediaRecorderSupported ? (
          <button
            type="button"
            onClick={recordingState === 'recording' ? stopRecording : startRecording}
            disabled={recordingState === 'transcribing'}
            style={{ background: recordingState === 'recording' ? '#fee2e2' : undefined }}
          >
            {recordingState === 'recording' ? `⏹ Stop (${recordingSeconds}s)` : '🎤 Record'}
          </button>
        ) : (
          <span className="muted" style={{ fontSize: '0.85rem' }}>Voice input not supported in this browser — type your notes.</span>
        )}
        <button
          className="primary"
          onClick={handleContinue}
          disabled={selectedDays.length === 0}
          style={{ marginLeft: 'auto' }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
