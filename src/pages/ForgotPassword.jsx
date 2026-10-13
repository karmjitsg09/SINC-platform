import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import AuthButton from '../components/AuthButton';

export default function ForgotPassword() {
  const { forgotPassword, navigateAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await forgotPassword(email);
      setIsSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9"></circle>
            <circle cx="12" cy="12" r="4"></circle>
          </svg>
        </div>

        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">
          Enter your email and we'll send you instructions to reset your password
        </p>

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
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <AuthInput
              label="Email"
              id="forgot-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              error={error}
            />

            <AuthButton type="submit" isLoading={isLoading}>
              Send Reset Link
            </AuthButton>
          </form>
        )}

        {!isSubmitted && (
          <div className="auth-footer-text">
            Remembered your password?{' '}
            <button
              type="button"
              className="auth-link-bold"
              onClick={() => navigateAuth('login')}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
