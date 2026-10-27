import React, { useState, useEffect, useRef } from 'react';
import ChatInput from '../components/ChatInput';
import { useAuth } from '../context/AuthContext';
import { checkIsDomainMember } from '../lib/domainUtils';
import {
  getDomainMessages,
  sendDomainMessage,
  subscribeToDomainChannel
} from '../messaging/services/domainMessageService';

export default function DomainChat({ domain, channel, channelTitle }) {
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState(null);
  const messagesEndRef = useRef(null);

  const domainName = domain ? domain.name : 'Domain';
  const domainId = domain?.id || 'tech';
  const rawChannelTitle = channel ? channel.title.replace(/^[^a-zA-Z0-9]+/, '') : 'General';
  const channelId = channel?.id || 'general';
  const displayTitle = channelTitle || `${domainName} / ${rawChannelTitle}`;
  const conversationKey = `domain_${domainId}_${channelId}`;

  // Domain Membership Security Check:
  // Authorizes user based on profiles.domains or local cached memberships
  const userDomainIds = currentUser?.domains || [];
  let isMember = checkIsDomainMember(userDomainIds, domainId, domainName);

  if (!isMember && currentUser?.id) {
    try {
      const cached = localStorage.getItem(`sync_user_domains_${currentUser.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && checkIsDomainMember(parsed, domainId, domainName)) {
          isMember = true;
        }
      }
    } catch (e) {}
  }

  // Load existing persistent messages & subscribe to realtime delivery
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setSendError(null);

    // 1. Fetch persistent messages
    async function fetchHistory() {
      const { messages: historyMessages, error } = await getDomainMessages(
        domainId,
        channelId,
        currentUser?.id
      );

      if (isMounted) {
        setMessages(historyMessages);
        setLoading(false);
        if (error && error.code === 'PGRST205') {
          console.info(
            '[DomainChat] Note: public.domain_messages table is awaiting migration. Local & realtime broadcast delivery are active.'
          );
        }
      }
    }

    fetchHistory();

    // 2. Realtime subscription (PostgreSQL INSERT + Realtime Broadcast)
    const unsubscribe = subscribeToDomainChannel({
      domainId,
      channelId,
      currentUserId: currentUser?.id,
      onMessage: (newMsg) => {
        if (!isMounted) return;
        setMessages((prev) => {
          // If we already have this message by ID, do not add duplicate
          const existingIdx = prev.findIndex((m) => m.id === newMsg.id);
          if (existingIdx !== -1) {
            // Update persistence state if needed
            const copy = [...prev];
            copy[existingIdx] = { ...copy[existingIdx], ...newMsg };
            return copy;
          }
          // If message is from current user and matches optimistic content and close timestamp, reconcile
          const optimisticMatch = prev.findIndex(
            (m) =>
              m.userId === newMsg.userId &&
              m.text === newMsg.text &&
              !m.isPersisted
          );
          if (optimisticMatch !== -1) {
            const copy = [...prev];
            copy[optimisticMatch] = { ...copy[optimisticMatch], id: newMsg.id, isPersisted: true };
            return copy;
          }
          return [...prev, newMsg];
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [conversationKey, domainId, channelId, currentUser?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (text) => {
    if (!text || !text.trim() || !currentUser?.id) return;
    setSendError(null);

    // Call domainMessageService to persist and broadcast
    const result = await sendDomainMessage({
      domainId,
      channelId,
      userId: currentUser.id,
      content: text,
      senderProfile: currentUser
    });

    if (result.message) {
      // Append message to state and update localStorage cache
      setMessages((prev) => {
        const next = [...prev, result.message];
        try {
          localStorage.setItem(`sync_domain_chat_${conversationKey}`, JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }

    if (!result.success && result.error) {
      console.warn('[DomainChat] sendDomainMessage result:', result.error.message || result.error);
      if (result.error?.code === 'PGRST205') {
        // Table awaiting migration
      } else {
        setSendError(result.error.message || 'Message could not be saved to server.');
      }
    }
  };

  // Domain Security Enforcement UI
  if (!isMember) {
    return (
      <div className="main-content">
        <div className="content-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3860', margin: '0 0 8px 0' }}>
            Domain Membership Required
          </h2>
          <p style={{ color: '#64748b', fontSize: '13.5px', maxWidth: '420px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
            You must be a member of the <strong>{domainName}</strong> domain to access this conversation channel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="content-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
          <div>
            <h2 className="page-title" style={{ margin: 0, fontSize: '17px' }}>{displayTitle}</h2>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Real-time member discussions & announcements
            </div>
          </div>
          <span style={{ fontSize: '11.5px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
            Member Channel
          </span>
        </div>

        {sendError && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '10px'
            }}
          >
            {sendError}
          </div>
        )}

        <div className="chat-messages-area" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
          {loading ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
              Welcome to the <strong>{displayTitle}</strong> domain group conversation! Send the first message.
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`message-bubble ${msg.type}`}
                style={{
                  maxWidth: '75%',
                  alignSelf: msg.type === 'sent' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.type === 'sent' ? '#2563eb' : '#f1f5f9',
                  color: msg.type === 'sent' ? '#ffffff' : '#1e293b',
                  borderRadius: msg.type === 'sent' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {msg.type === 'received' && (
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                    {msg.senderName}
                  </div>
                )}
                <div>{msg.text}</div>
                {msg.createdAt && (
                  <div
                    style={{
                      fontSize: '10px',
                      opacity: 0.7,
                      textAlign: 'right',
                      marginTop: '4px'
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
          <ChatInput placeholder={`Message in ${rawChannelTitle}...`} onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
}
