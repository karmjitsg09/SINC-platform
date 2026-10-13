import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authRoute, setAuthRoute] = useState('login'); // 'login' | 'signup' | 'forgot-password'
  const [loadingSession, setLoadingSession] = useState(true);

  // Helper to load user profile from public.profiles
  const fetchUserProfile = async (authUser) => {
    if (!authUser) return null;

    let profileData = {
      id: authUser.id,
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
      username: (authUser.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, ''),
      email: authUser.email,
      role: 'Member',
      bio: '',
      skills: [],
      domains: [],
      is_verified: false,
      profile_setup_completed_steps: []
    };

    if (isSupabaseConfigured) {
      try {
        const { data: dbProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!error && dbProfile) {
          profileData = {
            id: dbProfile.id,
            name: dbProfile.name || profileData.name,
            username: dbProfile.username || profileData.username,
            email: authUser.email,
            role: dbProfile.role || 'Member',
            bio: dbProfile.bio || '',
            avatarUrl: dbProfile.avatar_url || null,
            skills: dbProfile.skills || [],
            domains: dbProfile.domains || [],
            is_verified: Boolean(dbProfile.is_verified),
            profile_setup_completed_steps: dbProfile.profile_setup_completed_steps || []
          };
        } else if (error && error.code === 'PGRST116') {
          // Row missing, attempt automatic insert
          const { data: newProfile } = await supabase
            .from('profiles')
            .upsert([
              {
                id: authUser.id,
                name: profileData.name,
                username: `${profileData.username}_${authUser.id.substring(0, 4)}`,
                role: 'Member',
                is_verified: false
              }
            ])
            .select()
            .single();

          if (newProfile) {
            profileData = {
              id: newProfile.id,
              name: newProfile.name,
              username: newProfile.username,
              email: authUser.email,
              role: newProfile.role || 'Member',
              bio: newProfile.bio || '',
              avatarUrl: newProfile.avatar_url || null,
              skills: newProfile.skills || [],
              domains: newProfile.domains || [],
              is_verified: Boolean(newProfile.is_verified),
              profile_setup_completed_steps: newProfile.profile_setup_completed_steps || []
            };
          }
        }
      } catch (e) {
        console.warn('Error fetching user profile from Supabase:', e);
      }
    }

    return profileData;
  };

  // Initialize and listen to Auth state changes
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            const profile = await fetchUserProfile(session.user);
            setUser(profile);
            setIsAuthenticated(true);
          }
        } catch (e) {
          console.warn('Supabase getSession error:', e);
        }
      }
      if (isMounted) setLoadingSession(false);
    }

    initAuth();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
          const profile = await fetchUserProfile(session.user);
          setUser(profile);
          setIsAuthenticated(true);
        } else if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setIsAuthenticated(false);
        }
      });

      return () => {
        isMounted = false;
        subscription?.unsubscribe();
      };
    }
  }, []);

  const login = async (email, password) => {
    if (isSupabaseConfigured) {
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
          setIsAuthenticated(true);
          return { success: true };
        }
      } catch (e) {
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
      role: 'Senior Developer'
    };

    setUser(mockUser);
    setIsAuthenticated(true);
    return { success: true };
  };

  const signup = async (name, email, password) => {
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

        if (data.user) {
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
          setUser(profile);
          setIsAuthenticated(true);
          return { success: true, user: data.user };
        }
      } catch (e) {
        return { success: false, error: e.message || 'Unable to register account' };
      }
    }

    // Mock fallback
    const mockUser = {
      id: `u-${Date.now()}`,
      name: trimmedName,
      username: username,
      email: trimmedEmail,
      role: 'Member'
    };
    setUser(mockUser);
    setIsAuthenticated(true);
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

  const updateProfile = async (updatedFields) => {
    if (user?.id && isSupabaseConfigured && !user.id.startsWith('u-') && user.id !== 'u1') {
      try {
        const dbUpdates = {};
        if (updatedFields.name) dbUpdates.name = updatedFields.name;
        if (updatedFields.role) dbUpdates.role = updatedFields.role;
        if (updatedFields.avatarUrl) dbUpdates.avatar_url = updatedFields.avatarUrl;
        if (updatedFields.bio) dbUpdates.bio = updatedFields.bio;
        if (updatedFields.skills) dbUpdates.skills = updatedFields.skills;
        if (updatedFields.domains) dbUpdates.domains = updatedFields.domains;

        if (Object.keys(dbUpdates).length > 0) {
          await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
        }
      } catch (e) {
        console.warn('Update profile error in Supabase:', e);
      }
    }

    setUser((prev) => ({
      ...prev,
      ...updatedFields
    }));
  };

  const logout = async () => {
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
  };

  const navigateAuth = (route) => {
    setAuthRoute(route);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        authRoute,
        loadingSession,
        login,
        signup,
        forgotPassword,
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
