import { create } from 'zustand';

export interface SocketState {
  isConnected: boolean;
  onlineUserIds: string[];
  typingUsers: Record<string, string[]>; // conversationId -> array of typing userIds

  setIsConnected: (connected: boolean) => void;
  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setUserTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  resetSocketState: () => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  isConnected: false,
  onlineUserIds: [],
  typingUsers: {},

  setIsConnected: (isConnected) => set({ isConnected }),
  setOnlineUsers: (onlineUserIds) => set({ onlineUserIds }),
  addOnlineUser: (userId) =>
    set((state) => ({
      onlineUserIds: state.onlineUserIds.includes(userId)
        ? state.onlineUserIds
        : [...state.onlineUserIds, userId]
    })),
  removeOnlineUser: (userId) =>
    set((state) => ({
      onlineUserIds: state.onlineUserIds.filter((id) => id !== userId)
    })),
  setUserTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const current = state.typingUsers[conversationId] || [];
      const updated = isTyping
        ? current.includes(userId)
          ? current
          : [...current, userId]
        : current.filter((id) => id !== userId);
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: updated
        }
      };
    }),
  resetSocketState: () =>
    set({
      isConnected: false,
      onlineUserIds: [],
      typingUsers: {}
    })
}));
