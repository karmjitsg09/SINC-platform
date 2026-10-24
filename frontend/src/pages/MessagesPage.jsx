import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConversations } from '../messaging/hooks/useConversations';
import { useMessages } from '../messaging/hooks/useMessages';
import { usePresence } from '../messaging/hooks/usePresence';
import { markConversationAsRead } from '../messaging/services/conversationService';
import { getPostById } from '../lib/postService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  MessageSquare,
  Search,
  ArrowLeft,
  Send,
  Sparkles,
  CheckCheck,
  Circle
} from 'lucide-react';

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function formatMsgTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function SharedPostEmbed({ postId, text, onNavigateToPostView, conversation }) {
  const [postData, setPostData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadPost() {
      if (!postId) return;
      try {
        const data = await getPostById(postId);
        if (isMounted && data) {
          setPostData(data);
        }
      } catch (e) {}
      if (isMounted) setLoading(false);
    }
    loadPost();
    return () => { isMounted = false; };
  }, [postId]);

  if (loading) {
    return <div className="shared-post-loading">Loading shared post...</div>;
  }

  if (!postData) {
    return (
      <div className="shared-post-deleted">
        <span>Post is no longer available</span>
      </div>
    );
  }

  const authorName = postData.author || postData.profiles?.name || 'User';

  return (
    <div
      className="shared-post-card"
      onClick={() => onNavigateToPostView && onNavigateToPostView(postId, { activeTab: 'messages', conversation })}
    >
      <div className="shared-post-kicker">
        <span>↗</span> {text || 'Shared a post with you'}
      </div>
      <div className="shared-post-author-row">
        <span className="shared-author-name">{authorName}</span>
      </div>
      <p className="shared-post-snippet">{postData.content?.substring(0, 80)}...</p>
      <span className="shared-post-btn">View Post</span>
    </div>
  );
}

export default function MessagesPage({
  selectedConversation,
  onSelectConversation,
  onNavigateToPostView,
  onBackToList,
  initialConversationId,
  onNavigateToProfile
}) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const { conversations, loading: loadingConversations, markAsRead } = useConversations(currentUserId);
  const [searchFilter, setSearchFilter] = useState('');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const conversationId = selectedConversation?.id || initialConversationId;

  // Resolve active conversation details from loaded conversations or selectedConversation
  const matchedConv = conversations.find((c) => c.id === conversationId);
  const activeConversation = (selectedConversation?.otherUser || selectedConversation?.name)
    ? selectedConversation
    : (matchedConv || selectedConversation);

  // Sync full details to parent if selectedConversation only had an ID (e.g. from reload or route param)
  useEffect(() => {
    if (conversationId && matchedConv && !selectedConversation?.otherUser && onSelectConversation) {
      onSelectConversation(matchedConv);
    }
  }, [conversationId, matchedConv, selectedConversation, onSelectConversation]);

  // Mark active conversation read
  useEffect(() => {
    if (conversationId && currentUserId) {
      markConversationAsRead(conversationId, currentUserId);
    }
  }, [conversationId, currentUserId]);

  // Hook for message stream
  const { messages, loading: loadingMessages, sendMessage, setTyping, isTyping } = useMessages(
    conversationId,
    currentUserId
  );

  // Participant info
  const targetUser = activeConversation?.otherUser || {};
  const targetUserId = targetUser.id || activeConversation?.targetUserId;
  const targetName = activeConversation?.name || targetUser.name || 'User';
  const targetAvatar = activeConversation?.avatarUrl || targetUser.avatar_url || targetUser.avatarUrl;
  const targetInitials = getInitials(targetName);

  const presence = usePresence(targetUserId, currentUserId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !conversationId) return;
    setInputText('');
    setTyping(false);
    const sent = await sendMessage(textToSend);
    if (!sent) {
      // Preserve input text on failure so user never loses their drafted message
      setInputText(textToSend);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(q);
    const lastMsgMatch = c.lastMessage?.toLowerCase().includes(q);
    return nameMatch || lastMsgMatch;
  });

  return (
    <div className="messaging-desktop-container">
      {/* ── LEFT PANEL: CONVERSATION LIST ── */}
      <div className={`messaging-sidebar-panel ${selectedConversation ? 'mobile-hidden' : ''}`}>
        <div className="messaging-sidebar-header">
          <div className="header-title-row">
            <h2>Messages</h2>
            <span className="conv-count-badge">
              {conversations.length}
            </span>
          </div>

          {/* Conversation Search Box */}
          <div className="conv-search-box">
            <Search size={15} className="conv-search-icon" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="conv-search-input"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="conv-list-scroll">
          {loadingConversations ? (
            <div className="conv-loading-text">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="conv-empty-state">
              <MessageSquare size={26} className="text-muted" />
              <p>No conversations found</p>
              <span>Connect with people in search or domains to start chatting!</span>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              const isUnread = conv.isUnread || conv.unreadCount > 0;
              const cInitials = getInitials(conv.name);

              return (
                <div
                  key={conv.id}
                  className={`conv-row-item ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                  onClick={() => {
                    markAsRead(conv.id);
                    onSelectConversation(conv);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="conv-avatar-wrapper">
                    {conv.avatarUrl ? (
                      <img src={conv.avatarUrl} alt={conv.name} className="conv-avatar-img" />
                    ) : (
                      <span className="conv-avatar-initials">{cInitials}</span>
                    )}
                    {conv.isOnline && <span className="online-presence-indicator" />}
                  </div>

                  <div className="conv-item-content">
                    <div className="conv-content-top">
                      <span className="conv-participant-name">{conv.name}</span>
                      <span className="conv-timestamp">{formatMsgTime(conv.updated_at || conv.lastMessageTime)}</span>
                    </div>

                    <div className="conv-content-bottom">
                      <p className="conv-snippet-text">
                        {conv.lastMessage || 'Started a new conversation'}
                      </p>
                      {isUnread && <span className="conv-unread-dot" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: CHAT DETAIL ── */}
      <div className={`messaging-chat-panel ${!conversationId ? 'mobile-hidden' : ''}`}>
        {!conversationId ? (
          <div className="chat-placeholder-view">
            <div className="placeholder-icon-circle">
              <MessageSquare size={36} className="text-blue" />
            </div>
            <h3>Your Messages</h3>
            <p>Select an ongoing conversation from the left, or explore members to start messaging.</p>
          </div>
        ) : (
          <div className="active-chat-container">
            {/* Active Chat Header */}
            <div className="active-chat-header">
              <div className="chat-header-left">
                <button
                  type="button"
                  className="mobile-back-to-convs-btn"
                  onClick={onBackToList}
                  aria-label="Back to conversations list"
                  title="Back to conversations list"
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="active-chat-avatar">
                  {targetAvatar ? (
                    <img src={targetAvatar} alt={targetName} className="avatar-img" />
                  ) : (
                    <span className="avatar-initials">{targetInitials}</span>
                  )}
                </div>

                <div className="active-chat-user-meta">
                  <span className="active-chat-name">{targetName}</span>
                  <span className="active-chat-status">
                    <Circle
                      size={8}
                      className={presence.status === 'online' ? 'status-online-dot' : 'status-offline-dot'}
                    />
                    <span>{presence.status === 'online' ? 'Online' : 'Offline'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Message History Area */}
            <div className="active-chat-stream">
              {loadingMessages ? (
                <div className="stream-loading-text">Loading message history...</div>
              ) : messages.length === 0 ? (
                <div className="stream-empty-prompt">
                  <Sparkles size={24} className="text-blue" />
                  <h4>This is the start of your direct conversation with {targetName}.</h4>
                  <p>Send a message below to say hello!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSent = msg.type === 'sent';

                  let parsedShared = null;
                  if (typeof msg.text === 'string' && msg.text.startsWith('{') && msg.text.includes('shared_post')) {
                    try {
                      const p = JSON.parse(msg.text);
                      if (p && p.type === 'shared_post' && p.post_id) {
                        parsedShared = p;
                      }
                    } catch (e) {}
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`chat-bubble-row ${isSent ? 'sent-row' : 'received-row'}`}
                    >
                      <div className={`chat-bubble ${isSent ? 'bubble-sent' : 'bubble-received'}`}>
                        {parsedShared ? (
                          <SharedPostEmbed
                            postId={parsedShared.post_id}
                            text={parsedShared.text}
                            onNavigateToPostView={onNavigateToPostView}
                            conversation={selectedConversation}
                          />
                        ) : (
                          <p className="bubble-text">{msg.text}</p>
                        )}

                        <div className="bubble-footer-meta">
                          <span className="bubble-time">
                            {msg.created_at
                              ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Just now'}
                          </span>
                          {isSent && <CheckCheck size={12} className="sent-check-icon" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {isTyping && (
                <div className="chat-bubble-row received-row">
                  <div className="chat-bubble bubble-received typing-bubble">
                    <span>{targetName} is typing...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Composer */}
            <form className="active-chat-composer" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setTyping(e.target.value.length > 0);
                }}
                className="chat-composer-input"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="chat-send-btn"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
