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

import { useConversations } from './messaging/hooks/useConversations';
import { getOrCreateDirectConversation, markConversationAsRead } from './messaging/services/conversationService';
import { domains, users, FEED_CATEGORIES } from './data/mockData';

function isUuid(str) {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function MainAppContent() {
  const { user, isAuthenticated, authRoute, loadingSession } = useAuth();
  const currentUserId = isAuthenticated ? user?.id : null;
  const { conversations: rawConversations, hasUnreadMessages } = useConversations(currentUserId);
  const conversations = rawConversations || [];

  const [activeTab, setActiveTab] = useState('home');
  const [activeDomainId, setActiveDomainId] = useState('tech');

  // Domain sub-navigation state
  const [domainSubView, setDomainSubView] = useState('list'); // 'list' | 'domain' | 'chat'
  const [selectedChannel, setSelectedChannel] = useState(null);

  // Messages sub-navigation state
  const [messagesSubView, setMessagesSubView] = useState('list'); // 'list' | 'detail'
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Profile sub-navigation state
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [profileOriginTab, setProfileOriginTab] = useState('search');
  const [profileSubView, setProfileSubView] = useState('view'); // 'view' | 'create-post' | 'item-updates'
  const [profileDetailsOrigin, setProfileDetailsOrigin] = useState('view'); // tracks where 'details' was opened from
  const [activeUpdatesContext, setActiveUpdatesContext] = useState(null); // { itemType, itemId, item, previousSubView }

  // Home Feed category state — INDEPENDENT from domain state.
  // Controls which category is shown in the Home feed rail.
  // Never affects user domain memberships or DomainChat.
  const [selectedFeedCategory, setSelectedFeedCategory] = useState('all');
  const [selectedUpdateCategory, setSelectedUpdateCategory] = useState('all');
  const [storyViewerGroup, setStoryViewerGroup] = useState(null);
  const [storyViewerGroups, setStoryViewerGroups] = useState([]);
  const [isResolvingConversation, setIsResolvingConversation] = useState(false);
  const [targetPostId, setTargetPostId] = useState(null);

  // Dedicated Post View navigation state
  const [activePostId, setActivePostId] = useState(null);
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

  const handleViewAllUpdates = (itemType, item) => {
    setActiveUpdatesContext({
      itemType,
      itemId: item.id,
      item,
      previousSubView: profileSubView
    });
    setProfileSubView('item-updates');
    window.history.pushState({ type: 'profile-item-updates' }, '');
  };

  // Browser history popstate handler
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.hash.startsWith('#post-')) {
        const hashId = window.location.hash.replace('#post-', '');
        if (isUuid(hashId)) {
          setActivePostId(hashId);
          setActiveTab('post-view');
          return;
        }
      }

      if (activeTab === 'post-view') {
        if (postViewReturnState) {
          const { activeTab: prevTab, messagesSubView: prevSubView, conversation, selectedConversation: prevConv, profileSubView: prevProfileSubView } = postViewReturnState;
          const targetConv = conversation || prevConv;

          setActiveTab(prevTab || 'messages');
          if (prevTab === 'messages') {
            setMessagesSubView(prevSubView || 'detail');
            if (targetConv) {
              setSelectedConversation(targetConv);
            }
          } else if (prevTab === 'profile') {
            setProfileSubView(prevProfileSubView || 'view');
          }
          setActivePostId(null);
          setPostViewReturnState(null);
        } else {
          setActiveTab('messages');
          setMessagesSubView('list');
          setActivePostId(null);
        }
      } else if (activeTab === 'update-story-viewer') {
        setStoryViewerGroup(null);
        setStoryViewerGroups([]);
        setActiveTab('home');
      } else if (activeTab === 'profile') {
        if (profileSubView === 'item-updates') {
          setProfileSubView(activeUpdatesContext?.previousSubView || 'menu');
        } else if (profileSubView === 'details') {
          setProfileSubView(profileDetailsOrigin || 'view');
        } else if (['projects', 'experience', 'education', 'certifications', 'achievements', 'saved-posts'].includes(profileSubView)) {
          setProfileSubView('menu');
        } else if (profileSubView === 'menu') {
          setProfileSubView('view');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, postViewReturnState, profileSubView, activeUpdatesContext, profileDetailsOrigin]);

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

  const handleNavigateToPost = (postId) => {
    if (!postId) return;
    setTargetPostId(postId);
    setActiveTab('home');
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

    // Push state so browser Back button works naturally
    window.history.pushState(
      {
        type: 'post-view',
        postId,
        returnContext: ctx
      },
      '',
      '#post-' + postId
    );
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
        }
      } else if (prevTab === 'profile') {
        setProfileSubView(prevProfileSubView || 'view');
      }
      setActivePostId(null);
      setPostViewReturnState(null);

      if (window.location.hash.startsWith('#post-')) {
        window.history.pushState(null, '', window.location.pathname);
      }
    } else {
      setActiveTab('messages');
      setMessagesSubView('list');
      setActivePostId(null);
      if (window.location.hash.startsWith('#post-')) {
        window.history.pushState(null, '', window.location.pathname);
      }
    }
  };

  const handleOpenProfileDetails = (targetUser = null, origin = null) => {
    if (targetUser) {
      setSelectedProfileUser(targetUser);
    }
    // Track origin so Back button returns to the correct subview
    const detailsOrigin = origin || profileSubView || 'view';
    setProfileDetailsOrigin(detailsOrigin);
    setProfileSubView('details');
    window.history.pushState({ type: 'profile-details', userId: targetUser?.id || currentUserId }, '');
  };

  const handleOpenProfileMenu = () => {
    setProfileSubView('menu');
    window.history.pushState({ type: 'profile-menu' }, '');
  };

  const handleOpenProjects = () => {
    setProfileSubView('projects');
    window.history.pushState({ type: 'profile-projects' }, '');
  };

  const handleOpenExperience = () => {
    setProfileSubView('experience');
    window.history.pushState({ type: 'profile-experience' }, '');
  };

  const handleOpenEducation = () => {
    setProfileSubView('education');
    window.history.pushState({ type: 'profile-education' }, '');
  };

  const handleOpenCertifications = () => {
    setProfileSubView('certifications');
    window.history.pushState({ type: 'profile-certifications' }, '');
  };

  const handleOpenAchievements = () => {
    setProfileSubView('achievements');
    window.history.pushState({ type: 'profile-achievements' }, '');
  };

  const handleOpenSavedPosts = () => {
    setProfileSubView('saved-posts');
    window.history.pushState({ type: 'saved-posts' }, '');
  };

  const handleBackFromSavedPosts = () => {
    setProfileSubView('menu');
  };

  const handleBackFromProfileMenu = () => {
    setProfileSubView('view');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== 'home') {
      setTargetPostId(null);
    }
    if (tabId !== 'post-view') {
      setActivePostId(null);
      setPostViewReturnState(null);
      if (window.location.hash.startsWith('#post-')) {
        window.history.pushState(null, '', window.location.pathname);
      }
    }
    if (tabId === 'domains') {
      setDomainSubView('list');
    } else if (tabId === 'messages') {
      setMessagesSubView('list');
    } else if (tabId === 'profile') {
      setSelectedProfileUser(null);
      setProfileSubView('view');
    }
  };

  const handleSelectDomainShortcut = (domainId) => {
    setActiveDomainId(domainId);
    if (activeTab === 'domains') {
      setDomainSubView('domain');
    }
  };

  const handleSelectDomainFromList = (domain) => {
    setActiveDomainId(domain.id);
    setDomainSubView('domain');
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setDomainSubView('chat');
  };

  const handleSelectConversation = async (convOrUser) => {
    if (!convOrUser) {
      setSelectedConversation(null);
      setActiveTab('messages');
      setMessagesSubView('list');
      return;
    }

    if (isResolvingConversation) return;

    console.log('[CHAT NAV DEBUG] clicked user:', convOrUser);
    console.log('[CHAT NAV DEBUG] current user:', user?.id);

    if (convOrUser.id && isUuid(convOrUser.id)) {
      if (user?.id) markConversationAsRead(convOrUser.id, user.id);
      setSelectedConversation(convOrUser);
      setActiveTab('messages');
      setMessagesSubView('detail');
      console.log('[CHAT NAV DEBUG] navigation target:', convOrUser.id);
      return;
    }

    const targetUserId = convOrUser.otherUser?.id || convOrUser.targetUserId || convOrUser.id;
    console.log('[CHAT NAV DEBUG] resolving target user id:', targetUserId);

    if (user?.id && targetUserId && isUuid(user.id) && isUuid(targetUserId)) {
      setIsResolvingConversation(true);
      try {
        const resolved = await getOrCreateDirectConversation(user.id, targetUserId, convOrUser.otherUser || convOrUser);
        console.log('[CHAT NAV DEBUG] resolved conversation:', resolved);
        setIsResolvingConversation(false);

        if (resolved && resolved.id && !resolved.error) {
          if (user?.id) markConversationAsRead(resolved.id, user.id);
          setSelectedConversation(resolved);
          setActiveTab('messages');
          setMessagesSubView('detail');
          console.log('[CHAT NAV DEBUG] navigation target:', resolved.id);
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
  };

  const handleOpenConversationFromProfile = async (conversation) => {
    await handleSelectConversation(conversation);
  };

  const handleOpenStoryViewer = (group, groups) => {
    setStoryViewerGroup(group);
    setStoryViewerGroups(groups);
    setActiveTab('update-story-viewer');
    window.history.pushState({ type: 'update-story-viewer' }, '');
  };

  const handleCloseStoryViewer = () => {
    if (window.history.state?.type === 'update-story-viewer') {
      window.history.back();
      return;
    }
    setStoryViewerGroup(null);
    setStoryViewerGroups([]);
    setActiveTab('home');
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
              conversation={selectedConversation}
              onBack={() => setMessagesSubView('list')}
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
            }}
            onSelectProfile={handleSelectProfileFromSearch}
          />
        );

      case 'profile':
        if (profileSubView === 'create-post') {
          return (
            <CreatePost
              onBack={() => setProfileSubView('view')}
              onPostCreated={() => setProfileSubView('view')}
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
            />
          );
        }
        if (profileSubView === 'projects') {
          return (
            <ProjectsPage
              onBack={() => setProfileSubView('menu')}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'experience') {
          return (
            <ExperiencePage
              onBack={() => setProfileSubView('menu')}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'education') {
          return (
            <EducationPage
              onBack={() => setProfileSubView('menu')}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'certifications') {
          return (
            <CertificationsPage
              onBack={() => setProfileSubView('menu')}
              onViewAllUpdates={handleViewAllUpdates}
            />
          );
        }
        if (profileSubView === 'achievements') {
          return (
            <AchievementsPage
              onBack={() => setProfileSubView('menu')}
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
              onBack={() => setProfileSubView(activeUpdatesContext.previousSubView || 'menu')}
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
              }}
              onNavigateToPostView={handleNavigateToPostView}
              onNavigateToProfile={handleSelectProfileFromSearch}
            />
          );
        }
        if (profileSubView === 'details') {
          return (
            <ProfileDetails
              targetUser={selectedProfileUser || user}
              onBack={() => setProfileSubView(profileDetailsOrigin || 'view')}
              onViewAllUpdates={handleViewAllUpdates}
              onOpenConversation={handleOpenConversationFromProfile}
              onNavigateToProfile={(u) => handleSelectProfileFromSearch(u, profileOriginTab || 'search')}
            />
          );
        }
        return (
          <Profile
            targetUser={selectedProfileUser}
            onBack={() => {
              setSelectedProfileUser(null);
              setActiveTab(profileOriginTab || 'search');
            }}
            onOpenConversation={handleOpenConversationFromProfile}
            onOpenCreatePost={() => setProfileSubView('create-post')}
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

  const handleNotificationNavigate = (notif) => {
    if (!notif) return;
    if (notif.entity_type === 'user' || notif.type === 'follow_request' || notif.type === 'follow_accepted' || notif.type === 'view_profile') {
      const targetUser = notif.actor || users.find((u) => u.id === notif.actor_id || u.id === notif.entity_id) || { id: notif.actor_id, name: 'User' };
      setSelectedProfileUser(targetUser);
      setActiveTab('profile');
    } else if (notif.entity_type === 'conversation' || notif.type === 'message') {
      const conv = { id: notif.entity_id, name: notif.actor?.name || 'User', otherUser: notif.actor };
      setSelectedConversation(conv);
      setActiveTab('messages');
      setMessagesSubView('detail');
    } else if (notif.entity_type === 'post') {
      handleNavigateToPostView(notif.entity_id, { activeTab: 'notifications' });
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
            // Context-aware rail mode:
            // 'feed'   → Home screen: category filter only, never touches domain state
            // 'domain' → All other screens: existing domain navigation behaviour
            railMode={activeTab === 'home' ? 'feed' : 'domain'}

            // Feed mode props (Home only)
            feedCategories={FEED_CATEGORIES}
            selectedFeedCategory={selectedFeedCategory}
            onSelectFeedCategory={setSelectedFeedCategory}

            // Domain mode props (Domains and other tabs)
            domains={userDomains}
            activeDomainId={activeDomainId}
            onSelectDomain={handleSelectDomainShortcut}

            // Messages mode props (unchanged)
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
