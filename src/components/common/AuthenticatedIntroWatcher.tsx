'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import SincIntro from './SincIntro';

export default function AuthenticatedIntroWatcher() {
  const { isAuthenticated, loadingSession, authEvent, authEventType, consumeAuthEvent } = useAuth();

  return (
    <SincIntro
      signedIn={!loadingSession && isAuthenticated}
      authEvent={authEvent}
      authEventType={authEventType}
      consumeAuthEvent={consumeAuthEvent}
    />
  );
}
