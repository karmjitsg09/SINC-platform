import React from 'react';

export default function AuthButton({
  children,
  isLoading = false,
  disabled = false,
  type = 'submit',
  onClick,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`auth-btn ${isLoading ? 'loading' : ''} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <span className="auth-btn-spinner-wrapper">
          <svg className="auth-spinner" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3.5"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
