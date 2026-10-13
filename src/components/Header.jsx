import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../notifications/hooks/useNotifications';
import NotificationBadge from '../notifications/components/NotificationBadge';

export default function Header({
  showSearchIcon = true,
  onSearchClick,
  onNotificationClick,
  isNotificationActive = false
}) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const { unreadCount } = useNotifications(currentUserId);

  const userName = user?.name || 'Alex Rivers';
  const userSubtext = user?.role || 'Senior Developer';

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-avatar" title={userName}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={userName} className="header-avatar-img" />
          ) : (
            <span className="header-avatar-initials">{initials}</span>
          )}
        </div>
        <div className="header-user-info">
          <span className="header-user-name">{userName}</span>
          <span className="header-user-subtext">{userSubtext}</span>
        </div>
      </div>

      <div className="header-right">
        {showSearchIcon && (
          <button
            className="header-icon-btn"
            aria-label="Search"
            onClick={onSearchClick}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        )}

        {/* Top-Right Notification Hub Icon (Navigates to /notifications) */}
        <button
          className={`header-icon-btn ${isNotificationActive ? 'active' : ''}`}
          aria-label="Notifications"
          onClick={onNotificationClick}
          style={{ position: 'relative' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <NotificationBadge unreadCount={unreadCount} />
        </button>
      </div>
    </header>
  );
}
