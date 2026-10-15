import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import DomainShortcutRail from './components/DomainShortcutRail';
import BottomNav from './components/BottomNav';

import Feed from './pages/Feed';
import DomainList from './pages/DomainList';
import Domain from './pages/Domain';
import DomainChat from './pages/DomainChat';
import MessagesList from './pages/MessagesList';
import MessageDetail from './pages/MessageDetail';
import PostView from './pages/PostView';
import Search from './pages/Search';
import Profile from './pages/Profile';
import ProfileDetails from './pages/ProfileDetails';
import ProfileMenu from './pages/ProfileMenu';
import SavedPosts from './pages/SavedPosts';
import ProjectsPage from './pages/ProjectsPage';
import ExperiencePage from './pages/ExperiencePage';
import EducationPage from './pages/EducationPage';
import CertificationsPage from './pages/CertificationsPage';
import AchievementsPage from './pages/AchievementsPage';
import ItemUpdatesPage from './pages/ItemUpdatesPage';
import CreatePost from './pages/CreatePost';
import Notifications from './pages/Notifications';
import UpdateStoryViewer from './pages/UpdateStoryViewer';

import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ProfileSetupWizard from './components/profile/ProfileSetupWizard';
import { updateBasicProfile } from './lib/profileService';

import { useConversations } from './messaging/hooks/useConversations';
import { getOrCreateDirectConversation, markConversationAsRead } from './messaging/services/conversationService';
import { domains, users, FEED_CATEGORIES } from './data/mockData';
import { parseRoute, pushRoute, replaceRoute } from './lib/routeUtils';

function isUuid(str) {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function MainAppContent() {
  const { user, isAuthenticated, authRoute, loadingSession, logout, updateProfile: updateAuthProfile } = useAuth();
  const currentUserId = isAuthenticated ? user?.id : null;
  const { conversations: rawConversations, hasUnreadMessages } = useConversations(currentUserId);
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
  const [activeDomainId, setActiveDomainId] = useState(initialRoute.activeDomainId || 'tech');

  // Domain sub-navigation state
  const [domainSubView, setDomainSubView] = useState(initialRoute.domainSubView || 'list'); // 'list' | 'domain' | 'chat'
  const [selectedChannel, setSelectedChannel] = useState(
    initialRoute.channelId ? { id: initialRoute.channelId, title: initialRoute.channelId } : null
  );

  // Messages sub-navigation state
  const [messagesSubView, setMessagesSubView] = useState(initialRoute.messagesSubView || 'list'); // 'list' | 'detail'
  const [selectedConversation, setSelectedConversation] = useState(
    initialRoute.conversationId ? { id: initialRoute.conversationId } : null
  );

  // Profile sub-navigation state
  const [selectedProfileUser, setSelectedProfileUser] = useState(
    initialRoute.targetUserId ? { id: initialRoute.targetUserId } : null
  );
  const [profileOriginTab, setProfileOriginTab] = useState('search');
  const [profileSubView, setProfileSubView] = useState(initialRoute.profileSubView || 'view');
  const [profileDetailsOrigin, setProfileDetailsOrigin] = useState('view');
  const [activeUpdatesContext, setActiveUpdatesContext] = useState(null);

  // Home Feed category state
  const [selectedFeedCategory, setSelectedFeedCategory] = useState('all');
  const [selectedUpdateCategory, setSelectedUpdateCategory] = useState('all');
  const [storyViewerGroup, setStoryViewerGroup] = useState(null);
  const [storyViewerGroups, setStoryViewerGroups] = useState([]);
  const [isResolvingConversation, setIsResolvingConversation] = useState(false);
  const [targetPostId, setTargetPostId] = useState(null);

  // Dedicated Post View navigation state
  const [activePostId, setActivePostId] = useState(initialRoute.activePostId || null);
  const [postViewReturnState, setPostViewReturnState] = useState(null);

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
      const filtered = domains.filter((d) => domainIds.includes(d.id));
      if (filtered.length > 0) return filtered;
    }
    return domains.slice(0, 5);
  }, [user?.domains, user?.id]);

  const activeDomain = userDomains.find((d) => d.id === activeDomainId) || userDomains[0] || domains[0];

  // Resolve active conversation by merging with fetched list if available
  const activeConversation = React.useMemo(() => {
    if (!selectedConversation) return null;
    const found = conversations.find((c) => c.id === selectedConversation.id);
    return found ? { ...selectedConversation, ...found } : selectedConversation;
  }, [conversations, selectedConversation]);

  // Resolve active profile user by merging with mock data if available
  const activeProfileUser = React.useMemo(() => {
    if (!selectedProfileUser) return null;
    const found = users.find((u) => u.id === selectedProfileUser.id);
    return found ? { ...selectedProfileUser, ...found } : selectedProfileUser;
  }, [selectedProfileUser]);

  const handleViewAllUpdates = (itemType, item) => {
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
          setSelectedConversation((prev) => (prev?.id === parsed.conversationId ? prev : { id: parsed.conversationId }));
        } else {
          setSelectedConversation(null);
        }
      } else if (parsed.tab === 'domains') {
        setDomainSubView(parsed.domainSubView || 'list');
        if (parsed.activeDomainId) {
          setActiveDomainId(parsed.activeDomainId);
        }
        if (parsed.channelId) {
          setSelectedChannel((prev) => (prev?.id === parsed.channelId ? prev : { id: parsed.channelId, title: parsed.channelId }));
        } else {
          setSelectedChannel(null);
        }
      } else if (parsed.tab === 'profile') {
        setProfileSubView(parsed.profileSubView || 'view');
        if (parsed.targetUserId) {
          setSelectedProfileUser((prev) => (prev?.id === parsed.targetUserId ? prev : { id: parsed.targetUserId }));
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

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: '500', fontSize: '14px' }}>
        Loading platform...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        {authRoute === 'signup' && <SignUp />}
        {authRoute === 'forgot-password' && <ForgotPassword />}
        {authRoute === 'login' && <Login />}
      </div>
    );
  }

  // Resume profile setup wizard for new users with incomplete setup
  if (isOnboardingActive) {
    return (
      <div className="app-shell">
        <Header
          showSearchIcon={false}
          onSearchClick={() => {}}
          onNotificationClick={() => {}}
          isNotificationActive={false}
        />
        <div className="app-body" style={{ justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div className="main-content" style={{ maxWidth: '720px', margin: '0 auto', width: '100%' }}>
            <ProfileSetupWizard
              profileUser={user}
              initialStep={user?.firstIncompleteStep || 1}
              onSave={async (updates) => {
                await updateBasicProfile(user.id, updates);
                if (updateAuthProfile) {
                  updateAuthProfile({ ...updates, onboarding_completed: true, isNewUser: false });
                }
                setIsOnboardingActive(false);
                setActiveTab('home');
                pushRoute({ tab: 'home' });
              }}
              onCancel={() => {
                setIsOnboardingActive(false);
                setActiveTab('home');
                pushRoute({ tab: 'home' });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const handleNavigateToPost = (postId) => {
    if (!postId) return;
    setTargetPostId(postId);
    setActiveTab('home');
    pushRoute({ tab: 'home' });
  };

  const handleNavigateToPostView = (postId, returnContext = null) => {
    if (!postId) return;
    const ctx = returnContext || {
      activeTab,
      messagesSubView,
      selectedConversation,
      profileSubView
    };
    setPostViewReturnState(ctx);
    setActivePostId(postId);
    setActiveTab('post-view');

    pushRoute({ tab: 'post-view', activePostId: postId });
  };

  const handleBackFromPostView = () => {
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

  const handleOpenProfileDetails = (targetUser = null, origin = null) => {
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

  const handleTabChange = (tabId) => {
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
    } else {
      pushRoute({ tab: 'home' });
    }
  };

  const handleSelectDomainShortcut = (domainId) => {
    setActiveDomainId(domainId);
    if (activeTab === 'domains') {
      setDomainSubView('domain');
      pushRoute({ tab: 'domains', domainSubView: 'domain', activeDomainId: domainId });
    }
  };

  const handleSelectDomainFromList = (domain) => {
    setActiveDomainId(domain.id);
    setDomainSubView('domain');
    pushRoute({ tab: 'domains', domainSubView: 'domain', activeDomainId: domain.id });
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setDomainSubView('chat');
    pushRoute({ tab: 'domains', domainSubView: 'chat', activeDomainId, channelId: channel.id });
  };

  const handleSelectConversation = async (convOrUser) => {
    if (!convOrUser) {
      setSelectedConversation(null);
      setActiveTab('messages');
      setMessagesSubView('list');
      pushRoute({ tab: 'messages', messagesSubView: 'list' });
      return;
    }

    if (isResolvingConversation) return;

    if (convOrUser.id && isUuid(convOrUser.id)) {
      if (user?.id) markConversationAsRead(convOrUser.id, user.id);
      setSelectedConversation(convOrUser);
      setActiveTab('messages');
      setMessagesSubView('detail');
      pushRoute({ tab: 'messages', messagesSubView: 'detail', conversationId: convOrUser.id });
      return;
    }

    const targetUserId = convOrUser.otherUser?.id || convOrUser.targetUserId || convOrUser.id;

    if (user?.id && targetUserId && isUuid(user.id) && isUuid(targetUserId)) {
      setIsResolvingConversation(true);
      try {
        const resolved = await getOrCreateDirectConversation(user.id, targetUserId, convOrUser.otherUser || convOrUser);
        setIsResolvingConversation(false);

        if (resolved && resolved.id && !resolved.error) {
          if (user?.id) markConversationAsRead(resolved.id, user.id);
          setSelectedConversation(resolved);
          setActiveTab('messages');
          setMessagesSubView('detail');
          pushRoute({ tab: 'messages', messagesSubView: 'detail', conversationId: resolved.id });
          return;
        } else if (resolved?.error) {
          console.error('[CHAT NAV DEBUG] conversation error:', resolved.error);
        }
      } catch (err) {
        console.error('[CHAT NAV DEBUG] conversation exception:', err);
        setIsResolvingConversation(false);
      }
    }
  };

  const handleSelectChatMember = async (memberOrConv) => {
    await handleSelectConversation(memberOrConv);
  };

  const handleSelectProfileFromSearch = (user, origin = null) => {
    setSelectedProfileUser(user);
    setProfileOriginTab(origin || activeTab || 'search');
    setActiveTab('profile');
    setProfileSubView('view');
    pushRoute({ tab: 'profile', profileSubView: 'view', targetUserId: user?.id });
  };

  const handleOpenConversationFromProfile = async (conversation) => {
    await handleSelectConversation(conversation);
  };

  const handleOpenStoryViewer = (group, groups) => {
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

  const handleNotificationNavigate = (notif) => {
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
            selectedUpdateCategory={selectedUpdateCategory}
            onSelectUpdateCategory={setSelectedUpdateCategory}
            onOpenStoryViewer={handleOpenStoryViewer}
            targetPostId={targetPostId}
            onClearTargetPostId={() => setTargetPostId(null)}
            onNavigateToProfile={handleSelectProfileFromSearch}
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
          const currentChan = selectedChannel || activeDomain.channels[0];
          return (
            <DomainChat
              domain={activeDomain}
              channel={currentChan}
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
        if (messagesSubView === 'detail') {
          return (
            <MessageDetail
              conversation={activeConversation}
              onBack={() => {
                setMessagesSubView('list');
                setSelectedConversation(null);
                pushRoute({ tab: 'messages', messagesSubView: 'list' });
              }}
              onNavigateToPostView={handleNavigateToPostView}
            />
          );
        }
        return <MessagesList onSelectConversation={handleSelectConversation} />;

      case 'post-view':
        return (
          <PostView
            postId={activePostId}
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

      default:
        return (
          <Feed
            selectedFeedCategory={selectedFeedCategory}
            onNavigateToProfile={handleSelectProfileFromSearch}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      {/* Top Header Bar */}
      <Header
        showSearchIcon={activeTab !== 'home'}
        onSearchClick={() => handleTabChange('search')}
        onNotificationClick={() => handleTabChange('notifications')}
        isNotificationActive={activeTab === 'notifications'}
      />

      {/* Main Body with Reusable Domain Action Rail + Page View */}
      <div className="app-body">
        {activeTab !== 'search' && activeTab !== 'profile' && activeTab !== 'update-story-viewer' && (
          <DomainShortcutRail
            railMode={activeTab === 'home' ? 'feed' : 'domain'}
            feedCategories={FEED_CATEGORIES}
            selectedFeedCategory={selectedFeedCategory}
            onSelectFeedCategory={setSelectedFeedCategory}
            domains={userDomains}
            activeDomainId={activeDomainId}
            onSelectDomain={handleSelectDomainShortcut}
            isMessagesMode={activeTab === 'messages' || (activeTab === 'post-view' && postViewReturnState?.activeTab === 'messages')}
            conversations={conversations}
            selectedConversationId={selectedConversation?.id || postViewReturnState?.conversationId || postViewReturnState?.conversation?.id}
            onSelectChatMember={handleSelectChatMember}
          />
        )}
        {renderScreen()}
      </div>

      {/* Bottom Floating Navigation Bar */}
      <BottomNav
        activeTab={activeTab === 'post-view' ? (postViewReturnState?.activeTab || 'messages') : (activeTab === 'update-story-viewer' ? 'home' : activeTab)}
        onSelectTab={handleTabChange}
        hasUnreadMessages={hasUnreadMessages}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
