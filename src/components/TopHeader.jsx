import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../notifications/hooks/useNotifications';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Laptop,
  LogOut,
  User,
  Bookmark,
  Settings,
  Menu,
  X,
  Sparkles,
  Compass,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export default function TopHeader({
  activeTab,
  onSelectTab,
  onSearch,
  onToggleSidebar,
  isSidebarOpen,
  onOpenCreatePost
}) {
  const { user, logout } = useAuth();
  const { theme, effectiveTheme, setTheme } = useTheme();
  const currentUserId = user?.id;
  const { unreadCount: notificationsUnread } = useNotifications(currentUserId);

  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const userDropdownRef = useRef(null);
  const themeDropdownRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target)) {
        setShowThemeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (headerSearchQuery.trim()) {
      if (onSearch) {
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
    await logout();
  };

  const userName = user?.name || 'Alex Rivers';
  const userRole = user?.role || 'Member';
  const username = user?.username ? `@${user.username}` : '@alexrivers';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
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
        >
          <div className="brand-logo-symbol">
            <span className="brand-dot" />
            <span className="brand-wave" />
          </div>
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

      {/* Right Controls: Theme Toggle, Notifications, User Profile */}
      <div className="top-header-right">
        {/* Theme Mode Toggle Button & Dropdown */}
        <div className="header-action-wrapper" ref={themeDropdownRef}>
          <button
            type="button"
            className="header-action-btn theme-toggle-btn"
            onClick={() => setShowThemeDropdown((prev) => !prev)}
            aria-label={`Theme: ${theme}. Click to change.`}
            title={`Current theme: ${theme} (${effectiveTheme})`}
          >
            {effectiveTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {showThemeDropdown && (
            <div className="header-dropdown-menu theme-menu-dropdown" role="menu">
              <div className="dropdown-section-title">Appearance</div>
              <button
                type="button"
                className={`dropdown-item ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => { setTheme('dark'); setShowThemeDropdown(false); }}
                role="menuitem"
              >
                <Moon size={15} />
                <span>Dark Theme</span>
                {theme === 'dark' && <span className="dropdown-check">✓</span>}
              </button>
              <button
                type="button"
                className={`dropdown-item ${theme === 'light' ? 'active' : ''}`}
                onClick={() => { setTheme('light'); setShowThemeDropdown(false); }}
                role="menuitem"
              >
                <Sun size={15} />
                <span>Light Theme</span>
                {theme === 'light' && <span className="dropdown-check">✓</span>}
              </button>
              <button
                type="button"
                className={`dropdown-item ${theme === 'system' ? 'active' : ''}`}
                onClick={() => { setTheme('system'); setShowThemeDropdown(false); }}
                role="menuitem"
              >
                <Laptop size={15} />
                <span>System Default</span>
                {theme === 'system' && <span className="dropdown-check">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Notifications Button */}
        <button
          type="button"
          className={`header-action-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => onSelectTab('notifications')}
          aria-label={`Notifications${notificationsUnread > 0 ? `, ${notificationsUnread} unread` : ''}`}
          title="Notifications"
        >
          <Bell size={18} />
          {notificationsUnread > 0 && (
            <span className="header-badge-count">
              {notificationsUnread > 99 ? '99+' : notificationsUnread}
            </span>
          )}
        </button>

        <div className="header-divider" />

        {/* User Account Pill & Dropdown */}
        <div className="header-user-wrapper" ref={userDropdownRef}>
          <button
            type="button"
            className="header-user-trigger"
            onClick={() => setShowUserDropdown((prev) => !prev)}
            aria-expanded={showUserDropdown}
            aria-label="User Account Menu"
          >
            <div className="header-user-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={userName} className="avatar-img" />
              ) : (
                <span className="avatar-initials">{initials}</span>
              )}
            </div>
            <div className="header-user-meta">
              <span className="header-user-display-name">{userName}</span>
              <span className="header-user-role">{username}</span>
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
