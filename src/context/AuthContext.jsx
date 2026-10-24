import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOAuthRedirectUrl } from '../lib/authConfig';
import { playSincIntro } from '../lib/sinc-intro';

const AuthContext = createContext(null);

// In-flight profile fetch cache to guarantee idempotency and prevent duplicate concurrent database queries/inserts
const activeProfileFetchPromises = new Map();

export function AuthProvider({ children }) {
  const getInitialAuthRoute = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
    if (path === '/signup') return 'signup';
    if (path === '/forgot-password') return 'forgot-password';
    return 'login';
  };

  const hasLikelyStoredSession = () => {
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

  const isOAuthReturnVisit = () => {
    if (typeof window === 'undefined') return false;
    const hasHash = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');
    const hasCode = window.location.search.includes('code=');
    let hasPending = false;
    try {
      hasPending = sessionStorage.getItem('sinc_pending_oauth') === '1';
    } catch (e) {}
    return hasHash || hasCode || hasPending;
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authRoute, setAuthRoute] = useState(getInitialAuthRoute); // 'login' | 'signup' | 'forgot-password'
  const [loadingSession, setLoadingSession] = useState(hasLikelyStoredSession);
  const [oauthError, setOauthError] = useState('');
  const [isPlayingWelcomeStory, setIsPlayingWelcomeStory] = useState(false);

  const welcomeStoryActiveRef = useRef(false);
  const explicitLoginActiveRef = useRef(false);
  const isOAuthCallbackRef = useRef(isOAuthReturnVisit());

  const currentUserRef = useRef(null);
  currentUserRef.current = user;

  const triggerWelcomeStory = async () => {
    if (welcomeStoryActiveRef.current) return;
    welcomeStoryActiveRef.current = true;
    setIsPlayingWelcomeStory(true);
    try {
      await playSincIntro({ mode: 'welcome' });
    } catch (err) {
      console.warn('[Welcome Story Notice]:', err);
    } finally {
      setIsPlayingWelcomeStory(false);
      welcomeStoryActiveRef.current = false;
    }
  };

  // Listen to popstate when unauthenticated to sync login / signup routes
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/signup') setAuthRoute('signup');
      else if (path === '/forgot-password') setAuthRoute('forgot-password');
      else if (path === '/login') setAuthRoute('login');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

        // Clean up URL query parameters without reloading the page
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn('OAuth URL parameter check notice:', e);
    }
  }, []);

  /**
   * Helper to load or initialize user profile from public.profiles.
   *
   * Idempotent & Race-Condition Safe:
   * - Ensures profiles.id strictly matches authUser.id (UUID).
   * - For existing users: preserves all user-edited fields and never overwrites them.
   * - For new users: pre-populates name, username, and avatar URL from Google/OAuth metadata.
   * - Resilient against database schema differences (onboarding columns vs base columns).
   */
  const fetchUserProfile = async (authUser) => {
    if (!authUser || !authUser.id) return null;

    // Deduplicate concurrent fetch requests for the same authenticated user
    if (activeProfileFetchPromises.has(authUser.id)) {
      return activeProfileFetchPromises.get(authUser.id);
    }

    const fetchPromise = (async () => {
      // Extract Google OAuth / auth metadata safely
      const rawGoogleName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split('@')[0] ||
        'User';

      const rawGoogleAvatar =
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        null;

      const emailUsername = (authUser.email?.split('@')[0] || rawGoogleName || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');

      // Baseline fallback representation
      let profileData = {
        id: authUser.id,
        name: rawGoogleName,
        username: `${emailUsername || 'user'}_${authUser.id.substring(0, 4)}`,
        email: authUser.email,
        role: 'Member',
        bio: '',
        avatarUrl: rawGoogleAvatar,
        avatar_url: rawGoogleAvatar,
        skills: [],
        domains: [],
        is_verified: false,
        onboarding_completed: false,
        profile_setup_completed_steps: [],
        isNewUser: false
      };

      if (!isSupabaseConfigured) {
        return profileData;
      }

      try {
        // 1. Check if profile already exists in public.profiles table
        const { data: dbProfile, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        // Also fetch owner private details from user_private_details
        let privateDetails = null;
        try {
          const { data: privData } = await supabase
            .from('user_private_details')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle();
          if (privData) privateDetails = privData;
        } catch (e) {}

        if (!selectError && dbProfile) {
          // EXISTING USER:
          // Strictly preserve existing user-edited data; never overwrite profile data
          const userAvatar = dbProfile.avatar_url || rawGoogleAvatar || null;

          profileData = {
            ...dbProfile,
            id: dbProfile.id,
            name: dbProfile.name || rawGoogleName,
            username: dbProfile.username || profileData.username,
            email: authUser.email,
            role: dbProfile.role || 'Member',
            bio: dbProfile.bio || '',
            avatarUrl: userAvatar,
            avatar_url: userAvatar,
            skills: dbProfile.skills || [],
            domains: dbProfile.domains || [],
            is_verified: Boolean(dbProfile.is_verified),
            onboarding_completed: Boolean(dbProfile.onboarding_completed),
            profile_setup_completed_steps: dbProfile.profile_setup_completed_steps || [],
            first_name: dbProfile.first_name || '',
            last_name: dbProfile.last_name || '',
            location: dbProfile.location || '',
            privacy_settings: privateDetails?.privacy_settings || dbProfile.privacy_settings || { profile_visibility: 'everyone', dob_visibility: 'followers', location_visibility: 'followers', gender_visibility: 'only_me' },
            date_of_birth: privateDetails?.date_of_birth || dbProfile.date_of_birth || null,
            gender: privateDetails?.gender || dbProfile.gender || null,
            gender_custom: privateDetails?.gender_custom || dbProfile.gender_custom || null,
            location_address: privateDetails?.location_address || dbProfile.location_address || '',
            location_landmark: privateDetails?.location_landmark || dbProfile.location_landmark || '',
            location_pincode: privateDetails?.location_pincode || dbProfile.location_pincode || '',
            location_latitude: privateDetails?.location_latitude ?? dbProfile.location_latitude ?? null,
            location_longitude: privateDetails?.location_longitude ?? dbProfile.location_longitude ?? null,
            isNewUser: false
          };

          // If dbProfile exists but has no avatar, and Google provides one, populate avatar fallback
          if (!dbProfile.avatar_url && rawGoogleAvatar) {
            try {
              await supabase
                .from('profiles')
                .update({ avatar_url: rawGoogleAvatar })
                .eq('id', authUser.id);
            } catch (e) {
              // Non-blocking update failure
            }
          }

          return profileData;
        }

        // NEW USER:
        // Profile row does not exist yet. Initialize profile using authUser.id.
        const nameParts = rawGoogleName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const uniqueUsername = `${emailUsername || 'user'}_${authUser.id.substring(0, 4)}`;

        // Attempt creation with onboarding schema columns first
        let newRecord = null;
        try {
          const { data: createdWithOnboarding, error: createError } = await supabase
            .from('profiles')
            .upsert(
              [
                {
                  id: authUser.id, // profiles.id MUST equal auth.users.id
                  name: rawGoogleName,
                  username: uniqueUsername,
                  role: 'Member',
                  avatar_url: rawGoogleAvatar,
                  bio: '',
                  skills: [],
                  domains: [],
                  first_name: firstName,
                  last_name: lastName,
                  onboarding_completed: false,
                  profile_setup_completed_steps: []
                }
              ],
              { onConflict: 'id' }
            )
            .select()
            .single();

          if (!createError && createdWithOnboarding) {
            newRecord = createdWithOnboarding;
          } else if (
            createError &&
            (createError.code === '42703' ||
              createError.code === 'PGRST204' ||
              createError.message?.includes('column') ||
              createError.message?.includes('schema cache'))
          ) {
            // Fallback for base profiles schema without onboarding migration
            const { data: createdBase, error: baseErr } = await supabase
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
                { onConflict: 'id' }
              )
              .select()
              .single();

            if (!baseErr && createdBase) {
              newRecord = createdBase;
            } else if (baseErr) {
              console.warn('[Profile Init Base Fallback error]:', baseErr.message);
            }
          } else if (createError) {
            console.warn('[Profile Init Onboarding error]:', createError.message);
          }
        } catch (insertErr) {
          console.warn('[Profile Init Exception]:', insertErr);
        }

        // Return synthesized profile marked as isNewUser
        profileData = {
          id: authUser.id,
          name: newRecord?.name || rawGoogleName,
          username: newRecord?.username || uniqueUsername,
          email: authUser.email,
          role: newRecord?.role || 'Member',
          bio: newRecord?.bio || '',
          avatarUrl: newRecord?.avatar_url || rawGoogleAvatar || null,
          avatar_url: newRecord?.avatar_url || rawGoogleAvatar || null,
          skills: newRecord?.skills || [],
          domains: newRecord?.domains || [],
          is_verified: false,
          onboarding_completed: Boolean(newRecord?.onboarding_completed),
          profile_setup_completed_steps: newRecord?.profile_setup_completed_steps || [],
          first_name: firstName,
          last_name: lastName,
          isNewUser: true,
          firstIncompleteStep: 1
        };

        return profileData;
      } catch (e) {
        console.warn('Error fetching or initializing user profile from Supabase:', e);
        return profileData;
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

    async function initAuth() {
      const hasLikely = hasLikelyStoredSession();
      // Lightweight flourish guarantee for returning sessions so logo entrance feels intentional and smooth
      const minFlourishPromise = hasLikely
        ? new Promise((resolve) => setTimeout(resolve, 450))
        : Promise.resolve();

      if (isSupabaseConfigured) {
        try {
          const [{ data: { session }, error }] = await Promise.all([
            supabase.auth.getSession(),
            minFlourishPromise
          ]);

          if (error) {
            console.warn('[Supabase getSession notice]:', error.message);
          }

          if (session?.user && isMounted) {
            const profile = await fetchUserProfile(session.user);
            if (isMounted && profile) {
              setUser(profile);
              setIsAuthenticated(true);
            }
          }
        } catch (e) {
          console.warn('[Supabase getSession exception]:', e);
        }
      } else {
        await minFlourishPromise;
      }

      if (isMounted) {
        setLoadingSession(false);
      }
    }

    initAuth();

    if (isSupabaseConfigured) {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        console.log(`[Supabase Auth Event]: ${event}`);

        if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          const isOAuthReturn = isOAuthCallbackRef.current && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION');
          if (isOAuthReturn) {
            isOAuthCallbackRef.current = false;
            try {
              sessionStorage.removeItem('sinc_pending_oauth');
            } catch (e) {}
          }

          const profile = await fetchUserProfile(session.user);
          if (isMounted && profile) {
            setUser(profile);
            setIsAuthenticated(true);
            setLoadingSession(false);

            // If genuine Google OAuth sign-in return, trigger full welcome story once
            if (isOAuthReturn && !explicitLoginActiveRef.current) {
              triggerWelcomeStory();
            }
          }
        } else if (event === 'SIGNED_OUT' || !session) {
          if (isMounted) {
            setUser(null);
            setIsAuthenticated(false);
            setLoadingSession(false);
            setIsPlayingWelcomeStory(false);
          }
        }
      });

      return () => {
        isMounted = false;
        subscription?.unsubscribe();
      };
    }
  }, []);

  /**
   * Initiate Google OAuth sign-in flow.
   * Redirects browser to Google consent screen using Supabase Auth.
   */
  const signInWithGoogle = async () => {
    setOauthError('');

    if (!isSupabaseConfigured) {
      const errorMsg =
        'Supabase credentials are not configured in your .env file. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable Google OAuth.';
      setOauthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      try {
        sessionStorage.setItem('sinc_pending_oauth', '1');
      } catch (e) {}
      const redirectUrl = getOAuthRedirectUrl();
      console.log('[Supabase OAuth] Initiating Google sign-in with redirect URL:', redirectUrl);

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
        console.error('[Supabase OAuth Error]:', error);
        let friendly = error.message;
        if (error.message?.includes('provider is not enabled') || error.message?.includes('Unsupported provider')) {
          friendly =
            'Google Sign-In is not enabled yet in your Supabase project dashboard. Go to Supabase > Authentication > Providers > Google to enable it.';
        }
        setOauthError(friendly);
        return { success: false, error: friendly };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[Supabase OAuth Exception]:', err);
      const friendly = err.message || 'An unexpected error occurred while initiating Google sign-in.';
      setOauthError(friendly);
      return { success: false, error: friendly };
    }
  };

  const login = async (email, password) => {
    setOauthError('');
    explicitLoginActiveRef.current = true;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        });

        if (error) {
          explicitLoginActiveRef.current = false;
          return { success: false, error: error.message };
        }

        if (data.user) {
          const profile = await fetchUserProfile(data.user);
          setUser(profile);
          setIsAuthenticated(true);
          await triggerWelcomeStory();
          explicitLoginActiveRef.current = false;
          return { success: true };
        }
      } catch (e) {
        explicitLoginActiveRef.current = false;
        return { success: false, error: e.message || 'Unable to sign in' };
      }
    }

    // Mock fallback
    const rawName = email.split('@')[0] || 'Alex Rivers';
    const mockUser = {
      id: 'u1',
      name: rawName,
      username: rawName.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      email: email,
      role: 'Senior Developer',
      onboarding_completed: true,
      profile_setup_completed_steps: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    };

    setUser(mockUser);
    setIsAuthenticated(true);
    await triggerWelcomeStory();
    explicitLoginActiveRef.current = false;
    return { success: true };
  };

  const signup = async (name, email, password) => {
    setOauthError('');
    const trimmedEmail = email.trim();
    const trimmedName = name.trim() || 'New User';
    const rawUser = trimmedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    const username = `${rawUser}_${Math.floor(1000 + Math.random() * 9000)}`;

    if (isSupabaseConfigured) {
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

        // Case B: Account created but email confirmation required before session is granted
        if (data.user && !data.session) {
          return {
            success: true,
            requiresEmailConfirmation: true,
            message: 'Account created! Please check your email to confirm your account before signing in.'
          };
        }

        // Case A: Account created and authenticated immediately
        if (data.user && data.session) {
          explicitLoginActiveRef.current = true;
          // Insert row into public.profiles referencing auth.users.id
          try {
            await supabase.from('profiles').upsert([
              {
                id: data.user.id,
                name: trimmedName,
                username: username,
                role: 'Member'
              }
            ]);
          } catch (pe) {
            console.warn('Profile insertion error:', pe);
          }

          const profile = await fetchUserProfile(data.user);
          setUser({ ...profile, isNewUser: true, onboarding_completed: false });
          setIsAuthenticated(true);
          await triggerWelcomeStory();
          explicitLoginActiveRef.current = false;
          return { success: true, user: data.user };
        }
      } catch (e) {
        return { success: false, error: e.message || 'Unable to register account' };
      }
    }

    // Mock fallback (Case A)
    explicitLoginActiveRef.current = true;
    const mockUser = {
      id: `u-${Date.now()}`,
      name: trimmedName,
      username: username,
      email: trimmedEmail,
      role: 'Member',
      isNewUser: true,
      onboarding_completed: false,
      profile_setup_completed_steps: []
    };
    setUser(mockUser);
    setIsAuthenticated(true);
    await triggerWelcomeStory();
    explicitLoginActiveRef.current = false;
    return { success: true };
  };

  const forgotPassword = async (email) => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.resetPasswordForEmail(email.trim());
      } catch (e) {
        // Fallback
      }
    }
    return { success: true };
  };

  const updatePassword = async (newPassword) => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, data };
      } catch (e) {
        return { success: false, error: e.message || 'Unable to update password' };
      }
    }
    return { success: true };
  };

  const updateProfile = async (updatedFields) => {
    // Prevent client-controlled modification of privileged verification field
    const sanitized = { ...updatedFields };
    delete sanitized.is_verified;

    if (user?.id && isSupabaseConfigured && !user.id.startsWith('u-') && user.id !== 'u1') {
      try {
        const dbUpdates = {};
        if (sanitized.name) dbUpdates.name = sanitized.name;
        if (sanitized.role) dbUpdates.role = sanitized.role;
        if (sanitized.avatarUrl) dbUpdates.avatar_url = sanitized.avatarUrl;
        if (sanitized.avatar_url) dbUpdates.avatar_url = sanitized.avatar_url;
        if (sanitized.bio) dbUpdates.bio = sanitized.bio;
        if (sanitized.skills) dbUpdates.skills = sanitized.skills;
        if (sanitized.domains) dbUpdates.domains = sanitized.domains;
        if (sanitized.onboarding_completed !== undefined) {
          dbUpdates.onboarding_completed = sanitized.onboarding_completed;
        }

        if (Object.keys(dbUpdates).length > 0) {
          await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
        }

        // Isolate sensitive private updates to user_private_details
        const privUpdates = {};
        if (sanitized.privacy_settings !== undefined) privUpdates.privacy_settings = sanitized.privacy_settings;
        if (sanitized.date_of_birth !== undefined) privUpdates.date_of_birth = sanitized.date_of_birth;
        if (sanitized.gender !== undefined) privUpdates.gender = sanitized.gender;
        if (sanitized.gender_custom !== undefined) privUpdates.gender_custom = sanitized.gender_custom;
        if (sanitized.location_address !== undefined) privUpdates.location_address = sanitized.location_address;
        if (sanitized.location_area !== undefined) privUpdates.location_area = sanitized.location_area;
        if (sanitized.location_landmark !== undefined) privUpdates.location_landmark = sanitized.location_landmark;
        if (sanitized.location_pincode !== undefined) privUpdates.location_pincode = sanitized.location_pincode;
        if (sanitized.location_latitude !== undefined) privUpdates.location_latitude = sanitized.location_latitude;
        if (sanitized.location_longitude !== undefined) privUpdates.location_longitude = sanitized.location_longitude;

        if (Object.keys(privUpdates).length > 0) {
          try {
            await supabase
              .from('user_private_details')
              .upsert({ user_id: user.id, ...privUpdates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
          } catch (pe) {
            console.warn('Update user_private_details error:', pe);
          }
        }
      } catch (e) {
        console.warn('Update profile error in Supabase:', e);
      }
    }

    setUser((prev) => ({
      ...prev,
      ...sanitized,
      // If user finished onboarding, clear isNewUser flag
      isNewUser: sanitized.onboarding_completed ? false : prev?.isNewUser
    }));
  };

  const logout = async () => {
    welcomeStoryActiveRef.current = false;
    explicitLoginActiveRef.current = false;
    setIsPlayingWelcomeStory(false);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
    setIsAuthenticated(false);
    setUser(null);
    setAuthRoute('login');
    setOauthError('');
    setLoadingSession(false);
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.pushState({ authRoute: 'login' }, '', '/login');
    }
  };

  const navigateAuth = (route) => {
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
        oauthError,
        isPlayingWelcomeStory,
        triggerWelcomeStory,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
