import React, { useRef, useEffect } from 'react';
import NotificationItem from './NotificationItem';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationPanel({ isOpen, onClose, onNavigateEntity, currentUserId }) {
  const panelRef = useRef(null);
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(currentUserId);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectNotification = (notif) => {
    markAsRead(notif.id);
    if (onNavigateEntity) {
      onNavigateEntity(notif);
    }
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: '48px',
        right: '12px',
        width: '340px',
        maxHeight: '460px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        border: '1px solid var(--border-color, #e2e8f0)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card, #ffffff)'
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary, #0f172a)' }}>
          Notifications
        </span>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center'
          }}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Notifications Body List */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '340px' }}>
        {loading ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#334155' }}>
              You're all caught up!
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              No new notifications right now.
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onSelectNotification={handleSelectNotification}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      {/* Panel Footer */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            backgroundColor: 'var(--bg-surface-secondary, #f8fafc)',
            textAlign: 'center'
          }}
        >
          <button
            type="button"
            onClick={markAllAsRead}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary-blue, #2563eb)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}
