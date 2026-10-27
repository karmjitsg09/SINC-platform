import React from 'react';

export default function AuthInput({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  children,
  ...props
}) {
  return (
    <div className="auth-field-group">
      {label && (
        <label htmlFor={id} className="auth-label">
          {label}
        </label>
      )}
      <div className="auth-input-wrapper">
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`auth-input ${error ? 'error' : ''}`}
          {...props}
        />
        {children}
      </div>
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
