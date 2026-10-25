import React, { useState, useEffect } from 'react';
import { respondToFollowRequest } from '../../lib/socialService';
import { rejectAndBlockUser } from '../../lib/blockService';
import RejectFollowRequestModal from '../../components/RejectFollowRequestModal';
import { SincNotification } from '../hooks/useNotifications';
import {
  User,
  UserPlus,
  Check,
  X,
  MessageSquare,
  Heart,
  AtSign,
  Bell
} from 'lucide-react';

export interface NotificationItemProps {
  notification: SincNotification;
  onSelectNotification?: (notification: SincNotification) => void;
  currentUserId?: string | null;
}

export default function NotificationItem({
  notification,
  onSelectNotification,
  currentUserId
}: NotificationItemProps) {
  const [requestState, setRequestState] = useState<string | null>(
    notification.followRequestStatus || null
  ); // null | 'accepted' | 'rejected' | 'pending'
  const [loading, setLoading] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);

  useEffect(() => {
    if (notification.followRequestStatus) {
      setRequestState(notification.followRequestStatus);
    }
  }, [notification.followRequestStatus]);

  const actor = notification.actor || { id: notification.actor_id || 'unknown', name: 'User', username: 'user' };
  const actorAvatar = actor.avatar_url || (actor as any).avatarUrl;
  const initials = (actor.name || actor.username || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isFollowRequest = notification.type === 'follow_request';

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectNotification) {
      onSelectNotification({ ...notification, type: 'view_profile' });
    }
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || requestState === 'accepted') return;
    setLoading(true);

    try {
      const requestId = notification.entity_id || notification.id || null;
      const res = await respondToFollowRequest(requestId, currentUserId, actor.id, 'accepted');
      if (res && res.success) {
        setRequestState('accepted');
      } else {
        console.warn('[NotificationItem] Follow request accept returned:', res?.error);
      }
    } catch (err) {
      console.error('[NotificationItem] Accept follow request failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRejectModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || requestState === 'rejected') return;
    setShowRejectModal(true);
  };

  const handleRejectOnly = async () => {
    setLoading(true);
    try {
      const requestId = notification.entity_id || notification.id || null;
      const res = await respondToFollowRequest(requestId, currentUserId, actor.id, 'rejected');
      if (res && res.success) {
        setRequestState('rejected');
      }
    } catch (err) {
      console.error('[NotificationItem] Reject follow request failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAndBlock = async () => {
    setLoading(true);
    try {
      const requestId = notification.entity_id || notification.id || null;
      const res = await rejectAndBlockUser(actor.id, requestId, currentUserId);
      if (res && res.success) {
        setRequestState('rejected');
      }
    } catch (err) {
      console.error('[NotificationItem] Reject and block user failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (isoString?: string) => {
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

  const renderTypeIcon = () => {
    switch (notification.type) {
      case 'follow_request':
      case 'follow_accepted':
        return <UserPlus size={12} className="text-blue" />;
      case 'post_like':
        return <Heart size={12} className="text-red" fill="currentColor" />;
      case 'post_comment':
      case 'comment_reply':
        return <MessageSquare size={12} className="text-blue" />;
      case 'mention':
        return <AtSign size={12} className="text-purple" />;
      default:
        return <Bell size={12} className="text-blue" />;
    }
  };

  return (
    <div
      className={`notification-item-row ${!notification.is_read ? 'unread' : ''}`}
      onClick={() => onSelectNotification && onSelectNotification(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectNotification && onSelectNotification(notification);
        }
      }}
      aria-label={`Notification from ${actor.name || actor.username || 'User'}: ${notification.message}`}
    >
      {/* 1. Left: Avatar Column */}
      <div className="notif-avatar-col">
        <div className="notif-avatar">
          {actorAvatar ? (
            <img src={actorAvatar} alt={actor.name || actor.username} className="avatar-img" />
          ) : (
            <span className="avatar-initials">{initials}</span>
          )}
        </div>
        <span className={`notif-type-badge ${notification.type}`} title={notification.type}>
          {renderTypeIcon()}
        </span>
      </div>

      {/* 2. Center: Metadata & Message Column */}
      <div className="notif-center-col">
        <div className="notif-header-line">
          <div className="notif-actor-meta">
            <span className="actor-name" title={actor.name || actor.username}>
              {actor.name || actor.username || 'User'}
            </span>
            {actor.username && (
              <span className="actor-handle">@{actor.username}</span>
            )}
          </div>

          <div className="notif-timestamp-wrapper">
            {!notification.is_read && <span className="notif-unread-dot" title="Unread" />}
            <span className="notif-time-ago">{formatTimeAgo(notification.created_at)}</span>
          </div>
        </div>

        <p className="notif-body-message">{notification.message}</p>
      </div>

      {/* 3. Right: Follow Request Action Buttons */}
      {isFollowRequest && (
        <div className="notif-actions-col notif-action-row" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="notif-action-btn notif-sub-btn notif-profile-btn"
            onClick={handleViewProfile}
            title="View Profile"
          >
            <User size={13} />
            <span>View Profile</span>
          </button>

          {requestState === 'accepted' ? (
            <span className="notif-status-badge accepted">
              <Check size={13} strokeWidth={2.5} />
              <span>Accepted</span>
            </span>
          ) : requestState === 'rejected' ? (
            <span className="notif-status-badge rejected">
              <X size={13} strokeWidth={2.5} />
              <span>Declined</span>
            </span>
          ) : (
            <>
              <button
                type="button"
                className="notif-action-btn notif-sub-btn notif-accept-btn"
                onClick={handleAccept}
                disabled={loading}
                title="Accept follow request"
              >
                {loading ? (
                  <span className="notif-btn-spinner" />
                ) : (
                  <Check size={13} strokeWidth={2.5} />
                )}
                <span>{loading ? 'Processing...' : 'Accept'}</span>
              </button>

              <button
                type="button"
                id="reject-notification-btn"
                className="notif-action-btn notif-sub-btn notif-decline-btn"
                onClick={handleOpenRejectModal}
                disabled={loading}
                title="Decline follow request"
              >
                <X size={13} strokeWidth={2.5} />
                <span>Decline</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Reject & Block Confirmation Modal */}
      <RejectFollowRequestModal
        isOpen={showRejectModal}
        targetUser={actor}
        onClose={() => setShowRejectModal(false)}
        onRejectOnly={handleRejectOnly}
        onRejectAndBlock={handleRejectAndBlock}
        loading={loading}
      />
    </div>
  );
}
