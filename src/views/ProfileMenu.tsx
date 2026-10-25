import React from 'react';
import { useAuth } from '../context/AuthContext';
import { playSincIntro } from '../lib/sinc-intro';

export interface ProfileMenuProps {
  onBack?: () => void;
  onSelectProjects?: () => void;
  onSelectExperience?: () => void;
  onSelectEducation?: () => void;
  onSelectCertifications?: () => void;
  onSelectAchievements?: () => void;
  onSelectSavedPosts?: () => void;
  onSelectProfileDetails?: () => void;
  onLogout?: () => Promise<void> | void;
}

export default function ProfileMenu({
  onBack,
  onSelectProjects,
  onSelectExperience,
  onSelectEducation,
  onSelectCertifications,
  onSelectAchievements,
  onSelectSavedPosts,
  onSelectProfileDetails,
  onLogout
}: ProfileMenuProps) {
  const { logout: authLogout } = useAuth();

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    } else if (authLogout) {
      await authLogout();
    }
  };

  const menuItems = [
    {
      id: 'projects',
      title: 'Projects',
      description: 'Manage your projects',
      icon: '📁',
      onClick: onSelectProjects
    },
    {
      id: 'experience',
      title: 'Experience',
      description: 'Manage your professional experience',
      icon: '💼',
      onClick: onSelectExperience
    },
    {
      id: 'education',
      title: 'Education',
      description: 'Manage your academic background',
      icon: '🎓',
      onClick: onSelectEducation
    },
    {
      id: 'certifications',
      title: 'Certifications',
      description: 'Manage your certifications',
      icon: '📜',
      onClick: onSelectCertifications
    },
    {
      id: 'achievements',
      title: 'Achievements',
      description: 'Manage your achievements and honors',
      icon: '🏆',
      onClick: onSelectAchievements
    },
    {
      id: 'professional_profile',
      title: 'Professional Profile',
      description: 'View your detailed professional profile',
      icon: '💼',
      onClick: onSelectProfileDetails
    }
  ];

  return (
    <div className="main-content profile-menu-page">
      <div className="profile-menu-panel">
        {/* Header Row */}
        <div className="profile-menu-header">
          <button
            type="button"
            className="profile-menu-back-btn"
            onClick={onBack}
            aria-label="Back to Profile"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>

          <h2 className="profile-menu-title">
            Profile Menu
          </h2>

          {/* Balance spacer for centering the title */}
          <div style={{ width: '64px' }} />
        </div>

        {/* Profile Sections Management */}
        <div className="profile-menu-section">
          <span className="profile-menu-section-label">
            Profile Sections
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="profile-menu-card"
                onClick={item.onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (item.onClick) item.onClick();
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div className="profile-menu-card-icon">
                    {item.icon}
                  </div>
                  <div className="profile-menu-card-info">
                    <span className="profile-menu-card-title">
                      {item.title}
                    </span>
                    <span className="profile-menu-card-desc">
                      {item.description}
                    </span>
                  </div>
                </div>

                <span className="profile-menu-card-chevron">
                  ›
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Account & Session Section */}
        <div className="profile-menu-section" style={{ marginTop: '8px' }}>
          <span className="profile-menu-section-label">
            Account & Session
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              className="profile-menu-card"
              onClick={onSelectSavedPosts}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onSelectSavedPosts) onSelectSavedPosts();
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="profile-menu-card-icon">
                  🔖
                </div>
                <div className="profile-menu-card-info">
                  <span className="profile-menu-card-title">
                    Saved Posts
                  </span>
                  <span className="profile-menu-card-desc">
                    View posts you saved
                  </span>
                </div>
              </div>

              <span className="profile-menu-card-chevron">
                ›
              </span>
            </div>

            {/* Watch Intro Animation Option */}
            <div
              className="profile-menu-card"
              onClick={() => playSincIntro({ mode: 'welcome' })}
              role="button"
              tabIndex={0}
              id="profile-menu-watch-intro-btn"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  playSincIntro({ mode: 'welcome' });
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="profile-menu-card-icon">
                  🎬
                </div>
                <div className="profile-menu-card-info">
                  <span className="profile-menu-card-title">
                    Watch SINC Intro
                  </span>
                  <span className="profile-menu-card-desc">
                    Replay the full welcome story & animation
                  </span>
                </div>
              </div>

              <span className="profile-menu-card-chevron">
                ›
              </span>
            </div>

            {/* Log Out Option */}
            <div
              className="profile-menu-card profile-menu-card-logout"
              onClick={handleLogout}
              role="button"
              tabIndex={0}
              id="profile-menu-logout-btn"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleLogout();
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="profile-menu-card-icon profile-menu-logout-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </div>
                <div className="profile-menu-card-info">
                  <span className="profile-menu-card-title profile-menu-logout-title">
                    Log Out
                  </span>
                  <span className="profile-menu-card-desc">
                    Sign out of your account
                  </span>
                </div>
              </div>

              <span className="profile-menu-card-chevron profile-menu-logout-chevron">
                ›
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
