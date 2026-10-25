'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { initSocketClient, disconnectSocketClient } from '@/lib/socketService';

export default function SocketInitializer() {
  const auth: any = useAuth();
  const user = auth?.user;
  const isAuthenticated = auth?.isAuthenticated;

  useEffect(() => {
    let isCancelled = false;

    async function setupSocket() {
      if (isAuthenticated && user?.id) {
        let token: string | null = null;
        if (isSupabaseConfigured) {
          try {
            const { data } = await supabase.auth.getSession();
            token = data?.session?.access_token || null;
          } catch (err) {
            console.warn('[SocketInitializer] Failed to retrieve session token:', err);
          }
        }

        if (!isCancelled) {
          if (token) {
            initSocketClient(user.id, token);
          } else {
            console.warn('[SocketInitializer] Missing session token; socket connection suppressed for security.');
            disconnectSocketClient();
          }
        }
      } else {
        disconnectSocketClient();
      }
    }

    setupSocket();

    // Listen for auth state changes (e.g. token refresh or sign-out)
    let subscription: any = null;
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
        if (isCancelled) return;
        if (session?.access_token && user?.id) {
          initSocketClient(user.id, session.access_token);
        } else if (event === 'SIGNED_OUT' || !session) {
          disconnectSocketClient();
        }
      });
      subscription = data?.subscription;
    }

    return () => {
      isCancelled = true;
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [isAuthenticated, user?.id]);

  return null;
}
