import React from 'react';

export default function ProfileSkills({ skills }) {
  if (!skills || !Array.isArray(skills) || skills.length === 0) return null;

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
        Skills
      </h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {skills.map((skill, idx) => (
          <span
            key={idx}
            className="skill-pill"
            style={{
              padding: '6px 14px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: '600'
            }}
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}
