import React from 'react';
import {
  MapPin,
  Mail,
  Calendar,
  Edit3,
  MessageSquare,
  UserPlus,
  UserCheck,
  Clock,
  Menu as MenuIcon,
  ArrowLeft,
  Plus,
  ExternalLink,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';

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
  onOpenProfileDetails,
  onUnblock
}) {
  const avatar = profileUser?.avatarUrl || profileUser?.avatar_url;
  const coverImage = profileUser?.cover_image || profileUser?.coverUrl;
  const initials = getInitials(profileUser?.name);
  const username = profileUser?.username || (profileUser?.name ? profileUser.name.toLowerCase().replace(/\s+/g, '') : 'user');
  const role = profileUser?.role || profileUser?.profession || 'Member';
  const followStatus = followInfo?.status || 'none';
  const isPending = followStatus === 'pending';
  const isFollowing = followStatus === 'accepted';
  const isBlocked = followInfo?.isBlocked || followStatus === 'blocked';
  const hasIncomingRequest = followInfo?.incomingRequest;

  return (
    <div className="profile-header-card-v2">
      {/* 1. Cover Banner */}
      <div className="profile-cover-banner">
        {coverImage ? (
          <img src={coverImage} alt="Profile Cover" className="cover-img" />
        ) : (
          <div className="cover-gradient-mesh">
            <div className="mesh-accent-1" />
            <div className="mesh-accent-2" />
          </div>
        )}

        {/* Back Button (if viewing other profile) & Menu Button */}
        <div className="cover-top-controls">
          {!isSelf && onBack ? (
            <button
              type="button"
              className="cover-nav-btn"
              onClick={onBack}
              aria-label="Back to previous page"
            >
              <ArrowLeft size={18} />
            </button>
          ) : <div />}

          {isSelf && onOpenMenu && (
            <button
              type="button"
              className="cover-nav-btn"
              onClick={onOpenMenu}
              aria-label="Profile Sections Menu"
              title="Manage profile sections"
            >
              <MenuIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Profile Info Section */}
      <div className="profile-body-wrapper">
        <div className="profile-avatar-row">
          {/* Avatar */}
          <div className="profile-main-avatar">
            {avatar ? (
              <img src={avatar} alt={profileUser?.name || 'User'} className="avatar-img" />
            ) : (
              <span className="avatar-initials">{initials}</span>
            )}
          </div>

          {/* Action Buttons Top Right of Header */}
          <div className="profile-actions-toolbar">
            {isSelf ? (
              <>
                <button
                  type="button"
                  id="edit-profile-btn"
                  className="profile-btn profile-primary-btn"
                  onClick={onOpenEdit}
                >
                  <Edit3 size={15} />
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  id="add-post-profile-btn"
                  className="profile-btn profile-secondary-btn"
                  onClick={onOpenCreatePost}
                >
                  <Plus size={15} />
                  <span>New Post</span>
                </button>
              </>
            ) : isBlocked ? (
              <button
                type="button"
                className="profile-btn profile-secondary-btn"
                onClick={onUnblock}
                disabled={loadingAction}
              >
                <span>Unblock User</span>
              </button>
            ) : hasIncomingRequest ? (
              <div className="incoming-request-actions">
                <span className="incoming-req-label">Requested to follow you:</span>
                <button
                  type="button"
                  className="profile-btn profile-primary-btn"
                  onClick={onAccept}
                  disabled={loadingAction}
                >
                  <Check size={14} />
                  <span>Accept</span>
                </button>
                <button
                  type="button"
                  className="profile-btn profile-danger-btn"
                  onClick={onReject}
                  disabled={loadingAction}
                >
                  <X size={14} />
                  <span>Decline</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={`profile-btn ${isFollowing ? 'profile-secondary-btn' : isPending ? 'profile-secondary-btn' : 'profile-primary-btn'}`}
                  onClick={onFollow}
                  disabled={loadingAction}
                >
                  {loadingAction ? (
                    <span className="btn-spinner" />
                  ) : isFollowing ? (
                    <>
                      <UserCheck size={15} />
                      <span>Following</span>
                    </>
                  ) : isPending ? (
                    <>
                      <Clock size={15} />
                      <span>Requested</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} />
                      <span>Follow</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="profile-btn profile-secondary-btn"
                  onClick={onStartChat}
                  disabled={loadingAction}
                  title="Direct Message"
                >
                  {loadingAction ? (
                    <>
                      <span className="btn-spinner" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare size={15} />
                      <span>Message</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* User Identity Details */}
        <div className="profile-identity-block">
          <div className="profile-title-row">
            <h1 className="profile-display-name">{profileUser?.name || 'User'}</h1>
            <span className="profile-verified-badge" title="Verified Community Member">
              <ShieldCheck size={18} className="verified-icon" />
            </span>
          </div>

          <p className="profile-handle">@{username}</p>
          <p className="profile-role-tag">{role}</p>

          {/* Bio */}
          {profileUser?.bio && (
            <p className="profile-bio-text">{profileUser.bio}</p>
          )}

          {/* Meta Attributes: Location, Website, Email */}
          <div className="profile-meta-chips">
            {profileUser?.location && (
              <div className="meta-chip">
                <MapPin size={13} className="chip-icon" />
                <span>{profileUser.location}</span>
              </div>
            )}

            {isSelf && profileUser?.email && (
              <div className="meta-chip">
                <Mail size={13} className="chip-icon" />
                <span>{profileUser.email}</span>
              </div>
            )}

            {profileUser?.website && (
              <a
                href={profileUser.website.startsWith('http') ? profileUser.website : `https://${profileUser.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="meta-chip meta-link"
              >
                <ExternalLink size={13} className="chip-icon" />
                <span>{profileUser.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
          </div>
        </div>

        {/* 3. Statistics Counter Strip */}
        <div className="profile-stats-strip">
          <button
            type="button"
            className="stat-pill-btn"
            onClick={onScrollToPosts}
            title="View posts"
          >
            <span className="stat-number">{stats?.postsCount ?? 0}</span>
            <span className="stat-label">Posts</span>
          </button>

          <div className="stat-separator" />

          <button
            type="button"
            className="stat-pill-btn"
            onClick={onOpenFollowers}
            title="View followers"
          >
            <span className="stat-number">{stats?.followersCount ?? 0}</span>
            <span className="stat-label">Followers</span>
          </button>

          <div className="stat-separator" />

          <button
            type="button"
            className="stat-pill-btn"
            onClick={onOpenFollowing}
            title="View following"
          >
            <span className="stat-number">{stats?.followingCount ?? 0}</span>
            <span className="stat-label">Following</span>
          </button>
        </div>
      </div>
    </div>
  );
}
