/**
 * Route Utilities for SINC Platform
 * Synchronizes application navigation states with window.location and browser history.
 * Ensures page refreshes and direct URLs preserve the correct page instead of resetting to dashboard.
 */

export interface ParsedRoute {
  tab: string;
  url: string;
  search: string;
  activePostId?: string | null;
  messagesSubView?: 'list' | 'detail';
  conversationId?: string | null;
  domainSubView?: 'list' | 'domain' | 'chat';
  activeDomainId?: string;
  channelId?: string | null;
  profileSubView?: string;
  targetUserId?: string | null;
  authRoute?: string;
}

export function parseRoute(
  pathname: string = (typeof window !== 'undefined' ? window.location.pathname : '/'),
  hash: string = (typeof window !== 'undefined' ? window.location.hash : ''),
  search: string = (typeof window !== 'undefined' ? window.location.search : '')
): ParsedRoute {
  const path = (pathname || '/').trim();
  const lowerPath = path.toLowerCase();
  const searchStr = search || '';
  const cleanHash = (hash || '').replace(/^#/, '').toLowerCase().trim();

  // 1. Post view via hash (#post-<uuid>) or pathname (/post/<id>)
  if (hash && hash.startsWith('#post-')) {
    const postId = hash.replace('#post-', '');
    return { tab: 'post-view', activePostId: postId, url: path + hash, search: searchStr };
  }
  if (lowerPath.startsWith('/post/')) {
    const postId = path.replace(/^\/post\//i, '').split('/')[0];
    return { tab: 'post-view', activePostId: postId, url: path, search: searchStr };
  }

  // 1.1 Hash-based tab shortcuts for legacy links
  if (cleanHash === 'search') return { tab: 'search', url: '/search', search: searchStr };
  if (cleanHash === 'domains') return { tab: 'domains', domainSubView: 'list', url: '/domains', search: searchStr };
  if (cleanHash === 'messages') return { tab: 'messages', messagesSubView: 'list', url: '/messages', search: searchStr };
  if (cleanHash === 'profile') return { tab: 'profile', profileSubView: 'view', url: '/profile', search: searchStr };
  if (cleanHash === 'settings') return { tab: 'settings', url: '/settings', search: searchStr };
  if (cleanHash === 'saved') return { tab: 'saved', url: '/saved', search: searchStr };
  if (cleanHash === 'notifications') return { tab: 'notifications', url: '/notifications', search: searchStr };

  // 2. Notifications
  if (lowerPath === '/notifications' || lowerPath.startsWith('/notifications/')) {
    return { tab: 'notifications', url: '/notifications', search: searchStr };
  }

  // 2.1 Settings
  if (lowerPath === '/settings' || lowerPath.startsWith('/settings/')) {
    return { tab: 'settings', url: '/settings', search: searchStr };
  }

  // 2.2 Saved
  if (lowerPath === '/saved' || lowerPath.startsWith('/saved/')) {
    return { tab: 'saved', url: '/saved', search: searchStr };
  }

  // 3. Search
  if (lowerPath === '/search' || lowerPath.startsWith('/search/')) {
    return { tab: 'search', url: '/search', search: searchStr };
  }

  // 4. Messages & Conversation details
  if (lowerPath === '/messages' || lowerPath.startsWith('/messages/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 1 && parts[1]) {
      return {
        tab: 'messages',
        messagesSubView: 'detail',
        conversationId: parts[1],
        url: path,
        search: searchStr
      };
    }
    return { tab: 'messages', messagesSubView: 'list', url: '/messages', search: searchStr };
  }

  // 5. Domains & Channels
  if (lowerPath === '/domains' || lowerPath.startsWith('/domains/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 4 && parts[2]?.toLowerCase() === 'chat' && parts[3]) {
      return {
        tab: 'domains',
        domainSubView: 'chat',
        activeDomainId: parts[1],
        channelId: parts[3],
        url: path,
        search: searchStr
      };
    }
    if (parts.length >= 2 && parts[1]) {
      return {
        tab: 'domains',
        domainSubView: 'domain',
        activeDomainId: parts[1],
        url: path,
        search: searchStr
      };
    }
    return { tab: 'domains', domainSubView: 'list', url: '/domains', search: searchStr };
  }

  // 6. Profile & Sub-views
  if (lowerPath === '/profile' || lowerPath.startsWith('/profile/')) {
    const parts = path.split('/').filter(Boolean);
    const sub = parts[1]?.toLowerCase();

    if (sub === 'menu') {
      return { tab: 'profile', profileSubView: 'menu', url: '/profile/menu', search: searchStr };
    }
    if (sub === 'projects') {
      return { tab: 'profile', profileSubView: 'projects', url: '/profile/projects', search: searchStr };
    }
    if (sub === 'experience') {
      return { tab: 'profile', profileSubView: 'experience', url: '/profile/experience', search: searchStr };
    }
    if (sub === 'education') {
      return { tab: 'profile', profileSubView: 'education', url: '/profile/education', search: searchStr };
    }
    if (sub === 'certifications') {
      return { tab: 'profile', profileSubView: 'certifications', url: '/profile/certifications', search: searchStr };
    }
    if (sub === 'achievements') {
      return { tab: 'profile', profileSubView: 'achievements', url: '/profile/achievements', search: searchStr };
    }
    if (sub === 'saved-posts') {
      return { tab: 'profile', profileSubView: 'saved-posts', url: '/profile/saved-posts', search: searchStr };
    }
    if (sub === 'create-post') {
      return { tab: 'profile', profileSubView: 'create-post', url: '/profile/create-post', search: searchStr };
    }
    if (sub === 'details') {
      return { tab: 'profile', profileSubView: 'details', url: '/profile/details', search: searchStr };
    }
    if (sub === 'item-updates') {
      return { tab: 'profile', profileSubView: 'item-updates', url: '/profile/item-updates', search: searchStr };
    }
    if (sub) {
      return {
        tab: 'profile',
        profileSubView: 'view',
        targetUserId: parts[1],
        url: path,
        search: searchStr
      };
    }
    return { tab: 'profile', profileSubView: 'view', targetUserId: null, url: '/profile', search: searchStr };
  }

  // 7. Auth routes (when unauthenticated)
  if (lowerPath === '/signup') {
    return { authRoute: 'signup', tab: 'home', url: '/signup', search: searchStr };
  }
  if (lowerPath === '/forgot-password') {
    return { authRoute: 'forgot-password', tab: 'home', url: '/forgot-password', search: searchStr };
  }
  if (lowerPath === '/login') {
    return { authRoute: 'login', tab: 'home', url: '/login', search: searchStr };
  }

  // 8. Default fallback: Dashboard / Home Feed
  return { tab: 'home', url: '/', search: searchStr };
}

export function getRouteUrl(state: Partial<ParsedRoute>): string {
  if (!state) return '/';
  let path = '/';
  if (state.tab === 'post-view' && state.activePostId) {
    path = `/post/${state.activePostId}`;
  } else if (state.tab === 'notifications') {
    path = '/notifications';
  } else if (state.tab === 'settings') {
    path = '/settings';
  } else if (state.tab === 'saved') {
    path = '/saved';
  } else if (state.tab === 'search') {
    path = '/search';
  } else if (state.tab === 'messages') {
    if (state.messagesSubView === 'detail' && state.conversationId) {
      path = `/messages/${state.conversationId}`;
    } else {
      path = '/messages';
    }
  } else if (state.tab === 'domains') {
    if (state.domainSubView === 'chat' && state.activeDomainId && state.channelId) {
      path = `/domains/${state.activeDomainId}/chat/${state.channelId}`;
    } else if (state.domainSubView === 'domain' && state.activeDomainId) {
      path = `/domains/${state.activeDomainId}`;
    } else {
      path = '/domains';
    }
  } else if (state.tab === 'profile') {
    if (state.profileSubView === 'menu') path = '/profile/menu';
    else if (state.profileSubView === 'projects') path = '/profile/projects';
    else if (state.profileSubView === 'experience') path = '/profile/experience';
    else if (state.profileSubView === 'education') path = '/profile/education';
    else if (state.profileSubView === 'certifications') path = '/profile/certifications';
    else if (state.profileSubView === 'achievements') path = '/profile/achievements';
    else if (state.profileSubView === 'saved-posts') path = '/profile/saved-posts';
    else if (state.profileSubView === 'create-post') path = '/profile/create-post';
    else if (state.profileSubView === 'details') path = '/profile/details';
    else if (state.profileSubView === 'item-updates') path = '/profile/item-updates';
    else if (state.targetUserId) path = `/profile/${state.targetUserId}`;
    else path = '/profile';
  } else if (state.authRoute) {
    path = `/${state.authRoute}`;
  }

  if (state.search) {
    return path + (state.search.startsWith('?') ? state.search : `?${state.search}`);
  }
  return path;
}

export function pushRoute(state: Partial<ParsedRoute>, search: string = ''): void {
  const finalState = search ? { ...state, search } : state;
  const url = getRouteUrl(finalState);
  if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== url) {
    window.history.pushState(finalState, '', url);
  }
}

export function replaceRoute(state: Partial<ParsedRoute>, search: string = ''): void {
  const finalState = search ? { ...state, search } : state;
  const url = getRouteUrl(finalState);
  if (typeof window !== 'undefined') {
    window.history.replaceState(finalState, '', url);
  }
}
