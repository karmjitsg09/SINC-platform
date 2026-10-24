import { useEffect, useRef } from 'react';
import { playSincIntro } from '../../lib/sinc-intro';

/**
 * SINC Intro Animation Component
 * Mounts once on the first authenticated render of the application.
 * Runs in 'auto' mode:
 *  - 16.9s full Welcome Film if this browser has never seen it (localStorage.sincWelcomeSeen)
 *  - 5.2s short Intro once per browser session (sessionStorage.sincIntroSeen)
 *  - Nothing if already viewed in this session
 * StrictMode-guarded to prevent double-execution in development.
 */
export default function SincIntro() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React StrictMode guard
    started.current = true;
    playSincIntro(); // auto: welcome film first time, short intro after
  }, []);

  return null;
}
