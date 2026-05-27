import { useState, useRef } from 'react';
import type { Kid, ParentPrefs, ParsedSession } from '../types';
import { useApp } from '../context/AppContext';

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
};

export default function WizardOverlay({ weekStartDate, kid, prefs, onClose }: Props) {
  const [selectedDays, setSelectedDays] = useState<string[]>([...ALL_DAYS]);
  const [notes, setNotes] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: `Hi! I'm BentoBot 🤖 Tell me anything special about this week — leftovers to use, days to skip, or specific requests. Or just hit Generate!` },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { startBackgroundPlanGeneration, backgroundGen } = useApp();

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

  const handleGenerate = () => {
    if (selectedDays.length === 0) {
      appendMessage('bot', 'Please select at least one day first!');
      return;
    }

    const session: ParsedSession = {
      daysNeeded: selectedDays,
      ingredientsOnHand: [],
      specialNotes: notes.trim(),
      prepTimeAvailable: 'medium',
    };

    startBackgroundPlanGeneration(weekStartDate, session, kid, prefs);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addUserMessage();
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

        <div className="absolute bottom-0 left-0 right-0 h-3 scallop-wave" />
      </div>

      {/* Chat + day selector */}
      <div className="flex-1 overflow-y-auto flex flex-col px-4 py-4 gap-3">
          {/* Day selector */}
          <div className="bg-moku-beige/50 border-2 border-dashed border-moku-dark/20 rounded-2xl p-3">
            <p className="font-fredoka text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Days this week</p>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`font-fredoka text-xs font-bold px-2 py-1 rounded-xl border-2 moku-press transition-colors ${
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
                  className={`w-6 h-6 rounded-full moku-border flex-shrink-0 flex items-center justify-center text-xs ${
                    msg.role === 'bot' ? 'bg-moku-yellow' : 'bg-moku-blue'
                  }`}
                >
                  {msg.role === 'bot' ? '🤖' : '👩'}
                </div>
                <div
                  className={`bg-white moku-border rounded-xl ${msg.role === 'bot' ? 'rounded-tl-none' : 'rounded-tr-none'} px-3 py-2 text-xs text-slate-700 leading-relaxed`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Quick stickers */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 mb-1.5">💡 QUICK ADDS:</p>
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
                  className="bg-white moku-border font-fredoka text-xs px-2 py-1 rounded-full moku-shadow-sm moku-press hover:bg-moku-yellow/20"
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
              className="flex-1 moku-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-moku-blue"
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
          disabled={backgroundGen.active || selectedDays.length === 0}
          className="w-full bg-moku-yellow text-moku-dark font-fredoka font-bold text-sm py-3 rounded-xl moku-border moku-shadow moku-press disabled:opacity-50"
        >
          ✨ Generate Plan
        </button>

        {backgroundGen.active && (
          <p className="text-xs text-moku-dark text-center">⏳ Another plan is generating…</p>
        )}
      </div>

      {/* Footer */}
      <div className="py-2 bg-moku-beige border-t border-slate-200 text-center text-[10px] font-fredoka font-bold text-moku-blue select-none">
        🧁 POWERED BY BENTOBOT
      </div>
    </div>
  );
}
