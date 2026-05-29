import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function SignIn() {
  const { session, loading, signInWithGoogle, signInWithEmail, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error } = await signInWithEmail(email);
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="craft-bg min-h-screen flex justify-center items-center p-4">
      <div className="w-full max-w-sm bg-luncharoo-beige luncharoo-border rounded-[32px] p-6 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="font-fredoka text-2xl font-bold text-luncharoo-dark">Luncharoo</h1>
          <p className="text-xs font-fredoka text-luncharoo-dark/70 mt-1">Sign in to plan lunches</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full bg-white luncharoo-border rounded-xl py-3 font-fredoka font-bold text-sm text-luncharoo-dark luncharoo-press flex items-center justify-center gap-2 disabled:opacity-50 mb-4"
        >
          <span>🔐</span> Continue with Google
        </button>

        <div className="text-center text-[10px] font-fredoka text-luncharoo-dark/50 my-3">or</div>

        {sent ? (
          <p className="text-center text-xs font-fredoka text-luncharoo-dark bg-white/60 rounded-xl p-3">
            ✉️ Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleEmail} className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full luncharoo-border rounded-xl px-3 py-2 font-fredoka text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              data-testid="dev-magic-link"
              className="w-full bg-luncharoo-yellow luncharoo-border rounded-xl py-2.5 font-fredoka font-bold text-sm text-luncharoo-dark luncharoo-press disabled:opacity-50"
            >
              Send magic link
            </button>
          </form>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-700 bg-red-100 rounded-lg p-2 text-center">{error}</p>
        )}

        {import.meta.env.DEV && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const { error } = await signInWithPassword(email, password);
              setBusy(false);
              if (error) setError(error.message);
            }}
            className="mt-4 pt-4 border-t border-luncharoo-dark/10 space-y-2"
          >
            <p className="text-[10px] font-fredoka text-luncharoo-dark/50 text-center">dev only</p>
            <input
              type="email"
              data-testid="dev-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              className="w-full luncharoo-border rounded-xl px-3 py-2 font-fredoka text-sm"
            />
            <input
              type="password"
              data-testid="dev-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              className="w-full luncharoo-border rounded-xl px-3 py-2 font-fredoka text-sm"
            />
            <button
              type="submit"
              data-testid="dev-sign-in"
              disabled={busy}
              className="w-full bg-luncharoo-dark text-white luncharoo-border rounded-xl py-2 font-fredoka font-bold text-xs luncharoo-press disabled:opacity-50"
            >
              Sign in with password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
