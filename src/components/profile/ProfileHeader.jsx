import React from 'react';

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export default function ProfileHeader({
  profileUser,
  isSelf,
  followInfo,
  loadingAction,
  onFollow,
  onAccept,
  onReject,
  onStartChat,
  onOpenEdit,
  onOpenCreatePost,
  onOpenMenu,
  onBack,
  stats,
  onOpenFollowers,
  onOpenFollowing,
  onScrollToPosts,
  onOpenProfileDetails
}) {
  const avatar = profileUser?.avatarUrl || profileUser?.avatar_url;
  const initials = getInitials(profileUser?.name);
  const username = profileUser?.username || (profileUser?.name ? profileUser.name.toLowerCase().replace(/\s+/g, '') : 'user');
  const role = profileUser?.role || profileUser?.profession || 'Member';

  return (
    <div
      className="profile-header-card"
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '24px',
        border: '1.5px solid var(--border-app, #b5d2fd)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      {/* Top Bar with Back Button & Profile Menu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSelf && onBack && (
            <button
              type="button"
              className="back-btn"
              onClick={onBack}
              aria-label="Back"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#f0f7ff',
                border: '1.5px solid #bfdbfe',
                color: '#1e3860',
                cursor: 'pointer'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
            {isSelf ? 'Profile' : profileUser?.name}
          </h2>
        </div>

        {/* Top-Right Hamburger Menu (Own Profile Only) */}
        {isSelf && onOpenMenu && (
          <button
            type="button"
            className="profile-menu-btn"
            onClick={onOpenMenu}
            aria-label="Profile Menu"
            title="Profile Menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#f0f7ff',
              border: '1.5px solid #bfdbfe',
              color: '#1e3860',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dbeafe';
              e.currentTarget.style.borderColor = '#93c5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f7ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* ──────────────────── Top Divider ──────────────────── */}
      <div style={{ borderBottom: '1.5px solid #e2e8f0', margin: '0 -4px' }} />

      {/* Main Profile Info Row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap'
        }}
      >
        {/* Profile Photo */}
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            backgroundColor: '#bcd5fa',
            border: '2.5px solid #b5d2fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            fontSize: '28px',
            color: '#1e3860',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(181, 210, 253, 0.4)'
          }}
        >
          {avatar ? (
            <img src={avatar} alt={profileUser?.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* User Titles: Name, Username, Role */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #1e3860)', lineHeight: '1.2' }}>
              {profileUser?.name || 'User'}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e3860" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginTop: '2px' }}>
            @{username}
          </div>
          {profileUser?.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              <span style={{ fontSize: '12px' }}>📍</span>
              <span>{profileUser.location}</span>
            </div>
          )}
          <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0369a1', marginTop: '4px' }}>
            {role}
          </div>
          {/* Email: strictly displayed for own profile only */}
          {isSelf && profileUser?.email && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              ✉ {profileUser.email}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {profileUser?.bio && (
        <div
          style={{
            fontSize: '13.5px',
            color: '#334155',
            lineHeight: '1.5',
            padding: '12px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}
        >
          {profileUser.bio}
        </div>
      )}

      {/* Followers | Following Stats Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          borderRadius: '14px',
          border: '1px solid #e2e8f0'
        }}
      >
        <button
          type="button"
          onClick={onOpenFollowers}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '8px',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
            {stats?.followersCount ?? 0}
          </span>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Followers
          </span>
        </button>

        <div style={{ width: '1.5px', height: '20px', backgroundColor: '#cbd5e1' }} />

        <button
          type="button"
          onClick={onOpenFollowing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '8px',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
            {stats?.followingCount ?? 0}
          </span>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Following
          </span>
        </button>

        <div style={{ width: '1.5px', height: '20px', backgroundColor: '#cbd5e1' }} />

        <button
          type="button"
          id="profile-posts-stat-btn"
          onClick={() => {
            if (onScrollToPosts) {
              onScrollToPosts();
            } else {
              document.getElementById('my-posts')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              });
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '8px',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Scroll to posts"
          aria-label={`${stats?.postsCount ?? 0} Posts, click to view posts`}
        >
          <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
            {stats?.postsCount ?? 0}
          </span>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Posts
          </span>
        </button>
      </div>

      {/* Edit Profile / Follow / Message Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {isSelf ? (
          <>
            <button
              type="button"
              id="edit-profile-btn"
              onClick={onOpenEdit}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '10px 18px',
                borderRadius: '12px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              Edit Profile
            </button>
            <button
              type="button"
              id="profile-details-btn"
              onClick={onOpenProfileDetails}
              style={{
                flex: 1,
                minWidth: '100px',
                padding: '10px 18px',
                borderRadius: '12px',
                backgroundColor: '#f0f7ff',
                color: '#1e3860',
                border: '1.5px solid #bfdbfe',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dbeafe';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f7ff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
            >
              Profile
            </button>
            <button
              type="button"
              id="add-post-profile-btn"
              onClick={onOpenCreatePost}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '12px',
                backgroundColor: '#f0f7ff',
                color: '#1e3860',
                border: '1.5px solid #bfdbfe',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dbeafe';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f7ff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
            >
              <span>+</span>
              <span>Add Post</span>
            </button>
          </>
        ) : (
          <>
            {/* Third-party Profile Actions: Follow / Pending / Following */}
            {followInfo?.status === 'none' && (
              <button
                type="button"
                onClick={onFollow}
                disabled={loadingAction}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: loadingAction ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingAction ? '...' : 'Follow'}
              </button>
            )}

            {followInfo?.status === 'pending_sent' && (
              <button
                type="button"
                disabled
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  backgroundColor: '#cbd5e1',
                  color: '#334155',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '13.5px',
                  cursor: 'default'
                }}
              >
                Requested
              </button>
            )}

            {followInfo?.status === 'pending_received' && (
              <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={loadingAction}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    cursor: loadingAction ? 'not-allowed' : 'pointer'
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={loadingAction}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: loadingAction ? 'not-allowed' : 'pointer'
                  }}
                >
                  Reject
                </button>
              </div>
            )}

            {followInfo?.status === 'accepted' && (
              <button
                type="button"
                disabled
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1.5px solid #cbd5e1',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'default'
                }}
              >
                Following
              </button>
            )}

            {/* Profile Details Button (Other User) */}
            <button
              type="button"
              id="other-profile-details-btn"
              onClick={onOpenProfileDetails}
              style={{
                flex: 1,
                minWidth: '100px',
                padding: '10px 16px',
                borderRadius: '12px',
                backgroundColor: '#f0f7ff',
                color: '#1e3860',
                border: '1.5px solid #bfdbfe',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dbeafe';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f7ff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
            >
              Profile
            </button>

            {/* Message Button */}
            <button
              type="button"
              id="message-user-btn"
              onClick={onStartChat}
              disabled={loadingAction}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                flex: 1,
                minWidth: '120px',
                padding: '10px 18px',
                borderRadius: '12px',
                backgroundColor: '#f0f7ff',
                color: '#1e3860',
                border: '1.5px solid #bfdbfe',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: loadingAction ? 'not-allowed' : 'pointer'
              }}
            >
              <span>💬</span>
              <span>Message</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
