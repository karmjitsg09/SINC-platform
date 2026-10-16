import React, { useState, useMemo } from 'react';
import { useNotifications } from '../notifications/hooks/useNotifications';
import NotificationItem from '../notifications/components/NotificationItem';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  CheckCheck,
  UserPlus,
  AtSign,
  MessageSquare,
  Heart,
  Sparkles
} from 'lucide-react';

export default function Notifications({ onSelectNotification }) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(currentUserId);
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // 'all' | 'requests' | 'mentions' | 'comments' | 'likes'

  const handleSelect = (notif) => {
    markAsRead(notif.id);
    if (onSelectNotification) {
      onSelectNotification(notif);
    }
  };

  // Group and count notifications by category
  const counts = useMemo(() => {
    let requests = 0;
    let mentions = 0;
    let comments = 0;
    let likes = 0;
    let unread = 0;

    notifications.forEach((n) => {
      if (!n.is_read) unread++;
      if (n.type === 'follow_request' || n.type === 'follow_accepted') requests++;
      else if (n.type === 'mention') mentions++;
      else if (n.type === 'post_comment' || n.type === 'comment_reply') comments++;
      else if (n.type === 'post_like') likes++;
    });

    return { all: notifications.length, unread, requests, mentions, comments, likes };
  }, [notifications]);

  // Filter list by selected tab
  const filteredNotifications = useMemo(() => {
    switch (activeFilterTab) {
      case 'requests':
        return notifications.filter((n) => n.type === 'follow_request' || n.type === 'follow_accepted');
      case 'mentions':
        return notifications.filter((n) => n.type === 'mention');
      case 'comments':
        return notifications.filter((n) => n.type === 'post_comment' || n.type === 'comment_reply');
      case 'likes':
        return notifications.filter((n) => n.type === 'post_like');
      default:
        return notifications;
    }
  }, [notifications, activeFilterTab]);

  return (
    <div className="notifications-page-layout">
      <div className="notifications-card-wrapper">
        {/* Header Bar */}
        <div className="notifications-header">
          <div className="notifications-header-left">
            <h1 className="notifications-page-title">Notifications</h1>
            {counts.unread > 0 ? (
              <span className="notif-total-badge" title={`${counts.unread} unread`}>
                {counts.unread}
              </span>
            ) : counts.all > 0 ? (
              <span className="notif-total-badge notif-badge-all" title={`${counts.all} total`}>
                {counts.all}
              </span>
            ) : null}
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="mark-all-read-btn"
              disabled={counts.unread === 0}
              title={counts.unread === 0 ? 'All notifications marked as read' : 'Mark all notifications as read'}
            >
              <CheckCheck size={16} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {/* Filter Category Tabs */}
        <div className="notifications-filter-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeFilterTab === 'all'}
            className={`notif-tab-btn ${activeFilterTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilterTab('all')}
          >
            <Bell size={14} />
            <span>All</span>
            {counts.all > 0 && <span className="tab-count-pill">{counts.all}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilterTab === 'requests'}
            className={`notif-tab-btn ${activeFilterTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveFilterTab('requests')}
          >
            <UserPlus size={14} />
            <span>Follow Requests</span>
            {counts.requests > 0 && <span className="tab-count-pill">{counts.requests}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilterTab === 'mentions'}
            className={`notif-tab-btn ${activeFilterTab === 'mentions' ? 'active' : ''}`}
            onClick={() => setActiveFilterTab('mentions')}
          >
            <AtSign size={14} />
            <span>Mentions</span>
            {counts.mentions > 0 && <span className="tab-count-pill">{counts.mentions}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilterTab === 'comments'}
            className={`notif-tab-btn ${activeFilterTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveFilterTab('comments')}
          >
            <MessageSquare size={14} />
            <span>Comments</span>
            {counts.comments > 0 && <span className="tab-count-pill">{counts.comments}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilterTab === 'likes'}
            className={`notif-tab-btn ${activeFilterTab === 'likes' ? 'active' : ''}`}
            onClick={() => setActiveFilterTab('likes')}
          >
            <Heart size={14} />
            <span>Likes</span>
            {counts.likes > 0 && <span className="tab-count-pill">{counts.likes}</span>}
          </button>
        </div>

        {/* Notifications List Body */}
        {loading ? (
          <div className="notif-loading-box">
            <span className="notif-loading-spinner" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notif-empty-state">
            <div className="empty-bell-circle">
              <Sparkles size={28} className="text-blue" />
            </div>
            <h3>
              {activeFilterTab === 'all'
                ? "You're all caught up!"
                : activeFilterTab === 'requests'
                ? 'No pending follow requests'
                : activeFilterTab === 'mentions'
                ? 'No mentions yet'
                : activeFilterTab === 'comments'
                ? 'No comments yet'
                : 'No likes yet'}
            </h3>
            <p>
              {activeFilterTab === 'all'
                ? 'When someone follows you, comments on your posts, or likes your content, you will see it here.'
                : 'Activity in this category will appear here as soon as it happens.'}
            </p>
          </div>
        ) : (
          <div className="notifications-stream-list">
            {filteredNotifications.map((notif) => (
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
