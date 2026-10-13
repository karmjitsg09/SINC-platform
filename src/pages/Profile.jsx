import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getFollowStatus, sendFollowRequest, respondToFollowRequest } from '../lib/socialService';
import { createPost as createPostService, getPostsByAuthor, subscribeToPostState } from '../lib/postService';
import { FEED_CATEGORIES } from '../data/mockData';
import {
  getProfileStats,
  updateBasicProfile,
  subscribeToProfileState
} from '../lib/profileService';
import { getOrCreateDirectConversation } from '../messaging/services/conversationService';

import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileFollowersModal from '../components/profile/ProfileFollowersModal';
import ProfileFollowingModal from '../components/profile/ProfileFollowingModal';
import ProfileEditModal from '../components/profile/ProfileEditModal';
import ProfileSetupWizard from '../components/profile/ProfileSetupWizard';
import PostCardInteractions from '../components/PostCardInteractions';
import PostInsightsModal from '../components/PostInsightsModal';
import PostMedia from '../components/PostMedia';
import ProfileItemPostEmbed from '../components/profile/ProfileItemPostEmbed';
import { parseProfileItemRef } from '../lib/profileItemPostService';

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function Profile({
  targetUser,
  onBack,
  onOpenConversation,
  onOpenCreatePost,
  onNavigateToProfile,
  onOpenMenu,
  onOpenProfileDetails
}) {
  const { user: currentUser, updateProfile: updateAuthProfile, logout } = useAuth();

  const isSelf = !targetUser || (currentUser?.id && targetUser.id === currentUser.id);
  const activeUserId = isSelf ? currentUser?.id : targetUser?.id;

  // Profile data & loading states
  const [profileData, setProfileData] = useState(isSelf ? currentUser : targetUser);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // Stats
  const [stats, setStats] = useState({ followersCount: 0, followingCount: 0, postsCount: 0 });

  // Follow status state (for other user's profile)
  const [followInfo, setFollowInfo] = useState({ status: 'none', request: null });
  const [loadingAction, setLoadingAction] = useState(false);

  // User posts state
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [insightsPost, setInsightsPost] = useState(null);

  // Modals & Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);


  // Create post modal state (internal fallback)
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postDomain, setPostDomain] = useState('tech');
  const [isPublishingPost, setIsPublishingPost] = useState(false);

  // 1. Fetch Profile, Stats and Projects from Database
  const fetchProfileDetails = useCallback(async (isMountedRef) => {
    if (!activeUserId) {
      if (isMountedRef?.current !== false) setLoadingProfile(false);
      return;
    }

    try {
      setProfileError(null);

      // Load cached wizard metadata if present
      let savedWizardMeta = {};
      try {
        const rawMeta = localStorage.getItem(`sync_profile_wizard_${activeUserId}`);
        if (rawMeta) savedWizardMeta = JSON.parse(rawMeta);
      } catch (e) {}

      // Load cached structured location if present
      let savedLocationData = {};
      try {
        const rawLoc = localStorage.getItem(`sync_profile_location_${activeUserId}`);
        if (rawLoc) savedLocationData = JSON.parse(rawLoc);
      } catch (e) {}

      // Fetch base profile from public.profiles
      let userObj = isSelf ? currentUser : targetUser;
      if (isSupabaseConfigured) {
        const { data: dbProfile, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', activeUserId)
          .maybeSingle();

        if (!pErr && dbProfile) {
          userObj = {
            id: dbProfile.id,
            name: dbProfile.name || userObj?.name || 'User',
            username: dbProfile.username || userObj?.username || 'user',
            role: dbProfile.role || userObj?.role || 'Member',
            email: isSelf ? (currentUser?.email || userObj?.email) : null,
            bio: dbProfile.bio || '',
            avatarUrl: dbProfile.avatar_url || null,
            avatar_url: dbProfile.avatar_url || null,
            skills: dbProfile.skills || [],
            domains: dbProfile.domains || [],
            location: dbProfile.location || savedLocationData?.displayLocation || userObj?.location || '',
            location_place_name: dbProfile.location_place_name || savedLocationData?.placeName || '',
            location_address: dbProfile.location_address || savedLocationData?.address || '',
            location_area: dbProfile.location_area || savedLocationData?.area || '',
            location_landmark: dbProfile.location_landmark || savedLocationData?.landmark || '',
            location_city: dbProfile.location_city || savedLocationData?.city || '',
            location_state: dbProfile.location_state || savedLocationData?.state || '',
            location_country: dbProfile.location_country || savedLocationData?.country || 'India',
            location_pincode: dbProfile.location_pincode || savedLocationData?.pincode || '',
            location_latitude: dbProfile.location_latitude ?? savedLocationData?.latitude ?? null,
            location_longitude: dbProfile.location_longitude ?? savedLocationData?.longitude ?? null,
            locationData: savedLocationData,
            ...savedWizardMeta
          };
        }
      } else {
        userObj = { ...userObj, ...savedWizardMeta, ...savedLocationData };
      }

      // Fetch database stats
      const statsData = await getProfileStats(activeUserId);

      if (isMountedRef?.current !== false) {
        if (userObj) setProfileData(userObj);
        setStats(statsData);
        setLoadingProfile(false);
      }
    } catch (err) {
      console.error('[Profile] fetchProfileDetails error:', err);
      if (isMountedRef?.current !== false) {
        setProfileError('Unable to load profile.');
        setLoadingProfile(false);
      }
    }
  }, [activeUserId, isSelf, currentUser, targetUser]);

  // 2. Fetch User Posts
  const fetchUserPosts = useCallback(async (isMountedRef) => {
    if (!activeUserId) return;
    try {
      if (isMountedRef?.current !== false) setLoadingPosts(true);
      const posts = await getPostsByAuthor(activeUserId);
      if (isMountedRef?.current !== false) {
        setUserPosts(posts || []);
        setLoadingPosts(false);
      }
    } catch (err) {
      console.error('[Profile] fetchUserPosts error:', err);
      if (isMountedRef?.current !== false) setLoadingPosts(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    const isMounted = { current: true };
    fetchProfileDetails(isMounted);
    fetchUserPosts(isMounted);

    // Subscribe to post mutations
    const unsubPost = subscribeToPostState(() => {
      fetchUserPosts(isMounted);
      getProfileStats(activeUserId).then((s) => {
        if (isMounted.current) setStats(s);
      });
    });

    // Subscribe to profile mutations
    const unsubProfile = subscribeToProfileState(() => {
      fetchProfileDetails(isMounted);
    });

    return () => {
      isMounted.current = false;
      unsubPost();
      unsubProfile();
    };
  }, [fetchProfileDetails, fetchUserPosts, activeUserId]);

  // 3. Fetch Follow Status for Other User
  useEffect(() => {
    if (isSelf || !currentUser?.id || !activeUserId) return;
    let isSubscribed = true;

    async function checkStatus() {
      try {
        const info = await getFollowStatus(currentUser.id, activeUserId);
        if (isSubscribed) setFollowInfo(info);
      } catch (err) {
        console.error('[Profile] checkStatus error:', err);
      }
    }

    checkStatus();
    return () => { isSubscribed = false; };
  }, [isSelf, currentUser?.id, activeUserId]);

  // Follow Actions
  const handleFollow = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setLoadingAction(true);
    setFollowInfo((prev) => ({ ...prev, status: 'pending_sent' }));
    await sendFollowRequest(currentUser.id, activeUserId);
    setLoadingAction(false);
  };

  const handleAccept = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction || !followInfo.request?.id) return;
    setLoadingAction(true);
    setFollowInfo((prev) => ({ ...prev, status: 'accepted' }));
    setStats((prev) => ({ ...prev, followersCount: prev.followersCount + 1 }));
    await respondToFollowRequest(followInfo.request.id, currentUser.id, activeUserId, 'accepted');
    setLoadingAction(false);
  };

  const handleReject = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setLoadingAction(true);
    setFollowInfo({ status: 'none', request: null });
    await respondToFollowRequest(followInfo.request?.id, currentUser.id, activeUserId, 'rejected');
    setLoadingAction(false);
  };

  const handleStartChat = async () => {
    if (!onOpenConversation || isSelf || !currentUser?.id || !activeUserId) return;
    setLoadingAction(true);
    const conversation = await getOrCreateDirectConversation(currentUser.id, activeUserId, profileData);
    setLoadingAction(false);
    onOpenConversation(conversation);
  };

  // Save profile updates from ProfileSetupWizard or ProfileEditModal
  const handleSaveProfile = async (updates) => {
    if (!currentUser?.id) return;

    // Cache wizard metadata
    try {
      localStorage.setItem(`sync_profile_wizard_${currentUser.id}`, JSON.stringify(updates));
      if (updates.locationData || updates.location) {
        localStorage.setItem(`sync_profile_location_${currentUser.id}`, JSON.stringify(updates.locationData || { displayLocation: updates.location }));
      }
    } catch (e) {}

    await updateBasicProfile(currentUser.id, updates);
    if (updateAuthProfile) {
      updateAuthProfile(updates);
    }
    setProfileData((prev) => ({
      ...prev,
      ...updates,
      avatar_url: updates.avatarUrl || updates.avatar_url || prev?.avatar_url
    }));
    setIsWizardOpen(false);
    setShowEditModal(false);
  };

  // Profile Completion Evaluation (Real sections check)
  const profileCompletion = useMemo(() => {
    if (!profileData) return { percentage: 0, completedSections: [], incompleteSections: [] };

    const sections = [
      {
        id: 'basic',
        name: 'Basic Information',
        step: 1,
        isComplete: Boolean(profileData.name && profileData.username && (profileData.avatar_url || profileData.avatarUrl))
      },
      {
        id: 'location',
        name: 'Location',
        step: 2,
        isComplete: Boolean(profileData.location_city || profileData.location)
      },
      {
        id: 'profession',
        name: 'Profession',
        step: 3,
        isComplete: Boolean(profileData.role && profileData.role !== 'Member') || Boolean(profileData.profession_type)
      },
      {
        id: 'skills',
        name: 'Skills & Expertise',
        step: 4,
        isComplete: Boolean(
          (Array.isArray(profileData.skills) && profileData.skills.length > 0) ||
          (Array.isArray(profileData.skills_technical) && profileData.skills_technical.length > 0)
        )
      },
      {
        id: 'portfolio',
        name: 'Portfolio & Links',
        step: 5,
        isComplete: Boolean(profileData.portfolio_url || profileData.github_url || profileData.linkedin_url)
      },
      {
        id: 'domains',
        name: 'Domains',
        step: 8,
        isComplete: Boolean(Array.isArray(profileData.domains) && profileData.domains.length > 0)
      }
    ];

    const completed = sections.filter((s) => s.isComplete);
    const incomplete = sections.filter((s) => !s.isComplete);
    const percentage = Math.round((completed.length / sections.length) * 100);

    return {
      percentage,
      completedSections: completed,
      incompleteSections: incomplete
    };
  }, [profileData]);

  const handleOpenWizardAtStep = (stepNumber) => {
    setWizardInitialStep(stepNumber);
    setIsWizardOpen(true);
  };



  // Internal Post Creation
  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    setIsPublishingPost(true);
    try {
      const newPost = await createPostService({
        authorId: currentUser?.id,
        content: postContent.trim(),
        title: postTitle.trim(),
        domain: postDomain
      });

      setIsPublishingPost(false);
      setShowCreatePostModal(false);
      setPostTitle('');
      setPostContent('');

      if (newPost) {
        setUserPosts((prev) => [newPost, ...prev]);
        setStats((prev) => ({ ...prev, postsCount: prev.postsCount + 1 }));
      }
    } catch (err) {
      console.error('[Profile] Publish post error:', err);
      setIsPublishingPost(false);
      alert(err.message || 'Failed to publish post.');
    }
  };

  // Loading State
  if (loadingProfile && !profileData) {
    return (
      <div className="main-content">
        <div className="content-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  // Error State
  if (profileError && !profileData) {
    return (
      <div className="main-content">
        <div className="content-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main, #1e3860)', margin: '0 0 8px 0' }}>
            Unable to load profile.
          </h3>
          <button
            type="button"
            onClick={() => fetchProfileDetails({ current: true })}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Multi-step Profile Setup / Edit Wizard (Image flow)
  if (isWizardOpen && isSelf) {
    return (
      <div className="main-content">
        <div className="content-card" style={{ padding: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
          <ProfileSetupWizard
            profileUser={profileData}
            onSave={handleSaveProfile}
            onCancel={() => setIsWizardOpen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="content-card profile-content-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 1. PROFILE HEADER & STATS */}
        <ProfileHeader
          profileUser={profileData}
          isSelf={isSelf}
          followInfo={followInfo}
          loadingAction={loadingAction}
          onFollow={handleFollow}
          onAccept={handleAccept}
          onReject={handleReject}
          onStartChat={handleStartChat}
          onOpenEdit={() => setIsWizardOpen(true)}
          onOpenCreatePost={() => onOpenCreatePost ? onOpenCreatePost() : setShowCreatePostModal(true)}
          onOpenMenu={onOpenMenu}
          onBack={onBack}
          stats={stats}
          onOpenFollowers={() => setShowFollowersModal(true)}
          onOpenFollowing={() => setShowFollowingModal(true)}
          onScrollToPosts={() => {
            const el = document.getElementById('my-posts');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          onOpenProfileDetails={() => {
            if (onOpenProfileDetails) {
              onOpenProfileDetails(profileData || targetUser || currentUser);
            }
          }}
        />

        {/* 2. PROFILE COMPLETION INDICATOR (OWNER-ONLY) */}
        {isSelf && profileCompletion.percentage < 100 && (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '18px 20px',
              border: '1.5px solid var(--border-app, #b5d2fd)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📊</span>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#1e3860' }}>
                  Profile Completion
                </h3>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#2563eb' }}>
                {profileCompletion.percentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${profileCompletion.percentage}%`,
                  height: '100%',
                  backgroundColor: '#2563eb',
                  borderRadius: '6px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>

            {/* Incomplete Sections Warnings & Quick Action Buttons */}
            {profileCompletion.incompleteSections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                  Incomplete sections:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {profileCompletion.incompleteSections.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleOpenWizardAtStep(sec.step)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#92400e',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>⚠</span>
                      <span>Complete {sec.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. POSTS SECTION */}
        <div
          id="my-posts"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            border: '1.5px solid var(--border-app, #b5d2fd)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            scrollMarginTop: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#0369a1'
              }}
            >
              {isSelf ? 'My Posts' : `Posts by ${profileData?.name || 'User'}`}
            </h3>
            {isSelf && (
              <button
                type="button"
                onClick={() => onOpenCreatePost ? onOpenCreatePost() : setShowCreatePostModal(true)}
                style={{
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: '#2563eb',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                + Add Post
              </button>
            )}
          </div>

          {loadingPosts ? (
            <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
              Loading posts...
            </div>
          ) : userPosts.length === 0 ? (
            <div
              style={{
                fontSize: '13px',
                color: '#64748b',
                textAlign: 'center',
                padding: '24px 12px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1'
              }}
            >
              No posts created yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {userPosts.map((post) => {
                const isOwner = currentUser?.id && (post.user_id === currentUser.id || post.author_id === currentUser.id);

                return (
                  <div
                    key={post.id}
                    style={{
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          padding: '2px 8px',
                          borderRadius: '8px'
                        }}
                      >
                        {post.domain_id || post.domain || 'Tech'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isOwner && (
                          <button
                            type="button"
                            className="post-info-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInsightsPost(post);
                            }}
                            title="Post Insights"
                            aria-label="Post Insights"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%'
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="16" x2="12" y2="12"></line>
                              <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                          </button>
                        )}
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {formatTimeAgo(post.created_at)}
                        </span>
                      </div>
                    </div>

                    {(() => {
                      const { caption, itemRef } = parseProfileItemRef(post.content);
                      return (
                        <>
                          {caption && (
                            <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.45', margin: '0 0 8px 0', whiteSpace: 'pre-line' }}>
                              {caption}
                            </p>
                          )}
                          {itemRef && <ProfileItemPostEmbed itemRef={itemRef} />}
                        </>
                      );
                    })()}

                    {/* Post Media: Images, Videos, Carousel */}
                    <PostMedia
                      media={post.media}
                      layout={post.layout}
                      legacyImageUrl={post.mediaUrl || post.media_url || post.image_url}
                      legacyVideoUrl={post.video_url}
                      postType={post.post_type}
                    />

                    {/* Social Interactions Row */}
                    <PostCardInteractions post={post} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* EDIT PROFILE MODAL (PHASE 1) */}
      {showEditModal && isSelf && (
        <ProfileEditModal
          profileUser={profileData}
          onSave={handleSaveProfile}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* PROFILE SETUP / EDIT WIZARD (9-STEP SYSTEM) */}
      {isWizardOpen && isSelf && (
        <ProfileSetupWizard
          profileUser={profileData}
          initialStep={wizardInitialStep}
          onSave={handleSaveProfile}
          onCancel={() => setIsWizardOpen(false)}
        />
      )}



      {/* FOLLOWERS MODAL */}
      {showFollowersModal && (
        <ProfileFollowersModal
          userId={activeUserId}
          onClose={() => setShowFollowersModal(false)}
          onSelectUser={(user) => {
            if (onNavigateToProfile) onNavigateToProfile(user);
          }}
        />
      )}

      {/* FOLLOWING MODAL */}
      {showFollowingModal && (
        <ProfileFollowingModal
          userId={activeUserId}
          onClose={() => setShowFollowingModal(false)}
          onSelectUser={(user) => {
            if (onNavigateToProfile) onNavigateToProfile(user);
          }}
        />
      )}

      {/* INTERNAL CREATE POST MODAL OVERLAY */}
      {showCreatePostModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2500,
            padding: '20px'
          }}
          onClick={() => setShowCreatePostModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid var(--border-app, #b5d2fd)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                Create New Post
              </h3>
              <button
                type="button"
                onClick={() => setShowCreatePostModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishPost} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Post Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Give your post a title..."
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Domain / Category
                </label>
                <select
                  value={postDomain}
                  onChange={(e) => setPostDomain(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {FEED_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Content *
                </label>
                <textarea
                  rows="4"
                  placeholder="What's on your mind? Share thoughts, code snippets, or ideas..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="submit"
                  className="profile-btn-primary"
                  disabled={isPublishingPost}
                  style={{ flex: 1 }}
                >
                  {isPublishingPost ? 'Publishing...' : 'Publish Post'}
                </button>
                <button
                  type="button"
                  className="profile-btn-secondary"
                  onClick={() => setShowCreatePostModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST INSIGHTS MODAL (OWNER-ONLY WITH DELETE POST) */}
      {insightsPost && currentUser && (
        <PostInsightsModal
          post={insightsPost}
          postId={insightsPost.id}
          ownerId={currentUser.id}
          onClose={() => setInsightsPost(null)}
          onNavigateToProfile={onNavigateToProfile}
          onPostDeleted={(deletedId) => {
            setUserPosts((prev) => prev.filter((p) => p.id !== deletedId));
            setStats((prev) => ({ ...prev, postsCount: Math.max(0, prev.postsCount - 1) }));
            setInsightsPost(null);
          }}
        />
      )}
    </div>
  );
}
