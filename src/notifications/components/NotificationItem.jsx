import React, { useState } from 'react';
import { respondToFollowRequest } from '../../lib/socialService';

export default function NotificationItem({ notification, onSelectNotification, currentUserId }) {
  const [requestState, setRequestState] = useState(null); // null | 'accepted' | 'rejected'
  const [loading, setLoading] = useState(false);

  const actor = notification.actor || { name: 'User' };
  const initials = (actor.name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isFollowRequest = notification.type === 'follow_request';

  const handleAccept = async (e) => {
    e.stopPropagation();
    if (loading || requestState) return;
    setLoading(true);

    await respondToFollowRequest(notification.entity_id || null, currentUserId, actor.id, 'accepted');
    setRequestState('accepted');
    setLoading(false);
  };

  const handleReject = async (e) => {
    e.stopPropagation();
    if (loading || requestState) return;
    setLoading(true);

    await respondToFollowRequest(notification.entity_id || null, currentUserId, actor.id, 'rejected');
    setRequestState('rejected');
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
      onClick={() => onSelectNotification(notification)}
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border-app, #e2e8f0)',
        backgroundColor: notification.is_read ? 'var(--bg-card, #ffffff)' : 'rgba(239, 246, 255, 0.75)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: 'pointer',
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
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            fontSize: '14px',
            flexShrink: 0,
            overflow: 'hidden'
          }}
        >
          {actor.avatarUrl ? (
            <img src={actor.avatarUrl} alt={actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>
              {actor.name}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8', flexShrink: 0 }}>
              {formatTimeAgo(notification.created_at)}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
            {notification.message}
          </p>
        </div>
      </div>

      {/* Follow Request Action Buttons */}
      {isFollowRequest && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '56px', marginTop: '2px' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNotification({ ...notification, type: 'view_profile' });
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
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#16a34a' }}>
              ✓ Follow request accepted
            </span>
          ) : requestState === 'rejected' ? (
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
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
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Accepting...' : 'Accept'}
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
                  cursor: 'pointer'
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
