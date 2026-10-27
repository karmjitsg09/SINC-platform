'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Global event bus for non-React contexts
const TOAST_EVENT = 'sinc:toast-event';

export function showToast(message: string, type: ToastType = 'info', duration: number = 4000) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { message, type, duration }
      })
    );
  }
}

export function showToastError(message: string, duration: number = 4500) {
  showToast(message, 'error', duration);
}

export function showToastSuccess(message: string, duration: number = 3500) {
  showToast(message, 'success', duration);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      if (!message) return;
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = { id, type, message, duration };

      setToasts((prev) => [...prev.slice(-2), newToast]); // Keep max 3 at a time

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback((msg: string, dur?: number) => show(msg, 'success', dur || 3500), [show]);
  const error = useCallback((msg: string, dur?: number) => show(msg, 'error', dur || 4500), [show]);
  const info = useCallback((msg: string, dur?: number) => show(msg, 'info', dur || 3500), [show]);
  const warning = useCallback((msg: string, dur?: number) => show(msg, 'warning', dur || 4000), [show]);

  // Listen for global custom events
  useEffect(() => {
    const handleCustomToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string; type: ToastType; duration?: number }>;
      if (customEvent.detail) {
        show(customEvent.detail.message, customEvent.detail.type || 'info', customEvent.detail.duration);
      }
    };

    window.addEventListener(TOAST_EVENT, handleCustomToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleCustomToast);
    };
  }, [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning, dismiss }}>
      {children}
      {/* Toast Overlay Container */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          width: '100%',
          maxWidth: '460px',
          padding: '0 16px'
        }}
      >
        {toasts.map((t) => {
          const isError = t.type === 'error';
          const isSuccess = t.type === 'success';
          const isWarning = t.type === 'warning';

          const borderColor = isError
            ? '#ef4444'
            : isSuccess
            ? '#10b981'
            : isWarning
            ? '#f59e0b'
            : '#3b82f6';

          const iconColor = isError
            ? '#ef4444'
            : isSuccess
            ? '#10b981'
            : isWarning
            ? '#f59e0b'
            : '#3b82f6';

          const icon = isError ? '✕' : isSuccess ? '✓' : isWarning ? '⚠' : 'ℹ';

          return (
            <div
              key={t.id}
              role="alert"
              style={{
                pointerEvents: 'auto',
                width: '100%',
                backgroundColor: 'rgba(10, 15, 29, 0.96)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1.5px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                animation: 'sincToastSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: `${iconColor}22`,
                    border: `1px solid ${iconColor}66`,
                    color: iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                    flexShrink: 0
                  }}
                >
                  {icon}
                </div>
                <span
                  style={{
                    color: '#f8fafc',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                    lineHeight: '1.4'
                  }}
                >
                  {t.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Close notification"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '15px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      show: (msg: string, type: ToastType = 'info', dur?: number) => showToast(msg, type, dur),
      success: (msg: string, dur?: number) => showToastSuccess(msg, dur),
      error: (msg: string, dur?: number) => showToastError(msg, dur),
      info: (msg: string, dur?: number) => showToast(msg, 'info', dur),
      warning: (msg: string, dur?: number) => showToast(msg, 'warning', dur),
      dismiss: () => {}
    };
  }
  return ctx;
}
