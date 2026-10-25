import React from 'react';

export interface ProfileAboutProps {
  bio?: string | null;
}

export default function ProfileAbout({ bio }: ProfileAboutProps) {
  if (!bio || !bio.trim()) return null;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '20px',
        border: '1.5px solid var(--border-app, #b5d2fd)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
      }}
    >
      <h3
        style={{
          margin: '0 0 10px 0',
          fontSize: '13px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#0369a1'
        }}
      >
        About
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          color: '#334155',
          lineHeight: '1.6',
          whiteSpace: 'pre-line'
        }}
      >
        {bio}
      </p>
    </div>
  );
}
