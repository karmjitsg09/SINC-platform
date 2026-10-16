import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { users as defaultUsers } from '../data/mockData';
import { getFollowStatus, sendFollowRequest, searchProfiles } from '../lib/socialService';
import { isBlockedSync } from '../lib/blockService';
import { Users, UserPlus, Check, Clock } from 'lucide-react';

export default function WhoToFollowWidget({ onNavigateToProfile }) {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [followStatuses, setFollowStatuses] = useState({});
  const [loadingAction, setLoadingAction] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function loadCandidates() {
      // Filter out current user and blocked users
      let candidates = defaultUsers.filter((u) => {
        if (currentUserId && u.id === currentUserId) return false;
        if (currentUserId && isBlockedSync(currentUserId, u.id)) return false;
        return true;
      });

      // Try fetching active real profiles if available
      try {
        const liveProfiles = await searchProfiles('', currentUserId);
        if (Array.isArray(liveProfiles) && liveProfiles.length > 0) {
          const validLive = liveProfiles.filter((p) => {
            if (currentUserId && p.id === currentUserId) return false;
            if (currentUserId && isBlockedSync(currentUserId, p.id)) return false;
            return true;
          });
          if (validLive.length >= 3) {
            candidates = validLive;
          }
        }
      } catch (e) {
        // Fallback to candidates
      }

      const topCandidates = candidates.slice(0, 4);
      if (!isMounted) return;
      setRecommendedUsers(topCandidates);

      // Fetch follow status for each candidate
      if (currentUserId) {
        const statuses = {};
        for (const u of topCandidates) {
          try {
            const res = await getFollowStatus(currentUserId, u.id);
            statuses[u.id] = res?.status || 'none';
          } catch (e) {
            statuses[u.id] = 'none';
          }
        }
        if (isMounted) setFollowStatuses(statuses);
      }
    }

    loadCandidates();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const handleFollowClick = async (e, targetUser) => {
    e.stopPropagation();
    if (!currentUserId || loadingAction[targetUser.id]) return;

    setLoadingAction((prev) => ({ ...prev, [targetUser.id]: true }));
    try {
      const res = await sendFollowRequest(currentUserId, targetUser.id);
      if (res && res.success) {
        setFollowStatuses((prev) => ({
          ...prev,
          [targetUser.id]: res.status === 'accepted' ? 'accepted' : 'pending'
        }));
      }
    } catch (err) {
      console.warn('Failed to send follow request:', err);
    } finally {
      setLoadingAction((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (recommendedUsers.length === 0) return null;

  return (
    <div className="right-widget-card who-to-follow-widget">
      <div className="widget-header">
        <div className="widget-header-title">
          <Users size={17} className="widget-icon text-blue" />
          <h3>Who to Follow</h3>
        </div>
      </div>

      <div className="recommended-users-list">
        {recommendedUsers.map((recUser) => {
          const status = followStatuses[recUser.id] || 'none';
          const isPending = status === 'pending';
          const isFollowing = status === 'accepted';
          const isLoading = loadingAction[recUser.id];
          const initials = getInitials(recUser.name);

          return (
            <div
              key={recUser.id}
              className="recommended-user-row"
              onClick={() => onNavigateToProfile && onNavigateToProfile(recUser)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onNavigateToProfile && onNavigateToProfile(recUser); }}
            >
              <div className="rec-user-avatar">
                {recUser.avatar_url || recUser.avatarUrl ? (
                  <img src={recUser.avatar_url || recUser.avatarUrl} alt={recUser.name} className="avatar-img" />
                ) : (
                  <span className="avatar-initials">{initials}</span>
                )}
              </div>

              <div className="rec-user-meta">
                <span className="rec-user-name">{recUser.name}</span>
                <span className="rec-user-role">{recUser.role || recUser.bio || 'Member'}</span>
              </div>

              <button
                type="button"
                className={`rec-follow-btn ${isFollowing ? 'following' : ''} ${isPending ? 'pending' : ''}`}
                onClick={(e) => handleFollowClick(e, recUser)}
                disabled={isLoading || isFollowing}
                title={isFollowing ? 'Following' : isPending ? 'Request Pending' : 'Follow'}
              >
                {isLoading ? (
                  <span className="btn-spinner" />
                ) : isFollowing ? (
                  <>
                    <Check size={13} />
                    <span>Following</span>
                  </>
                ) : isPending ? (
                  <>
                    <Clock size={13} />
                    <span>Requested</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
