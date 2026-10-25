import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getProfileStats, calculateAge, getUserPrivateDetails } from '../lib/profileService';
import { getFollowStatus, sendFollowRequest } from '../lib/socialService';
import { getUserProjects } from '../lib/projectService';
import { getExperiencesByUserId } from '../lib/experienceService';
import { getEducationByUserId } from '../lib/educationService';
import { getCertificationsByUserId } from '../lib/certificationService';
import { getAchievementsByUserId } from '../lib/achievementService';
import { getPostsByAuthor, FormattedPost } from '../lib/postService';
import { getOrCreateDirectConversation } from '../messaging/services/conversationService';

import ProfileProjects from '../components/profile/ProfileProjects';
import ProfileExperience from '../components/profile/ProfileExperience';
import ProfileEducation from '../components/profile/ProfileEducation';
import ProfileCertifications from '../components/profile/ProfileCertifications';
import ProfileAchievements from '../components/profile/ProfileAchievements';
import ProfileDomains from '../components/profile/ProfileDomains';
import PostCardInteractions from '../components/PostCardInteractions';
import PostMedia from '../components/PostMedia';
import ProfileItemPostEmbed from '../components/profile/ProfileItemPostEmbed';
import { parseProfileItemRef } from '../lib/profileItemPostService';

function getInitials(name?: string) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function formatTimeAgo(isoString?: string | null) {
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

export interface ProfileDetailsProps {
  targetUser?: any;
  onBack?: () => void;
  onViewAllUpdates?: (itemType: string, itemId: string, itemTitle: string) => void;
  onOpenConversation?: (conversation: any) => void;
  onNavigateToProfile?: (user: any) => void;
}

export default function ProfileDetails({
  targetUser,
  onBack,
  onViewAllUpdates,
  onOpenConversation
}: ProfileDetailsProps) {
  const { user: currentUser } = useAuth();

  const isSelf = !targetUser || (currentUser?.id && targetUser.id === currentUser.id);
  const activeUserId = targetUser?.id || currentUser?.id;

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(targetUser || currentUser || null);
  const [stats, setStats] = useState({ followersCount: 0, followingCount: 0, postsCount: 0 });
  const [followInfo, setFollowInfo] = useState<any>({ status: 'none', request: null });
  const [loadingAction, setLoadingAction] = useState(false);
  const [proPhotoError, setProPhotoError] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem(`sync_verification_req_${activeUserId}`)) || null;
  });
  const [requestingVerification, setRequestingVerification] = useState(false);

  // Collections
  const [projects, setProjects] = useState<any[]>([]);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [educationList, setEducationList] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<FormattedPost[]>([]);

  const loadAllProfileData = useCallback(async () => {
    if (!activeUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Fetch structured location / wizard local cache fallbacks
      let savedWizardMeta: any = {};
      let savedLocationData: any = {};
      try {
        const rawMeta = localStorage.getItem(`sync_profile_wizard_${activeUserId}`);
        if (rawMeta) savedWizardMeta = JSON.parse(rawMeta);
      } catch (e) {}
      try {
        const rawLoc = localStorage.getItem(`sync_profile_location_${activeUserId}`);
        if (rawLoc) savedLocationData = JSON.parse(rawLoc);
      } catch (e) {}

      // 2. Fetch public.profiles & private details (owner-only)
      let baseProfile: any = targetUser || currentUser || {};
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
          baseProfile = {
            id: dbProfile.id,
            name: dbProfile.name || baseProfile?.name || 'User',
            username: dbProfile.username || baseProfile?.username || 'user',
            role: dbProfile.role || baseProfile?.role || 'Member',
            bio: dbProfile.bio || '',
            avatarUrl: dbProfile.avatar_url || null,
            avatar_url: dbProfile.avatar_url || null,
            skills: dbProfile.skills || [],
            domains: dbProfile.domains || [],
            location: dbProfile.location || savedLocationData?.displayLocation || baseProfile?.location || '',
            first_name: dbProfile.first_name || (isSelf ? savedWizardMeta.first_name : ''),
            last_name: dbProfile.last_name || (isSelf ? savedWizardMeta.last_name : ''),
            date_of_birth: isSelf ? (privateDetails?.date_of_birth || savedWizardMeta.date_of_birth || null) : null,
            gender: isSelf ? (privateDetails?.gender || savedWizardMeta.gender || null) : null,
            gender_custom: isSelf ? (privateDetails?.gender_custom || savedWizardMeta.gender_custom || null) : null,
            languages: dbProfile.languages || (isSelf ? savedWizardMeta.languages : []) || [],
            profession_type: dbProfile.profession_type || (isSelf ? savedWizardMeta.profession_type : null),
            profession_details: dbProfile.profession_details || (isSelf ? savedWizardMeta.profession_details : {}) || {},
            skills_technical: dbProfile.skills_technical || (isSelf ? savedWizardMeta.skills_technical : []) || [],
            skills_soft: dbProfile.skills_soft || (isSelf ? savedWizardMeta.skills_soft : []) || [],
            skills_languages: dbProfile.skills_languages || (isSelf ? savedWizardMeta.skills_languages : []) || [],
            skills_tools: dbProfile.skills_tools || (isSelf ? savedWizardMeta.skills_tools : []) || [],
            skills_technologies: dbProfile.skills_technologies || (isSelf ? savedWizardMeta.skills_technologies : []) || [],
            skills_expertise: dbProfile.skills_expertise || (isSelf ? savedWizardMeta.skills_expertise : []) || [],
            portfolio_url: dbProfile.portfolio_url || (isSelf ? savedWizardMeta.portfolio_url : null),
            github_url: dbProfile.github_url || (isSelf ? savedWizardMeta.github_url : null),
            linkedin_url: dbProfile.linkedin_url || (isSelf ? savedWizardMeta.linkedin_url : null),
            other_links: dbProfile.other_links || (isSelf ? savedWizardMeta.other_links : []) || [],
            privacy_settings: isSelf ? (privateDetails?.privacy_settings || savedWizardMeta.privacy_settings || {}) : {},
            professional_photo_url: dbProfile.professional_photo_url || (isSelf ? savedWizardMeta.professional_photo_url : null),
            is_verified: Boolean(dbProfile.is_verified),
            ...(isSelf ? (() => {
              const meta = { ...savedWizardMeta };
              delete meta.is_verified;
              return meta;
            })() : {})
          };
        }
      }
      setProfileData(baseProfile);

      // 3. Parallel fetch of all sub-collections
      const [
        statsRes,
        followRes,
        projRes,
        expRes,
        eduRes,
        certRes,
        achRes,
        postsRes
      ] = await Promise.allSettled([
        getProfileStats(activeUserId),
        !isSelf && currentUser?.id ? getFollowStatus(currentUser.id, activeUserId) : Promise.resolve({ status: 'none' }),
        getUserProjects(activeUserId),
        getExperiencesByUserId(activeUserId),
        getEducationByUserId(activeUserId),
        getCertificationsByUserId(activeUserId),
        getAchievementsByUserId(activeUserId),
        getPostsByAuthor(activeUserId)
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) setStats(statsRes.value);
      if (followRes.status === 'fulfilled' && followRes.value) setFollowInfo(followRes.value);
      if (projRes.status === 'fulfilled') setProjects(projRes.value || []);
      if (expRes.status === 'fulfilled') setExperiences(expRes.value || []);
      if (eduRes.status === 'fulfilled') setEducationList(eduRes.value || []);
      if (certRes.status === 'fulfilled') setCertifications(certRes.value || []);
      if (achRes.status === 'fulfilled') setAchievements(achRes.value || []);
      if (postsRes.status === 'fulfilled') setUserPosts(postsRes.value || []);
    } catch (err) {
      console.error('[ProfileDetails] Error loading details:', err);
    } finally {
      setLoading(false);
    }
  }, [activeUserId, isSelf, currentUser, targetUser]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadAllProfileData();
    window.scrollTo(0, 0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [loadAllProfileData]);

  // Follow interaction for other users
  const handleFollowAction = async () => {
    if (isSelf || !currentUser?.id || !activeUserId) return;
    setLoadingAction(true);
    try {
      if (followInfo.status === 'none') {
        const req = await sendFollowRequest(currentUser.id, activeUserId);
        setFollowInfo({ status: req.status === 'accepted' ? 'accepted' : 'pending_sent', request: req });
        if (req.status === 'accepted') {
          setStats((prev) => ({ ...prev, followersCount: prev.followersCount + 1 }));
        }
      }
    } catch (err) {
      console.error('[ProfileDetails] Follow action error:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStartDirectChat = async () => {
    if (!currentUser?.id || !activeUserId) return;
    setLoadingAction(true);
    try {
      const conv = await getOrCreateDirectConversation(currentUser.id, activeUserId);
      setLoadingAction(false);
      if (conv?.error) {
        alert(conv.error);
        return;
      }
      if (conv && onOpenConversation) {
        onOpenConversation(conv);
      }
    } catch (err) {
      setLoadingAction(false);
      console.error('[ProfileDetails] Start chat error:', err);
      alert('Unable to open direct message. Please try again.');
    }
  };

  const handleRequestVerification = async () => {
    if (!isSelf || !currentUser?.id) return;
    setRequestingVerification(true);
    try {
      localStorage.setItem(`sync_verification_req_${currentUser.id}`, 'pending');
      setVerificationStatus('pending');
      if (isSupabaseConfigured) {
        await supabase
          .from('profiles')
          .update({ verification_requested_at: new Date().toISOString() })
          .eq('id', currentUser.id);
      }
    } catch (e) {
      console.warn('[ProfileDetails] Verification request notice:', e);
    } finally {
      setRequestingVerification(false);
    }
  };

  const avatar = profileData?.avatarUrl || profileData?.avatar_url;
  const initials = getInitials(profileData?.name);
  const username = profileData?.username || (profileData?.name ? profileData.name.toLowerCase().replace(/\s+/g, '') : 'user');
  const role = profileData?.role || profileData?.profession || 'Member';
  const location = profileData?.location || '';
  const bio = profileData?.bio || '';
  const domainsList = profileData?.domains || [];
  const professionalPhoto = profileData?.professional_photo_url || null;

  // Professional Photo Display Fallback:
  const displayedProfessionalPhoto = (professionalPhoto && String(professionalPhoto).trim())
    ? professionalPhoto
    : ((avatar && String(avatar).trim()) ? avatar : null);

  // Determine if About section has content
  const hasAboutData = Boolean(bio.trim() || role || location);

  // Profile visibility evaluation (everyone | verified_profile | followers_only)
  const profileVisibility = profileData?.privacy_settings?.profile_visibility || 'everyone';
  const isVerifiedViewer = Boolean(currentUser?.is_verified);
  const isFollower = followInfo.status === 'accepted';
  const canViewProfileContent = isSelf || profileVisibility === 'everyone' ||
    (profileVisibility === 'verified_profile' && isVerifiedViewer) ||
    (profileVisibility === 'followers_only' && isFollower);

  return (
    <div className="main-content">
      <div
        ref={containerRef}
        className="content-card profile-details-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
          backgroundColor: 'transparent',
          border: 'none',
          padding: 'clamp(8px, 1.5vw, 16px) 0',
          boxShadow: 'none',
          width: '100%',
          maxWidth: '820px',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Navigation Bar with Back Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '12px 20px',
            border: '1.5px solid var(--border-app, #b5d2fd)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
          }}
        >
          <button
            type="button"
            className="profile-menu-back-btn"
            id="profile-details-back-btn"
            onClick={onBack}
            aria-label="Back to Profile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: '10px',
              color: '#1d4ed8',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>

          <h1
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: '#1e3860',
              margin: 0
            }}
          >
            Profile Details
          </h1>

          <div style={{ width: '64px' }} />
        </div>

        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1.5px solid #b5d2fd',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            Loading profile details...
          </div>
        ) : (
          <>
            {/* 1. PROFILE HEADER CARD */}
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
                    fontWeight: 800,
                    fontSize: '28px',
                    color: '#1e3860',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(181, 210, 253, 0.4)'
                  }}
                >
                  {avatar ? (
                    <img src={avatar} alt={profileData?.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                {/* Name, Username, Role, Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main, #1e3860)', margin: 0 }}>
                      {profileData?.name || 'User'}
                    </h2>
                    {Boolean(profileData?.is_verified) ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700
                        }}
                        title="Verified Profile by SINC Platform"
                      >
                        <span>✓</span> Verified Profile
                      </span>
                    ) : isSelf ? (
                      verificationStatus === 'pending' ? (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#b45309',
                            backgroundColor: '#fef3c7',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 600
                          }}
                        >
                          ⏳ Verification Pending Review
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestVerification}
                          disabled={requestingVerification}
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          {requestingVerification ? 'Requesting...' : '+ Request Verification'}
                        </button>
                      )
                    ) : null}
                  </div>

                  <span style={{ fontSize: '13.5px', color: '#64748b', fontWeight: 600 }}>
                    @{username}
                  </span>

                  {location && (
                    <span style={{ fontSize: '12.5px', color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>📍</span>
                      <span>{location}</span>
                    </span>
                  )}

                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                    {role}
                  </span>

                  {bio && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: '#475569', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                      {bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: '#f8fafc',
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  justifyContent: 'space-around'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e3860' }}>
                    {stats?.followersCount ?? 0}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Followers</span>
                </div>

                <div style={{ width: '1px', height: '28px', backgroundColor: '#cbd5e1' }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e3860' }}>
                    {stats?.followingCount ?? 0}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Following</span>
                </div>

                <div style={{ width: '1px', height: '28px', backgroundColor: '#cbd5e1' }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e3860' }}>
                    {stats?.postsCount ?? 0}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Posts</span>
                </div>
              </div>

              {/* Follow / Message Actions for Other User */}
              {!isSelf && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {followInfo?.status === 'none' && (
                    <button
                      type="button"
                      id="details-follow-btn"
                      onClick={handleFollowAction}
                      disabled={loadingAction}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '10px 18px',
                        borderRadius: '12px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
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
                        fontWeight: 600,
                        fontSize: '13.5px',
                        cursor: 'default'
                      }}
                    >
                      Requested
                    </button>
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
                        fontWeight: 700,
                        fontSize: '13.5px',
                        cursor: 'default'
                      }}
                    >
                      Following
                    </button>
                  )}

                  <button
                    type="button"
                    id="details-message-btn"
                    onClick={handleStartDirectChat}
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
                      fontWeight: 700,
                      fontSize: '13.5px',
                      cursor: loadingAction ? 'not-allowed' : 'pointer',
                      opacity: loadingAction ? 0.7 : 1
                    }}
                  >
                    <span>💬</span>
                    <span>{loadingAction ? 'Opening...' : 'Message'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Conditional Content: Restricted Profile Notice vs Full Details */}
            {!canViewProfileContent ? (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  border: '1.5px solid var(--border-app, #b5d2fd)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                }}
              >
                <div style={{ fontSize: '32px' }}>🔒</div>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: '#1e3860' }}>
                  Profile Details Restricted
                </h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b', maxWidth: '440px', lineHeight: 1.5 }}>
                  {profileVisibility === 'verified_profile'
                    ? 'This profile is set to Verified Profile visibility. Only profiles verified by SINC Platform can view full details.'
                    : 'This profile is set to Followers Only visibility. Only approved followers can view full details.'}
                </p>
              </div>
            ) : (
              <>
                {/* 1b. PROFESSIONAL PHOTO CARD */}
                <div
                  className="profile-professional-photo-card"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1.5px solid var(--border-app, #b5d2fd)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#0369a1'
                      }}
                    >
                      Professional Photo
                    </h3>
                    {!professionalPhoto && avatar && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#0369a1',
                          backgroundColor: '#e0f2fe',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}
                      >
                        Using Profile Photo
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      width: '180px',
                      height: '220px',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      border: '3px solid #b5d2fd',
                      boxShadow: '0 4px 16px rgba(181, 210, 253, 0.4)',
                      backgroundColor: '#bcd5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '44px',
                      color: '#1e3860'
                    }}
                  >
                    {displayedProfessionalPhoto && !proPhotoError ? (
                      <img
                        src={displayedProfessionalPhoto}
                        alt={`${profileData?.name || 'User'} - Professional`}
                        onError={(e) => {
                          if (displayedProfessionalPhoto !== avatar && avatar) {
                            (e.currentTarget as HTMLImageElement).src = avatar;
                          } else {
                            setProPhotoError(true);
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                </div>

                {/* 2. ABOUT CARD */}
                {hasAboutData && (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      padding: '20px',
                      border: '1.5px solid var(--border-app, #b5d2fd)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                    }}
                  >
                    <h3
                      style={{
                        margin: '0 0 12px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#0369a1'
                      }}
                    >
                      About
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {bio && (
                        <p style={{ margin: 0, fontSize: '13.5px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                          {bio}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '4px' }}>
                        {role && (
                          <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                            <strong style={{ color: '#1e3860' }}>Role: </strong> {role}
                          </div>
                        )}
                        {location && (
                          <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                            <strong style={{ color: '#1e3860' }}>Location: </strong> 📍 {location}
                          </div>
                        )}
                        {/* Derived Age with privacy check */}
                        {profileData?.date_of_birth && (() => {
                          const age = calculateAge(profileData.date_of_birth);
                          const vis = profileData.privacy_settings?.dob_visibility || 'followers';
                          const canView = isSelf || vis === 'everyone' || (vis === 'followers' && followInfo.status === 'accepted');
                          return canView && age !== null ? (
                            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                              <strong style={{ color: '#1e3860' }}>Age: </strong> {age} yrs
                            </div>
                          ) : null;
                        })()}
                        {/* Languages */}
                        {profileData?.languages && profileData.languages.length > 0 && (
                          <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                            <strong style={{ color: '#1e3860' }}>Languages: </strong> {profileData.languages.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. DOMAINS CARD */}
                {domainsList.length > 0 && (
                  <ProfileDomains domains={domainsList} />
                )}

                {/* 4. SKILLS & EXPERTISE CARD */}
                {(
                  (profileData?.skills_technical && profileData.skills_technical.length > 0) ||
                  (profileData?.skills_languages && profileData.skills_languages.length > 0) ||
                  (profileData?.skills_tools && profileData.skills_tools.length > 0) ||
                  (profileData?.skills_technologies && profileData.skills_technologies.length > 0) ||
                  (profileData?.skills_soft && profileData.skills_soft.length > 0) ||
                  (profileData?.skills_expertise && profileData.skills_expertise.length > 0) ||
                  (profileData?.skills && profileData.skills.length > 0)
                ) && (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      padding: '20px',
                      border: '1.5px solid var(--border-app, #b5d2fd)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                    }}
                  >
                    <h3
                      style={{
                        margin: '0 0 14px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#0369a1'
                      }}
                    >
                      Skills & Expertise
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {profileData?.skills_technical && profileData.skills_technical.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Technical Skills</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {profileData.skills_technical.map((s: string, i: number) => (
                              <span key={i} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '12px', fontWeight: 600 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profileData?.skills_languages && profileData.skills_languages.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Programming Languages</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {profileData.skills_languages.map((s: string, i: number) => (
                              <span key={i} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', fontSize: '12px', fontWeight: 600 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profileData?.skills_tools && profileData.skills_tools.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tools</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {profileData.skills_tools.map((s: string, i: number) => (
                              <span key={i} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#fdf4ff', color: '#86198f', fontSize: '12px', fontWeight: 600 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profileData?.skills_technologies && profileData.skills_technologies.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Technologies</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {profileData.skills_technologies.map((s: string, i: number) => (
                              <span key={i} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 600 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profileData?.skills_soft && profileData.skills_soft.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Soft Skills</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {profileData.skills_soft.map((s: string, i: number) => (
                              <span key={i} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#fff7ed', color: '#c2410c', fontSize: '12px', fontWeight: 600 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profileData?.skills_expertise && profileData.skills_expertise.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Areas of Expertise</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {profileData.skills_expertise.map((s: string, i: number) => (
                              <span key={i} style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#5b21b6', fontSize: '12px', fontWeight: 600 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. PORTFOLIO & PROFESSIONAL LINKS CARD */}
                {(profileData?.portfolio_url || profileData?.github_url || profileData?.linkedin_url || (profileData?.other_links && profileData.other_links.length > 0)) && (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      padding: '20px',
                      border: '1.5px solid var(--border-app, #b5d2fd)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                    }}
                  >
                    <h3
                      style={{
                        margin: '0 0 14px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#0369a1'
                      }}
                    >
                      Portfolio & Professional Links
                    </h3>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {profileData.portfolio_url && (
                        <a
                          href={profileData.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#1e3860',
                            fontWeight: 700,
                            fontSize: '13px',
                            textDecoration: 'none'
                          }}
                        >
                          <span>🌐</span>
                          <span>Portfolio</span>
                        </a>
                      )}

                      {profileData.github_url && (
                        <a
                          href={profileData.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#1e3860',
                            fontWeight: 700,
                            fontSize: '13px',
                            textDecoration: 'none'
                          }}
                        >
                          <span>🐙</span>
                          <span>GitHub</span>
                        </a>
                      )}

                      {profileData.linkedin_url && (
                        <a
                          href={profileData.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#1e3860',
                            fontWeight: 700,
                            fontSize: '13px',
                            textDecoration: 'none'
                          }}
                        >
                          <span>💼</span>
                          <span>LinkedIn</span>
                        </a>
                      )}

                      {profileData.other_links && profileData.other_links.map((link: any, idx: number) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#1e3860',
                            fontWeight: 700,
                            fontSize: '13px',
                            textDecoration: 'none'
                          }}
                        >
                          <span>🔗</span>
                          <span>{link.title || link.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. PROJECTS SECTION (Read-Only) */}
                <div id="details-projects-section">
                  <ProfileProjects
                    projects={projects as any}
                    isOwner={false}
                    onViewAllUpdates={onViewAllUpdates}
                    onOpenAddProject={() => {}}
                    onOpenEditProject={() => {}}
                    onDeleteProject={() => {}}
                    onOpenPostModal={() => {}}
                    onOpenUpdateModal={() => {}}
                  />
                </div>

                {/* 5. WORK EXPERIENCE SECTION (Read-Only) */}
                <div id="details-experience-section">
                  <ProfileExperience
                    experiences={experiences as any}
                    isOwnProfile={false}
                    onViewAllUpdates={onViewAllUpdates}
                    onAddClick={() => {}}
                    onEditClick={() => {}}
                    onDeleteClick={() => {}}
                    onOpenPostModal={() => {}}
                    onOpenUpdateModal={() => {}}
                  />
                </div>

                {/* 6. EDUCATION SECTION (Read-Only) */}
                <div id="details-education-section">
                  <ProfileEducation
                    educationList={educationList as any}
                    isOwnProfile={false}
                    onViewAllUpdates={onViewAllUpdates}
                    onAddClick={() => {}}
                    onEditClick={() => {}}
                    onDeleteClick={() => {}}
                    onOpenPostModal={() => {}}
                    onOpenUpdateModal={() => {}}
                  />
                </div>

                {/* 7. CERTIFICATIONS SECTION (Read-Only) */}
                <div id="details-certifications-section">
                  <ProfileCertifications
                    certifications={certifications as any}
                    isOwnProfile={false}
                    onViewAllUpdates={onViewAllUpdates}
                    onAddClick={() => {}}
                    onEditClick={() => {}}
                    onDeleteClick={() => {}}
                    onOpenPostModal={() => {}}
                    onOpenUpdateModal={() => {}}
                  />
                </div>

                {/* 8. ACHIEVEMENTS SECTION (Read-Only) */}
                <div id="details-achievements-section">
                  <ProfileAchievements
                    achievements={achievements as any}
                    isOwnProfile={false}
                    onViewAllUpdates={onViewAllUpdates}
                    onAddClick={() => {}}
                    onEditClick={() => {}}
                    onDeleteClick={() => {}}
                    onOpenPostModal={() => {}}
                    onOpenUpdateModal={() => {}}
                  />
                </div>

                {/* 9. RECENT POSTS SECTION */}
                <div
                  id="details-posts-section"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1.5px solid var(--border-app, #b5d2fd)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '13px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#0369a1'
                    }}
                  >
                    Recent Posts ({userPosts.length})
                  </h3>

                  {userPosts.length === 0 ? (
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#64748b',
                        textAlign: 'center',
                        padding: '28px 12px',
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
                        const { caption, itemRef } = parseProfileItemRef(post.content);

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
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  backgroundColor: '#e0f2fe',
                                  color: '#0369a1',
                                  padding: '2px 8px',
                                  borderRadius: '8px'
                                }}
                              >
                                {post.domain_id || post.domain || 'Tech'}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {formatTimeAgo(post.created_at)}
                              </span>
                            </div>

                            {caption && (
                              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.45, margin: '0 0 8px 0', whiteSpace: 'pre-line' }}>
                                {caption}
                              </p>
                            )}

                            {itemRef && <ProfileItemPostEmbed itemRef={itemRef} />}

                            <PostMedia
                              media={post.media}
                              layout={post.layout}
                              legacyImageUrl={post.mediaUrl || post.media_url || post.image_url}
                              legacyVideoUrl={post.video_url}
                              postType={post.post_type}
                            />

                            <PostCardInteractions post={post} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
