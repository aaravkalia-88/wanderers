import {FormEvent, useEffect, useRef, useState} from 'react';
import {api, ensureSession, setSessionToken, signIn, token} from '../api/travel';
import {Icon} from './UI';
import './AuthForm.css';

type Mode = 'login' | 'register';
export default function AuthForm({mode, onMode, onDone, onGuest}: {
  mode: Mode; onMode: (mode: Mode) => void; onDone: (storageWarning?: string) => void; onGuest?: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {if (error && !busy) errorRef.current?.focus();}, [error, busy]);
  const registering = mode === 'register';
  function switchMode(next: Mode) {onMode(next); setError(''); setVisible(false);}
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim().toLowerCase();
    const password = String(data.get('password'));
    setBusy(true); setError(''); setVisible(false);
    try {
      let stored: boolean;
      if (registering) {
        await ensureSession();
        const current = token();
        await api('/auth/register', {method: 'POST', body: JSON.stringify({username: String(data.get('username')).trim(), email, password})});
        if (token() !== current) throw new Error('Your account was created, but the active passport changed. Sign in to open your account.');
        stored = setSessionToken(current, remember);
      } else stored = await signIn(email, password, remember);
      onDone(stored ? undefined : 'Signed in for this page. Browser storage is unavailable, so sign in again after reloading.');
    } catch (error) {setError(error instanceof Error ? error.message : 'Could not sign in. Please try again.');}
    finally {setBusy(false);}
  }
  return <form className="auth-form" onSubmit={submit} aria-busy={busy}>
    <div className="auth-emblem"><Icon name="auto_stories"/><span>YOUR NEXT CHAPTER</span></div>
    <div className="auth-heading"><span className="eyebrow">The world is waiting</span><h2>{registering ? 'Make it your story.' : 'Good to see you again.'}</h2><p>{registering ? 'Your stamps, saved places, and future plans. All in one passport.' : 'Pick up where you wandered off. Your passport is right here.'}</p></div>
    <div className="auth-tabs" role="group" aria-label="Account options">
      <button type="button" aria-pressed={!registering} disabled={busy} onClick={() => switchMode('login')}>Sign in</button>
      <button type="button" aria-pressed={registering} disabled={busy} onClick={() => switchMode('register')}>Create account</button>
    </div>
    {error && <p ref={errorRef} tabIndex={-1} className="auth-error" role="alert"><Icon name="info"/>{error}</p>}
    <fieldset disabled={busy} className="auth-fields">
      {registering && <label htmlFor="auth-name">Your name<input id="auth-name" name="username" autoComplete="nickname" required minLength={2} maxLength={40} pattern="[a-zA-Z0-9_ \-]+" title="Use 2–40 letters, numbers, spaces, underscores or hyphens." placeholder="How should we call you?"/></label>}
      <label htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={200} placeholder="you@example.com"/></label>
      <label htmlFor="auth-password">Password<span className="auth-password"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} minLength={registering ? 8 : undefined} maxLength={64} required autoComplete={registering ? 'new-password' : 'current-password'} placeholder={registering ? 'At least 8 characters' : 'Enter your password'} aria-describedby={registering ? 'auth-password-hint' : undefined}/><button type="button" className="auth-reveal" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? 'Hide' : 'Show'}</button></span></label>
      {registering && <small id="auth-password-hint" className="auth-hint">Use 8–64 characters. A few memorable words work well.</small>}
      <label className="auth-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)}/><span><strong>Keep me signed in</strong><small>{remember ? 'Use only on a private device. Uncheck on shared computers.' : 'Use a different account in each tab. Other sessions stay signed in.'}</small></span></label>
    </fieldset>
    <button className="primary full-width auth-submit" disabled={busy}>{busy ? registering ? 'Creating your account…' : 'Opening your passport…' : registering ? 'Create my account' : 'Let’s wander'}{busy ? <span className="route-spinner" aria-hidden="true"/> : <Icon name="arrow_forward"/>}</button>
    <p className="auth-passport-note"><Icon name={registering ? 'verified' : 'auto_stories'}/><span>{registering ? 'Your current guest stamps and memories stay with your new account.' : 'Sign in opens your account’s passport. Guest memories are separate; create an account to keep them.'}</span></p>
    {onGuest && <button className="text-button auth-guest" type="button" onClick={onGuest} disabled={busy}>Keep exploring for now <Icon name="north_east"/></button>}
    <small className="auth-local-note"><Icon name="lock"/>We remember your session, never your password.</small>
  </form>;
}
