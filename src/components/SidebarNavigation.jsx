import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useConversations } from '../messaging/hooks/useConversations';
import {
  Home,
  Compass,
  MessageSquare,
  Search,
  Bookmark,
  User,
  Settings,
  PlusCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  PanelLeftClose
} from 'lucide-react';
import SincLogo from './common/SincLogo';

export default function SidebarNavigation({
  activeTab,
  onSelectTab,
  onOpenCreatePost,
  isMobileOpen,
  onCloseMobile,
  onToggleSidebar
}) {
  const { user, logout } = useAuth();
  const currentUserId = user?.id;
  const { unreadCount: messagesUnread } = useConversations(currentUserId);

  const navItems = [
    {
      id: 'home',
      label: 'Home Feed',
      icon: Home
    },
    {
      id: 'domains',
      label: 'Domains & Hubs',
      icon: Compass
    },
    {
      id: 'messages',
      label: 'Direct Messages',
      icon: MessageSquare,
      badge: messagesUnread > 0 ? (messagesUnread > 99 ? '99+' : messagesUnread) : null
    },
    {
      id: 'search',
      label: 'Explore & Search',
      icon: Search
    },
    {
      id: 'saved',
      label: 'Saved Posts',
      icon: Bookmark
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: User
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings
    }
  ];


  const userName = user?.name || 'Alex Rivers';
  const username = user?.username ? `@${user.username}` : '@alexrivers';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleNavClick = (tabId) => {
    onSelectTab(tabId);
    if ((isMobileOpen || (typeof window !== 'undefined' && window.innerWidth <= 768)) && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar-navigation ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Main Navigation">
        {/* Navigation Header with Title and Collapse Button */}
        <div className="sidebar-header">
          <div
            className="sidebar-header-info"
            onClick={() => handleNavClick('home')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            title="SINC Platform — Home"
          >
            <SincLogo size={22} alt="" role="presentation" />
            <span className="sidebar-header-title">SINC</span>
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => {
              if (isMobileOpen && onCloseMobile) {
                onCloseMobile();
              } else if (onToggleSidebar) {
                onToggleSidebar();
              } else if (onCloseMobile) {
                onCloseMobile();
              }
            }}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>

        {/* Quick Post Action */}
        <div className="sidebar-action-container">
          <button
            type="button"
            className="sidebar-create-post-btn"
            onClick={() => {
              if (onOpenCreatePost) onOpenCreatePost();
              if (isMobileOpen && onCloseMobile) onCloseMobile();
            }}
          >
            <PlusCircle size={18} />
            <span>Create Post</span>
          </button>
        </div>

        {/* Primary Navigation Items List */}
        <nav className="sidebar-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="nav-item-icon-wrapper">
                  <Icon size={19} className="nav-icon" />
                  {item.badge && <span className="nav-icon-badge">{item.badge}</span>}
                </div>
                <span className="nav-item-text">{item.label}</span>
                {item.badge && <span className="nav-pill-badge">{item.badge}</span>}
                {isActive && <div className="nav-active-pill" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Profile Section */}
        <div className="sidebar-footer">
          <div
            className="sidebar-user-card"
            onClick={() => handleNavClick('profile')}
            role="button"
            tabIndex={0}
            title="View your profile"
          >
            <div className="sidebar-user-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={userName} className="avatar-img" />
              ) : (
                <span className="avatar-initials">{initials}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{userName}</span>
              <span className="sidebar-user-handle">{username}</span>
            </div>
            <ChevronRight size={15} className="sidebar-chevron" />
          </div>

          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={logout}
            title="Log Out"
            aria-label="Log out of SINC platform"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
