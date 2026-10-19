import React, { useState, useEffect } from 'react';
import {
  Palette,
  User,
  Shield,
  Bell,
  UserX,
  Sun,
  Moon,
  Monitor,
  Check,
  ExternalLink,
  Lock,
  Eye,
  Mail,
  Calendar,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getUserPrivateDetails, upsertUserPrivateDetails } from '../lib/profileService';
import { getBlockedUserList, unblockUser } from '../lib/blockService';

export default function Settings({
  currentUser,
  currentProfile,
  onOpenEditProfile,
  onNavigateTab,
  showBottomNav = true,
  onToggleBottomNav,
  showVerticalRail = true,
  onToggleVerticalRail,
  isLeftSidebarOpen = true,
  onToggleLeftSidebar
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('appearance');

  // Privacy state
  const [privacySettings, setPrivacySettings] = useState(() => ({
    profile_visibility: currentProfile?.privacy_settings?.profile_visibility || 'everyone',
    dob_visibility: currentProfile?.privacy_settings?.dob_visibility || 'followers',
    location_visibility: currentProfile?.privacy_settings?.location_visibility || 'followers'
  }));
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacySavedMsg, setPrivacySavedMsg] = useState(false);

  // Blocked users state
  const [blockedList, setBlockedList] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  // Load privacy settings from user_private_details
  useEffect(() => {
    let isMounted = true;
    async function loadPrivateSettings() {
      if (!currentUser?.id) return;
      try {
        const { data } = await getUserPrivateDetails(currentUser.id);
        if (data?.privacy_settings && isMounted) {
          setPrivacySettings({
            profile_visibility: data.privacy_settings.profile_visibility || 'everyone',
            dob_visibility: data.privacy_settings.dob_visibility || 'followers',
            location_visibility: data.privacy_settings.location_visibility || 'followers'
          });
        }
      } catch (e) {
        console.warn('[Settings] Error loading private settings:', e);
      }
    }
    loadPrivateSettings();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Sync privacy settings when profile updates
  useEffect(() => {
    if (currentProfile?.privacy_settings) {
      setPrivacySettings({
        profile_visibility: currentProfile.privacy_settings.profile_visibility || 'everyone',
        dob_visibility: currentProfile.privacy_settings.dob_visibility || 'followers',
        location_visibility: currentProfile.privacy_settings.location_visibility || 'followers'
      });
    }
  }, [currentProfile]);

  // Load blocked users when blocked section is active
  useEffect(() => {
    if (activeSection === 'blocked' && currentUser?.id) {
      loadBlockedUsers();
    }
  }, [activeSection, currentUser?.id]);

  const loadBlockedUsers = async () => {
    if (!currentUser?.id) return;
    setLoadingBlocked(true);
    try {
      const list = await getBlockedUserList(currentUser.id);
      setBlockedList(list || []);
    } catch (e) {
      console.error('[Settings] loadBlockedUsers error:', e);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (targetUserId) => {
    if (!currentUser?.id || !targetUserId) return;
    setUnblockingId(targetUserId);
    try {
      const res = await unblockUser(currentUser.id, targetUserId);
      if (res.success) {
        setBlockedList((prev) => prev.filter((u) => u.id !== targetUserId));
      } else {
        alert(res.error || 'Failed to unblock user');
      }
    } catch (e) {
      console.error('[Settings] handleUnblock error:', e);
    } finally {
      setUnblockingId(null);
    }
  };

  const handleSavePrivacy = async (updated) => {
    const nextSettings = { ...privacySettings, ...updated };
    setPrivacySettings(nextSettings);
    if (!currentUser?.id) return;

    setSavingPrivacy(true);
    setPrivacySavedMsg(false);
    try {
      const res = await upsertUserPrivateDetails(currentUser.id, {
        privacy_settings: nextSettings
      });
      if (res.success) {
        if (res.serverSaved !== false && !res.pendingMigration) {
          setPrivacySavedMsg('Saved to server!');
        } else {
          setPrivacySavedMsg('Saved locally (server migration pending)');
        }
        setTimeout(() => setPrivacySavedMsg(false), 3500);
      } else {
        console.error('[Settings] Failed to save privacy settings:', res.error);
        alert(res.error || 'Failed to save privacy settings');
      }
    } catch (e) {
      console.error('[Settings] handleSavePrivacy error:', e);
      alert('Error saving privacy settings');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const navItems = [
    { id: 'appearance', label: 'Appearance & Theme', icon: Palette, description: 'Dark, Light, System themes & styling' },
    { id: 'account', label: 'Account & Security', icon: User, description: 'User info, email & credentials' },
    { id: 'privacy', label: 'Privacy & Visibility', icon: Shield, description: 'Profile audience and data visibility' },
    { id: 'blocked', label: 'Blocked Accounts', icon: UserX, description: 'Manage blocked profiles and restrictions' }
  ];

  return (
    <div className="settings-page-layout">
      {/* Settings Header */}
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage your platform preferences, account privacy, and visual appearance</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Settings Navigation Sidebar */}
        <aside className="settings-sidebar">
          <nav className="settings-nav-list" aria-label="Settings categories">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`settings-nav-item ${isActive ? 'active' : ''}`}
                >
                  <div className="settings-nav-icon-wrap">
                    <Icon size={18} />
                  </div>
                  <div className="settings-nav-text">
                    <span className="settings-nav-label">{item.label}</span>
                    <span className="settings-nav-desc">{item.description}</span>
                  </div>
                  <ChevronRight size={15} className="settings-nav-arrow" />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Settings Content Pane */}
        <main className="settings-content-pane">
          {/* ======================================================== */}
          {/* APPEARANCE SECTION */}
          {/* ======================================================== */}
          {activeSection === 'appearance' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <div>
                  <h2 className="section-title">Appearance & Color Scheme</h2>
                  <p className="section-desc">
                    Customize the interface appearance. Choose between the new Midnight Navy dark theme,
                    standard light theme, or automatic system sync.
                  </p>
                </div>
              </div>

              {/* Theme Choices Cards */}
              <div className="theme-options-grid">
                {/* DARK THEME */}
                <div
                  className={`theme-card ${theme === 'dark' ? 'selected' : ''}`}
                  onClick={() => setTheme('dark')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTheme('dark')}
                >
                  {/* Theme Mockup Preview */}
                  <div className="theme-mockup theme-mockup-dark">
                    <div className="mockup-header">
                      <div className="mockup-brand">
                        <div className="mockup-logo-dot" />
                        <div className="mockup-text-bar w-16" />
                      </div>
                      <div className="mockup-avatar" />
                    </div>
                    <div className="mockup-body">
                      <div className="mockup-sidebar">
                        <div className="mockup-pill active" />
                        <div className="mockup-pill" />
                        <div className="mockup-pill" />
                      </div>
                      <div className="mockup-feed">
                        <div className="mockup-card">
                          <div className="mockup-card-header">
                            <div className="mockup-avatar-sm" />
                            <div className="mockup-text-bar w-20" />
                          </div>
                          <div className="mockup-text-bar w-full" />
                          <div className="mockup-text-bar w-3/4" />
                          <div className="mockup-btn" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="theme-info">
                    <div className="theme-title-row">
                      <div className="theme-label-with-icon">
                        <Moon size={16} className="text-primary-blue" />
                        <span className="theme-name">Dark (Midnight Navy)</span>
                      </div>
                      {theme === 'dark' && (
                        <div className="theme-check-badge">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <p className="theme-desc">
                      Deep Midnight Navy (#080E18) with vibrant Electric Blue accents (#2878FF). Recommended for low-light environments and optimal contrast.
                    </p>
                  </div>
                </div>

                {/* LIGHT THEME */}
                <div
                  className={`theme-card ${theme === 'light' ? 'selected' : ''}`}
                  onClick={() => setTheme('light')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTheme('light')}
                >
                  {/* Theme Mockup Preview */}
                  <div className="theme-mockup theme-mockup-light">
                    <div className="mockup-header">
                      <div className="mockup-brand">
                        <div className="mockup-logo-dot" />
                        <div className="mockup-text-bar w-16" />
                      </div>
                      <div className="mockup-avatar" />
                    </div>
                    <div className="mockup-body">
                      <div className="mockup-sidebar">
                        <div className="mockup-pill active" />
                        <div className="mockup-pill" />
                        <div className="mockup-pill" />
                      </div>
                      <div className="mockup-feed">
                        <div className="mockup-card">
                          <div className="mockup-card-header">
                            <div className="mockup-avatar-sm" />
                            <div className="mockup-text-bar w-20" />
                          </div>
                          <div className="mockup-text-bar w-full" />
                          <div className="mockup-text-bar w-3/4" />
                          <div className="mockup-btn" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="theme-info">
                    <div className="theme-title-row">
                      <div className="theme-label-with-icon">
                        <Sun size={16} className="text-amber-500" />
                        <span className="theme-name">Light</span>
                      </div>
                      {theme === 'light' && (
                        <div className="theme-check-badge">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <p className="theme-desc">
                      Clean daylight surfaces with crisp typography and subtle grey borders. High-contrast readability for bright spaces.
                    </p>
                  </div>
                </div>

                {/* SYSTEM THEME */}
                <div
                  className={`theme-card ${theme === 'system' ? 'selected' : ''}`}
                  onClick={() => setTheme('system')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTheme('system')}
                >
                  {/* Theme Mockup Preview */}
                  <div className="theme-mockup theme-mockup-system">
                    <div className="mockup-split-left">
                      <div className="mockup-header">
                        <div className="mockup-logo-dot" />
                      </div>
                      <div className="mockup-body">
                        <div className="mockup-card" />
                      </div>
                    </div>
                    <div className="mockup-split-right">
                      <div className="mockup-header">
                        <div className="mockup-avatar" />
                      </div>
                      <div className="mockup-body">
                        <div className="mockup-card" />
                      </div>
                    </div>
                  </div>

                  <div className="theme-info">
                    <div className="theme-title-row">
                      <div className="theme-label-with-icon">
                        <Monitor size={16} className="text-purple-400" />
                        <span className="theme-name">System Default</span>
                      </div>
                      {theme === 'system' && (
                        <div className="theme-check-badge">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <p className="theme-desc">
                      Automatically follows your operating system's dark or light mode setting. Currently resolved to:{' '}
                      <strong style={{ color: 'var(--color-primary-blue)' }}>{resolvedTheme} mode</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Component Preferences */}
              <div className="settings-card" style={{ marginTop: '24px' }}>
                <h3 className="card-heading">Navigation Layout & Visibility</h3>
                <p className="card-subheading" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Independently customize which SINC navigation controls are visible across the platform.
                </p>

                {/* Toggle 1: Floating Bottom Navigation */}
                <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ maxWidth: '80%' }}>
                    <div className="setting-label" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      Floating Bottom Navigation Bar
                    </div>
                    <div className="setting-subtext" style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Pill-shaped floating horizontal bar centered near the bottom with Home, Domains, Messages, Search, and Profile.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${showBottomNav ? 'active' : ''}`}
                    onClick={() => {
                      if (onToggleBottomNav) {
                        onToggleBottomNav();
                      } else {
                        const next = !showBottomNav;
                        try {
                          localStorage.setItem('sinc_show_bottom_nav', String(next));
                          window.dispatchEvent(new Event('sinc_nav_preferences_changed'));
                        } catch (e) {}
                      }
                    }}
                    role="switch"
                    aria-checked={showBottomNav}
                    aria-label="Toggle Floating Bottom Navigation Bar"
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>

                {/* Toggle 2: Floating Vertical Icon Sidebar */}
                <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ maxWidth: '80%' }}>
                    <div className="setting-label" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      Floating Vertical Icon Sidebar
                    </div>
                    <div className="setting-subtext" style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Pill-shaped capsule on the left with 13 circular icons for instant domain navigation and category feed filters.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${showVerticalRail ? 'active' : ''}`}
                    onClick={() => {
                      if (onToggleVerticalRail) {
                        onToggleVerticalRail();
                      } else {
                        const next = !showVerticalRail;
                        try {
                          localStorage.setItem('sinc_show_vertical_rail', String(next));
                          window.dispatchEvent(new Event('sinc_nav_preferences_changed'));
                        } catch (e) {}
                      }
                    }}
                    role="switch"
                    aria-checked={showVerticalRail}
                    aria-label="Toggle Floating Vertical Icon Sidebar"
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>

                {/* Toggle 3: Full Left Menu with Labels */}
                <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                  <div style={{ maxWidth: '80%' }}>
                    <div className="setting-label" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      Full Left Menu with Labels
                    </div>
                    <div className="setting-subtext" style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Expanded primary sidebar menu with destination text labels, Create Post button, and account drawer.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${isLeftSidebarOpen ? 'active' : ''}`}
                    onClick={() => {
                      if (onToggleLeftSidebar) {
                        onToggleLeftSidebar();
                      } else {
                        const next = !isLeftSidebarOpen;
                        try {
                          localStorage.setItem('sinc_left_sidebar_open', String(next));
                          window.dispatchEvent(new Event('sinc_nav_preferences_changed'));
                        } catch (e) {}
                      }
                    }}
                    role="switch"
                    aria-checked={isLeftSidebarOpen}
                    aria-label="Toggle Full Left Menu with Labels"
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>
              </div>

              {/* Design System Details info banner */}
              <div className="settings-info-card">
                <div className="info-icon-badge">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="info-title">SINC Design System 2.0</h4>
                  <p className="info-text">
                    All components, cards, navigation bars, dropdowns, and dialogs are powered by CSS design tokens.
                    Theme transitions apply with zero layout shift and are persisted across your browsing sessions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACCOUNT & SECURITY SECTION */}
          {/* ======================================================== */}
          {activeSection === 'account' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <div>
                  <h2 className="section-title">Account Details</h2>
                  <p className="section-desc">Manage your authenticated session, user credentials, and profile links</p>
                </div>
              </div>

              <div className="settings-card">
                <div className="account-preview-header">
                  <div className="account-avatar-wrap">
                    {currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url ? (
                      <img
                        src={currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url}
                        alt="Profile avatar"
                        className="account-avatar-img"
                      />
                    ) : (
                      <div className="account-avatar-placeholder">
                        <User size={28} />
                      </div>
                    )}
                  </div>
                  <div className="account-details">
                    <h3 className="account-name">
                      {currentProfile?.name || currentUser?.user_metadata?.full_name || 'Authenticated Member'}
                    </h3>
                    <p className="account-handle">
                      @{currentProfile?.username || currentUser?.email?.split('@')[0] || 'member'}
                    </p>
                    <span className="account-badge">
                      {currentProfile?.role || 'SINC Contributor'}
                    </span>
                  </div>
                  <div className="account-actions">
                    {onOpenEditProfile && (
                      <button
                        type="button"
                        onClick={onOpenEditProfile}
                        className="btn-primary-sm"
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>
                </div>

                <div className="account-meta-grid">
                  <div className="account-meta-item">
                    <div className="meta-label">
                      <Mail size={14} />
                      <span>Email Address</span>
                    </div>
                    <div className="meta-val">{currentUser?.email || 'Not available'}</div>
                  </div>

                  <div className="account-meta-item">
                    <div className="meta-label">
                      <Shield size={14} />
                      <span>User ID</span>
                    </div>
                    <div className="meta-val code-font">{currentUser?.id || 'Anonymous'}</div>
                  </div>

                  <div className="account-meta-item">
                    <div className="meta-label">
                      <Calendar size={14} />
                      <span>Member Since</span>
                    </div>
                    <div className="meta-val">
                      {currentUser?.created_at
                        ? new Date(currentUser.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Active Member'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PRIVACY & VISIBILITY SECTION */}
          {/* ======================================================== */}
          {activeSection === 'privacy' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <div>
                  <h2 className="section-title">Privacy & Profile Visibility</h2>
                  <p className="section-desc">
                    Control who can view your profile, posts, and shared technology updates.
                  </p>
                </div>
                {privacySavedMsg && (
                  <div
                    className="saved-indicator"
                    style={
                      typeof privacySavedMsg === 'string' && privacySavedMsg.includes('locally')
                        ? { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }
                        : {}
                    }
                  >
                    <CheckCircle2 size={16} />
                    <span>{typeof privacySavedMsg === 'string' ? privacySavedMsg : 'Saved!'}</span>
                  </div>
                )}
              </div>

              {/* Profile Visibility Options */}
              <div className="settings-card">
                <h3 className="card-heading">Profile Visibility</h3>
                <p className="card-subheading">
                  Choose how your profile and timeline content appear to other members across the platform.
                </p>

                <div className="privacy-options-stack">
                  {/* Public / Everyone */}
                  <label
                    className={`privacy-option-card ${
                      privacySettings.profile_visibility === 'everyone' ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="profile_visibility"
                      value="everyone"
                      checked={privacySettings.profile_visibility === 'everyone'}
                      onChange={() => handleSavePrivacy({ profile_visibility: 'everyone' })}
                      className="privacy-radio"
                    />
                    <div className="privacy-option-content">
                      <div className="privacy-option-title-row">
                        <Eye size={16} className="text-primary-blue" />
                        <span className="privacy-option-title">Public (Everyone)</span>
                      </div>
                      <p className="privacy-option-desc">
                        Anyone on SINC can view your posts, projects, follow you without approval, and see your activity.
                      </p>
                    </div>
                  </label>

                  {/* Private / Followers Only */}
                  <label
                    className={`privacy-option-card ${
                      privacySettings.profile_visibility === 'followers' ||
                      privacySettings.profile_visibility === 'private'
                        ? 'selected'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="profile_visibility"
                      value="followers"
                      checked={
                        privacySettings.profile_visibility === 'followers' ||
                        privacySettings.profile_visibility === 'private'
                      }
                      onChange={() => handleSavePrivacy({ profile_visibility: 'followers' })}
                      className="privacy-radio"
                    />
                    <div className="privacy-option-content">
                      <div className="privacy-option-title-row">
                        <Lock size={16} className="text-amber-500" />
                        <span className="privacy-option-title">Private (Followers Only)</span>
                      </div>
                      <p className="privacy-option-desc">
                        Only people you approve as followers can see your posts and details. New followers must send a request.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Additional privacy options */}
              <div className="settings-card">
                <h3 className="card-heading">Specific Information Visibility</h3>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Date of Birth Visibility</div>
                    <div className="setting-subtext">Who can see your birthday on your profile</div>
                  </div>
                  <select
                    value={privacySettings.dob_visibility}
                    onChange={(e) => handleSavePrivacy({ dob_visibility: e.target.value })}
                    className="settings-select"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers Only</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>

                <div className="setting-row">
                  <div>
                    <div className="setting-label">Location Visibility</div>
                    <div className="setting-subtext">Who can see your city and country information</div>
                  </div>
                  <select
                    value={privacySettings.location_visibility}
                    onChange={(e) => handleSavePrivacy({ location_visibility: e.target.value })}
                    className="settings-select"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers Only</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BLOCKED USERS SECTION */}
          {/* ======================================================== */}
          {activeSection === 'blocked' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <div>
                  <h2 className="section-title">Blocked Accounts</h2>
                  <p className="section-desc">
                    Blocked members cannot send you follow requests, view your private timeline, or message you.
                  </p>
                </div>
              </div>

              <div className="settings-card">
                {loadingBlocked ? (
                  <div className="blocked-loading">
                    <div className="settings-spinner" />
                    <span>Loading blocked accounts...</span>
                  </div>
                ) : blockedList.length === 0 ? (
                  <div className="blocked-empty-state">
                    <UserX size={36} className="text-muted" />
                    <h4 className="empty-title">No blocked accounts</h4>
                    <p className="empty-desc">
                      You haven't blocked any members yet. When you reject a follow request with "Reject and Block",
                      they will appear here and can be unblocked anytime.
                    </p>
                  </div>
                ) : (
                  <div className="blocked-list">
                    {blockedList.map((user) => (
                      <div key={user.id} className="blocked-user-row">
                        <div className="blocked-user-info">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="blocked-user-avatar" />
                          ) : (
                            <div className="blocked-avatar-placeholder">
                              <User size={18} />
                            </div>
                          )}
                          <div>
                            <div className="blocked-user-name">{user.name}</div>
                            <div className="blocked-user-handle">@{user.username}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnblock(user.id)}
                          disabled={unblockingId === user.id}
                          className="btn-unblock"
                        >
                          {unblockingId === user.id ? 'Unblocking...' : 'Unblock'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
