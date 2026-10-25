import React from 'react';

export interface ProfileDomainsProps {
  domains?: string[] | null;
}

export default function ProfileDomains({ domains }: ProfileDomainsProps) {
  if (!domains || !Array.isArray(domains) || domains.length === 0) return null;

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
          margin: '0 0 12px 0',
          fontSize: '13px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#0369a1'
        }}
      >
        Domains & Interests
      </h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {domains.map((dom, idx) => (
          <span
            key={idx}
            style={{
              padding: '6px 14px',
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              border: '1px solid #bae6fd',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: '700'
            }}
          >
            {dom}
          </span>
        ))}
      </div>
    </div>
  );
}
