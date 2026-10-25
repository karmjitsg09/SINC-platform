import { create } from 'zustand';

export interface NavigationState {
  activeTab: string;
  sidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  activeDomainId: string;
  domainSubView: 'list' | 'domain' | 'chat';
  selectedChannelId: string | null;
  messagesSubView: 'list' | 'detail';
  selectedConversationId: string | null;
  profileSubView: string;
  selectedTargetUserId: string | null;
  activePostId: string | null;

  // Actions
  setActiveTab: (tab: string) => void;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  setIsMobileSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setDomainNavigation: (subView: 'list' | 'domain' | 'chat', domainId?: string, channelId?: string | null) => void;
  setMessagesNavigation: (subView: 'list' | 'detail', conversationId?: string | null) => void;
  setProfileNavigation: (subView: string, targetUserId?: string | null) => void;
  setActivePostId: (postId: string | null) => void;
  resetNavigation: () => void;
  reset: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeTab: 'home',
  sidebarCollapsed: false,
  isMobileSidebarOpen: false,
  activeDomainId: 'tech',
  domainSubView: 'list',
  selectedChannelId: null,
  messagesSubView: 'list',
  selectedConversationId: null,
  profileSubView: 'view',
  selectedTargetUserId: null,
  activePostId: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSidebarCollapsed: (updater) =>
    set((state) => ({
      sidebarCollapsed: typeof updater === 'function' ? updater(state.sidebarCollapsed) : updater
    })),

  setIsMobileSidebarOpen: (updater) =>
    set((state) => ({
      isMobileSidebarOpen: typeof updater === 'function' ? updater(state.isMobileSidebarOpen) : updater
    })),

  setDomainNavigation: (domainSubView, activeDomainId, selectedChannelId = null) =>
    set((state) => ({
      domainSubView,
      activeDomainId: activeDomainId !== undefined ? activeDomainId : state.activeDomainId,
      selectedChannelId
    })),

  setMessagesNavigation: (messagesSubView, selectedConversationId = null) =>
    set({
      messagesSubView,
      selectedConversationId
    }),

  setProfileNavigation: (profileSubView, selectedTargetUserId = null) =>
    set({
      profileSubView,
      selectedTargetUserId
    }),

  setActivePostId: (activePostId) => set({ activePostId }),

  resetNavigation: () =>
    set({
      activeTab: 'home',
      sidebarCollapsed: false,
      isMobileSidebarOpen: false,
      activeDomainId: 'tech',
      domainSubView: 'list',
      selectedChannelId: null,
      messagesSubView: 'list',
      selectedConversationId: null,
      profileSubView: 'view',
      selectedTargetUserId: null,
      activePostId: null
    }),

  reset: () =>
    set({
      activeTab: 'home',
      sidebarCollapsed: false,
      isMobileSidebarOpen: false,
      activeDomainId: 'tech',
      domainSubView: 'list',
      selectedChannelId: null,
      messagesSubView: 'list',
      selectedConversationId: null,
      profileSubView: 'view',
      selectedTargetUserId: null,
      activePostId: null
    })
}));
