import { useState, useRef, useEffect } from 'react';
import { getAuthHeader } from '../lib/ai';

const MAX_RECORDING_SECONDS = 120;

type Message = { role: 'user' | 'assistant'; content: string };

export type ConversationalChatProps = {
  messages: Message[];
  isLoading: boolean;
  onSend: (text: string) => void;
  voiceEnabled?: boolean;
  actionArea?: React.ReactNode;
  placeholder?: string;
};

type RecordingState = 'idle' | 'recording' | 'transcribing';

export default function ConversationalChat({
  messages,
  isLoading,
  onSend,
  voiceEnabled = false,
  actionArea,
  placeholder = 'Type a message…',
}: ConversationalChatProps) {
  const [input, setInput] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const mediaRecorderSupported = typeof window !== 'undefined' && !!window.MediaRecorder;

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    };
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    setTranscribeError(null);
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
      limitTimerRef.current = setTimeout(() => void stopRecording(), MAX_RECORDING_SECONDS * 1000);
    } catch {
      setTranscribeError('Microphone access denied — type your notes instead.');
    }
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        setRecordingState('transcribing');
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        try {
          const form = new FormData();
          form.append('audio', blob, 'recording.webm');
          const authHeader = await getAuthHeader();
          const res = await fetch('/api/transcribe', { method: 'POST', body: form, headers: authHeader });
          if (!res.ok) throw new Error('Transcription failed');
          const data = await res.json() as { transcript: string };
          setInput((prev) => prev ? `${prev} ${data.transcript}` : data.transcript);
        } catch {
          setTranscribeError("Couldn't transcribe — try again or type your notes.");
        } finally {
          setRecordingState('idle');
          recorder.stream.getTracks().forEach((t) => t.stop());
          resolve();
        }
      };
      recorder.stop();
    });
  };

  const handleVoiceButton = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {messages.length > 0 && (
        <div ref={threadRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: m.role === 'user' ? '#fff' : 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '0.5rem 0.75rem',
              maxWidth: '85%',
              whiteSpace: 'pre-wrap',
              fontSize: '0.95rem',
            }}>
              {m.content}
            </div>
          ))}
          {isLoading && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
              <span className="spinner" />
              Thinking…
            </div>
          )}
        </div>
      )}

      {actionArea}

      {transcribeError && <p className="error-banner">{transcribeError}</p>}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            recordingState === 'transcribing'
              ? 'Transcribing…'
              : recordingState === 'recording'
              ? 'Recording…'
              : placeholder
          }
          disabled={recordingState !== 'idle'}
          style={{ flex: 1, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {voiceEnabled && mediaRecorderSupported && (
            <>
              <button
                type="button"
                onClick={handleVoiceButton}
                disabled={recordingState === 'transcribing'}
                title={recordingState === 'recording' ? 'Stop recording' : 'Start recording'}
                style={{ background: recordingState === 'recording' ? '#fee2e2' : undefined }}
              >
                {recordingState === 'recording' ? '⏹' : '🎤'}
              </button>
              {recordingState === 'recording' && (() => {
                const remaining = MAX_RECORDING_SECONDS - recordingSeconds;
                const m = Math.floor(remaining / 60);
                const s = remaining % 60;
                return (
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1 }}>
                    {m}:{s.toString().padStart(2, '0')} left
                  </span>
                );
              })()}
            </>
          )}
          {voiceEnabled && !mediaRecorderSupported && (
            <span className="muted" style={{ fontSize: '0.8rem' }}>Voice not supported in this browser</span>
          )}
          <button type="button" className="primary" onClick={handleSend} disabled={isLoading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
