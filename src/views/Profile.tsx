import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getFollowStatus, sendFollowRequest, respondToFollowRequest, subscribeToLocalState } from '../lib/socialService';
import { rejectAndBlockUser, unblockUser, subscribeToBlockState } from '../lib/blockService';
import RejectFollowRequestModal from '../components/RejectFollowRequestModal';
import { createPost as createPostService, getPostsByAuthor, subscribeToPostState, FormattedPost } from '../lib/postService';
import { FEED_CATEGORIES } from '../data/mockData';
import {
  getProfileStats,
  updateBasicProfile,
  subscribeToProfileState,
  getUserPrivateDetails
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
import { getUserProjects } from '../lib/projectService';
import { getExperiencesByUserId } from '../lib/experienceService';
import { getEducationByUserId } from '../lib/educationService';
import ProfileProjects from '../components/profile/ProfileProjects';
import ProfileExperience from '../components/profile/ProfileExperience';
import ProfileEducation from '../components/profile/ProfileEducation';
import { Lock, FileText, FolderGit2, Briefcase, GraduationCap, Info } from 'lucide-react';

export interface ProfileProps {
  targetUser?: any;
  onBack?: () => void;
  onOpenConversation?: (conversation: any) => void;
  onOpenCreatePost?: () => void;
  onNavigateToProfile?: (user: any) => void;
  onOpenMenu?: () => void;
  onOpenProfileDetails?: (user: any) => void;
}

function formatTimeAgo(isoString?: string | null): string {
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
}: ProfileProps) {
  const { user: currentUser, updateProfile: updateAuthProfile } = useAuth();

  const isSelf = Boolean(!targetUser || (currentUser?.id && targetUser.id === currentUser.id));
  const activeUserId = isSelf ? currentUser?.id : targetUser?.id;

  // Profile data & loading states
  const [profileData, setProfileData] = useState<any>(isSelf ? currentUser : targetUser);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<{ followersCount: number; followingCount: number; postsCount: number }>({
    followersCount: 0,
    followingCount: 0,
    postsCount: 0
  });

  // Follow status state (for other user's profile)
  const [followInfo, setFollowInfo] = useState<any>({ status: 'none', request: null });
  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);

  // User posts state
  const [userPosts, setUserPosts] = useState<FormattedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [insightsPost, setInsightsPost] = useState<FormattedPost | null>(null);

  // Modals & Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<number>(1);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showFollowersModal, setShowFollowersModal] = useState<boolean>(false);
  const [showFollowingModal, setShowFollowingModal] = useState<boolean>(false);

  // Tab navigation state
  const [activeProfileTab, setActiveProfileTab] = useState<'posts' | 'projects' | 'experience' | 'education' | 'about'>('posts');
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [experienceList, setExperienceList] = useState<any[]>([]);
  const [educationList, setEducationList] = useState<any[]>([]);
  const [, setLoadingSectionTab] = useState<boolean>(false);

  // Tab data loader
  useEffect(() => {
    if (!activeUserId) return;
    let isMounted = true;
    async function loadTabData() {
      if (activeProfileTab === 'projects' && projectsList.length === 0) {
        setLoadingSectionTab(true);
        const data = await getUserProjects(activeUserId);
        if (isMounted) { setProjectsList(data || []); setLoadingSectionTab(false); }
      } else if (activeProfileTab === 'experience' && experienceList.length === 0) {
        setLoadingSectionTab(true);
        const data = await getExperiencesByUserId(activeUserId);
        if (isMounted) { setExperienceList(data || []); setLoadingSectionTab(false); }
      } else if (activeProfileTab === 'education' && educationList.length === 0) {
        setLoadingSectionTab(true);
        const data = await getEducationByUserId(activeUserId);
        if (isMounted) { setEducationList(data || []); setLoadingSectionTab(false); }
      }
    }
    loadTabData();
    return () => { isMounted = false; };
  }, [activeProfileTab, activeUserId, projectsList.length, experienceList.length, educationList.length]);

  // Create post modal state (internal fallback)
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postDomain, setPostDomain] = useState('tech');
  const [isPublishingPost, setIsPublishingPost] = useState(false);

  // Ref and wheel forwarding for pinned profile header & scrollable lower body
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const handleHeaderWheel = useCallback((e: React.WheelEvent) => {
    if (scrollBodyRef.current) {
      scrollBodyRef.current.scrollTop += e.deltaY;
    }
  }, []);

  useEffect(() => {
    // Reset viewport scroll position when profile mounts so header stays aligned at top
    const viewport = document.querySelector('.sinc-viewport-scroll-area');
    if (viewport && viewport.scrollTop > 0) {
      viewport.scrollTop = 0;
    }
  }, []);

  // 1. Fetch Profile, Stats and Projects from Database
  const fetchProfileDetails = useCallback(async (isMountedRef?: { current: boolean }) => {
    if (!activeUserId) {
      if (isMountedRef?.current !== false) setLoadingProfile(false);
      return;
    }

    try {
      setProfileError(null);

      // Load cached wizard metadata if present
      let savedWizardMeta: any = {};
      try {
        const rawMeta = localStorage.getItem(`sync_profile_wizard_${activeUserId}`);
        if (rawMeta) savedWizardMeta = JSON.parse(rawMeta);
      } catch (e) {}

      // Load cached structured location if present
      let savedLocationData: any = {};
      try {
        const rawLoc = localStorage.getItem(`sync_profile_location_${activeUserId}`);
        if (rawLoc) savedLocationData = JSON.parse(rawLoc);
      } catch (e) {}

      // Fetch base profile from public.profiles & private details (owner-only)
      let userObj = isSelf ? currentUser : targetUser;
      let privateDetails: any = null;
      if (isSelf) {
        try {
          const privRes = await getUserPrivateDetails(activeUserId);
          privateDetails = privRes?.data;
        } catch (e) {}
      }

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
            location_city: dbProfile.location_city || savedLocationData?.city || '',
            location_state: dbProfile.location_state || savedLocationData?.state || '',
            location_country: dbProfile.location_country || savedLocationData?.country || 'India',
            location_address: isSelf ? (privateDetails?.location_address || savedLocationData?.address || '') : '',
            location_area: isSelf ? (privateDetails?.location_area || savedLocationData?.area || '') : '',
            location_landmark: isSelf ? (privateDetails?.location_landmark || savedLocationData?.landmark || '') : '',
            location_pincode: isSelf ? (privateDetails?.location_pincode || savedLocationData?.pincode || '') : '',
            location_latitude: isSelf ? (privateDetails?.location_latitude ?? savedLocationData?.latitude ?? null) : null,
            location_longitude: isSelf ? (privateDetails?.location_longitude ?? savedLocationData?.longitude ?? null) : null,
            date_of_birth: isSelf ? (privateDetails?.date_of_birth || savedWizardMeta.date_of_birth || null) : null,
            gender: isSelf ? (privateDetails?.gender || savedWizardMeta.gender || null) : null,
            gender_custom: isSelf ? (privateDetails?.gender_custom || savedWizardMeta.gender_custom || null) : null,
            privacy_settings: isSelf ? (privateDetails?.privacy_settings || savedWizardMeta.privacy_settings || {}) : {},
            locationData: savedLocationData,
            ...(isSelf ? savedWizardMeta : {})
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
  const fetchUserPosts = useCallback(async (isMountedRef?: { current: boolean }) => {
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
      if (!currentUser?.id || !activeUserId) return;
      try {
        const info = await getFollowStatus(currentUser.id, activeUserId);
        if (isSubscribed) setFollowInfo(info);
      } catch (err) {
        console.error('[Profile] checkStatus error:', err);
      }
    }

    checkStatus();

    // 1. Subscribe to local state updates
    const unsubLocal = subscribeToLocalState(() => {
      if (isSubscribed) checkStatus();
    });

    // 2. Subscribe to block state updates
    const unsubBlock = subscribeToBlockState(() => {
      if (isSubscribed) checkStatus();
    });

    // 3. Subscribe to Supabase Realtime changes for follow_requests
    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`follow_status:${currentUser.id}_${activeUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'follow_requests'
          },
          (payload: any) => {
            const row = payload.new || payload.old;
            if (
              row &&
              ((row.follower_user_id === currentUser.id && row.following_user_id === activeUserId) ||
               (row.follower_user_id === activeUserId && row.following_user_id === currentUser.id))
            ) {
              if (isSubscribed) checkStatus();
            }
          }
        )
        .subscribe();
    }

    return () => {
      isSubscribed = false;
      unsubLocal();
      unsubBlock();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isSelf, currentUser?.id, activeUserId]);

  // Follow Actions
  const handleFollow = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setLoadingAction(true);
    try {
      const res = await sendFollowRequest(currentUser.id, activeUserId);
      if (res && res.success) {
        setFollowInfo((prev: any) => ({
          ...prev,
          status: res.status === 'accepted' ? 'accepted' : 'pending_sent',
          request: res.request || prev.request
        }));
      } else {
        console.error('[Profile] Follow request failed:', res?.error);
        alert(res?.error || 'Failed to send follow request.');
      }
    } catch (err) {
      console.error('[Profile] Follow exception:', err);
      alert('An error occurred while sending follow request.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAccept = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setLoadingAction(true);
    try {
      const res = await respondToFollowRequest(followInfo.request?.id, currentUser.id, activeUserId, 'accepted');
      if (res && res.success) {
        setFollowInfo((prev: any) => ({ ...prev, status: 'accepted' }));
        setStats((prev) => ({ ...prev, followersCount: prev.followersCount + 1 }));
      } else {
        console.error('[Profile] Accept follow request failed:', res?.error);
        alert(res?.error || 'Failed to accept follow request.');
      }
    } catch (err) {
      console.error('[Profile] Accept exception:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setShowRejectModal(true);
  };

  const handleRejectOnly = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setLoadingAction(true);
    try {
      const res = await respondToFollowRequest(followInfo.request?.id, currentUser.id, activeUserId, 'rejected');
      if (res && res.success) {
        setFollowInfo({ status: 'none', request: null });
      } else {
        console.error('[Profile] Reject follow request failed:', res?.error);
        alert(res?.error || 'Failed to reject follow request.');
      }
    } catch (err) {
      console.error('[Profile] Reject exception:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRejectAndBlock = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setLoadingAction(true);
    try {
      const res = await rejectAndBlockUser(activeUserId, followInfo.request?.id, currentUser.id);
      if (res && res.success) {
        setFollowInfo({ status: 'blocked_by_me', isBlocked: true, blockedByMe: true, request: null });
      } else {
        console.error('[Profile] Reject & block failed:', res?.error);
        alert(res?.error || 'Failed to block user.');
      }
    } catch (err) {
      console.error('[Profile] Reject and block exception:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUnblock = async () => {
    if (!currentUser?.id || !activeUserId || loadingAction) return;
    setLoadingAction(true);
    try {
      const res = await unblockUser(currentUser.id, activeUserId);
      if (res && res.success) {
        setFollowInfo({ status: 'none', request: null });
      } else {
        alert(res?.error || 'Failed to unblock user.');
      }
    } catch (err) {
      console.error('[Profile] Unblock exception:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStartChat = async () => {
    if (!onOpenConversation || isSelf || !currentUser?.id || !activeUserId) return;
    setLoadingAction(true);
    try {
      const conversation = await getOrCreateDirectConversation(currentUser.id, activeUserId, profileData);
      setLoadingAction(false);
      if (conversation?.error) {
        alert(conversation.error);
        return;
      }
      onOpenConversation(conversation);
    } catch (err) {
      setLoadingAction(false);
      console.error('[Profile] Start chat error:', err);
      alert('Unable to open direct message. Please try again.');
    }
  };

  // Save profile updates from ProfileSetupWizard or ProfileEditModal
  const handleSaveProfile = async (updates: any) => {
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
    setProfileData((prev: any) => ({
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

  const handleOpenWizardAtStep = (stepNumber: number) => {
    setWizardInitialStep(stepNumber);
    setIsWizardOpen(true);
  };

  // Internal Post Creation
  const handlePublishPost = async (e: React.FormEvent) => {
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
    } catch (err: any) {
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
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading profile...</div>
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
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #1e3860)', margin: '0 0 8px 0' }}>
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
              fontWeight: 700,
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
      <div className="main-content profile-wizard-page">
        <div className="content-card profile-wizard-card">
          <ProfileSetupWizard
            profileUser={profileData}
            initialStep={wizardInitialStep}
            onSave={handleSaveProfile}
            onCancel={() => setIsWizardOpen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="main-content profile-page-content">
      <div className="content-card profile-content-card">
        {/* 1. PINNED PROFILE HEADER */}
        <div
          className="profile-pinned-header-container"
          onWheel={handleHeaderWheel}
        >
          <ProfileHeader
            profileUser={profileData}
            isSelf={isSelf}
            followInfo={followInfo}
            loadingAction={loadingAction}
            onFollow={handleFollow}
            onAccept={handleAccept}
            onReject={handleReject}
            onUnblock={handleUnblock}
            onStartChat={handleStartChat}
            onOpenEdit={() => setIsWizardOpen(true)}
            onOpenCreatePost={() => onOpenCreatePost ? onOpenCreatePost() : setShowCreatePostModal(true)}
            onOpenMenu={onOpenMenu}
            onBack={onBack}
            stats={stats}
            onOpenFollowers={() => setShowFollowersModal(true)}
            onOpenFollowing={() => setShowFollowingModal(true)}
            onScrollToPosts={() => {
              const el = document.querySelector('.profile-tabs-header-bar') || document.getElementById('my-posts');
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
        </div>

        {/* 2. SCROLLABLE LOWER PROFILE BODY */}
        <div
          className="profile-scrollable-body"
          id="profile-scrollable-body"
          ref={scrollBodyRef}
        >
          {/* PROFILE COMPLETION INDICATOR (OWNER-ONLY) */}
          {isSelf && profileCompletion.percentage < 100 && (
          <div className="profile-completion-card">
            <div className="profile-completion-header">
              <div className="completion-title-wrap">
                <span className="completion-icon">📊</span>
                <h3 className="completion-title">Profile Completion</h3>
              </div>
              <span className="completion-percentage">{profileCompletion.percentage}%</span>
            </div>

            {/* Progress Bar */}
            <div className="completion-progress-track">
              <div
                className="completion-progress-fill"
                style={{ width: `${profileCompletion.percentage}%` }}
              />
            </div>

            {/* Incomplete Sections Warnings & Quick Action Buttons */}
            {profileCompletion.incompleteSections.length > 0 && (
              <div className="completion-incomplete-wrap">
                <span className="completion-subtext">Incomplete sections:</span>
                <div className="incomplete-sections-list">
                  {profileCompletion.incompleteSections.map((sec: any) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleOpenWizardAtStep(sec.step)}
                      className="incomplete-sec-pill"
                    >
                      <span className="sec-alert-icon">⚠</span>
                      <span>Complete {sec.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. PROFILE TABS BAR */}
        <div className="profile-tabs-header-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeProfileTab === 'posts'}
            className={`profile-tab-button ${activeProfileTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveProfileTab('posts')}
          >
            <FileText size={15} />
            <span>Posts</span>
            <span className="profile-tab-counter">{stats?.postsCount ?? 0}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeProfileTab === 'projects'}
            className={`profile-tab-button ${activeProfileTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveProfileTab('projects')}
          >
            <FolderGit2 size={15} />
            <span>Projects</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeProfileTab === 'experience'}
            className={`profile-tab-button ${activeProfileTab === 'experience' ? 'active' : ''}`}
            onClick={() => setActiveProfileTab('experience')}
          >
            <Briefcase size={15} />
            <span>Experience</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeProfileTab === 'education'}
            className={`profile-tab-button ${activeProfileTab === 'education' ? 'active' : ''}`}
            onClick={() => setActiveProfileTab('education')}
          >
            <GraduationCap size={15} />
            <span>Education</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeProfileTab === 'about'}
            className={`profile-tab-button ${activeProfileTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveProfileTab('about')}
          >
            <Info size={15} />
            <span>About</span>
          </button>
        </div>

        {/* 4. TAB CONTENTS WITH PRIVACY CHECK */}
        {(() => {
          const isPrivate = profileData?.is_private || profileData?.isPrivate;
          const isAcceptedFollower = followInfo?.status === 'accepted';
          const canViewRestricted = isSelf || !isPrivate || isAcceptedFollower;

          if (!canViewRestricted) {
            return (
              <div className="profile-private-lock-card">
                <div className="lock-icon-circle">
                  <Lock size={30} className="text-blue" />
                </div>
                <h3>This Account is Private</h3>
                <p>Follow @{profileData?.username || 'user'} to see their posts, projects, and professional background.</p>
              </div>
            );
          }

          // TAB 1: POSTS
          if (activeProfileTab === 'posts') {
            return (
              <div id="my-posts" className="profile-section-card">
                <div className="section-card-header">
                  <h3>{isSelf ? 'My Posts' : `Posts by ${profileData?.name || 'User'}`}</h3>
                  {isSelf && (
                    <button
                      type="button"
                      onClick={() => onOpenCreatePost ? onOpenCreatePost() : setShowCreatePostModal(true)}
                      className="section-add-btn"
                    >
                      + Add Post
                    </button>
                  )}
                </div>

                {loadingPosts ? (
                  <div className="section-loading-text">Loading posts...</div>
                ) : userPosts.length === 0 ? (
                  <div className="section-empty-box">No posts created yet.</div>
                ) : (
                  <div className="profile-posts-list">
                    {userPosts.map((post) => {
                      const isOwner = !!(currentUser?.id && (post.user_id === currentUser.id || post.author_id === currentUser.id));

                      return (
                        <div key={post.id} className="profile-post-item-card">
                          <div className="profile-post-item-top">
                            <span className="profile-post-domain-badge">
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
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                  </svg>
                                </button>
                              )}
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {formatTimeAgo(post.created_at)}
                              </span>
                            </div>
                          </div>

                          {(() => {
                            const { caption, itemRef } = parseProfileItemRef(post.content);
                            return (
                              <>
                                {caption && (
                                  <p className="profile-post-caption-text">{caption}</p>
                                )}
                                {itemRef && <ProfileItemPostEmbed itemRef={itemRef} />}
                              </>
                            );
                          })()}

                          {/* Post Media */}
                          <PostMedia
                            media={post.media}
                            layout={post.layout}
                            legacyImageUrl={post.mediaUrl || post.media_url || post.image_url}
                            legacyVideoUrl={post.video_url}
                            postType={post.post_type}
                          />

                          {/* Social Interactions */}
                          <PostCardInteractions post={post} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // TAB 2: PROJECTS
          if (activeProfileTab === 'projects') {
            return (
              <ProfileProjects
                projects={projectsList as any}
                isOwner={Boolean(isSelf)}
                onOpenAddProject={() => onOpenMenu?.()}
                onOpenEditProject={() => {}}
                onDeleteProject={() => {}}
                onOpenPostModal={() => {}}
                onOpenUpdateModal={() => {}}
                onViewAllUpdates={() => {}}
              />
            );
          }

          // TAB 3: EXPERIENCE
          if (activeProfileTab === 'experience') {
            return (
              <ProfileExperience
                experiences={experienceList as any}
                isOwnProfile={Boolean(isSelf)}
                onAddClick={() => onOpenMenu?.()}
                onEditClick={() => {}}
                onDeleteClick={() => {}}
                onOpenPostModal={() => {}}
                onOpenUpdateModal={() => {}}
                onViewAllUpdates={() => {}}
              />
            );
          }

          // TAB 4: EDUCATION
          if (activeProfileTab === 'education') {
            return (
              <ProfileEducation
                educationList={educationList as any}
                isOwnProfile={Boolean(isSelf)}
                onAddClick={() => onOpenMenu?.()}
                onEditClick={() => {}}
                onDeleteClick={() => {}}
                onOpenPostModal={() => {}}
                onOpenUpdateModal={() => {}}
                onViewAllUpdates={() => {}}
              />
            );
          }

          // TAB 5: ABOUT
          if (activeProfileTab === 'about') {
            return (
              <div className="profile-section-card profile-about-card">
                <div className="section-card-header">
                  <h3>About & Domains</h3>
                </div>

                <div className="about-content-body">
                  <div className="about-bio-section">
                    <h4>Biography</h4>
                    <p>{profileData?.bio || 'No biography added yet.'}</p>
                  </div>

                  {Array.isArray(profileData?.skills) && profileData.skills.length > 0 && (
                    <div className="about-skills-section">
                      <h4>Skills & Tech Stack</h4>
                      <div className="skills-chips-row">
                        {profileData.skills.map((skill: string, idx: number) => (
                          <span key={idx} className="skill-chip">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(profileData?.domains) && profileData.domains.length > 0 && (
                    <div className="about-domains-section">
                      <h4>Active Domain Hubs</h4>
                      <div className="domains-chips-row">
                        {profileData.domains.map((dom: string, idx: number) => (
                          <span key={idx} className="domain-chip">#{dom}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })()}
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
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main, #1e3860)' }}>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Content *
                </label>
                <textarea
                  rows={4}
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

      {/* REJECT & BLOCK CONFIRMATION MODAL */}
      <RejectFollowRequestModal
        isOpen={showRejectModal}
        targetUser={profileData}
        onClose={() => setShowRejectModal(false)}
        onRejectOnly={handleRejectOnly}
        onRejectAndBlock={handleRejectAndBlock}
        loading={loadingAction}
      />
    </div>
  );
}
