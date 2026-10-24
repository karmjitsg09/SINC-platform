import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import PasswordInput from '../components/PasswordInput';
import AuthButton from '../components/AuthButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import SincLogo from '../components/common/SincLogo';
import { validatePassword, PASSWORD_POLICY_HINT } from '../lib/passwordPolicy';
import { playSincIntro } from '../lib/sinc-intro';

export default function SignUp() {
  const { signup, signInWithGoogle, oauthError, clearOauthError, navigateAuth } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      newErrors.password = passwordError;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleSignUp = async () => {
    if (isGoogleLoading || isLoading) return;
    setApiError('');
    if (clearOauthError) clearOauthError();
    setIsGoogleLoading(true);

    try {
      const res = await signInWithGoogle();
      if (res && !res.success && res.error) {
        setApiError(res.error);
        setIsGoogleLoading(false);
      }
    } catch (err) {
      setApiError(err.message || 'Unable to connect to Google.');
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (clearOauthError) clearOauthError();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await signup(name, email, password);
      if (res && res.error) {
        setApiError(res.error);
      }
    } catch (err) {
      setApiError(err.message || 'Unable to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedError = apiError || oauthError;

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

          <button
            type="button"
            className="sinc-welcome-story-trigger"
            onClick={() => playSincIntro({ mode: 'welcome' })}
            id="welcome-story-trigger-btn"
          >
            <span>▶</span>
            <span>Experience Welcome Story</span>
          </button>
        </div>

        {/* Segmented Auth Navigation Tabs */}
        <div className="sinc-welcome-tabs" role="tablist">
          <button
            type="button"
            className="sinc-welcome-tab"
            role="tab"
            aria-selected="false"
            onClick={() => navigateAuth('login')}
            id="auth-tab-signin"
          >
            Sign In
          </button>
          <button
            type="button"
            className="sinc-welcome-tab active"
            role="tab"
            aria-selected="true"
            id="auth-tab-signup"
          >
            Create Account
          </button>
        </div>

        {displayedError && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: '500',
              width: '100%',
              boxSizing: 'border-box',
              textAlign: 'center'
            }}
          >
            {displayedError}
          </div>
        )}

        {/* Continue with Google Action */}
        <GoogleSignInButton
          onClick={handleGoogleSignUp}
          isLoading={isGoogleLoading}
          disabled={isLoading}
          text="Continue with Google"
        />

        {/* Visual Divider */}
        <div className="auth-divider">
          <span>or sign up with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <AuthInput
            label="Full Name"
            id="name"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
            error={errors.name}
          />

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

          <PasswordInput
            label="Password"
            id="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors({ ...errors, password: '' });
            }}
            error={errors.password}
          />
          {!errors.password && (
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #7E8EA7)', margin: '-10px 0 14px 2px', lineHeight: 1.4 }}>
              {PASSWORD_POLICY_HINT}
            </p>
          )}

          <AuthButton type="submit" isLoading={isLoading}>
            Create Account
          </AuthButton>
        </form>

        <div className="auth-footer-text">
          Already have an account?{' '}
          <button
            type="button"
            className="auth-link-bold"
            onClick={() => navigateAuth('login')}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
