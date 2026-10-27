import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import ChatInput from '../components/ChatInput';
import { useMessages } from '../messaging/hooks/useMessages';
import { usePresence } from '../messaging/hooks/usePresence';
import { useAuth } from '../context/AuthContext';

import { markConversationAsRead } from '../messaging/services/conversationService';
import { getPostById } from '../lib/postService';

function SharedPostCard({ postId, text, onNavigateToPostView, conversation }) {
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
      } catch (e) {
        console.warn('Failed to load shared post details:', e);
      }
      if (isMounted) setLoading(false);
    }
    loadPost();
    return () => {
      isMounted = false;
    };
  }, [postId]);

  const authorName = postData?.author || postData?.profiles?.name || 'User';
  const authorAvatar = postData?.avatar_url || postData?.avatarUrl || postData?.profiles?.avatar_url || null;
  const postSnippet = postData?.content || 'Shared post';
  const firstMedia = postData?.media?.[0] || (postData?.image_url ? { media_url: postData.image_url, media_type: 'image' } : null);

  const handleOpenPost = () => {
    if (postId && onNavigateToPostView) {
      onNavigateToPostView(postId, {
        from: 'message',
        activeTab: 'messages',
        messagesSubView: 'detail',
        conversationId: conversation?.id,
        conversation: conversation
      });
    }
  };

  return (
    <div
      style={{
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        padding: '10px 12px',
        color: '#1e293b',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        width: '100%',
        maxWidth: '260px'
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>↗️</span> {text || 'Shared a post with you'}
      </div>

      {loading ? (
        <div style={{ fontSize: '11px', color: '#64748b' }}>Loading post details...</div>
      ) : !postData ? (
        <div
          style={{
            padding: '14px 10px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span style={{ fontSize: '18px' }}>🚫</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
            This post is unavailable
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            The post was deleted.
          </span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#bcd5fa', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '10px', color: '#1e3860' }}>
              {authorAvatar ? (
                <img src={authorAvatar} alt={authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                authorName[0]?.toUpperCase()
              )}
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
              {authorName}
            </span>
          </div>

          <p style={{ fontSize: '11.5px', color: '#475569', margin: '0 0 8px 0', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {postSnippet}
          </p>

          {/* Media preview thumbnail if post has images or video */}
          {firstMedia && (
            <div style={{ position: 'relative', width: '100%', height: '110px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', border: '1px solid #cbd5e1', backgroundColor: '#0f172a' }}>
              {firstMedia.media_type === 'video' ? (
                <video src={firstMedia.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={firstMedia.media_url} alt="Shared post attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {postData.media?.length > 1 && (
                <span style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                  📷 {postData.media.length}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenPost}
            style={{
              width: '100%',
              padding: '5px 10px',
              borderRadius: '6px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: '600',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            View Post
          </button>
        </>
      )}
    </div>
  );
}

export default function MessageDetail({ conversation, onBack, onNavigateToPostView }) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  if (conversation?.error) {
    console.error('[CHAT ROUTE ERROR GUARD]', conversation.error);
    return (
      <div className="main-content">
        <div className="content-card" style={{ padding: '24px' }}>
          <button className="back-btn" onClick={onBack} style={{ marginBottom: '16px' }}>
            Back
          </button>
          <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '15px' }}>
            Unable to open conversation
          </div>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '8px' }}>
            {conversation.error}
          </div>
        </div>
      </div>
    );
  }

  const conversationId = conversation?.id;

  useEffect(() => {
    if (conversationId && currentUserId) {
      markConversationAsRead(conversationId, currentUserId);
    }
  }, [conversationId, currentUserId]);
  const initialOtherUser = conversation?.otherUser || {};
  const [resolvedProfile, setResolvedProfile] = useState(
    initialOtherUser.name && initialOtherUser.name !== 'User' ? initialOtherUser : null
  );

  useEffect(() => {
    let isMounted = true;

    async function resolveParticipantProfile() {
      if (!conversationId || !currentUserId) return;

      try {
        let otherUserId = conversation?.targetUserId || conversation?.otherUser?.id;

        if (!otherUserId && isSupabaseConfigured) {
          const { data: members, error: memErr } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conversationId);

          if (memErr) {
            console.error('[CHAT PROFILE ERROR]', {
              message: memErr?.message,
              code: memErr?.code,
              details: memErr?.details,
              hint: memErr?.hint
            });
          } else if (members) {
            const otherMem = members.find((m) => m.user_id !== currentUserId);
            if (otherMem) {
              otherUserId = otherMem.user_id;
            }
          }
        }

        if (otherUserId && isSupabaseConfigured) {
          const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherUserId)
            .single();

          if (profErr) {
            console.error('[CHAT PROFILE ERROR]', {
              message: profErr?.message,
              code: profErr?.code,
              details: profErr?.details,
              hint: profErr?.hint
            });
          }

          console.log('[CHAT PARTICIPANT]', {
            conversationId,
            currentUserId,
            otherUserId,
            profile
          });

          if (isMounted && profile) {
            setResolvedProfile({
              id: profile.id,
              name: profile.name || profile.username || 'User',
              username: profile.username || '',
              role: profile.role || '',
              avatarUrl: profile.avatar_url || null,
              avatar_url: profile.avatar_url || null
            });
          }
        }
      } catch (e) {
        console.error('Participant profile resolution exception:', e);
      }
    }

    resolveParticipantProfile();

    return () => {
      isMounted = false;
    };
  }, [conversationId, currentUserId, conversation?.targetUserId, conversation?.otherUser?.id]);

  const targetUser = resolvedProfile || conversation?.otherUser || {};
  const targetUserId = targetUser.id || conversation?.targetUserId;
  const targetName = targetUser.name || conversation?.name || 'User';
  const targetAvatar = targetUser.avatarUrl || targetUser.avatar_url || conversation?.avatarUrl || null;

  const { messages, loading, sendMessage, setTyping, isTyping } = useMessages(conversationId, currentUserId);
  const presence = usePresence(targetUserId, currentUserId);

  const messagesEndRef = useRef(null);

  const initials = targetName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (text) => {
    if (!text || !text.trim()) return;
    await sendMessage(text);
  };

  return (
    <div className="main-content chat-page">
      <div className="content-card chat-card">
        {/* Header with back button, avatar, name, and presence status */}
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button className="back-btn" onClick={onBack} aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            
            <div
              className="msg-avatar"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '14px',
                overflow: 'hidden'
              }}
            >
              {targetAvatar ? (
                <img src={targetAvatar} alt={targetName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>
                {targetName}
              </span>
              <span className="subtitle-online" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: presence.status === 'online' ? '#22c55e' : '#94a3b8'
                  }}
                />
                {presence.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Message bubbles area */}
        <div className="chat-messages-area">
          {loading ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '24px 0' }}>
              Loading message history...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto 0' }}>
              <p style={{ fontSize: '14px', margin: 0 }}>This is the beginning of your conversation with <strong>{targetName}</strong>.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Send a message to start chatting!</p>
            </div>
          ) : (
            messages.map((msg) => {
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
                  className={`message-bubble ${msg.type}`}
                  style={{
                    maxWidth: 'min(85%, 580px)',
                    alignSelf: msg.type === 'sent' ? 'flex-end' : 'flex-start',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word'
                  }}
                >
                  {parsedShared ? (
                    <SharedPostCard
                      postId={parsedShared.post_id}
                      text={parsedShared.text}
                      onNavigateToPostView={onNavigateToPostView}
                      conversation={conversation}
                    />
                  ) : (
                    <div>{msg.text}</div>
                  )}
                  <div
                    style={{
                      fontSize: '10px',
                      opacity: 0.7,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '4px'
                    }}
                  >
                    <span>
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Just now'}
                    </span>
                    {msg.type === 'sent' && (
                      <span style={{ fontSize: '11px', fontWeight: '700' }}>✓✓</span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div
              className="message-bubble received"
              style={{
                alignSelf: 'flex-start',
                padding: '8px 14px',
                fontSize: '12px',
                fontStyle: 'italic',
                color: '#64748b'
              }}
            >
              {targetName} is typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input */}
        <ChatInput
          placeholder="Message here..."
          onSendMessage={handleSendMessage}
          onChangeText={(val) => setTyping(val.length > 0)}
        />
      </div>
    </div>
  );
}
