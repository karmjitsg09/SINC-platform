import React from 'react';

export interface ProfileItemPostEmbedProps {
  itemRef?: any;
}

export default function ProfileItemPostEmbed({ itemRef }: ProfileItemPostEmbedProps) {
  if (!itemRef) return null;

  const isUpdate = itemRef.source_type?.endsWith('_update');
  const icon = itemRef.icon || (isUpdate ? '🔄' : '📌');
  const label = itemRef.share_label || (isUpdate ? 'Shared an update' : 'Shared a profile item');

  return (
    <div
      className="profile-item-post-embed"
      style={{
        marginTop: '12px',
        marginBottom: '6px',
        backgroundColor: '#f8fafc',
        border: '1.5px solid #bfdbfe',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          backgroundColor: '#eff6ff',
          borderBottom: '1px solid #dbeafe'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '15px' }}>{icon}</span>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: '#0369a1'
            }}
          >
            {label}
          </span>
        </div>
        {itemRef.status && (
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: '700',
              backgroundColor: itemRef.status === 'Completed' ? '#dcfce7' : '#e0f2fe',
              color: itemRef.status === 'Completed' ? '#166534' : '#0369a1',
              padding: '2px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase'
            }}
          >
            {itemRef.status}
          </span>
        )}
      </div>

      {/* Main Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #1e3860)', lineHeight: '1.3' }}>
          {itemRef.title}
        </div>

        {itemRef.subtitle && (
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
            {itemRef.subtitle}
          </div>
        )}

        {itemRef.description && (
          <div
            style={{
              fontSize: '13px',
              color: '#334155',
              lineHeight: '1.5',
              marginTop: '2px'
            }}
          >
            {itemRef.description}
          </div>
        )}

        {/* Thumbnail Image if provided */}
        {itemRef.image_url && (
          <div style={{ marginTop: '6px', borderRadius: '10px', overflow: 'hidden', maxHeight: '240px' }}>
            <img
              src={itemRef.image_url}
              alt={itemRef.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Technologies / Skills Chips */}
        {Array.isArray(itemRef.tags) && itemRef.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {itemRef.tags.map((tag: string, idx: number) => (
              <span
                key={idx}
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  backgroundColor: '#e2e8f0',
                  color: '#334155',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* External Link */}
        {itemRef.link && (
          <div style={{ marginTop: '6px' }}>
            <a
              href={itemRef.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12.5px',
                color: '#2563eb',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>🔗</span>
              <span>View Resource</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
