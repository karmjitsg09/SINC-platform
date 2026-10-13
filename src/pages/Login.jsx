import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthInput from '../components/AuthInput';
import PasswordInput from '../components/PasswordInput';
import AuthButton from '../components/AuthButton';

export default function Login() {
  const { login, navigateAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const validate = () => {
    const newErrors = {};
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await login(email, password);
      if (res && res.error) {
        setGeneralError(res.error);
      }
    } catch (err) {
      setGeneralError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Brand Logo / Mark */}
        <div className="auth-brand-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9"></circle>
            <circle cx="12" cy="12" r="4"></circle>
          </svg>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to continue to your account</p>

        {generalError && <div className="auth-general-error">{generalError}</div>}

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
                onClick={() => navigateAuth('forgot-password')}
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
            onClick={() => navigateAuth('signup')}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
