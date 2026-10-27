'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOAuthRedirectUrl } from '../lib/authConfig';
import { resetSincIntroSession } from '../lib/sinc-intro';
import { queryClient } from '../lib/queryClient';
import { useNavigationStore } from '../stores/useNavigationStore';
import { disconnectSocket } from '../lib/socketService';
import { clearAllUserLocalCache } from '../lib/cacheCleanup';
import type { AuthEvent, AuthEventType, UserProfile } from '../types';

export interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  authRoute: string;
  loadingSession: boolean;
  authEvent: AuthEvent | null;
  authEventType: AuthEventType;
  consumeAuthEvent: () => AuthEvent | null;
  oauthError: string;
  clearOauthError: () => void;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string; data?: any }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean; message?: string; user?: any }>;
  forgotPassword: (email: string) => Promise<{ success: boolean }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string; data?: any }>;
  updateProfile: (updatedFields: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  navigateAuth: (route: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// In-flight profile fetch cache to guarantee idempotency and prevent duplicate concurrent database queries/inserts
const activeProfileFetchPromises = new Map<string, Promise<UserProfile | null>>();

// Global generation counter for uniquely identifying every authentication event lifecycle
let globalAuthEventCounter = 0;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const getInitialAuthRoute = (): string => {
    const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
    if (path === '/signup') return 'signup';
    if (path === '/forgot-password') return 'forgot-password';
    return 'login';
  };

  const hasLikelyStoredSession = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const val = localStorage.getItem(key);
          if (val && val !== 'null' && val !== 'undefined') return true;
        }
      }
    } catch (e) {}
    return false;
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authRoute, setAuthRoute] = useState<string>(getInitialAuthRoute);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [oauthError, setOauthError] = useState<string>('');
  const [authEvent, setAuthEventState] = useState<AuthEvent | null>(null);

  const authEventRef = useRef<AuthEvent | null>(null);
  authEventRef.current = authEvent;

  const setAuthEvent = (type: 'login' | 'session_restored' | null) => {
    if (!type) {
      authEventRef.current = null;
      setAuthEventState(null);
      return;
    }
    const eventObj: AuthEvent = {
      id: `auth_evt_${Date.now()}_${++globalAuthEventCounter}`,
      type,
      timestamp: Date.now()
    };
    authEventRef.current = eventObj;
    setAuthEventState(eventObj);
  };

  const consumeAuthEvent = (): AuthEvent | null => {
    const current = authEventRef.current;
    authEventRef.current = null;
    setAuthEventState(null);
    return current;
  };

  const authEventType: AuthEventType = authEvent?.type || null;

  // Listen to popstate when unauthenticated to sync login / signup routes
  useEffect(() => {
    const syncRouteFromPath = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/signup') setAuthRoute('signup');
      else if (path === '/forgot-password') setAuthRoute('forgot-password');
      else if (path === '/login') setAuthRoute('login');
    };
    syncRouteFromPath();
    window.addEventListener('popstate', syncRouteFromPath);
    return () => window.removeEventListener('popstate', syncRouteFromPath);
  }, []);

  // Check URL parameters for OAuth errors on initial page load
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorParam =
        searchParams.get('error_description') ||
        searchParams.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error');

      if (errorParam) {
        const friendlyMessage = errorParam.replace(/\+/g, ' ');
        console.warn('[Supabase OAuth Notice]: OAuth callback reported:', friendlyMessage);
        setOauthError(friendlyMessage);

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn('OAuth URL parameter check notice:', e);
    }
  }, []);

  /**
   * Helper to load or initialize user profile from public.profiles.
   * Ensures profiles.id strictly matches authUser.id.
   */
  const fetchUserProfile = async (authUser: any): Promise<UserProfile | null> => {
    if (!authUser || !authUser.id) return null;

    if (activeProfileFetchPromises.has(authUser.id)) {
      return activeProfileFetchPromises.get(authUser.id)!;
    }

    const fetchPromise = (async (): Promise<UserProfile | null> => {
      const rawGoogleName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split('@')[0] ||
        'User';

      const rawGoogleAvatar =
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        null;

      const emailUsername = authUser.email ? authUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') : '';

      try {
        const { data: dbProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profileErr && profileErr.code !== 'PGRST116') {
          console.warn('[Profile Fetch Notice]:', profileErr.message);
        }

        let privateDetails: any = null;
        try {
          const { data: privData } = await supabase
            .from('user_private_details')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle();
          if (privData) privateDetails = privData;
        } catch (_) {}

        if (dbProfile) {
          const userAvatar = dbProfile.avatar_url || rawGoogleAvatar || null;

          const profileData: UserProfile = {
            id: authUser.id,
            name: dbProfile.name || rawGoogleName,
            username: dbProfile.username || emailUsername || 'user',
            email: authUser.email,
            role: dbProfile.role || 'Member',
            bio: dbProfile.bio || '',
            avatarUrl: userAvatar,
            avatar_url: userAvatar,
            skills: dbProfile.skills || [],
            domains: dbProfile.domains || [],
            is_private: Boolean(dbProfile.is_private),
            isPrivate: Boolean(dbProfile.is_private),
            privacy_settings: privateDetails?.privacy_settings || null,
            onboarding_completed: Boolean(dbProfile.onboarding_completed),
            profile_setup_completed_steps: dbProfile.profile_setup_completed_steps || [],
            isNewUser: false
          };

          if (!dbProfile.avatar_url && rawGoogleAvatar) {
            try {
              await supabase
                .from('profiles')
                .update({ avatar_url: rawGoogleAvatar })
                .eq('id', authUser.id);
            } catch (e) {}
          }

          return profileData;
        }

        // New user initialization with standard core schema fields
        const uniqueUsername = `${emailUsername || 'user'}_${authUser.id.substring(0, 4)}`;

        let newRecord: any = null;
        try {
          const { data: createdBase } = await supabase
            .from('profiles')
            .upsert(
              [
                {
                  id: authUser.id,
                  name: rawGoogleName,
                  username: uniqueUsername,
                  role: 'Member',
                  avatar_url: rawGoogleAvatar,
                  bio: '',
                  skills: [],
                  domains: []
                }
              ],
              { onConflict: 'id', ignoreDuplicates: true }
            )
            .select()
            .maybeSingle();

          if (createdBase) newRecord = createdBase;
        } catch (insertErr) {
          console.warn('[Profile Init Exception]:', insertErr);
        }

        return {
          id: authUser.id,
          name: newRecord?.name || rawGoogleName,
          username: newRecord?.username || uniqueUsername,
          email: authUser.email,
          role: newRecord?.role || 'Member',
          avatarUrl: rawGoogleAvatar,
          avatar_url: rawGoogleAvatar,
          bio: '',
          skills: [],
          domains: [],
          onboarding_completed: false,
          profile_setup_completed_steps: [],
          isNewUser: true
        };
      } catch (err) {
        console.warn('[Fetch Profile Global Exception]:', err);
        return {
          id: authUser.id,
          name: rawGoogleName,
          username: emailUsername || 'user',
          email: authUser.email,
          role: 'Member',
          avatarUrl: rawGoogleAvatar,
          avatar_url: rawGoogleAvatar,
          bio: '',
          skills: [],
          domains: [],
          onboarding_completed: false,
          profile_setup_completed_steps: [],
          isNewUser: false
        };
      }
    })();

    activeProfileFetchPromises.set(authUser.id, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      activeProfileFetchPromises.delete(authUser.id);
    }
  };

  // Initialize and listen to Auth state changes
  useEffect(() => {
    let isMounted = true;
    let safetyTimeoutId: NodeJS.Timeout | null = null;

    // Safety safeguard: Never keep the app waiting longer than 3.5 seconds for initial session check
    safetyTimeoutId = setTimeout(() => {
      if (isMounted) {
        setLoadingSession(false);
      }
    }, 3500);

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          // Handle PKCE OAuth exchange if code is present in URL
          if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
            const code = new URLSearchParams(window.location.search).get('code');
            if (code) {
              try {
                await supabase.auth.exchangeCodeForSession(code);
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
              } catch (codeErr) {
                console.warn('[Supabase OAuth Code Exchange Notice]:', codeErr);
              }
            }
          }

          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.warn('[Supabase getSession notice]:', error.message);
          }

          if (session?.user && isMounted) {
            let isOAuthReturn = false;
            try {
              const pendingOAuth = sessionStorage.getItem('sinc_pending_oauth');
              const hasOAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token=');
              if (pendingOAuth === '1' || hasOAuthHash) {
                isOAuthReturn = true;
                sessionStorage.removeItem('sinc_pending_oauth');
              }
            } catch (_) {}

            const profile = await fetchUserProfile(session.user);
            if (isMounted && profile) {
              setUser(profile);
              setAuthEvent(isOAuthReturn ? 'login' : 'session_restored');
              setIsAuthenticated(true);
            }
          }
        } catch (e) {
          console.warn('[Supabase getSession exception]:', e);
        }
      }

      if (safetyTimeoutId) clearTimeout(safetyTimeoutId);
      if (isMounted) {
        setLoadingSession(false);
      }
    }

    initAuth();

    if (isSupabaseConfigured) {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (!isMounted) return;

        // Defer asynchronous database calls to a non-blocking macrotask
        // to prevent deadlocking supabase-js internal auth state transitions
        setTimeout(async () => {
          if (!isMounted) return;

          if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
            let isOAuth = false;
            try {
              if (sessionStorage.getItem('sinc_pending_oauth') === '1') {
                isOAuth = true;
                sessionStorage.removeItem('sinc_pending_oauth');
              }
            } catch (_) {}

            try {
              const profile = await fetchUserProfile(session.user);
              if (isMounted) {
                if (profile) {
                  setUser(profile);
                } else {
                  // Fallback profile if database row not ready
                  const fallbackProfile: UserProfile = {
                    id: session.user.id,
                    name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                    username: session.user.email?.split('@')[0] || 'user',
                    email: session.user.email,
                    role: 'Member',
                    bio: '',
                    avatarUrl: session.user.user_metadata?.avatar_url || null,
                    avatar_url: session.user.user_metadata?.avatar_url || null,
                    skills: [],
                    domains: [],
                    onboarding_completed: true,
                    profile_setup_completed_steps: [],
                    isNewUser: false
                  };
                  setUser(fallbackProfile);
                }
                if (!authEventRef.current) {
                  setAuthEvent(isOAuth ? 'login' : (event === 'SIGNED_IN' ? 'login' : 'session_restored'));
                }
                setIsAuthenticated(true);
                setLoadingSession(false);
              }
            } catch (err) {
              console.warn('[AuthContext] Deferred profile fetch error:', err);
              if (isMounted) {
                setLoadingSession(false);
              }
            }
          } else if (event === 'SIGNED_OUT' || !session) {
            if (isMounted) {
              setUser(null);
              setIsAuthenticated(false);
              setAuthEvent(null);
              setLoadingSession(false);
            }
          }
        }, 0);
      });

      return () => {
        isMounted = false;
        if (safetyTimeoutId) clearTimeout(safetyTimeoutId);
        subscription?.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
      if (safetyTimeoutId) clearTimeout(safetyTimeoutId);
    };
  }, []);

  const signInWithGoogle = async () => {
    setOauthError('');

    if (!isSupabaseConfigured) {
      const errorMsg = 'Authentication service is not configured. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.';
      setOauthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      try {
        sessionStorage.setItem('sinc_pending_oauth', '1');
      } catch (e) {}
      const redirectUrl = getOAuthRedirectUrl();

      // Standard Supabase OAuth browser redirect
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        setOauthError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: any) {
      const friendly = err.message || 'An unexpected error occurred while initiating Google sign-in.';
      setOauthError(friendly);
      return { success: false, error: friendly };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setOauthError('');
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Authentication service is not configured. Please check your Supabase environment variables.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user);
        setUser(profile);
        setAuthEvent('login');
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: 'Unable to authenticate user session.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Unable to sign in' };
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean; message?: string; user?: any }> => {
    setOauthError('');
    const trimmedEmail = email.trim();
    const trimmedName = name.trim() || 'New User';
    const rawUser = trimmedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    const username = `${rawUser}_${Math.floor(1000 + Math.random() * 9000)}`;

    if (!isSupabaseConfigured) {
      return { success: false, error: 'Authentication service is not configured. Please check your Supabase environment variables.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password,
        options: {
          data: {
            name: trimmedName,
            username: username
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && !data.session) {
        return {
          success: true,
          requiresEmailConfirmation: true,
          message: 'Account created! Please check your email to confirm your account before signing in.'
        };
      }

      if (data.user && data.session) {
        // Trigger handle_new_user (migration 004) is the authoritative single creator
        // of public.profiles and public.user_private_details.
        const profile = await fetchUserProfile(data.user);
        setUser(profile ? { ...profile, isNewUser: true, onboarding_completed: false } : null);
        setAuthEvent('login');
        setIsAuthenticated(true);
        return { success: true, user: data.user };
      }
      return { success: false, error: 'Failed to create user account.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Unable to register account' };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean }> => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.resetPasswordForEmail(email.trim());
      } catch (e) {}
    }
    return { success: true };
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string; data?: any }> => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e.message || 'Unable to update password' };
      }
    }
    return { success: false, error: 'Authentication service not configured' };
  };

  const updateProfile = async (updatedFields: Partial<UserProfile>): Promise<void> => {
    const sanitized = { ...updatedFields };

    if (user?.id && isSupabaseConfigured && !user.id.startsWith('u-')) {
      try {
        const dbUpdates: any = {};
        if (sanitized.name) dbUpdates.name = sanitized.name;
        if (sanitized.role) dbUpdates.role = sanitized.role;
        if (sanitized.avatarUrl) dbUpdates.avatar_url = sanitized.avatarUrl;
        if (sanitized.avatar_url) dbUpdates.avatar_url = sanitized.avatar_url;
        if (sanitized.bio) dbUpdates.bio = sanitized.bio;
        if (sanitized.skills) dbUpdates.skills = sanitized.skills;
        if (sanitized.domains) dbUpdates.domains = sanitized.domains;
        if (sanitized.is_private !== undefined) dbUpdates.is_private = sanitized.is_private;
        if (sanitized.isPrivate !== undefined) dbUpdates.is_private = sanitized.isPrivate;
        if (sanitized.onboarding_completed !== undefined) {
          dbUpdates.onboarding_completed = sanitized.onboarding_completed;
        }

        const { error } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', user.id);

        if (error) {
          throw new Error(error.message);
        }
      } catch (e: any) {
        console.error('Update profile error:', e);
        throw e;
      }
    }

    setUser((prev) => (prev ? {
      ...prev,
      ...sanitized,
      isNewUser: sanitized.onboarding_completed ? false : prev?.isNewUser
    } : null));
  };

  const logout = async (): Promise<void> => {
    // 0. Purge all user cached entities from localStorage so the next user on this device never sees them
    try {
      clearAllUserLocalCache(user?.id);
    } catch (_) {}

    // 1. Reset animation session state
    resetSincIntroSession();

    // 2. Clear TanStack Query server cache to prevent private data leakage
    try {
      queryClient.clear();
    } catch (_) {}

    // 3. Reset Zustand navigation and modal state
    try {
      useNavigationStore.getState().reset();
    } catch (_) {}

    // 4. Disconnect Socket.IO client
    try {
      disconnectSocket();
    } catch (_) {}

    // 5. Sign out from Supabase Auth
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut notice:', e);
      }
    }

    // 6. Reset local state
    setAuthEvent(null);
    setIsAuthenticated(false);
    setUser(null);
    setAuthRoute('login');
    setOauthError('');
    setLoadingSession(false);

    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.pushState({ authRoute: 'login' }, '', '/login');
    }
  };

  const navigateAuth = (route: string) => {
    setAuthRoute(route);
    const targetPath = route === 'login' ? '/login' : route === 'signup' ? '/signup' : '/forgot-password';
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ authRoute: route }, '', targetPath);
    }
  };

  const clearOauthError = () => {
    setOauthError('');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        authRoute,
        loadingSession,
        authEvent,
        authEventType,
        consumeAuthEvent,
        oauthError,
        clearOauthError,
        signInWithGoogle,
        login,
        signup,
        forgotPassword,
        updatePassword,
        updateProfile,
        logout,
        navigateAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
