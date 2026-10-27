import React from 'react';
import { useConversations } from '../messaging/hooks/useConversations';
import { useAuth } from '../context/AuthContext';

export default function MessagesList({ onSelectConversation }) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const { conversations, loading, markAsRead } = useConversations(currentUserId);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const handleSelect = (e, conv) => {
    if (e) {
      e.stopPropagation();
    }
    markAsRead(conv.id);
    if (onSelectConversation) {
      onSelectConversation(conv);
    }
  };

  return (
    <div className="main-content messages-list-page">
      <div className="content-card messages-list-card">
        <h2 className="page-title" style={{ flexShrink: 0 }}>Messages</h2>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b' }}>
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: 0, fontWeight: '500' }}>No direct conversations yet.</p>
            <p style={{ fontSize: '13px', marginTop: '6px', color: '#94a3b8' }}>
              Search for profiles, connect, and start chatting!
            </p>
          </div>
        ) : (
          <div className="list-container">
            {conversations.map((conv) => {
              const initials = getInitials(conv.name);
              const isUnread = conv.isUnread || conv.unreadCount > 0;

              return (
                <div
                  key={conv.id}
                  className="msg-row-item"
                  style={{
                    cursor: 'pointer',
                    position: 'relative',
                    backgroundColor: isUnread ? 'rgba(59, 130, 246, 0.07)' : 'transparent',
                    borderLeft: isUnread ? '3px solid #3b82f6' : '3px solid transparent',
                    borderRadius: '12px',
                    transition: 'background-color 0.2s ease, border-left-color 0.2s ease',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}
                  onClick={(e) => handleSelect(e, conv)}
                >
                  <div className="msg-row-left" style={{ gap: '14px', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                    <div
                      className="msg-avatar"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: '15px',
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}
                    >
                      {conv.avatarUrl ? (
                        <img src={conv.avatarUrl} alt={conv.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="msg-details" style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="msg-name" style={{ fontWeight: isUnread ? '700' : '600', color: 'var(--text-main)' }}>
                          {conv.name}
                        </span>
                      </div>
                      <span
                        className="msg-preview"
                        style={{
                          fontWeight: isUnread ? '600' : '400',
                          color: isUnread ? '#1e293b' : '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block'
                        }}
                      >
                        {typeof conv.lastMessage === 'string' && conv.lastMessage.startsWith('{') && conv.lastMessage.includes('shared_post')
                          ? '↗️ Shared a post with you'
                          : conv.lastMessage}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span className="msg-time" style={{ fontSize: '12px', color: isUnread ? '#3b82f6' : '#94a3b8', fontWeight: isUnread ? '600' : '400' }}>
                      {conv.time}
                    </span>
                    {isUnread && (
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.25)',
                          display: 'inline-block',
                          marginLeft: '4px'
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
