import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={next} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await signup(name, email, password);
      else await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const other = mode === 'login' ? 'signup' : 'login';
  return (
    <div className="auth card">
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <form onSubmit={onSubmit} className="form">
        {mode === 'signup' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'signup' ? 8 : 1}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          {mode === 'signup' && <small className="muted">At least 8 characters</small>}
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <p className="muted small">
        {mode === 'login' ? 'New here? ' : 'Already have an account? '}
        <Link to={`/${other}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </Link>
      </p>
    </div>
  );
}
