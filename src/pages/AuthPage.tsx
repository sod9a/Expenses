import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SplashScreen } from '@/components/SplashScreen';

type AuthMode = 'login' | 'register' | 'forgot';

export function AuthPage() {
  const { login, register, sendReset } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Login fields
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot fields
  const [forgotEmail, setForgotEmail] = useState('');

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(loginInput, loginPassword);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(regName, regUsername, regEmail, regPassword);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await sendReset(forgotEmail);
      setInfo('Password reset link sent. Check your inbox and spam folder.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (busy && (mode === 'login' || mode === 'register')) {
    return <SplashScreen message={mode === 'register' ? 'Creating your account…' : 'Signing you in…'} />;
  }

  return (
    <div id="auth-overlay" className="auth-overlay">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>ExpenseFlow</h1>
          <p>Your personal finance dashboard</p>
        </div>

        {mode === 'login' && (
          <form className="auth-form active" onSubmit={handleLogin}>
            <h2>Welcome back</h2>
            <div className="input-group">
              <label htmlFor="login-email">Email or Username</label>
              <input
                type="text"
                id="login-email"
                placeholder="Email or Username"
                autoComplete="username"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="auth-switch" style={{ marginTop: '0.75rem' }}>
              Forgot password? <span onClick={() => switchMode('forgot')}>Reset it</span>
            </p>
            <p className="auth-switch">
              No account? <span onClick={() => switchMode('register')}>Create one</span>
            </p>
            {error && (
              <div className="auth-error" style={{ display: 'block' }}>
                {error}
              </div>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form className="auth-form active" onSubmit={handleRegister}>
            <h2>Create account</h2>
            <div className="input-group">
              <label htmlFor="reg-name">Full Name</label>
              <input
                type="text"
                id="reg-name"
                placeholder="Your name"
                autoComplete="name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="reg-username">Username</label>
              <input
                type="text"
                id="reg-username"
                placeholder="unique_username"
                autoComplete="username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="reg-email">Email</label>
              <input
                type="email"
                id="reg-email"
                placeholder="you@example.com"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="reg-password">Password</label>
              <input
                type="password"
                id="reg-password"
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create Account'}
            </button>
            <p className="auth-switch">
              Already have an account? <span onClick={() => switchMode('login')}>Sign In</span>
            </p>
            {error && (
              <div className="auth-error" style={{ display: 'block' }}>
                {error}
              </div>
            )}
          </form>
        )}

        {mode === 'forgot' && (
          <form className="auth-form active" onSubmit={handleForgot}>
            <h2>Reset Password</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Enter your email address and we will send you a reset link.
            </p>
            <div className="input-group">
              <label htmlFor="forgot-email">Email</label>
              <input
                type="email"
                id="forgot-email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send Reset Link'}
            </button>
            <p className="auth-switch" style={{ marginTop: '0.75rem' }}>
              Remember it? <span onClick={() => switchMode('login')}>Sign In</span>
            </p>
            {error && (
              <div className="auth-error" style={{ display: 'block' }}>
                {error}
              </div>
            )}
            {info && (
              <div className="auth-error" style={{ display: 'block', borderLeftColor: 'var(--accent-green)' }}>
                {info}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
