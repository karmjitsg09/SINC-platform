import React from 'react';
import { useAuth } from '../context/AuthContext';
import SincLogo from './common/SincLogo';

export default function Header({
  showSearchIcon = true,
  onSearchClick
}) {
  const { user, logout } = useAuth();

  const userName = user?.name || 'Alex Rivers';

  const userSubtext = user?.role || 'Senior Developer';

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-brand-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
          <SincLogo size={32} alt="SINC logo" />
          <span style={{ fontWeight: '800', fontSize: '17px', letterSpacing: '-0.02em', color: 'var(--text-main, #0f172a)' }}>SINC</span>
        </div>
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

        {/* Top-Right Log Out Icon */}

        <button
          className="header-icon-btn header-logout-btn"
          aria-label="Log Out"
          title="Log Out"
          id="header-logout-btn"
          onClick={handleLogout}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>
  );
}
