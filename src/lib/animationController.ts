'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { playSincIntro } from './sinc-intro';

export type AnimationLifecycleState =
  | 'BOOTSTRAPPING'              // Initial session check in progress -> Static logo symbol
  | 'UNAUTHENTICATED_INTRO'     // Logged-out user navigating to login -> Welcome film playing ("Talent is everywhere")
  | 'LOGIN_PAGE'                 // Welcome film finished / skipped (or reduced motion) -> Login form displayed
  | 'SIGNUP_PAGE'                // Direct signup navigation -> Signup form displayed
  | 'FORGOT_PASSWORD_PAGE'       // Direct forgot password navigation -> Forgot password form displayed
  | 'POST_LOGIN_LOGO'            // Fresh authentication succeeded -> Logo animation playing (quick 2s)
  | 'AUTHENTICATED_ENTRY_LOGO'   // Already authenticated user opened fresh tab -> Logo animation playing (quick 2s)
  | 'AUTHENTICATED_READY'        // Authenticated application ready and displayed
  | 'LOGGING_OUT'                // Sign-out in progress
  | 'ERROR';                     // 12-second timeout reached

const TAB_INIT_KEY = 'sinc_tab_initialized';
const PENDING_LOGIN_KEY = 'sinc_pending_login';
const RETURN_URL_KEY = 'sinc_return_url';

export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getNavigationType(): 'reload' | 'navigate' | 'back_forward' | 'other' {
  if (typeof window === 'undefined' || !window.performance) return 'other';
  try {
    const navEntries = window.performance.getEntriesByType('navigation');
    if (navEntries && navEntries.length > 0) {
      const type = (navEntries[0] as PerformanceNavigationTiming).type;
      if (type === 'reload') return 'reload';
      if (type === 'navigate') return 'navigate';
      if (type === 'back_forward') return 'back_forward';
    }
    const legacy = (window.performance as any).navigation;
    if (legacy) {
      if (legacy.type === 1) return 'reload';
      if (legacy.type === 0) return 'navigate';
      if (legacy.type === 2) return 'back_forward';
    }
  } catch (_) {}
  return 'other';
}

export function sanitizeReturnUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return null;

  const pathPart = trimmed.split('?')[0].split('#')[0].toLowerCase();
  if (pathPart === '/login' || pathPart === '/signup' || pathPart === '/forgot-password') {
    return null;
  }
  return trimmed;
}

export function saveReturnUrl(url: string): void {
  const safe = sanitizeReturnUrl(url);
  if (safe && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(RETURN_URL_KEY, safe);
    } catch (_) {}
  }
}

export function consumeReturnUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.sessionStorage.getItem(RETURN_URL_KEY);
    window.sessionStorage.removeItem(RETURN_URL_KEY);
    return sanitizeReturnUrl(saved);
  } catch (_) {
    return null;
  }
}

export function isTabInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(TAB_INIT_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function markTabInitialized(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(TAB_INIT_KEY, '1');
  } catch (_) {}
}

export function clearTabInitialized(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(TAB_INIT_KEY);
  } catch (_) {}
}

export function markPendingLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_LOGIN_KEY, '1');
  } catch (_) {}
}

export function hasOAuthTokensInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const search = window.location.search;
    const hash = window.location.hash;
    return (
      search.includes('code=') ||
      hash.includes('access_token=') ||
      hash.includes('refresh_token=') ||
      search.includes('type=recovery') ||
      search.includes('type=signup') ||
      search.includes('type=invite') ||
      hash.includes('type=recovery') ||
      hash.includes('type=signup')
    );
  } catch (_) {
    return false;
  }
}

export function isPendingLogin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(PENDING_LOGIN_KEY) === '1' || hasOAuthTokensInUrl();
  } catch (_) {
    return false;
  }
}

export function clearPendingLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_LOGIN_KEY);
    window.sessionStorage.removeItem('sinc_pending_oauth');
  } catch (_) {}
}

interface CentralControllerOptions {
  isAuthenticated: boolean;
  loadingSession: boolean;
  authRoute: string;
  onNavigateToReturnUrl: (url: string) => void;
}

export function useCentralAnimationController({
  isAuthenticated,
  loadingSession,
  authRoute,
  onNavigateToReturnUrl
}: CentralControllerOptions) {
  const [state, setState] = useState<AnimationLifecycleState>('BOOTSTRAPPING');
  const [startupTimedOut, setStartupTimedOut] = useState<boolean>(false);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(isReducedMotionPreferred);

  const hasClaimedInitialRef = useRef<boolean>(false);
  const isAnimationRunningRef = useRef<boolean>(false);
  const prevAuthRef = useRef<boolean>(isAuthenticated);

  // Monitor reduced-motion preference changes without replaying animations
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    } else if ((mql as any).addListener) {
      (mql as any).addListener(handleChange);
      return () => (mql as any).removeListener(handleChange);
    }
  }, []);

  // 12-second safety fallback timer
  useEffect(() => {
    if (!loadingSession) {
      setStartupTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (loadingSession) {
        setStartupTimedOut(true);
        setState('ERROR');
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [loadingSession]);

  // Primary authoritative decision logic
  useEffect(() => {
    if (loadingSession) {
      return;
    }

    // Handle initial bootstrap decision once session resolution completes
    if (!hasClaimedInitialRef.current) {
      hasClaimedInitialRef.current = true;
      const reduced = isReducedMotionPreferred();

      if (isAuthenticated) {
        // User has an active authenticated session
        const pendingLogin = isPendingLogin();
        clearPendingLogin();

        if (pendingLogin) {
          // CASE 2: Successful login / OAuth return / confirmation link
          if (reduced) {
            markTabInitialized();
            const returnUrl = consumeReturnUrl();
            if (returnUrl) onNavigateToReturnUrl(returnUrl);
            setState('AUTHENTICATED_READY');
          } else {
            setState('POST_LOGIN_LOGO');
            isAnimationRunningRef.current = true;
            playSincIntro({ mode: 'quick' }).then(() => {
              isAnimationRunningRef.current = false;
              markTabInitialized();
              const returnUrl = consumeReturnUrl();
              if (returnUrl) onNavigateToReturnUrl(returnUrl);
              setState('AUTHENTICATED_READY');
            });
          }
        } else {
          // CASE 3: Already authenticated user opens, reloads, or returns
          const navType = getNavigationType();
          const tabInit = isTabInitialized();
          const isReload = navType === 'reload' || tabInit;

          if (isReload) {
            // CASE 3B: Reloading website while already logged in
            // Directly display authenticated website without animation
            markTabInitialized();
            setState('AUTHENTICATED_READY');
          } else {
            // CASE 3A: Newly opening website while already logged in (new tab/window)
            if (reduced) {
              markTabInitialized();
              setState('AUTHENTICATED_READY');
            } else {
              setState('AUTHENTICATED_ENTRY_LOGO');
              isAnimationRunningRef.current = true;
              playSincIntro({ mode: 'quick' }).then(() => {
                isAnimationRunningRef.current = false;
                markTabInitialized();
                setState('AUTHENTICATED_READY');
              });
            }
          }
        }
      } else {
        // CASE 1: Unauthenticated visitor
        const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
        if (currentPath === '/signup' || authRoute === 'signup') {
          setState('SIGNUP_PAGE');
        } else if (currentPath === '/forgot-password' || authRoute === 'forgot-password') {
          setState('FORGOT_PASSWORD_PAGE');
        } else {
          // Unauthenticated user navigating to login page
          if (reduced) {
            setState('LOGIN_PAGE');
          } else {
            setState('UNAUTHENTICATED_INTRO');
            isAnimationRunningRef.current = true;
            playSincIntro({ mode: 'welcome' }).then(() => {
              isAnimationRunningRef.current = false;
              setState('LOGIN_PAGE');
            });
          }
        }
      }

      prevAuthRef.current = isAuthenticated;
      return;
    }

    // Post-bootstrap state transitions (e.g. login or logout while page is open)
    const wasAuth = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    // Transition: Unauthenticated -> Authenticated (CASE 2: User just logged in via form or action)
    if (!wasAuth && isAuthenticated) {
      clearPendingLogin();
      const reduced = isReducedMotionPreferred();

      if (reduced) {
        markTabInitialized();
        const returnUrl = consumeReturnUrl();
        if (returnUrl) onNavigateToReturnUrl(returnUrl);
        setState('AUTHENTICATED_READY');
      } else {
        setState('POST_LOGIN_LOGO');
        isAnimationRunningRef.current = true;
        playSincIntro({ mode: 'quick' }).then(() => {
          isAnimationRunningRef.current = false;
          markTabInitialized();
          const returnUrl = consumeReturnUrl();
          if (returnUrl) onNavigateToReturnUrl(returnUrl);
          setState('AUTHENTICATED_READY');
        });
      }
      return;
    }

    // Transition: Authenticated -> Unauthenticated (CASE 1: User logged out)
    if (wasAuth && !isAuthenticated) {
      clearTabInitialized();
      clearPendingLogin();
      const reduced = isReducedMotionPreferred();

      if (reduced) {
        setState('LOGIN_PAGE');
      } else {
        setState('UNAUTHENTICATED_INTRO');
        isAnimationRunningRef.current = true;
        playSincIntro({ mode: 'welcome' }).then(() => {
          isAnimationRunningRef.current = false;
          setState('LOGIN_PAGE');
        });
      }
      return;
    }

    // Unauthenticated route changes between login, signup, forgot-password
    if (!isAuthenticated) {
      if (authRoute === 'signup' && state !== 'SIGNUP_PAGE') {
        setState('SIGNUP_PAGE');
      } else if (authRoute === 'forgot-password' && state !== 'FORGOT_PASSWORD_PAGE') {
        setState('FORGOT_PASSWORD_PAGE');
      } else if (authRoute === 'login' && state !== 'LOGIN_PAGE' && state !== 'UNAUTHENTICATED_INTRO') {
        // Navigating back to login page from signup / forgot-password
        const reduced = isReducedMotionPreferred();
        if (reduced) {
          setState('LOGIN_PAGE');
        } else {
          setState('UNAUTHENTICATED_INTRO');
          isAnimationRunningRef.current = true;
          playSincIntro({ mode: 'welcome' }).then(() => {
            isAnimationRunningRef.current = false;
            setState('LOGIN_PAGE');
          });
        }
      }
    }
  }, [loadingSession, isAuthenticated, authRoute, onNavigateToReturnUrl, state]);

  // Handle retry from 12s timeout screen
  const handleRetry = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  // Handle proceed to sign-in from 12s timeout screen
  const handleGoToSignIn = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            window.localStorage.removeItem(key);
          }
        }
      } catch (_) {}
      clearTabInitialized();
      clearPendingLogin();
      window.location.href = '/login';
    }
  }, []);

  // Programmatic welcome film skip / manual replay (for Settings / Profile preview)
  const triggerManualIntro = useCallback(async (mode: 'welcome' | 'quick' = 'welcome') => {
    return playSincIntro({ mode });
  }, []);

  return {
    state,
    startupTimedOut,
    isReducedMotion,
    handleRetry,
    handleGoToSignIn,
    triggerManualIntro
  };
}
