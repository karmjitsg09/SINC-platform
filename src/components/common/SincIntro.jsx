import { useEffect, useRef } from 'react';
import { playSincIntro } from '../../lib/sinc-intro';

/**
 * SINC Intro Animation Component
 * Runs on the first client-side render of any authenticated page:
 * - Very first visit on a browser: 16.9s welcome film (with Skip)
 * - Every login after that & opening in new tab/window: 2s quick animation
 * - Reloading / navigating inside an already-open tab: nothing (already played)
 */
export default function SincIntro({ signedIn }) {
  const started = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      started.current = false;
      return;
    }
    if (started.current) return; // wait until auth is resolved and user is signed in
    started.current = true;
    playSincIntro();
  }, [signedIn]);

  return null;
}
