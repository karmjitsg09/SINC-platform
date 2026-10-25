import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import PasswordInput from '../components/PasswordInput';
import AuthButton from '../components/AuthButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import SincLogo from '../components/common/SincLogo';
import { validatePassword, PASSWORD_POLICY_HINT } from '../lib/passwordPolicy';

export default function SignUp() {
  const { signup, signInWithGoogle, oauthError, clearOauthError, navigateAuth } = useAuth();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const [apiError, setApiError] = useState<string>('');
  const [confirmationNotice, setConfirmationNotice] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  const validate = (): boolean => {
    const newErrors: { name?: string; email?: string; password?: string; confirmPassword?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordError = validatePassword(password);
      if (passwordError) {
        newErrors.password = passwordError;
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
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
    } catch (err: any) {
      setApiError(err.message || 'Unable to connect to Google.');
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    setConfirmationNotice('');
    if (clearOauthError) clearOauthError();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await signup(name.trim(), email.trim(), password);
      if (res?.requiresEmailConfirmation) {
        // Case B: Email confirmation required
        setConfirmationNotice(res.message || 'Account created! Please check your email to confirm your account before signing in.');
      } else if (res && !res.success && res.error) {
        setApiError(res.error);
      }
    } catch (err: any) {
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
        </div>

        {displayedError && (
          <div
            className="auth-general-error"
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

        {confirmationNotice ? (
          <div
            style={{
              margin: '12px 0 20px',
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(40, 120, 255, 0.08)',
              border: '1px solid rgba(40, 120, 255, 0.25)',
              color: 'var(--navy-900, #0B192C)',
              fontSize: '14px',
              lineHeight: 1.5,
              textAlign: 'center'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1868ff' }}>Check Your Email</div>
            <p style={{ margin: '0 0 16px', color: '#475569', fontSize: '13px' }}>{confirmationNotice}</p>
            <button
              type="button"
              className="auth-link-bold"
              onClick={() => navigateAuth && navigateAuth('login')}
              style={{ padding: '8px 16px', borderRadius: '6px', background: '#1868ff', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            {/* Continue with Google Action */}
            <GoogleSignInButton
              onClick={handleGoogleSignUp}
              isLoading={isGoogleLoading}
              disabled={isLoading}
              text="Continue with Google"
            />

            {/* Visual Divider */}
            <div className="auth-divider">
              <span>or create account with email</span>
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
                label="Create Password"
                id="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: '' });
                  if (errors.confirmPassword && confirmPassword && e.target.value === confirmPassword) {
                    setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }
                }}
                error={errors.password}
              />
              {!errors.password && (
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #7E8EA7)', margin: '-10px 0 14px 2px', lineHeight: 1.4 }}>
                  {PASSWORD_POLICY_HINT}
                </p>
              )}

              <PasswordInput
                label="Confirm Password"
                id="confirmPassword"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                }}
                error={errors.confirmPassword}
              />

              <AuthButton type="submit" isLoading={isLoading} id="signup-submit-btn">
                Create Account
              </AuthButton>
            </form>
          </>
        )}

        <div className="auth-footer-text">
          Already have an account?{' '}
          <button
            type="button"
            className="auth-link-bold"
            id="auth-switch-to-signin-btn"
            onClick={() => navigateAuth && navigateAuth('login')}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
