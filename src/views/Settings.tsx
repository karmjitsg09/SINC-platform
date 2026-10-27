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
  AlertCircle,
  Smartphone,
  Send,
  RefreshCw,
  ChevronRight,
  Play,
  Copy,
  Pencil,
  KeyRound,
  Clock
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getUserPrivateDetails, upsertUserPrivateDetails } from '../lib/profileService';
import { getBlockedUserList, unblockUser } from '../lib/blockService';
import { playSincIntro } from '../lib/sinc-intro';
import {
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
  subscribeToPushState,
  dispatchServerPushNotification
} from '../lib/pushNotificationService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SettingsProps {
  currentUser?: any;
  currentProfile?: any;
  onOpenEditProfile?: () => void;
  onNavigateTab?: (tab: string) => void;
  showBottomNav?: boolean;
  onToggleBottomNav?: () => void;
  showVerticalRail?: boolean;
  onToggleVerticalRail?: () => void;
  isLeftSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
}

interface BlockedUser {
  id: string;
  name?: string;
  username?: string;
  avatarUrl?: string | null;
}

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
}: SettingsProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { updateProfile: updateAuthProfile } = useAuth();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState('appearance');

  // Privacy state
  const [privacySettings, setPrivacySettings] = useState(() => ({
    profile_visibility: currentProfile?.privacy_settings?.profile_visibility || 'everyone',
    dob_visibility: currentProfile?.privacy_settings?.dob_visibility || 'followers',
    location_visibility: currentProfile?.privacy_settings?.location_visibility || 'followers'
  }));
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacySavedMsg, setPrivacySavedMsg] = useState<string | boolean>(false);

  // Blocked users state
  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Copy User ID feedback state
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (currentUser?.id && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUser.id);
      setCopiedId(true);
      toast.success('User ID copied to clipboard');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

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
        profile_visibility: currentProfile.privacy_settings.profile_visibility || (currentProfile?.is_private ? 'followers' : 'everyone'),
        dob_visibility: currentProfile.privacy_settings.dob_visibility || 'followers',
        location_visibility: currentProfile.privacy_settings.location_visibility || 'followers'
      });
    } else if (currentProfile?.is_private !== undefined) {
      setPrivacySettings((prev) => ({
        ...prev,
        profile_visibility: currentProfile.is_private ? 'followers' : 'everyone'
      }));
    }
  }, [currentProfile]);

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

  // Load blocked users when blocked section is active
  useEffect(() => {
    if (activeSection === 'blocked' && currentUser?.id) {
      loadBlockedUsers();
    }
  }, [activeSection, currentUser?.id]);

  const handleUnblock = async (targetUserId: string) => {
    if (!currentUser?.id || !targetUserId) return;
    setUnblockingId(targetUserId);
    try {
      const res = await unblockUser(currentUser.id, targetUserId);
      if (res.success) {
        setBlockedList((prev) => prev.filter((u) => u.id !== targetUserId));
        toast.success('User unblocked successfully.');
      } else {
        toast.error(res.error || 'Failed to unblock user');
      }
    } catch (e: any) {
      console.error('[Settings] handleUnblock error:', e);
      toast.error(e?.message || 'Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  const handleSavePrivacy = async (updated: Partial<typeof privacySettings>) => {
    const prevSettings = { ...privacySettings };
    const nextSettings = { ...privacySettings, ...updated };
    setPrivacySettings(nextSettings);
    if (!currentUser?.id) return;

    setSavingPrivacy(true);
    setPrivacySavedMsg(false);
    try {
      const isPrivateAccount = nextSettings.profile_visibility === 'followers' || nextSettings.profile_visibility === 'private';

      // 1. Persist private settings into user_private_details
      const privPromise = upsertUserPrivateDetails(currentUser.id, {
        privacy_settings: nextSettings
      });

      // 2. Persist account-level is_private flag on public.profiles
      const profilePromise = isSupabaseConfigured
        ? supabase.from('profiles').update({ is_private: isPrivateAccount }).eq('id', currentUser.id)
        : Promise.resolve({ error: null });

      const [resPriv, resProfile] = await Promise.all([privPromise, profilePromise]);

      if (resProfile?.error) {
        throw new Error(resProfile.error.message);
      }
      if (!resPriv.success && !resPriv.pendingMigration) {
        throw new Error(resPriv.error || 'Failed to update private settings');
      }

      if (updateAuthProfile) {
        updateAuthProfile({ is_private: isPrivateAccount, privacy_settings: nextSettings });
      }

      setPrivacySavedMsg('Saved to server!');
      toast.success('Privacy settings saved successfully.');
      setTimeout(() => setPrivacySavedMsg(false), 3500);
    } catch (e: any) {
      console.error('[Settings] handleSavePrivacy error:', e);
      setPrivacySettings(prevSettings);
      toast.error(e?.message || 'Failed to save privacy settings');
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Web Push Notifications state
  const [pushState, setPushState] = useState<string>('loading');
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [pushPrefs, setPushPrefs] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('sinc_push_preferences') : null;
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { direct_messages: true, follow_requests: true, interactions: true };
  });

  useEffect(() => {
    let isMounted = true;
    async function loadPushState() {
      try {
        const state = await getPushSubscriptionState();
        if (isMounted) setPushState(state);
      } catch (e) {
        if (isMounted) setPushState('default');
      }
    }
    loadPushState();
    const unsub = subscribeToPushState(() => {
      loadPushState();
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleTogglePush = async () => {
    if (!currentUser?.id) {
      toast.warning('Please log in to manage push notifications.');
      return;
    }
    setIsTogglingPush(true);
    setPushError(null);
    setTestPushStatus(null);
    try {
      if (pushState === 'granted_subscribed') {
        const res = await unsubscribeFromPush(currentUser.id);
        if (!res.success) {
          setPushError(res.error || 'Failed to disable notifications');
        } else {
          setPushState('granted_unsubscribed');
        }
      } else {
        const res = await subscribeToPush(currentUser.id);
        if (res.success) {
          setPushState('granted_subscribed');
        } else {
          setPushError(res.error || 'Failed to enable notifications');
          const nextState = await getPushSubscriptionState();
          setPushState(nextState);
        }
      }
    } catch (err: any) {
      setPushError(err.message || 'An unexpected error occurred');
    } finally {
      setIsTogglingPush(false);
    }
  };

  const handleTogglePref = (key: string) => {
    setPushPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sinc_push_preferences', JSON.stringify(next));
        }
      } catch (e) {}
      return next;
    });
  };

  const handleSendTestPush = async () => {
    if (!currentUser?.id) return;
    setTestPushStatus('sending');
    try {
      const res = await dispatchServerPushNotification({
        recipientId: currentUser.id,
        type: 'system',
        title: 'SINC Web Push Notification',
        message: 'Your browser is successfully connected to SINC Web Push!',
        url: '/notifications'
      });
      if (res && res.delivered > 0) {
        setTestPushStatus('Delivered to this device!');
      } else {
        setTestPushStatus('Dispatched (check your notification tray)');
      }
      setTimeout(() => setTestPushStatus(null), 5000);
    } catch (e: any) {
      setTestPushStatus('Failed: ' + (e.message || 'Unknown error'));
      setTimeout(() => setTestPushStatus(null), 5000);
    }
  };

  const navItems = [
    { id: 'appearance', label: 'Appearance & Theme', icon: Palette, description: 'Dark, Light, System themes & styling' },
    { id: 'account', label: 'Account & Security', icon: User, description: 'User info, email & credentials' },
    { id: 'privacy', label: 'Privacy & Visibility', icon: Shield, description: 'Profile audience and data visibility' },
    { id: 'notifications', label: 'Notifications & Web Push', icon: Bell, description: 'Browser push alerts & preferences' },
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

              {/* SINC Brand Experience Card */}
              <div className="settings-card" style={{ marginTop: '20px' }}>
                <h3 className="card-heading">Brand Experience</h3>
                <p className="card-subheading" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Experience the full SINC brand journey, dynamic animation, and mission story.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ maxWidth: '75%' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      SINC Welcome Film & Intro
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Play the complete 16.9-second animated introduction drawn live on canvas.
                    </div>
                  </div>
                  <button
                    type="button"
                    id="settings-play-intro-btn"
                    onClick={() => playSincIntro({ mode: 'welcome' })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '9px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: 'var(--color-primary-blue, #1868ff)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Play size={14} fill="currentColor" />
                    <span>Play Intro</span>
                  </button>
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

              {/* Main Account Profile Card */}
              <div className="settings-card">
                <div className="account-profile-header">
                  <div className="account-profile-identity">
                    <div className="account-avatar-wrap">
                      {currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url ? (
                        <img
                          src={(currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url) ?? undefined}
                          alt="Profile avatar"
                          className="account-avatar-img"
                        />
                      ) : (
                        <div className="account-avatar-placeholder">
                          {getInitials(currentProfile?.name || currentUser?.user_metadata?.full_name || 'Member')}
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
                      <div className="account-badge-wrap">
                        <span className="account-badge">
                          <Sparkles size={11} />
                          <span>{currentProfile?.role || 'SINC Contributor'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {onOpenEditProfile && (
                    <div className="account-profile-actions">
                      <button
                        type="button"
                        onClick={onOpenEditProfile}
                        className="btn-edit-profile"
                        id="settings-edit-profile-btn"
                        aria-label="Edit your public profile details"
                      >
                        <Pencil size={14} />
                        <span>Edit Profile</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="account-card-divider" />

                <div className="account-info-grid">
                  {/* Email Address */}
                  <div className="account-info-item">
                    <div className="account-info-icon-wrap">
                      <Mail size={16} />
                    </div>
                    <div className="account-info-body">
                      <div className="account-info-label-row">
                        <span className="account-info-label">Email Address</span>
                        {currentUser?.email && (
                          <span className="account-status-pill verified">
                            <CheckCircle2 size={11} />
                            <span>Verified</span>
                          </span>
                        )}
                      </div>
                      <div className="account-info-val" title={currentUser?.email || 'Not available'}>
                        {currentUser?.email || 'Not available'}
                      </div>
                    </div>
                  </div>

                  {/* User ID */}
                  <div className="account-info-item">
                    <div className="account-info-icon-wrap">
                      <Shield size={16} />
                    </div>
                    <div className="account-info-body">
                      <div className="account-info-label-row">
                        <span className="account-info-label">User ID</span>
                        {currentUser?.id && (
                          <button
                            type="button"
                            onClick={handleCopyId}
                            className="account-copy-btn"
                            title="Copy User ID to clipboard"
                            aria-label="Copy User ID to clipboard"
                          >
                            {copiedId ? (
                              <>
                                <Check size={11} style={{ color: '#10B981' }} />
                                <span style={{ color: '#10B981' }}>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="account-info-val code-font" title={currentUser?.id || 'Anonymous'}>
                        {currentUser?.id || 'Anonymous'}
                      </div>
                    </div>
                  </div>

                  {/* Member Since */}
                  <div className="account-info-item">
                    <div className="account-info-icon-wrap">
                      <Calendar size={16} />
                    </div>
                    <div className="account-info-body">
                      <div className="account-info-label-row">
                        <span className="account-info-label">Member Since</span>
                      </div>
                      <div className="account-info-val">
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

              {/* Security & Credentials Summary Card */}
              <div className="settings-card">
                <h3 className="card-heading">Authentication & Session Security</h3>
                <p className="card-subheading">
                  Active authentication provider and session security status for this account.
                </p>

                <div className="security-info-grid">
                  <div className="security-item-card">
                    <div className="security-item-left">
                      <div className="security-item-icon">
                        <KeyRound size={16} />
                      </div>
                      <div>
                        <div className="security-item-label">Sign-In Provider</div>
                        <div className="security-item-val">
                          {currentUser?.app_metadata?.provider === 'google' || currentUser?.identities?.some((i: any) => i.provider === 'google')
                            ? 'Google OAuth 2.0'
                            : 'Email & Password'}
                        </div>
                      </div>
                    </div>
                    <span className="security-status-badge">
                      <CheckCircle2 size={12} />
                      <span>Active</span>
                    </span>
                  </div>

                  <div className="security-item-card">
                    <div className="security-item-left">
                      <div className="security-item-icon">
                        <Lock size={16} />
                      </div>
                      <div>
                        <div className="security-item-label">Session Protection</div>
                        <div className="security-item-val">Encrypted Session Tokens</div>
                      </div>
                    </div>
                    <span className="security-status-badge">
                      <Shield size={12} />
                      <span>Protected</span>
                    </span>
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
          {/* NOTIFICATIONS & WEB PUSH SECTION */}
          {/* ======================================================== */}
          {activeSection === 'notifications' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <div>
                  <h2 className="section-title">Web Push Notifications</h2>
                  <p className="section-desc">
                    Receive genuine background notifications for direct messages, follow requests, and social activity even when SINC is closed.
                  </p>
                </div>
              </div>

              {/* Status & Master Switch Card */}
              <div className="settings-card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      backgroundColor: pushState === 'granted_subscribed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(40, 120, 255, 0.12)',
                      color: pushState === 'granted_subscribed' ? '#10B981' : 'var(--color-primary-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Bell size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Push Notifications on this Device
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor:
                            pushState === 'granted_subscribed'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : pushState === 'denied'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : pushState === 'unsupported'
                              ? 'rgba(100, 116, 139, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            pushState === 'granted_subscribed'
                              ? '#10B981'
                              : pushState === 'denied'
                              ? '#EF4444'
                              : pushState === 'unsupported'
                              ? '#94A3B8'
                              : '#F59E0B'
                        }}>
                          {pushState === 'granted_subscribed' && <CheckCircle2 size={13} />}
                          {pushState === 'denied' && <AlertCircle size={13} />}
                          {pushState === 'unsupported' && <Info size={13} />}
                          {pushState === 'granted_subscribed'
                            ? 'Enabled on this device'
                            : pushState === 'denied'
                            ? 'Permission denied by browser'
                            : pushState === 'unsupported'
                            ? 'Unsupported browser'
                            : pushState === 'loading'
                            ? 'Checking status...'
                            : 'Not enabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Button / Switch */}
                  <div>
                    {pushState === 'unsupported' ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Unavailable</span>
                    ) : (
                      <button
                        type="button"
                        id="web-push-master-toggle"
                        className={`toggle-switch ${pushState === 'granted_subscribed' ? 'active' : ''}`}
                        onClick={handleTogglePush}
                        disabled={isTogglingPush || pushState === 'loading'}
                        role="switch"
                        aria-checked={pushState === 'granted_subscribed'}
                        aria-label="Toggle Web Push Notifications"
                        style={{ cursor: isTogglingPush ? 'wait' : 'pointer' }}
                      >
                        <span className="toggle-slider" />
                      </button>
                    )}
                  </div>
                </div>

                {/* State Explanations */}
                {pushState === 'denied' && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginTop: '12px'
                  }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Notifications are blocked by your browser.</strong>
                      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
                        To enable Web Push, click the site settings / lock icon in your browser address bar, set Notifications to "Allow", and reload.
                      </p>
                    </div>
                  </div>
                )}

                {pushError && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '12px'
                  }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{pushError}</span>
                  </div>
                )}

                {pushState === 'granted_subscribed' && (
                  <div style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Verify Delivery
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Send a test Web Push alert to this active device
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {testPushStatus && (
                        <span style={{ fontSize: '12.5px', color: 'var(--color-primary-blue)', fontWeight: '500' }}>
                          {testPushStatus === 'sending' ? 'Sending...' : testPushStatus}
                        </span>
                      )}
                      <button
                        type="button"
                        id="test-push-notification-btn"
                        onClick={handleSendTestPush}
                        disabled={testPushStatus === 'sending'}
                        className="btn-primary-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
                      >
                        <Send size={14} />
                        <span>Send Test Alert</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Categories Card */}
              <div className="settings-card" style={{ marginBottom: '24px' }}>
                <h3 className="card-heading">Push Notification Categories</h3>
                <p className="card-subheading" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Choose which platform events dispatch background alerts to your registered devices.
                </p>

                {/* Category 1: Direct Messages */}
                <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ maxWidth: '80%' }}>
                    <div className="setting-label" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      Direct Messages
                    </div>
                    <div className="setting-subtext" style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Get notified when another member sends you a direct message in conversations.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${pushPrefs.direct_messages ? 'active' : ''}`}
                    onClick={() => handleTogglePref('direct_messages')}
                    role="switch"
                    aria-checked={pushPrefs.direct_messages}
                    aria-label="Toggle Direct Message Push Alerts"
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>

                {/* Category 2: Follow Requests */}
                <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ maxWidth: '80%' }}>
                    <div className="setting-label" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      Follow Requests & Approvals
                    </div>
                    <div className="setting-subtext" style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Get notified when someone requests to follow you or accepts your follow request.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${pushPrefs.follow_requests ? 'active' : ''}`}
                    onClick={() => handleTogglePref('follow_requests')}
                    role="switch"
                    aria-checked={pushPrefs.follow_requests}
                    aria-label="Toggle Follow Request Push Alerts"
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>

                {/* Category 3: Social Interactions */}
                <div className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                  <div style={{ maxWidth: '80%' }}>
                    <div className="setting-label" style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      Likes, Comments & Domain Updates
                    </div>
                    <div className="setting-subtext" style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Get notified when someone likes or comments on your shared technology posts.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${pushPrefs.interactions ? 'active' : ''}`}
                    onClick={() => handleTogglePref('interactions')}
                    role="switch"
                    aria-checked={pushPrefs.interactions}
                    aria-label="Toggle Interaction Push Alerts"
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>
              </div>

              {/* Informational Card */}
              <div className="settings-info-card">
                <div className="info-icon-badge">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h4 className="info-title">Independent & Battery-Conscious</h4>
                  <p className="info-text">
                    SINC Web Push relies on the standard W3C Push API and Service Workers. Alerts are delivered even if the browser tab is in the background or closed.
                    Disabling push on this device does not affect other registered devices or delete your in-app notification history.
                  </p>
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
                    <div className="blocked-empty-icon-wrap">
                      <UserX size={28} />
                    </div>
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
                            <img src={user.avatarUrl} alt={user.name || 'User'} className="blocked-user-avatar" />
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
