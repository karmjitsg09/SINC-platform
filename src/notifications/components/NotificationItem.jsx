import React, { useState, useEffect } from 'react';
import { respondToFollowRequest } from '../../lib/socialService';

export default function NotificationItem({ notification, onSelectNotification, currentUserId }) {
  const [requestState, setRequestState] = useState(notification.followRequestStatus || null); // null | 'accepted' | 'rejected' | 'pending'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (notification.followRequestStatus) {
      setRequestState(notification.followRequestStatus);
    }
  }, [notification.followRequestStatus]);

  const actor = notification.actor || { name: 'User', username: 'user' };
  const actorAvatar = actor.avatar_url || actor.avatarUrl;
  const initials = (actor.name || actor.username || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isFollowRequest = notification.type === 'follow_request';

  const handleAccept = async (e) => {
    e.stopPropagation();
    if (loading || requestState === 'accepted') return;
    setLoading(true);

    const res = await respondToFollowRequest(notification.entity_id || null, currentUserId, actor.id, 'accepted');
    if (res && res.success) {
      setRequestState('accepted');
    }
    setLoading(false);
  };

  const handleReject = async (e) => {
    e.stopPropagation();
    if (loading || requestState === 'rejected') return;
    setLoading(true);

    const res = await respondToFollowRequest(notification.entity_id || null, currentUserId, actor.id, 'rejected');
    if (res && res.success) {
      setRequestState('rejected');
    }
    setLoading(false);
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Just now';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div
      onClick={() => onSelectNotification && onSelectNotification(notification)}
      style={{
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-app, #e2e8f0)',
        backgroundColor: notification.is_read ? 'var(--bg-card, #ffffff)' : 'rgba(239, 246, 255, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Avatar */}
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '14px',
            flexShrink: 0,
            overflow: 'hidden',
            border: '1.5px solid #bfdbfe'
          }}
        >
          {actorAvatar ? (
            <img src={actorAvatar} alt={actor.name || actor.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Notification Content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                {actor.name || actor.username || 'User'}
              </span>
              {actor.username && (
                <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                  @{actor.username}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!notification.is_read && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                    display: 'inline-block'
                  }}
                  title="Unread"
                />
              )}
              <span style={{ fontSize: '12px', color: '#94a3b8', flexShrink: 0 }}>
                {formatTimeAgo(notification.created_at)}
              </span>
            </div>
          </div>

          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#334155', lineHeight: '1.45' }}>
            {notification.message}
          </p>
        </div>
      </div>

      {/* Follow Request Actions */}
      {isFollowRequest && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '56px', marginTop: '2px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectNotification) {
                onSelectNotification({ ...notification, type: 'view_profile' });
              }
            }}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            View Profile
          </button>

          {requestState === 'accepted' ? (
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✓ Follow request accepted
            </span>
          ) : requestState === 'rejected' ? (
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✕ Follow request declined
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAccept}
                disabled={loading}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Processing...' : 'Accept'}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

