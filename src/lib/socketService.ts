/**
 * SINC Platform — Realtime Socket.IO Client Service
 * Phase 7: Auxiliary Realtime Transport Layer
 *
 * Coexists cleanly with Supabase Realtime for ephemeral typing indicators,
 * presence tracking, and instant peer notification dispatch.
 */

import { io, Socket } from 'socket.io-client';
import { useSocketStore } from '../stores/useSocketStore';

let socket: Socket | null = null;
let currentAuth: { userId: string; token: string } | null = null;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

export function initSocketClient(userId: string, token?: string | null): Socket | null {
  if (typeof window === 'undefined' || !userId) return null;

  if (!token) {
    console.warn('[Socket.IO] Connection skipped: Signed access token is required for secure authentication.');
    disconnectSocketClient();
    return null;
  }

  // If already connected with the same user and token, return existing socket
  if (socket && socket.connected && currentAuth?.userId === userId && currentAuth?.token === token) {
    return socket;
  }

  // If connected with different credentials, disconnect cleanly first
  if (socket) {
    disconnectSocketClient();
  }

  try {
    currentAuth = { userId, token };

    socket = io(SOCKET_URL, {
      auth: {
        userId,
        token
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: true,
      timeout: 10000
    });

    socket.on('connect', () => {
      useSocketStore.getState().setIsConnected(true);

      // Query active online presence list
      socket?.emit('presence:query', (response: { onlineUserIds: string[] }) => {
        if (response?.onlineUserIds) {
          useSocketStore.getState().setOnlineUsers(response.onlineUserIds);
        }
      });
    });

    socket.on('disconnect', (reason) => {
      useSocketStore.getState().setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      // Graceful fallback: socket gateway might be offline or disabled in some test environments
      console.warn('[Socket.IO] Connection error (graceful fallback active):', error.message);
      useSocketStore.getState().setIsConnected(false);
    });

    // Realtime Presence Listener
    socket.on('presence:update', (data: { userId: string; status: 'online' | 'offline' }) => {
      if (data?.status === 'online') {
        useSocketStore.getState().addOnlineUser(data.userId);
      } else if (data?.status === 'offline') {
        useSocketStore.getState().removeOnlineUser(data.userId);
      }
    });

    // Realtime Typing Indicator Listener
    socket.on('typing:status', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (data?.conversationId && data?.userId) {
        useSocketStore.getState().setUserTyping(data.conversationId, data.userId, data.isTyping);
      }
    });

    return socket;
  } catch (err: any) {
    console.warn('[Socket.IO] Initialization failed:', err.message);
    currentAuth = null;
    return null;
  }
}

export function getSocketClient(): Socket | null {
  return socket;
}

export function disconnectSocketClient(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentAuth = null;
    useSocketStore.getState().resetSocketState();
  }
}

export const disconnectSocket = disconnectSocketClient;

export function emitSocketTyping(conversationId: string, isTyping: boolean): void {
  if (socket && socket.connected) {
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  }
}

export function joinSocketConversation(conversationId: string): void {
  if (socket && socket.connected && conversationId) {
    socket.emit('conversation:join', { conversationId });
  }
}

export function leaveSocketConversation(conversationId: string): void {
  if (socket && socket.connected && conversationId) {
    socket.emit('conversation:leave', { conversationId });
  }
}
