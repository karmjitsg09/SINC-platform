'use client';

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import TopHeader from './components/TopHeader';
import SidebarNavigation from './components/SidebarNavigation';
import DomainShortcutRail from './components/DomainShortcutRail';
import BottomNav from './components/BottomNav';
import SincLogo from './components/common/SincLogo';
import SincIntro from './components/common/SincIntro';
import ErrorBoundary from './components/common/ErrorBoundary';

import Feed from './views/Feed';
import DomainList from './views/DomainList';
import Domain from './views/Domain';
import DomainChat from './views/DomainChat';
import MessagesList from './views/MessagesList';
import MessageDetail from './views/MessageDetail';
import MessagesPage from './views/MessagesPage';
import PostView from './views/PostView';
import Search from './views/Search';
import Profile from './views/Profile';
import Notifications from './views/Notifications';
import Login from './views/Login';
import SignUp from './views/SignUp';

// Route-level code splitting for non-critical pages (Phase 5: Bundle Optimization)
const Settings = lazy(() => import('./views/Settings'));
const ProfileDetails = lazy(() => import('./views/ProfileDetails'));
const ProfileMenu = lazy(() => import('./views/ProfileMenu'));
const SavedPosts = lazy(() => import('./views/SavedPosts'));
const ProjectsPage = lazy(() => import('./views/ProjectsPage'));
const ExperiencePage = lazy(() => import('./views/ExperiencePage'));
const EducationPage = lazy(() => import('./views/EducationPage'));
const CertificationsPage = lazy(() => import('./views/CertificationsPage'));
const AchievementsPage = lazy(() => import('./views/AchievementsPage'));
const ItemUpdatesPage = lazy(() => import('./views/ItemUpdatesPage'));
const CreatePost = lazy(() => import('./views/CreatePost'));
const UpdateStoryViewer = lazy(() => import('./views/UpdateStoryViewer'));
const ForgotPassword = lazy(() => import('./views/ForgotPassword'));
const ProfileSetupWizard = lazy(() => import('./components/profile/ProfileSetupWizard'));

function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        width: '100%',
        color: '#64748b',
        fontSize: '13px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '18px',
            height: '18px',
            border: '2px solid rgba(40, 120, 255, 0.2)',
            borderTopColor: '#2878ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <span>Loading...</span>
      </div>
    </div>
  );
}

import { updateBasicProfile } from './lib/profileService';

import { useConversations } from './messaging/hooks/useConversations';
import { useNotifications } from './notifications/hooks/useNotifications';
import { checkIsDomainMember } from './lib/domainUtils';
import { getOrCreateDirectConversation, markConversationAsRead } from './messaging/services/conversationService';
import { domains, users, FEED_CATEGORIES } from './data/mockData';
import { parseRoute, pushRoute, replaceRoute } from './lib/routeUtils';
import { useToast } from './context/ToastContext';

function isUuid(str: string): boolean {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function MainAppContent() {
  const { user, isAuthenticated, authRoute, loadingSession, logout, updateProfile: updateAuthProfile } = useAuth();
  const toast = useToast();
  const currentUserId = isAuthenticated ? user?.id : null;
  const { conversations: rawConversations, hasUnreadMessages, unreadTotal: unreadMessagesCount } = useConversations(currentUserId);
  const { unreadCount: unreadNotificationsCount } = useNotifications(currentUserId);
  const conversations = rawConversations || [];

  // Parse initial route from address bar on page load or refresh
  const initialRoute = React.useMemo(() => {
    return parseRoute(
      typeof window !== 'undefined' ? window.location.pathname : '/',
      typeof window !== 'undefined' ? window.location.hash : '',
      typeof window !== 'undefined' ? window.location.search : ''
    );
  }, []);

  const [activeTab, setActiveTab] = useState(initialRoute.tab || 'home');
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [startupTimedOut, setStartupTimedOut] = useState(false);

  useEffect(() => {
    if (!loadingSession) {
      setStartupTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (loadingSession) {
        setStartupTimedOut(true);
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [loadingSession]);

  const [activeDomainId, setActiveDomainId] = useState(initialRoute.activeDomainId || 'tech');

  // Domain sub-navigation state
  const [domainSubView, setDomainSubView] = useState<string>(initialRoute.domainSubView || 'list'); // 'list' | 'domain' | 'chat'
  const [selectedChannel, setSelectedChannel] = useState<any>(
    initialRoute.channelId ? { id: initialRoute.channelId, title: initialRoute.channelId } : null
  );

  // Messages sub-navigation state
  const [messagesSubView, setMessagesSubView] = useState<string>(initialRoute.messagesSubView || 'list'); // 'list' | 'detail'
  const [selectedConversation, setSelectedConversation] = useState<any>(
    initialRoute.conversationId ? { id: initialRoute.conversationId } : null
  );

  // Profile sub-navigation state
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(
    initialRoute.targetUserId ? { id: initialRoute.targetUserId } : null
  );
  const [profileOriginTab, setProfileOriginTab] = useState<string>('search');
  const [profileSubView, setProfileSubView] = useState<string>(initialRoute.profileSubView || 'view');
  const [profileDetailsOrigin, setProfileDetailsOrigin] = useState<string>('view');
  const [activeUpdatesContext, setActiveUpdatesContext] = useState<any>(null);

  // Home Feed category state
  const [selectedFeedCategory, setSelectedFeedCategory] = useState<string>('all');
  const [selectedUpdateCategory, setSelectedUpdateCategory] = useState<string>('all');
  const [storyViewerGroup, setStoryViewerGroup] = useState<any>(null);
  const [storyViewerGroups, setStoryViewerGroups] = useState<any[]>([]);
  const [isResolvingConversation, setIsResolvingConversation] = useState<boolean>(false);
  const [targetPostId, setTargetPostId] = useState<string | null>(null);
  const [createPostInitialMediaType, setCreatePostInitialMediaType] = useState<string>('none');

  // Dedicated Post View navigation state
  const [activePostId, setActivePostId] = useState<string | null>(initialRoute.activePostId || null);
  const [activePostInitialData, setActivePostInitialData] = useState<any>(null);
  const [postViewReturnState, setPostViewReturnState] = useState<any>(null);

  // Independent Navigation Visibility Preferences
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('sinc_left_sidebar_open');
      if (stored !== null) return stored !== 'false';
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  });

  const [showVerticalRail, setShowVerticalRail] = useState(() => {
    try {
      const stored = localStorage.getItem('sinc_show_vertical_rail');
      return stored !== null ? stored !== 'false' : true;
    } catch (e) {
      return true;
    }
  });

  const [showBottomNav, setShowBottomNav] = useState(() => {
    try {
      const stored = localStorage.getItem('sinc_show_bottom_nav');
      return stored !== null ? stored !== 'false' : true;
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    const handleNavPrefsSync = () => {
      try {
        const storedBottom = localStorage.getItem('sinc_show_bottom_nav');
        if (storedBottom !== null) setShowBottomNav(storedBottom !== 'false');
        const storedRail = localStorage.getItem('sinc_show_vertical_rail');
        if (storedRail !== null) setShowVerticalRail(storedRail !== 'false');
        const storedSidebar = localStorage.getItem('sinc_left_sidebar_open');
        if (storedSidebar !== null) setIsLeftSidebarOpen(storedSidebar !== 'false');
      } catch (e) {}
    };

    window.addEventListener('sinc_nav_preferences_changed', handleNavPrefsSync);
    window.addEventListener('storage', handleNavPrefsSync);
    return () => {
      window.removeEventListener('sinc_nav_preferences_changed', handleNavPrefsSync);
      window.removeEventListener('storage', handleNavPrefsSync);
    };
  }, []);

  const handleToggleLeftSidebar = () => {
    setIsLeftSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sinc_left_sidebar_open', String(next));
        window.dispatchEvent(new Event('sinc_nav_preferences_changed'));
      } catch (e) {}
      return next;
    });
  };

  // Filter available domains based on authenticated user's selected domain memberships
  const userDomains = React.useMemo(() => {
    let domainIds = user?.domains;
    if (!domainIds || !Array.isArray(domainIds) || domainIds.length === 0) {
      try {
        const cached = localStorage.getItem(`sync_user_domains_${user?.id}`);
        if (cached) domainIds = JSON.parse(cached);
      } catch (e) {}
    }

    if (Array.isArray(domainIds) && domainIds.length > 0) {
      const filtered = domains.filter((d) => checkIsDomainMember(domainIds, d.id, d.name));
      if (filtered.length > 0) return filtered;
    }
    return domains.slice(0, 5);
  }, [user?.domains, user?.id]);

  const activeDomain = userDomains.find((d) => d.id === activeDomainId) || userDomains[0] || domains[0];

  // Resolve active conversation by merging with fetched list if available
  const activeConversation = React.useMemo(() => {
    if (!selectedConversation) return null;
    const found = (conversations as any[]).find((c: any) => c.id === (selectedConversation as any)?.id);
    return found ? { ...(selectedConversation as any), ...found } : selectedConversation;
  }, [conversations, selectedConversation]);

  // Resolve active profile user by merging with mock data if available
  const activeProfileUser = React.useMemo(() => {
    if (!selectedProfileUser) return null;
    const found = (users as any[]).find((u: any) => u.id === (selectedProfileUser as any)?.id);
    return found ? { ...(selectedProfileUser as any), ...found } : selectedProfileUser;
  }, [selectedProfileUser]);

  const handleViewAllUpdates = (itemType: string, item: any) => {
    setActiveUpdatesContext({
      itemType,
      itemId: item.id,
      item,
      previousSubView: profileSubView
    });
    setProfileSubView('item-updates');
    pushRoute({ tab: 'profile', profileSubView: 'item-updates' });
  };

  // Browser history popstate handler — synchronizes application state with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRoute(window.location.pathname, window.location.hash, window.location.search);

      if (parsed.tab === 'post-view' && parsed.activePostId) {
        setActivePostId(parsed.activePostId);
        setActiveTab('post-view');
        return;
      }

      if (parsed.tab === 'home' && window.location.hash.startsWith('#post-')) {
        const hashId = window.location.hash.replace('#post-', '');
        if (isUuid(hashId)) {
          setActivePostId(hashId);
          setActiveTab('post-view');
          return;
        }
      }

      setActiveTab(parsed.tab || 'home');

      if (parsed.tab === 'messages') {
        setMessagesSubView(parsed.messagesSubView || 'list');
        if (parsed.conversationId) {
          setSelectedConversation((prev: any) => (prev?.id === parsed.conversationId ? prev : { id: parsed.conversationId }));
        } else {
          setSelectedConversation(null);
        }
      } else if (parsed.tab === 'domains') {
        setDomainSubView(parsed.domainSubView || 'list');
        if (parsed.activeDomainId) {
          setActiveDomainId(parsed.activeDomainId);
        }
        if (parsed.channelId) {
          setSelectedChannel((prev: any) => (prev?.id === parsed.channelId ? prev : { id: parsed.channelId, title: parsed.channelId }));
        } else {
          setSelectedChannel(null);
        }
      } else if (parsed.tab === 'profile') {
        setProfileSubView(parsed.profileSubView || 'view');
        if (parsed.targetUserId) {
          setSelectedProfileUser((prev: any) => (prev?.id === parsed.targetUserId ? prev : { id: parsed.targetUserId }));
        } else {
          setSelectedProfileUser(null);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initial load check for direct #post-<uuid> links
  useEffect(() => {
    if (window.location.hash.startsWith('#post-')) {
      const hashId = window.location.hash.replace('#post-', '');
      if (isUuid(hashId)) {
        setActivePostId(hashId);
        setActiveTab('post-view');
      }
    }
  }, []);

  // Sync auth routes when authentication state changes
  useEffect(() => {
    if (!loadingSession) {
      const lower = window.location.pathname.toLowerCase();
      if (isAuthenticated) {
        if (lower === '/login' || lower === '/signup' || lower === '/forgot-password') {
          replaceRoute({ tab: 'home' });
        }
      } else {
        if (lower !== '/login' && lower !== '/signup' && lower !== '/forgot-password') {
          window.history.replaceState({ authRoute: 'login' }, '', '/login');
        }
      }
    }
  }, [isAuthenticated, loadingSession]);

  // Resume or start profile setup wizard for new users with incomplete setup
  useEffect(() => {
    if (isAuthenticated && user?.isNewUser && !user?.onboarding_completed) {
      setIsOnboardingActive(true);
    }
  }, [isAuthenticated, user?.isNewUser, user?.onboarding_completed]);

  // Neutral initialization screen until client mount and session check completes
  if (loadingSession) {
    if (startupTimedOut) {
      return (
        <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app, #080E18)', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '420px', textAlign: 'center' }}>
            <SincLogo size={72} alt="SINC Logo" priority={true} />
            <div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 600 }}>Connection taking longer than expected</div>
            <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
              Initialization timed out. You can retry connecting or proceed directly to sign in.
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                id="startup-retry-btn"
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
              <button
                type="button"
                id="startup-login-btn"
                onClick={() => {
                  try {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const key = localStorage.key(i);
                      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                        localStorage.removeItem(key);
                      }
                    }
                  } catch (_) {}
                  window.location.href = '/login';
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  fontWeight: 500,
                  fontSize: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer'
                }}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app, #080E18)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <SincLogo size={72} alt="SINC Logo" priority={true} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        {authRoute === 'signup' && <SignUp />}
        {authRoute === 'forgot-password' && (
          <Suspense fallback={<PageLoadingFallback />}>
            <ForgotPassword />
          </Suspense>
        )}
        {authRoute === 'login' && <Login />}
      </div>
    );
  }

  // Resume profile setup wizard for new users with incomplete setup
  if (isOnboardingActive) {
    return (
      <div className="app-shell">
        <TopHeader
          showSearchIcon={false}
          onSearchClick={() => {}}
          onNotificationClick={() => {}}
          isNotificationActive={false}
        />
        <div className="app-body" style={{ justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div className="main-content" style={{ maxWidth: '720px', margin: '0 auto', width: '100%' }}>
            <Suspense fallback={<PageLoadingFallback />}>
              <ProfileSetupWizard
                profileUser={user as any}
                initialStep={(user as any)?.firstIncompleteStep || 1}
                onSave={async (updates: any) => {
                  if (user?.id) {
                    await updateBasicProfile(user.id, updates);
                  }
                  if (updateAuthProfile) {
                    updateAuthProfile({ ...updates, onboarding_completed: true, isNewUser: false });
                  }
                  setIsOnboardingActive(false);
                  setActiveTab('home');
                  pushRoute({ tab: 'home' });
                }}
                onCancel={() => {
                  if (updateAuthProfile) {
                    updateAuthProfile({ isNewUser: false, onboarding_completed: true });
                  }
                  setIsOnboardingActive(false);
                  setActiveTab('home');
                  pushRoute({ tab: 'home' });
                }}
              />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  const handleNavigateToPost = (postId: string) => {
    if (!postId) return;
    setTargetPostId(postId);
    setActiveTab('home');
    pushRoute({ tab: 'home' });
  };

  const handleNavigateToPostView = (postId: any, returnContext: any = null) => {
    if (!postId) return;
    const ctx = returnContext || {
      activeTab,
      messagesSubView,
      selectedConversation,
      profileSubView
    };
    if (returnContext && returnContext.initialPost) {
      setActivePostInitialData(returnContext.initialPost);
    } else {
      setActivePostInitialData(null);
    }
    setPostViewReturnState(ctx);
    setActivePostId(postId);
    setActiveTab('post-view');

    pushRoute({ tab: 'post-view', activePostId: postId });
  };

  const handleBackFromPostView = () => {
    setActivePostInitialData(null);
    if (postViewReturnState) {
      const {
        activeTab: prevTab,
        messagesSubView: prevSubView,
        conversation,
        selectedConversation: prevConv,
        profileSubView: prevProfileSubView
      } = postViewReturnState;
      const targetConv = conversation || prevConv;

      setActiveTab(prevTab || 'messages');
      if (prevTab === 'messages') {
        setMessagesSubView(prevSubView || 'detail');
        if (targetConv) {
          setSelectedConversation(targetConv);
          pushRoute({ tab: 'messages', messagesSubView: prevSubView || 'detail', conversationId: targetConv.id });
        } else {
          pushRoute({ tab: 'messages', messagesSubView: 'list' });
        }
      } else if (prevTab === 'profile') {
        setProfileSubView(prevProfileSubView || 'view');
        pushRoute({ tab: 'profile', profileSubView: prevProfileSubView || 'view' });
      } else if (prevTab === 'notifications') {
        pushRoute({ tab: 'notifications' });
      } else {
        pushRoute({ tab: prevTab || 'home' });
      }
      setActivePostId(null);
      setPostViewReturnState(null);
    } else {
      setActiveTab('messages');
      setMessagesSubView('list');
      setActivePostId(null);
      pushRoute({ tab: 'messages', messagesSubView: 'list' });
    }
  };

  const handleOpenProfileDetails = (targetUser: any = null, origin: string | null = null) => {
    if (targetUser) {
      setSelectedProfileUser(targetUser);
    }
    const detailsOrigin = origin || profileSubView || 'view';
    setProfileDetailsOrigin(detailsOrigin);
    setProfileSubView('details');
    pushRoute({ tab: 'profile', profileSubView: 'details', targetUserId: targetUser?.id });
  };

  const handleOpenProfileMenu = () => {
    setProfileSubView('menu');
    pushRoute({ tab: 'profile', profileSubView: 'menu' });
  };

  const handleOpenProjects = () => {
    setProfileSubView('projects');
    pushRoute({ tab: 'profile', profileSubView: 'projects' });
  };

  const handleOpenExperience = () => {
    setProfileSubView('experience');
    pushRoute({ tab: 'profile', profileSubView: 'experience' });
  };

  const handleOpenEducation = () => {
    setProfileSubView('education');
    pushRoute({ tab: 'profile', profileSubView: 'education' });
  };

  const handleOpenCertifications = () => {
    setProfileSubView('certifications');
    pushRoute({ tab: 'profile', profileSubView: 'certifications' });
  };

  const handleOpenAchievements = () => {
    setProfileSubView('achievements');
    pushRoute({ tab: 'profile', profileSubView: 'achievements' });
  };

  const handleOpenSavedPosts = () => {
    setProfileSubView('saved-posts');
    pushRoute({ tab: 'profile', profileSubView: 'saved-posts' });
  };

  const handleBackFromSavedPosts = () => {
    setProfileSubView('menu');
    pushRoute({ tab: 'profile', profileSubView: 'menu' });
  };

  const handleBackFromProfileMenu = () => {
    setProfileSubView('view');
    pushRoute({ tab: 'profile', profileSubView: 'view', targetUserId: selectedProfileUser?.id });
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId !== 'home') {
      setTargetPostId(null);
    }
    if (tabId !== 'post-view') {
      setActivePostId(null);
      setPostViewReturnState(null);
    }
    if (tabId === 'domains') {
      setDomainSubView('list');
      pushRoute({ tab: 'domains', domainSubView: 'list' });
    } else if (tabId === 'messages') {
      setMessagesSubView('list');
      setSelectedConversation(null);
      pushRoute({ tab: 'messages', messagesSubView: 'list' });
    } else if (tabId === 'profile') {
      setSelectedProfileUser(null);
      setProfileSubView('view');
      pushRoute({ tab: 'profile', profileSubView: 'view' });
    } else if (tabId === 'notifications') {
      pushRoute({ tab: 'notifications' });
    } else if (tabId === 'search') {
      pushRoute({ tab: 'search' });
    } else if (tabId === 'settings') {
      pushRoute({ tab: 'settings' });
    } else if (tabId === 'saved') {
      setProfileSubView('saved-posts');
      pushRoute({ tab: 'saved' });
    } else if (tabId === 'create-post') {
      setProfileSubView('create-post');
      pushRoute({ tab: 'profile', profileSubView: 'create-post' });
    } else {
      pushRoute({ tab: 'home' });
    }
  };

  const handleSelectDomainShortcut = (domainId: string) => {
    setActiveDomainId(domainId);
    if (activeTab === 'domains') {
      setDomainSubView('domain');
      pushRoute({ tab: 'domains', domainSubView: 'domain', activeDomainId: domainId });
    }
  };

  const handleSelectDomainFromList = (domain: any) => {
    setActiveDomainId(domain.id);
    setDomainSubView('domain');
    pushRoute({ tab: 'domains', domainSubView: 'domain', activeDomainId: domain.id });
  };

  const handleSelectChannel = (channel: any) => {
    setSelectedChannel(channel);
    setDomainSubView('chat');
    pushRoute({ tab: 'domains', domainSubView: 'chat', activeDomainId, channelId: channel.id });
  };

  const handleSelectConversation = async (convOrUser: any) => {
    if (!convOrUser) {
      setSelectedConversation(null);
      setActiveTab('messages');
      setMessagesSubView('list');
      pushRoute({ tab: 'messages', messagesSubView: 'list' });
      return;
    }

    if (convOrUser.error) {
      toast.error(convOrUser.error);
      return;
    }

    if (isResolvingConversation) return;

    // Distinguish whether convOrUser is an existing conversation or a pure user profile
    const isConv =
      Boolean(convOrUser.otherUser) ||
      Boolean(convOrUser.targetUserId) ||
      Boolean(convOrUser.conversation_id) ||
      convOrUser.type === 'direct' ||
      convOrUser.type === 'group' ||
      convOrUser.lastMessage !== undefined ||
      convOrUser.isConversation === true;

    if (isConv && convOrUser.id) {
      if (user?.id && isUuid(convOrUser.id)) markConversationAsRead(convOrUser.id, user.id);
      setSelectedConversation(convOrUser);
      setActiveTab('messages');
      setMessagesSubView('detail');
      pushRoute({ tab: 'messages', messagesSubView: 'detail', conversationId: convOrUser.id });
      return;
    }

    const targetUserId = convOrUser.otherUser?.id || convOrUser.targetUserId || convOrUser.id;

    if (user?.id && targetUserId) {
      setIsResolvingConversation(true);
      try {
        const resolved = await getOrCreateDirectConversation(user.id, targetUserId, convOrUser.otherUser || convOrUser);
        setIsResolvingConversation(false);

        if (resolved && resolved.id && !resolved.error) {
          if (user?.id && isUuid(resolved.id)) markConversationAsRead(resolved.id, user.id);
          setSelectedConversation(resolved);
          setActiveTab('messages');
          setMessagesSubView('detail');
          pushRoute({ tab: 'messages', messagesSubView: 'detail', conversationId: resolved.id });
          return;
        } else if (resolved?.error) {
          console.error('[CHAT NAV DEBUG] conversation error:', resolved.error);
          toast.error(resolved.error);
        }
      } catch (err) {
        console.error('[CHAT NAV DEBUG] conversation exception:', err);
        setIsResolvingConversation(false);
        toast.error('Failed to open conversation. Please try again.');
      }
    }
  };

  const handleSelectChatMember = async (memberOrConv: any) => {
    await handleSelectConversation(memberOrConv);
  };

  const handleSelectProfileFromSearch = (user: any, origin: string | null = null) => {
    setSelectedProfileUser(user);
    setProfileOriginTab(origin || activeTab || 'search');
    setActiveTab('profile');
    setProfileSubView('view');
    pushRoute({ tab: 'profile', profileSubView: 'view', targetUserId: user?.id });
  };

  const handleOpenConversationFromProfile = async (conversation: any) => {
    await handleSelectConversation(conversation);
  };

  const handleOpenStoryViewer = (group: any, groups: any[]) => {
    setStoryViewerGroup(group);
    setStoryViewerGroups(groups);
    setActiveTab('update-story-viewer');
  };

  const handleCloseStoryViewer = () => {
    setStoryViewerGroup(null);
    setStoryViewerGroups([]);
    setActiveTab('home');
    pushRoute({ tab: 'home' });
  };

  const handleNotificationNavigate = (notif: any) => {
    if (!notif) return;
    if (notif.entity_type === 'user' || notif.type === 'follow_request' || notif.type === 'follow_accepted' || notif.type === 'view_profile') {
      const targetUser = notif.actor || users.find((u) => u.id === notif.actor_id || u.id === notif.entity_id) || { id: notif.actor_id, name: 'User' };
      setSelectedProfileUser(targetUser);
      setActiveTab('profile');
      setProfileSubView('view');
      pushRoute({ tab: 'profile', profileSubView: 'view', targetUserId: targetUser.id });
    } else if (notif.entity_type === 'conversation' || notif.type === 'message') {
      const conv = { id: notif.entity_id, name: notif.actor?.name || 'User', otherUser: notif.actor };
      setSelectedConversation(conv);
      setActiveTab('messages');
      setMessagesSubView('detail');
      pushRoute({ tab: 'messages', messagesSubView: 'detail', conversationId: conv.id });
    } else if (notif.entity_type === 'post') {
      handleNavigateToPostView(notif.entity_id, { activeTab: 'notifications' });
    }
  };

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Feed
            selectedFeedCategory={selectedFeedCategory}
            onSelectFeedCategory={setSelectedFeedCategory}
            selectedUpdateCategory={selectedUpdateCategory}
            onSelectUpdateCategory={setSelectedUpdateCategory}
            onOpenStoryViewer={handleOpenStoryViewer}
            targetPostId={targetPostId as any}
            onClearTargetPostId={() => setTargetPostId(null)}
            onNavigateToProfile={handleSelectProfileFromSearch}
            onOpenCreatePost={(initialType) => {
              setCreatePostInitialMediaType(initialType || 'none');
              setActiveTab('create-post');
              pushRoute({ tab: 'create-post' });
            }}
            onNavigateToPostView={handleNavigateToPostView}
            showComposer={false}
          />
        );

      case 'update-story-viewer':
        return (
          <UpdateStoryViewer
            initialGroup={storyViewerGroup}
            groups={storyViewerGroups}
            onClose={handleCloseStoryViewer}
          />
        );

      case 'domains':
        if (domainSubView === 'chat') {
          const currentChan = selectedChannel || (activeDomain?.channels && activeDomain.channels[0]) || { id: 'general', title: 'General' };
          return (
            <DomainChat
              domain={activeDomain}
              channel={currentChan}
              channelTitle={currentChan?.title || currentChan?.id || 'Channel'}
            />
          );
        }
        if (domainSubView === 'domain') {
          return (
            <Domain
              domain={activeDomain}
              onSelectChannel={handleSelectChannel}
            />
          );
        }
        return (
          <DomainList
            domains={userDomains}
            onSelectDomain={handleSelectDomainFromList}
          />
        );

      case 'messages':
        return (
          <MessagesPage
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onBackToList={() => {
              setSelectedConversation(null);
              setMessagesSubView('list');
              pushRoute({ tab: 'messages', messagesSubView: 'list' });
            }}
            initialConversationId={(selectedConversation as any)?.id}
            onNavigateToProfile={handleSelectProfileFromSearch}
            onNavigateToPostView={handleNavigateToPostView}
          />
        );

      case 'post-view':
        return (
          <PostView
            postId={activePostId}
            initialPost={activePostInitialData}
            onBack={handleBackFromPostView}
            onNavigateToProfile={handleSelectProfileFromSearch}
          />
        );

      case 'search':
        return (
          <Search
            onSelectDomain={(domain) => {
              setActiveDomainId(domain.id);
              setActiveTab('domains');
              setDomainSubView('domain');
              pushRoute({ tab: 'domains', domainSubView: 'domain', activeDomainId: domain.id });
            }}
            onSelectProfile={handleSelectProfileFromSearch}
            onNavigateToPostView={handleNavigateToPostView}
          />
        );

      case 'profile':
        if (profileSubView === 'create-post') {
          return (
            <CreatePost
              onBack={() => {
                setProfileSubView('view');
                pushRoute({ tab: 'profile', profileSubView: 'view', targetUserId: selectedProfileUser?.id });
              }}
              onPostCreated={() => {
                setProfileSubView('view');
                pushRoute({ tab: 'profile', profileSubView: 'view', targetUserId: selectedProfileUser?.id });
              }}
              initialDomain={selectedFeedCategory !== 'all' ? selectedFeedCategory : activeDomainId || 'tech'}
            />
          );
        }
        if (profileSubView === 'menu') {
          return (
            <ProfileMenu
              onBack={handleBackFromProfileMenu}
              onSelectProjects={handleOpenProjects}
              onSelectExperience={handleOpenExperience}
              onSelectEducation={handleOpenEducation}
              onSelectCertifications={handleOpenCertifications}
              onSelectAchievements={handleOpenAchievements}
              onSelectSavedPosts={handleOpenSavedPosts}
              onSelectProfileDetails={() => handleOpenProfileDetails(null, 'menu')}
              onLogout={logout}
            />
          );
        }
        if (profileSubView === 'projects') {
          return (
            <ProjectsPage
              onBack={() => {
                setProfileSubView('menu');
                pushRoute({ tab: 'profile', profileSubView: 'menu' });
              }}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'experience') {
          return (
            <ExperiencePage
              onBack={() => {
                setProfileSubView('menu');
                pushRoute({ tab: 'profile', profileSubView: 'menu' });
              }}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'education') {
          return (
            <EducationPage
              onBack={() => {
                setProfileSubView('menu');
                pushRoute({ tab: 'profile', profileSubView: 'menu' });
              }}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'certifications') {
          return (
            <CertificationsPage
              onBack={() => {
                setProfileSubView('menu');
                pushRoute({ tab: 'profile', profileSubView: 'menu' });
              }}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'achievements') {
          return (
            <AchievementsPage
              onBack={() => {
                setProfileSubView('menu');
                pushRoute({ tab: 'profile', profileSubView: 'menu' });
              }}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'item-updates' && activeUpdatesContext) {
          return (
            <ItemUpdatesPage
              itemType={activeUpdatesContext.itemType}
              itemId={activeUpdatesContext.itemId}
              item={activeUpdatesContext.item}
              onBack={() => {
                const prev = activeUpdatesContext?.previousSubView || 'menu';
                setProfileSubView(prev);
                pushRoute({ tab: 'profile', profileSubView: prev });
              }}
              onNavigateToPostView={handleNavigateToPostView}
            />
          );
        }
        if (profileSubView === 'saved-posts') {
          return (
            <SavedPosts
              onBack={handleBackFromSavedPosts}
              onExplorePosts={() => {
                setActiveTab('home');
                setProfileSubView('view');
                pushRoute({ tab: 'home' });
              }}
              onNavigateToPostView={handleNavigateToPostView}
              onNavigateToProfile={handleSelectProfileFromSearch}
            />
          );
        }
        if (profileSubView === 'details') {
          return (
            <ProfileDetails
              targetUser={activeProfileUser || user}
              onBack={() => {
                const prev = profileDetailsOrigin || 'view';
                setProfileSubView(prev);
                pushRoute({ tab: 'profile', profileSubView: prev, targetUserId: selectedProfileUser?.id });
              }}
              onViewAllUpdates={handleViewAllUpdates}
              onOpenConversation={handleOpenConversationFromProfile}
              onNavigateToProfile={(u) => handleSelectProfileFromSearch(u, profileOriginTab || 'search')}
            />
          );
        }
        return (
          <Profile
            targetUser={activeProfileUser}
            onBack={() => {
              setSelectedProfileUser(null);
              setActiveTab(profileOriginTab || 'search');
              pushRoute({ tab: profileOriginTab || 'search' });
            }}
            onOpenConversation={handleOpenConversationFromProfile}
            onOpenCreatePost={() => {
              setProfileSubView('create-post');
              pushRoute({ tab: 'profile', profileSubView: 'create-post' });
            }}
            onNavigateToProfile={(u) => handleSelectProfileFromSearch(u, profileOriginTab || 'search')}
            onOpenMenu={handleOpenProfileMenu}
            onOpenProfileDetails={handleOpenProfileDetails}
          />
        );

      case 'notifications':
        return (
          <Notifications
            onSelectNotification={handleNotificationNavigate}
          />
        );

      case 'settings':
        return (
          <Settings
            currentUser={user}
            currentProfile={user}
            onOpenEditProfile={() => {
              setActiveTab('profile');
              setProfileSubView('view');
              pushRoute({ tab: 'profile', profileSubView: 'view' });
            }}
            onNavigateTab={handleTabChange}
            showBottomNav={showBottomNav}
            onToggleBottomNav={() => {
              setShowBottomNav((prev) => {
                const next = !prev;
                try {
                  localStorage.setItem('sinc_show_bottom_nav', String(next));
                  window.dispatchEvent(new Event('sinc_nav_preferences_changed'));
                } catch (e) {}
                return next;
              });
            }}
            showVerticalRail={showVerticalRail}
            onToggleVerticalRail={() => {
              setShowVerticalRail((prev) => {
                const next = !prev;
                try {
                  localStorage.setItem('sinc_show_vertical_rail', String(next));
                  window.dispatchEvent(new Event('sinc_nav_preferences_changed'));
                } catch (e) {}
                return next;
              });
            }}
            isLeftSidebarOpen={isLeftSidebarOpen}
            onToggleLeftSidebar={handleToggleLeftSidebar}
          />
        );

      case 'saved':
        return (
          <SavedPosts
            onBack={() => {
              setActiveTab('home');
              pushRoute({ tab: 'home' });
            }}
            onExplorePosts={() => {
              setActiveTab('home');
              pushRoute({ tab: 'home' });
            }}
            onNavigateToPostView={handleNavigateToPostView}
            onNavigateToProfile={handleSelectProfileFromSearch}
          />
        );

      case 'create-post':
        return (
          <CreatePost
            onBack={() => {
              setActiveTab('home');
              pushRoute({ tab: 'home' });
            }}
            onPostCreated={() => {
              setActiveTab('home');
              pushRoute({ tab: 'home' });
            }}
            initialDomain={selectedFeedCategory !== 'all' ? selectedFeedCategory : activeDomainId || 'tech'}
            initialMediaType={createPostInitialMediaType || 'none'}
          />
        );

      default:
        return (
          <Feed
            selectedFeedCategory={selectedFeedCategory}
            onSelectFeedCategory={setSelectedFeedCategory}
            selectedUpdateCategory={selectedUpdateCategory}
            onSelectUpdateCategory={setSelectedUpdateCategory}
            onOpenStoryViewer={handleOpenStoryViewer}
            targetPostId={targetPostId as any}
            onClearTargetPostId={() => setTargetPostId(null)}
            onNavigateToProfile={handleSelectProfileFromSearch}
            onOpenCreatePost={(initialType) => {
              setCreatePostInitialMediaType(initialType || 'none');
              setActiveTab('create-post');
              pushRoute({ tab: 'create-post' });
            }}
            onNavigateToPostView={handleNavigateToPostView}
            showComposer={false}
          />
        );
    }
  };

  // Authoritative navigation visibility:
  // 1. If user disabled bottom nav in preferences, keep it hidden.
  // 2. If the main left sidebar is expanded (showing full labels), hide the floating bottom nav (mutually exclusive).
  // 3. If an active direct messaging conversation is open, hide the floating bottom nav (preserves existing messaging rule).
  const isDirectChatOpen = activeTab === 'messages' && Boolean(selectedConversation?.id);
  const shouldShowBottomNav = showBottomNav && !isLeftSidebarOpen && !isDirectChatOpen;

  return (
    <div className="sinc-app-shell">
      {/* Top Header Bar */}
      <TopHeader
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        currentUser={user}
        currentProfile={user}
        unreadNotificationsCount={unreadNotificationsCount}
        unreadMessagesCount={unreadMessagesCount}
        onSearchSubmit={(query) => {
          setActiveTab('search');
          pushRoute({ tab: 'search' });
        }}
        onOpenCreatePost={() => {
          setActiveTab('create-post');
          pushRoute({ tab: 'create-post' });
        }}
        onToggleSidebar={handleToggleLeftSidebar}
        isSidebarOpen={isLeftSidebarOpen}
        onLogout={logout}
      />

      {/* Main Persistent Layout: Full Left Menu + Floating Vertical Rail + Viewport + Floating Bottom Nav */}
      <div className="sinc-app-body-container">
        {/* 1. Full Left Menu with Visible Labels */}
        <SidebarNavigation
          activeTab={activeTab}
          onSelectTab={handleTabChange}
          unreadNotificationsCount={unreadNotificationsCount}
          unreadMessagesCount={unreadMessagesCount}
          currentUser={user}
          currentProfile={user}
          onOpenCreatePost={() => {
            setActiveTab('create-post');
            pushRoute({ tab: 'create-post' });
          }}
          onCloseMobile={() => setIsLeftSidebarOpen(false)}
          onToggleSidebar={handleToggleLeftSidebar}
          isMobileOpen={isLeftSidebarOpen}
          isOpen={isLeftSidebarOpen}
        />

        {/* 2. Floating Vertical Icon Sidebar */}
        {showVerticalRail && (
          <DomainShortcutRail
            activeTab={activeTab}
            onSelectTab={handleTabChange}
            selectedFeedCategory={selectedFeedCategory}
            onSelectFeedCategory={setSelectedFeedCategory}
            activeDomainId={activeDomainId}
            onSelectDomain={handleSelectDomainShortcut}
            feedCategories={FEED_CATEGORIES}
            domains={userDomains}
          />
        )}

        {/* 3. Main Content Viewport */}
        <main
          className={`sinc-main-viewport ${shouldShowBottomNav ? 'has-bottom-nav' : 'no-bottom-nav'} ${isDirectChatOpen ? 'direct-chat-open' : ''} ${isLeftSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
          id="sinc-main-content"
        >
          <div
            className="sinc-viewport-scroll-area"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: shouldShowBottomNav
                ? 'var(--bottom-nav-reserved-height, 78px)'
                : (isDirectChatOpen ? '0px' : '20px'),
              transition: 'padding-bottom 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <ErrorBoundary sectionName={activeTab}>
                {renderScreen()}
              </ErrorBoundary>
            </Suspense>
          </div>

          {/* 4. Floating Horizontal Bottom Navigation Bar */}
          {showBottomNav && (
            <BottomNav
              isVisible={shouldShowBottomNav}
              activeTab={
                activeTab === 'post-view'
                  ? postViewReturnState?.activeTab || 'messages'
                  : activeTab === 'update-story-viewer'
                  ? 'home'
                  : activeTab
              }
              onSelectTab={handleTabChange}
              hasUnreadMessages={hasUnreadMessages}
              unreadMessagesCount={unreadMessagesCount}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function AuthenticatedIntroWatcher() {
  const { isAuthenticated, loadingSession, authEvent, authEventType, consumeAuthEvent } = useAuth();
  return (
    <SincIntro
      signedIn={!loadingSession && isAuthenticated}
      authEvent={authEvent}
      authEventType={authEventType}
      consumeAuthEvent={consumeAuthEvent}
    />
  );
}

export default function App() {
  return <MainAppContent />;
}
