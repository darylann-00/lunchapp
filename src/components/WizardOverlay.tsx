import { useState, useRef } from 'react';
import type { Kid, ParentPrefs, LunchItem, ParsedSession } from '../types';
import { useAI } from '../hooks/useAI';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_COLORS: Record<string, string> = {
  Monday: 'bg-moku-coral',
  Tuesday: 'bg-moku-peach',
  Wednesday: 'bg-moku-yellow',
  Thursday: 'bg-moku-blue',
  Friday: 'bg-emerald-500',
};

type ChatMessage = { role: 'user' | 'bot'; text: string };

type Props = {
  weekStartDate: string;
  kid: Kid;
  prefs: ParentPrefs;
  onClose: () => void;
  onCommit: (weekStartDate: string, days: string[], notes: string, items: LunchItem[]) => void;
};

export default function WizardOverlay({ weekStartDate, kid, prefs, onClose, onCommit }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([...ALL_DAYS]);
  const [notes, setNotes] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: `Hi! I'm BentoBot 🤖 Tell me anything special about this week — leftovers to use, days to skip, or specific requests. Or just hit Generate!` },
  ]);
  const [draftItems, setDraftItems] = useState<LunchItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { generatePlan } = useAI();
  const isLoading = generatePlan.loading;

  const toggleDay = (day: string) =>
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );

  const appendMessage = (role: ChatMessage['role'], text: string) =>
    setMessages((prev) => [...prev, { role, text }]);

  const addUserMessage = () => {
    const text = inputRef.current?.value.trim();
    if (!text) return;
    appendMessage('user', text);
    setNotes((prev) => (prev ? `${prev}\n${text}` : text));
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (selectedDays.length === 0) {
      appendMessage('bot', 'Please select at least one day first!');
      return;
    }

    appendMessage('bot', 'Got it! Cooking up your week plan now...');

    // Build ParsedSession directly from wizard state — no extra AI call needed
    const session: ParsedSession = {
      daysNeeded: selectedDays,
      ingredientsOnHand: [],
      specialNotes: notes.trim(),
      prepTimeAvailable: 'medium',
    };

    const result = await generatePlan.call(session, kid, prefs);
    if (!result) {
      appendMessage('bot', 'Could not generate a plan. Please try again.');
      return;
    }

    const itemsWithKid = result.items.map((item) => ({ ...item, kidId: kid.id }));
    setDraftItems(itemsWithKid);
    setStep(2);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addUserMessage();
  };

  const handleCommit = () => {
    onCommit(weekStartDate, selectedDays, notes, draftItems);
  };

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      {/* Wizard header */}
      <div className="bg-moku-blue moku-border-b relative pt-3 pb-5 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪄</span>
            <h2 className="font-fredoka text-base text-white font-bold drop-shadow-[1px_1px_0px_#134e9e]">
              BentoBot Wizard
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mt-3 bg-white/10 rounded-xl px-3 py-2 border border-white/20 relative">
          <div className="absolute left-[72px] right-[72px] top-1/2 -translate-y-1/2 h-[2px] bg-white/20" />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-moku-yellow transition-all duration-300"
            style={{ left: '72px', right: step === 2 ? '72px' : '50%' }}
          />
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`z-10 flex items-center gap-1 font-fredoka text-[9px] px-2 py-0.5 rounded-full border-2 font-bold transition-all ${
                step === n
                  ? 'bg-white border-moku-dark text-moku-dark scale-105'
                  : step > n
                  ? 'bg-white/80 border-white/50 text-moku-dark opacity-80'
                  : 'bg-white/20 border-white/30 text-white/70'
              } ${n === 2 ? 'ml-auto' : ''}`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center font-bold ${
                  step > n ? 'bg-moku-yellow text-moku-dark' : step === n ? 'bg-moku-yellow text-moku-dark' : 'bg-white/30 text-white'
                }`}
              >
                {step > n ? '✓' : n}
              </span>
              <span>{n === 1 ? 'Tell BentoBot' : 'Review Plan'}</span>
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
      </div>

      {/* Step 1: Chat + day selector */}
      {step === 1 && (
        <div className="flex-1 overflow-y-auto flex flex-col px-4 py-4 gap-3">
          {/* Day selector */}
          <div className="bg-moku-beige/50 border-2 border-dashed border-moku-dark/20 rounded-2xl p-3">
            <p className="font-fredoka text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Days this week</p>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`font-fredoka text-[10px] font-bold px-2 py-1 rounded-xl border-2 moku-press transition-colors ${
                    selectedDays.includes(day)
                      ? `${DAY_COLORS[day]} text-white border-moku-dark`
                      : 'bg-white text-slate-400 border-slate-200'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 bg-slate-50 moku-border rounded-xl p-3 overflow-y-auto flex flex-col gap-3 min-h-[180px] max-h-64">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 items-start max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-6 h-6 rounded-full moku-border flex-shrink-0 flex items-center justify-center text-[10px] ${
                    msg.role === 'bot' ? 'bg-moku-yellow' : 'bg-moku-blue'
                  }`}
                >
                  {msg.role === 'bot' ? '🤖' : '👩'}
                </div>
                <div
                  className={`bg-white moku-border rounded-xl ${msg.role === 'bot' ? 'rounded-tl-none' : 'rounded-tr-none'} px-3 py-2 text-[11px] text-slate-700 leading-relaxed`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Quick stickers */}
          <div>
            <p className="text-[9px] font-bold text-slate-400 mb-1.5">💡 QUICK ADDS:</p>
            <div className="flex flex-wrap gap-1">
              {[
                ['🥜 Nut-Free', 'Nut-free week — no nuts of any kind'],
                ['🍝 Leftovers', 'Use leftover pasta on one day'],
                ['⚡ No-Cook', 'Keep everything no-cook, simple assembly only'],
              ].map(([label, preset]) => (
                <button
                  key={label}
                  onClick={() => {
                    appendMessage('user', preset);
                    setNotes((prev) => (prev ? `${prev}\n${preset}` : preset));
                  }}
                  className="bg-white moku-border font-fredoka text-[9px] px-2 py-1 rounded-full moku-shadow-sm moku-press hover:bg-moku-yellow/20"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Input row */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. 'Use up the chicken from dinner'"
              onKeyDown={handleKeyDown}
              className="flex-1 moku-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-moku-blue"
            />
            <button
              onClick={addUserMessage}
              className="w-9 h-9 bg-moku-coral text-white rounded-xl moku-border moku-shadow-sm moku-press flex items-center justify-center text-sm"
            >
              ➤
            </button>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading || selectedDays.length === 0}
            className="w-full bg-moku-yellow text-moku-dark font-fredoka font-bold text-sm py-3 rounded-xl moku-border moku-shadow moku-press disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-moku-dark/30 border-t-moku-dark rounded-full animate-spin" />
                Generating…
              </span>
            ) : (
              '✨ Generate Plan'
            )}
          </button>

          {generatePlan.error && (
            <p className="text-xs text-red-500 text-center">{generatePlan.error}</p>
          )}
        </div>
      )}

      {/* Step 2: Review draft */}
      {step === 2 && (
        <div className="flex-1 overflow-y-auto flex flex-col px-4 py-4 gap-3">
          <div className="bg-moku-yellow/10 border-2 border-dashed border-moku-yellow rounded-2xl p-3 flex items-start gap-2">
            <span className="text-xl">🙌</span>
            <div>
              <h3 className="font-fredoka text-xs font-bold">Review Your Plan</h3>
              <p className="text-[10px] text-slate-500">BentoBot generated this based on your notes. Confirm to save it!</p>
            </div>
          </div>

          <div className="space-y-2">
            {draftItems.map((item) => (
              <div key={item.id} className="bg-white moku-border rounded-xl p-3 flex items-start gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] text-white font-fredoka font-bold ${DAY_COLORS[item.day] ?? 'bg-moku-blue'}`}
                >
                  {item.day[0]}
                </span>
                <div className="min-w-0">
                  <p className="font-fredoka text-xs font-bold text-moku-dark">{item.day}</p>
                  {item.lunches.map((d) => (
                    <p key={d.id} className="text-[11px] text-slate-700 truncate">🍱 {d.name}</p>
                  ))}
                  {item.snacks.map((d) => (
                    <p key={d.id} className="text-[11px] text-slate-500 truncate">🍎 {d.name}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-auto pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border-2 border-moku-dark/30 text-moku-dark font-fredoka text-xs py-2.5 rounded-xl moku-press"
            >
              ← Back
            </button>
            <button
              onClick={handleCommit}
              className="flex-[1.5] bg-moku-yellow text-moku-dark font-fredoka font-bold text-xs py-2.5 rounded-xl moku-border moku-shadow-sm moku-press"
            >
              Apply Plan 🍱
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="py-2 bg-moku-beige border-t border-slate-200 text-center text-[9px] font-fredoka font-bold text-moku-blue select-none">
        🧁 POWERED BY BENTOBOT
      </div>
    </div>
  );
}
