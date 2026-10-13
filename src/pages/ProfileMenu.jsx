import React from 'react';

export default function ProfileMenu({
  onBack,
  onSelectProjects,
  onSelectExperience,
  onSelectEducation,
  onSelectCertifications,
  onSelectAchievements,
  onSelectSavedPosts,
  onSelectProfileDetails
}) {
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

        {/* Account Section */}
        <div className="profile-menu-section" style={{ marginTop: '8px' }}>
          <span className="profile-menu-section-label">
            Account
          </span>

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
        </div>
      </div>
    </div>
  );
}
