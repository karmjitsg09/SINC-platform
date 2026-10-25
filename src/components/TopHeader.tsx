import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../notifications/hooks/useNotifications';
import {
  Search,
  Bell,
  LogOut,
  User,
  Bookmark,
  Settings,
  Compass,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import SincLogo from './common/SincLogo';

export interface TopHeaderProps {
  activeTab?: string;
  onSelectTab?: (tabId: string) => void;
  onSearch?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onOpenCreatePost?: () => void;
  currentUser?: any;
  currentProfile?: any;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  onLogout?: () => void | Promise<void>;
  showSearchIcon?: boolean;
  onSearchClick?: () => void;
  onNotificationClick?: () => void;
  isNotificationActive?: boolean;
}

export default function TopHeader({
  activeTab = 'home',
  onSelectTab = () => {},
  onSearch,
  onSearchSubmit,
  onToggleSidebar = () => {},
  isSidebarOpen = false,
  currentUser,
  currentProfile,
  unreadNotificationsCount,
  onLogout
}: TopHeaderProps) {
  const { user: authUser, logout: authLogout } = useAuth();
  const user = authUser || currentUser || currentProfile;

  const currentUserId = user?.id;
  const { unreadCount: hookUnreadCount } = useNotifications(
    unreadNotificationsCount === undefined ? currentUserId : null
  );
  const notificationsUnread = unreadNotificationsCount !== undefined
    ? (Number(unreadNotificationsCount) || 0)
    : (hookUnreadCount || 0);

  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerSearchQuery.trim()) {
      if (onSearchSubmit) {
        onSearchSubmit(headerSearchQuery.trim());
      } else if (onSearch) {
        onSearch(headerSearchQuery.trim());
      } else {
        onSelectTab('search');
      }
    } else {
      onSelectTab('search');
    }
  };

  const handleLogout = async () => {
    setShowUserDropdown(false);
    if (onLogout) {
      await onLogout();
    } else if (authLogout) {
      await authLogout();
    }
  };

  const userName = user?.name || 'Alex Rivers';
  const userRole = user?.role || 'Member';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="top-header" role="banner">
      {/* Left branding & visible sidebar collapse/expand toggle */}
      <div className="top-header-left">
        <button
          type="button"
          className="sidebar-toggle-btn mobile-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
        </button>

        <div
          className="brand-logo-container"
          onClick={() => onSelectTab('home')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelectTab('home'); }}
          title="SINC Platform — Home"
          aria-label="SINC Platform — Home"
        >
          <SincLogo size={36} className="topheader-logo" alt="" role="presentation" />
          <span className="brand-title">SINC</span>
          <span className="brand-badge">TECH</span>
        </div>
      </div>

      {/* Center Global Search Field */}
      <div className="top-header-center">
        <form className="global-search-form" onSubmit={handleSearchSubmit}>
          <Search size={16} className="global-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="global-search-input"
            placeholder="Search people, domains, topics..."
            value={headerSearchQuery}
            onChange={(e) => setHeaderSearchQuery(e.target.value)}
            aria-label="Global search query"
          />
          <kbd className="global-search-shortcut" title="Press Enter to search">↵</kbd>
        </form>
      </div>

      {/* Right Controls: Notifications, User Profile */}
      <div className="top-header-right">
        {/* Notifications Bell Button */}
        <button
          type="button"
          id="header-notifications-btn"
          className={`header-action-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => onSelectTab('notifications')}
          aria-label={notificationsUnread > 0 ? `Notifications (${notificationsUnread} unread)` : 'Notifications'}
          title="Notifications"
        >
          <Bell size={18} aria-hidden="true" />
          {notificationsUnread > 0 && (
            <span className="header-badge-count" aria-hidden="true">
              {notificationsUnread > 99 ? '99+' : notificationsUnread}
            </span>
          )}
        </button>

        <div className="header-divider" />

        {/* User Profile Avatar & Dropdown */}
        <div className="header-user-wrapper" ref={userDropdownRef}>
          <button
            type="button"
            id="header-user-menu-btn"
            className={`header-user-trigger ${showUserDropdown ? 'active' : ''}`}
            onClick={() => setShowUserDropdown((prev) => !prev)}
            aria-expanded={showUserDropdown}
            aria-haspopup="menu"
            aria-label="Open profile menu"
            title={`Profile menu — ${userName}`}
          >
            <div className="header-user-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={userName} className="avatar-img" />
              ) : (
                <span className="avatar-initials">{initials}</span>
              )}
            </div>
          </button>

          {showUserDropdown && (
            <div className="header-dropdown-menu user-menu-dropdown" role="menu">
              <div className="user-dropdown-header">
                <p className="user-full-name">{userName}</p>
                <p className="user-email">{user?.email || userRole}</p>
              </div>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-item"
                onClick={() => { onSelectTab('domains'); setShowUserDropdown(false); }}
                role="menuitem"
              >
                <Compass size={15} />
                <span>Domains & Hubs</span>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => { onSelectTab('profile'); setShowUserDropdown(false); }}
                role="menuitem"
              >
                <User size={15} />
                <span>My Profile</span>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => { onSelectTab('saved'); setShowUserDropdown(false); }}
                role="menuitem"
              >
                <Bookmark size={15} />
                <span>Saved Posts</span>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => { onSelectTab('settings'); setShowUserDropdown(false); }}
                role="menuitem"
              >
                <Settings size={15} />
                <span>Settings & Appearance</span>
              </button>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-item logout-item"
                onClick={handleLogout}
                role="menuitem"
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
