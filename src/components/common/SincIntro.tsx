'use client';

import type { AuthEvent, AuthEventType } from '@/types';

/**
 * SINC Intro Animation Bridge (Passive)
 * Authoritative playback is managed exclusively by the central controller in src/lib/animationController.ts.
 */
interface SincIntroProps {
  signedIn?: boolean;
  authEvent?: AuthEvent | null;
  authEventType?: AuthEventType;
  consumeAuthEvent?: () => any;
}

export default function SincIntro(_props: SincIntroProps) {
  return null;
}

