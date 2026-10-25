import React, { useState, useEffect } from 'react';
import { getFollowStatus, sendFollowRequest, respondToFollowRequest } from '../lib/socialService';
import { useAuth } from '../context/AuthContext';

export interface SearchProfileUser {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  role?: string;
  profession?: string;
  is_verified?: boolean;
  skills?: string[];
  [key: string]: any;
}

export interface ProfileSearchResultsProps {
  users?: SearchProfileUser[];
  onSelectProfile?: (user: SearchProfileUser) => void;
  currentUserId?: string;
}

export default function ProfileSearchResults({
  users = [],
  onSelectProfile,
  currentUserId
}: ProfileSearchResultsProps) {
  const { user: currentUser } = useAuth();
  const activeUserId = currentUser?.id || currentUserId;

  const [followStatuses, setFollowStatuses] = useState<Record<string, any>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadStatuses() {
      if (!activeUserId) return;
      const statuses: Record<string, any> = {};
      for (const targetUser of users) {
        if (targetUser.id === activeUserId) {
          statuses[targetUser.id] = { status: 'self' };
        } else {
          const res = await getFollowStatus(activeUserId, targetUser.id);
          statuses[targetUser.id] = res;
        }
      }
      if (isMounted) setFollowStatuses(statuses);
    }
    loadStatuses();
    return () => {
      isMounted = false;
    };
  }, [users, activeUserId]);

  const handleFollowAction = async (e: React.MouseEvent, targetUser: SearchProfileUser) => {
    e.stopPropagation();
    if (!activeUserId) return;
    const currentInfo = followStatuses[targetUser.id] || { status: 'none' };

    if (currentInfo.status === 'none') {
      setFollowStatuses((prev) => ({
        ...prev,
        [targetUser.id]: { status: 'pending_sent' }
      }));
      await sendFollowRequest(activeUserId, targetUser.id);
    } else if (currentInfo.status === 'pending_received') {
      setFollowStatuses((prev) => ({
        ...prev,
        [targetUser.id]: { status: 'accepted' }
      }));
      await respondToFollowRequest(currentInfo.request?.id, activeUserId, targetUser.id, 'accepted');
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="search-results-list">
      {users.map((user) => {
        const initials = getInitials(user.name);
        const followInfo = followStatuses[user.id] || { status: 'none' };
        const status = followInfo.status;

        return (
          <div
            key={user.id}
            className="search-card-item profile-result-item"
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}
            onClick={() => onSelectProfile && onSelectProfile(user)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
              <div className="profile-item-avatar">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="profile-item-info" style={{ flex: 1 }}>
                <div className="profile-item-header">
                  <span className="profile-item-name">
                    {user.name}
                    {user.is_verified && (
                      <span
                        style={{ color: '#2563eb', fontWeight: 800, fontSize: '13.5px', marginLeft: '5px' }}
                        title="Verified Profile"
                      >
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="profile-item-username">@{user.username || user.name.toLowerCase().replace(/\s+/g, '')}</span>
                </div>
                <span className="profile-item-role">{user.role || user.profession}</span>
              </div>
            </div>

            {user.skills && user.skills.length > 0 && (
              <div className="profile-item-skills" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {user.skills.slice(0, 3).map((skill, idx) => (
                  <span key={idx} className="skill-pill">
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Action buttons row */}
            <div
              className="profile-card-actions"
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '4px',
                width: '100%'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="profile-btn-primary"
                style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                onClick={() => onSelectProfile && onSelectProfile(user)}
              >
                View Profile
              </button>

              {status !== 'self' && (
                <button
                  type="button"
                  className={
                    status === 'accepted'
                      ? 'profile-btn-secondary'
                      : status === 'pending_sent'
                      ? 'profile-btn-secondary'
                      : 'profile-btn-primary'
                  }
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '13px',
                    backgroundColor:
                      status === 'accepted'
                        ? '#e2e8f0'
                        : status === 'pending_sent'
                        ? '#cbd5e1'
                        : undefined,
                    color:
                      status === 'accepted' || status === 'pending_sent'
                        ? '#334155'
                        : undefined
                  }}
                  disabled={status === 'pending_sent' || status === 'accepted'}
                  onClick={(e) => handleFollowAction(e, user)}
                >
                  {status === 'accepted'
                    ? 'Following'
                    : status === 'pending_sent'
                    ? 'Requested'
                    : status === 'pending_received'
                    ? 'Accept'
                    : 'Follow'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
