'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary] Caught error${this.props.sectionName ? ` in ${this.props.sectionName}` : ''}:`, error);
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetSection = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleResetSessionAndLogin = (): void => {
    if (typeof window !== 'undefined') {
      try {
        // Clear Supabase and application auth tokens
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.startsWith('sinc_') || key.startsWith('sync_'))) {
            localStorage.removeItem(key);
          }
        }
        sessionStorage.clear();
      } catch (e) {
        console.warn('[ErrorBoundary] Failed clearing storage:', e);
      }
      window.location.href = '/login';
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isSection = Boolean(this.props.sectionName);

      return (
        <div
          role="alert"
          className="sinc-error-boundary-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isSection ? '240px' : '100vh',
            width: '100%',
            padding: isSection ? '24px 16px' : '32px 24px',
            backgroundColor: 'var(--bg-app, #080E18)',
            color: 'var(--text-primary, #F8FAFC)',
            fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="sinc-error-card"
            style={{
              maxWidth: isSection ? '480px' : '520px',
              width: '100%',
              backgroundColor: 'var(--bg-card, #0F172A)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              borderRadius: '16px',
              padding: isSection ? '24px' : '32px 28px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444'
              }}
            >
              <AlertCircle size={28} />
            </div>

            <div>
              <h2
                style={{
                  fontSize: isSection ? '1.15rem' : '1.35rem',
                  fontWeight: 600,
                  margin: '0 0 6px 0',
                  color: 'var(--text-primary, #F8FAFC)'
                }}
              >
                {isSection ? `Unable to display ${this.props.sectionName}` : 'Something went wrong'}
              </h2>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary, #94A3B8)',
                  margin: 0,
                  lineHeight: 1.5
                }}
              >
                {isSection
                  ? 'A temporary error occurred while rendering this section. You can try refreshing it.'
                  : 'An unexpected application error occurred. Reloading the page usually resolves this.'}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                width: '100%',
                marginTop: '8px'
              }}
            >
              {isSection ? (
                <button
                  type="button"
                  onClick={this.handleResetSection}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    backgroundColor: 'var(--brand-primary, #3B82F6)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={16} />
                  Retry Section
                </button>
              ) : (
                <button
                  type="button"
                  onClick={this.handleReload}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    backgroundColor: 'var(--brand-primary, #3B82F6)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.92rem',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={16} />
                  Reload Application
                </button>
              )}

              {!isSection && (
                <button
                  type="button"
                  onClick={this.handleResetSessionAndLogin}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-secondary, #94A3B8)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    borderRadius: '8px',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <LogIn size={16} />
                  Return to Login
                </button>
              )}
            </div>

            {this.state.error && (
              <details
                style={{
                  width: '100%',
                  marginTop: '12px',
                  textAlign: 'left',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted, #64748B)'
                }}
              >
                <summary style={{ cursor: 'pointer', padding: '4px 0', userSelect: 'none' }}>
                  Technical Details
                </summary>
                <pre
                  style={{
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: '#F87171',
                    fontSize: '0.75rem',
                    maxHeight: '160px'
                  }}
                >
                  {this.state.error.message || String(this.state.error)}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
