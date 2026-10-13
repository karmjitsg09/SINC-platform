import React from 'react';

export default function BottomNav({ activeTab, onSelectTab, hasUnreadMessages }) {
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      )
    },
    {
      id: 'domains',
      label: 'Domains',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9"></circle>
          <circle cx="12" cy="12" r="5" fill="currentColor"></circle>
        </svg>
      )
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
        </svg>
      )
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      )
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )
    }
  ];

  return (
    <div className="bottom-nav-container">
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isMessages = item.id === 'messages';
          const showMessagesUnread = isMessages && hasUnreadMessages;

          return (
            <button
              key={item.id}
              className={`nav-item ${showMessagesUnread ? 'has-unread' : ''}`}
              onClick={() => onSelectTab(item.id)}
              style={{
                position: 'relative',
                backgroundColor: showMessagesUnread && !isActive ? 'rgba(59, 130, 246, 0.08)' : undefined,
                borderRadius: showMessagesUnread && !isActive ? '12px' : undefined
              }}
            >
              <div className="nav-item-icon" style={{ position: 'relative', display: 'inline-flex' }}>
                {item.icon}
                {showMessagesUnread && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-4px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      boxShadow: '0 0 0 2px #ffffff',
                      display: 'inline-block'
                    }}
                  />
                )}
              </div>
              <span className="nav-item-label">{item.label}</span>
              {isActive && <div className="active-dot" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
