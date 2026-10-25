'use client';

import { useEffect, useRef } from 'react';
import { playSincIntro } from '../../lib/sinc-intro';
import type { AuthEvent, AuthEventType } from '@/types';

/**
 * SINC Intro Animation Component
 * Authoritative Animation Lifecycle Controller:
 * - Fresh login (email/password, OAuth, immediate signup): Plays full 16.9s welcome story (with Skip).
 * - Restored session (page reload, new tab with existing session): Plays 2s short logo animation.
 * - Ordinary route navigation: Neither animation replays.
 * - Unauthenticated / failed auth: No animation.
 */
interface SincIntroProps {
  signedIn: boolean;
  authEvent?: AuthEvent | null;
  authEventType?: AuthEventType;
  consumeAuthEvent?: () => any;
}

export default function SincIntro({ signedIn, authEvent, authEventType, consumeAuthEvent }: SincIntroProps) {
  const lastConsumedEventId = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn) {
      lastConsumedEventId.current = null;
      return;
    }

    // Determine the unique event identifier and effective event type
    const eventId = authEvent?.id || (authEventType ? `legacy_${authEventType}_${Date.now()}` : null);
    const eventType = authEvent?.type || authEventType;

    if (!eventId || !eventType) return;

    // Deduplicate identical event instances (e.g. React StrictMode double invocation or concurrent renders)
    if (lastConsumedEventId.current === eventId) {
      if (consumeAuthEvent) consumeAuthEvent();
      return;
    }

    lastConsumedEventId.current = eventId;
    const mode = eventType === 'login' ? 'welcome' : 'quick';
    if (consumeAuthEvent) consumeAuthEvent();

    playSincIntro({ mode });
  }, [signedIn, authEvent, authEventType, consumeAuthEvent]);

  return null;
}
