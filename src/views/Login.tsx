import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import PasswordInput from '../components/PasswordInput';
import AuthButton from '../components/AuthButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import SincLogo from '../components/common/SincLogo';

export default function Login() {
  const { login, signInWithGoogle, oauthError, clearOauthError, navigateAuth } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string>('');

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isLoading) return;
    setGeneralError('');
    if (clearOauthError) clearOauthError();
    setIsGoogleLoading(true);

    try {
      const res = await signInWithGoogle();
      if (res && !res.success && res.error) {
        setGeneralError(res.error);
        setIsGoogleLoading(false);
      }
      // On success, Supabase initiates OAuth redirection to Google consent screen
    } catch (err: any) {
      setGeneralError(err.message || 'Unable to connect to Google. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    if (clearOauthError) clearOauthError();

    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await login(email, password);
      if (res && res.error) {
        setGeneralError(res.error);
      }
    } catch (err: any) {
      setGeneralError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedError = generalError || oauthError;

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* SINC Official Welcome Hero */}
        <div className="sinc-welcome-hero">
          <div className="sinc-welcome-emblem-wrap">
            <div className="sinc-welcome-emblem-glow" aria-hidden="true" />
            <div className="sinc-welcome-emblem">
              <SincLogo size={80} alt="SINC Official Emblem" priority={true} />
            </div>
          </div>
          <h1 className="sinc-welcome-title">SINC</h1>
          <div className="sinc-welcome-fullname">Society for Innovation, Network &amp; Collaboration</div>
          <p className="sinc-welcome-tagline">Where Ambition Finds Its People</p>
        </div>

        {displayedError && <div className="auth-general-error auth-error-message" role="alert">{displayedError}</div>}

        {/* Continue with Google Action */}
        <GoogleSignInButton
          onClick={handleGoogleSignIn}
          isLoading={isGoogleLoading}
          disabled={isLoading}
          text="Continue with Google"
        />

        {/* Visual Divider */}
        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <AuthInput
            label="Email"
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            error={errors.email}
          />

          <div className="auth-password-wrapper">
            <PasswordInput
              label="Password"
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              error={errors.password}
            />
            <div className="auth-forgot-link-wrapper">
              <button
                type="button"
                className="auth-inline-link"
                onClick={() => navigateAuth && navigateAuth('forgot-password')}
              >
                Forgot password?
              </button>
            </div>
          </div>

          <AuthButton type="submit" isLoading={isLoading}>
            Sign In
          </AuthButton>
        </form>

        <div className="auth-footer-text">
          Don't have an account?{' '}
          <button
            type="button"
            className="auth-link-bold"
            id="auth-switch-to-signup-btn"
            onClick={() => navigateAuth && navigateAuth('signup')}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
