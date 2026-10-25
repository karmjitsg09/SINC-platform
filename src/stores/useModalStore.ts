import { create } from 'zustand';

export interface ModalState {
  shareModalPost: any | null;
  likersModalPostId: string | null;
  insightsModalPostId: string | null;
  rejectFollowUser: any | null;
  isOnboardingActive: boolean;

  setShareModalPost: (post: any | null) => void;
  setLikersModalPostId: (postId: string | null) => void;
  setInsightsModalPostId: (postId: string | null) => void;
  setRejectFollowUser: (user: any | null) => void;
  setIsOnboardingActive: (active: boolean) => void;
  closeAllModals: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  shareModalPost: null,
  likersModalPostId: null,
  insightsModalPostId: null,
  rejectFollowUser: null,
  isOnboardingActive: false,

  setShareModalPost: (shareModalPost) => set({ shareModalPost }),
  setLikersModalPostId: (likersModalPostId) => set({ likersModalPostId }),
  setInsightsModalPostId: (insightsModalPostId) => set({ insightsModalPostId }),
  setRejectFollowUser: (rejectFollowUser) => set({ rejectFollowUser }),
  setIsOnboardingActive: (isOnboardingActive) => set({ isOnboardingActive }),
  closeAllModals: () =>
    set({
      shareModalPost: null,
      likersModalPostId: null,
      insightsModalPostId: null,
      rejectFollowUser: null
    })
}));
