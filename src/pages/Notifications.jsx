import React from 'react';
import { useNotifications } from '../notifications/hooks/useNotifications';
import NotificationItem from '../notifications/components/NotificationItem';
import { useAuth } from '../context/AuthContext';

export default function Notifications({ onSelectNotification }) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(currentUserId);

  const handleSelect = (notif) => {
    markAsRead(notif.id);
    if (onSelectNotification) {
      onSelectNotification(notif);
    }
  };

  return (
    <div className="main-content">
      <div className="content-card">
        {/* Page Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '14px',
            borderBottom: '1.5px solid var(--border-app, #e2e8f0)',
            marginBottom: '16px'
          }}
        >
          <h2 className="page-title" style={{ margin: 0 }}>
            Notifications
          </h2>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Scrollable Notifications List */}
        {loading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b' }}>
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: 'var(--text-main, #334155)' }}>
              You're all caught up!
            </p>
            <p style={{ fontSize: '13px', marginTop: '6px', color: '#94a3b8' }}>
              No new notifications right now.
            </p>
          </div>
        ) : (
          <div className="list-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notification={notif}
                onSelectNotification={handleSelect}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
