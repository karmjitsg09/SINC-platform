import React, { useState, useEffect, useRef } from 'react';
import ChatInput from '../components/ChatInput';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function DomainChat({ domain, channel, channelTitle }) {
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const domainName = domain ? domain.name : 'Domain';
  const domainId = domain?.id || 'tech';
  const rawChannelTitle = channel ? channel.title.replace(/^[^a-zA-Z0-9]+/, '') : 'General';
  const channelId = channel?.id || 'general';
  const displayTitle = channelTitle || `${domainName} / ${rawChannelTitle}`;
  const conversationKey = `domain_${domainId}_${channelId}`;

  // Domain Membership Security Check:
  // Check if current authenticated user has joined this domain
  const userDomainIds = currentUser?.domains || [];
  let isMember = userDomainIds.includes(domainId);
  if (!isMember) {
    try {
      const cached = localStorage.getItem(`sync_user_domains_${currentUser?.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.includes(domainId)) isMember = true;
      }
    } catch (e) {}
  }

  // Load existing persistent messages
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadMessages() {
      // 1. Check local storage cache first
      let localMsgs = [];
      try {
        const raw = localStorage.getItem(`sync_domain_chat_${conversationKey}`);
        if (raw) localMsgs = JSON.parse(raw);
      } catch (e) {}

      // 2. Fetch from Supabase messages if configured
      if (isSupabaseConfigured && currentUser?.id) {
        try {
          const { data, error } = await supabase
            .from('domain_messages')
            .select('*, profiles:user_id(id, name, avatar_url, username)')
            .eq('domain_id', domainId)
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true });

          if (!error && data && Array.isArray(data) && isMounted) {
            const formatted = data.map((m) => ({
              id: m.id,
              text: m.content,
              type: m.user_id === currentUser?.id ? 'sent' : 'received',
              senderName: m.profiles?.name || 'User',
              senderAvatar: m.profiles?.avatar_url || null,
              createdAt: m.created_at
            }));
            setMessages(formatted);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[DomainChat] Supabase messages read warning:', err);
        }
      }

      if (isMounted) {
        setMessages(localMsgs);
        setLoading(false);
      }
    }

    loadMessages();

    // 3. Realtime subscription to new domain messages
    let subscription = null;
    if (isSupabaseConfigured) {
      try {
        subscription = supabase
          .channel(`domain_chat_${conversationKey}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'domain_messages',
              filter: `domain_id=eq.${domainId}`
            },
            (payload) => {
              if (payload.new && payload.new.channel_id === channelId && isMounted) {
                if (payload.new.user_id !== currentUser?.id) {
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === payload.new.id)) return prev;
                    return [
                      ...prev,
                      {
                        id: payload.new.id,
                        text: payload.new.content,
                        type: 'received',
                        senderName: 'Member',
                        createdAt: payload.new.created_at
                      }
                    ];
                  });
                }
              }
            }
          )
          .subscribe();
      } catch (e) {}
    }

    return () => {
      isMounted = false;
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [conversationKey, domainId, channelId, currentUser?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (text) => {
    if (!text || !text.trim()) return;

    const trimmed = text.trim();
    const newMsg = {
      id: `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      text: trimmed,
      type: 'sent',
      senderName: currentUser?.name || 'You',
      senderAvatar: currentUser?.avatar_url || currentUser?.avatarUrl || null,
      createdAt: new Date().toISOString()
    };

    // Update state immediately
    const updated = [...messages, newMsg];
    setMessages(updated);

    // Save to persistent localStorage cache
    try {
      localStorage.setItem(`sync_domain_chat_${conversationKey}`, JSON.stringify(updated));
    } catch (e) {}

    // Persist to Supabase if configured
    if (isSupabaseConfigured && currentUser?.id) {
      try {
        await supabase.from('domain_messages').insert([
          {
            domain_id: domainId,
            channel_id: channelId,
            user_id: currentUser.id,
            content: trimmed
          }
        ]);
      } catch (err) {
        console.warn('[DomainChat] Supabase insert warning (cached locally):', err);
      }
    }
  };

  // Domain Security Enforcement
  if (!isMember) {
    return (
      <div className="main-content">
        <div className="content-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3860', margin: '0 0 8px 0' }}>
            Domain Membership Required
          </h2>
          <p style={{ color: '#64748b', fontSize: '13.5px', maxWidth: '420px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
            You must be a member of the <strong>{domainName}</strong> domain to access this conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="content-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
          <h2 className="page-title" style={{ margin: 0, fontSize: '17px' }}>{displayTitle}</h2>
          <span style={{ fontSize: '11.5px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
            Member Channel
          </span>
        </div>

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
                {msg.type === 'received' && msg.senderName && (
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                    {msg.senderName}
                  </div>
                )}
                <div>{msg.text}</div>
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
