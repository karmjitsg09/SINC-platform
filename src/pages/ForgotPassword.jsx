import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import PasswordInput from '../components/PasswordInput';
import AuthButton from '../components/AuthButton';
import SincLogo from '../components/common/SincLogo';
import { validatePassword, PASSWORD_POLICY_HINT } from '../lib/passwordPolicy';

export default function ForgotPassword() {
  const { forgotPassword, updatePassword, navigateAuth } = useAuth();

  // Detect recovery mode from URL hash or query params (from Supabase password reset link)
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return hash.includes('type=recovery') || search.includes('type=recovery') || hash.includes('access_token=');
  });

  // Request Reset Link state
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Set New Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [isPasswordResetSuccess, setIsPasswordResetSuccess] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Check URL params on mount
  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (hash.includes('type=recovery') || search.includes('type=recovery') || hash.includes('access_token=')) {
        setIsRecoveryMode(true);
      }
    } catch (e) {}
  }, []);

  const validateEmailForm = () => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePasswordForm = () => {
    const errs = {};
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) {
      errs.newPassword = pwdErr;
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    setPasswordErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    setGeneralError('');
    if (!validateEmailForm()) return;

    setIsLoading(true);
    try {
      await forgotPassword(email);
      setIsSubmitted(true);
    } catch (err) {
      setGeneralError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setGeneralError('');
    if (!validatePasswordForm()) return;

    setIsLoading(true);
    try {
      const res = await updatePassword(newPassword);
      if (res && res.error) {
        setGeneralError(res.error);
      } else {
        setIsPasswordResetSuccess(true);
      }
    } catch (err) {
      setGeneralError(err.message || 'Unable to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand-logo">
          <SincLogo size={68} alt="SINC logo" priority={true} />
        </div>

        {isRecoveryMode ? (
          <>
            <h1 className="auth-title">Set new password</h1>
            <p className="auth-subtitle">
              Choose a strong password to secure your account.
            </p>

            {generalError && <div className="auth-general-error">{generalError}</div>}

            {isPasswordResetSuccess ? (
              <div className="auth-success-box">
                <p className="auth-success-text">
                  Your password has been successfully updated! You can now sign in with your new password.
                </p>
                <AuthButton
                  type="button"
                  onClick={() => navigateAuth('login')}
                  style={{ marginTop: '16px' }}
                >
                  Sign In
                </AuthButton>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="auth-form" noValidate>
                <PasswordInput
                  label="New Password"
                  id="new-password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordErrors.newPassword) {
                      setPasswordErrors((prev) => ({ ...prev, newPassword: '' }));
                    }
                  }}
                  error={passwordErrors.newPassword}
                />
                {!passwordErrors.newPassword && (
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #7E8EA7)', margin: '-10px 0 14px 2px', lineHeight: 1.4 }}>
                    {PASSWORD_POLICY_HINT}
                  </p>
                )}

                <PasswordInput
                  label="Confirm New Password"
                  id="confirm-password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordErrors.confirmPassword) {
                      setPasswordErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    }
                  }}
                  error={passwordErrors.confirmPassword}
                />

                <AuthButton type="submit" isLoading={isLoading}>
                  Update Password
                </AuthButton>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="auth-title">Reset password</h1>
            <p className="auth-subtitle">
              Enter your email and we'll send you instructions to reset your password.
            </p>

            {generalError && <div className="auth-general-error">{generalError}</div>}

            {isSubmitted ? (
              <div className="auth-success-box">
                <p className="auth-success-text">
                  Instructions have been sent to <strong>{email}</strong> if an account exists.
                </p>
                <AuthButton
                  type="button"
                  onClick={() => navigateAuth('login')}
                  style={{ marginTop: '16px' }}
                >
                  Back to Sign In
                </AuthButton>
              </div>
            ) : (
              <form onSubmit={handleSendResetEmail} className="auth-form" noValidate>
                <AuthInput
                  label="Email"
                  id="forgot-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  error={emailError}
                />

                <AuthButton type="submit" isLoading={isLoading}>
                  Send Reset Link
                </AuthButton>
              </form>
            )}
          </>
        )}

        <div className="auth-footer-text" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <div>
            Remembered your password?{' '}
            <button
              type="button"
              className="auth-link-bold"
              onClick={() => navigateAuth('login')}
            >
              Sign In
            </button>
          </div>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary-blue, #2878FF)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px',
              textDecoration: 'underline'
            }}
            onClick={() => {
              setIsRecoveryMode(!isRecoveryMode);
              setGeneralError('');
            }}
          >
            {isRecoveryMode ? 'Need a reset link instead?' : 'Already have a reset link / code?'}
          </button>
        </div>
      </div>
    </div>
  );
}
