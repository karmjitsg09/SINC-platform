import React from 'react';
import SincLogo from './SincLogo';

/**
 * Short Logo-Only Entrance Flourish for Returning Authenticated Users
 * Displays a lightweight, GPU-accelerated entrance animation of the official
 * transparent SINC emblem while the restored session is validated.
 * Bypasses the 16.9s full welcome film for returning sessions.
 */
export default function SincLogoSplash() {
  return (
    <div className="sinc-logo-splash" role="status" aria-label="Loading SINC">
      <div className="sinc-logo-splash-emblem-wrap">
        <div className="sinc-logo-splash-glow" aria-hidden="true" />
        <div className="sinc-logo-splash-emblem">
          <SincLogo size={76} alt="SINC Logo" priority={true} />
        </div>
      </div>
      <div className="sinc-logo-splash-title">SINC</div>
    </div>
  );
}
