import { useState } from 'react';
import { ShieldCheck, Loader2, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import '@/pages/login-command.css';
import { cancelNativeLogin } from './auth';

export default function NativeLoginPage() {
  const { signInWithGoogle, isSigningIn, authError } = useAuth();
  const [error, setError] = useState('');
  const signIn = async () => {
    setError('');
    try { await signInWithGoogle(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in could not finish'); }
  };
  return <main className="rivals-login native-login">
    <div aria-hidden="true" />
    <section>
      <div className="native-wordmark">
        <img src="/rivals-logo.png" alt="" className="native-official-logo" />
        <strong>RIVALS<small>RIVAL HEIST</small></strong>
      </div>
      <div className="native-login-card">
        <span className="native-eyebrow">YOUR NEXT HEIST STARTS HERE</span>
        <h1>Sign in to RIVALS</h1>
        <p>Your existing account — the same city, built for your phone</p>
        <button disabled={isSigningIn} onClick={() => void signIn()}>{isSigningIn ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />} {isSigningIn ? 'COMPLETE SIGN-IN IN YOUR BROWSER' : 'CONTINUE WITH GOOGLE OR WALLET'}</button>
        {isSigningIn && <button onClick={cancelNativeLogin}>CANCEL BROWSER SIGN-IN</button>}
        <p className="native-secure"><ShieldCheck size={17} /> Secure browser sign-in — your password never enters the game</p>
        {(error || authError) && <p role="alert">{error || authError}</p>}
      </div>
      <p className="native-footer">PACKAGED ANDROID EDITION / ONLINE SIGN-IN REQUIRED</p>
    </section>
  </main>;
}
