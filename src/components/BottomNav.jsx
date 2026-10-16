import React from 'react';

export default function BottomNav({
  activeTab,
  onSelectTab,
  hasUnreadMessages = false,
  unreadMessagesCount = 0
}) {
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    },
    {
      id: 'domains',
      label: 'Domains',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      )
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    }
  ];

  return (
    <div className="bottom-nav-container" role="navigation" aria-label="Floating Bottom Navigation">
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isMessages = item.id === 'messages';
          const showMessagesUnread = isMessages && (hasUnreadMessages || unreadMessagesCount > 0);

          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''} ${showMessagesUnread ? 'has-unread' : ''}`}
              onClick={() => onSelectTab(item.id)}
              aria-label={`${item.label} Navigation`}
              aria-pressed={isActive}
            >
              <div className="nav-item-icon">
                {item.icon}
                {showMessagesUnread && (
                  <span
                    className="bottom-nav-unread-badge"
                    aria-label="Unread messages"
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-4px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      boxShadow: '0 0 0 2px var(--bg-surface, #ffffff)',
                      display: 'inline-block'
                    }}
                  />
                )}
              </div>
              <span className="nav-item-label">{item.label}</span>
              {isActive && <div className="active-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
