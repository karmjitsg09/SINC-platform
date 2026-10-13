import React from 'react';

export default function NotificationBadge({ unreadCount }) {
  if (!unreadCount || unreadCount <= 0) return null;

  return (
    <span
      className="notification-unread-dot"
      style={{
        position: 'absolute',
        top: '2px',
        right: '2px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#2563eb',
        border: '1.5px solid #ffffff',
        pointerEvents: 'none'
      }}
    />
  );
}
