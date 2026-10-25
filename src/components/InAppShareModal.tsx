import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAppProfiles, sharePost } from '../lib/postInteractionService';

export interface InAppShareModalProps {
  postId: string;
  postAuthorId?: string;
  onClose: () => void;
  onShareSuccess?: (shareCount?: number) => void;
}

export default function InAppShareModal({ postId, postAuthorId, onClose, onShareSuccess }: InAppShareModalProps) {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!currentUser?.id) return;
      setLoading(true);
      const list = await getAppProfiles(currentUser.id, searchQuery);
      if (isMounted) {
        setProfiles(list);
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      load();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentUser?.id, searchQuery]);

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!selectedUserId) {
      setErrorMessage('Please select a user to share this post with.');
      return;
    }

    if (!currentUser?.id || !postId) {
      setErrorMessage('You must be logged in to share posts.');
      return;
    }

    setIsSharing(true);

    try {
      const res = await sharePost(postId, currentUser.id, selectedUserId, postAuthorId);
      setIsSharing(false);
      setStatusMessage('✓ Post shared successfully!');

      if (onShareSuccess) {
        onShareSuccess(res?.shareCount);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[InAppShareModal] Share error:', err);
      setIsSharing(false);
      setErrorMessage(err.message || 'Failed to share post. Please try again.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
          border: '1.5px solid var(--border-app, #b5d2fd)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
            Share Post
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {/* Status / Error Banner */}
        {statusMessage && (
          <div style={{ padding: '10px 14px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '12px', fontSize: '13px', fontWeight: '600', marginBottom: '14px', flexShrink: 0 }}>
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '12px', fontSize: '13px', fontWeight: '600', marginBottom: '14px', flexShrink: 0 }}>
            {errorMessage}
          </div>
        )}

        {/* Search Input */}
        <div style={{ marginBottom: '14px', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search verified profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '14px',
              border: '1px solid var(--border-app, #b5d2fd)',
              fontSize: '13px',
              outline: 'none',
              backgroundColor: '#f8fafc'
            }}
          />
        </div>

        {/* User Selection List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', minHeight: '160px', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
              Loading users...
            </div>
          ) : profiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
              No matching users found.
            </div>
          ) : (
            profiles.map((p) => {
              const isSelected = selectedUserId === p.id;
              const initials = (p.name || 'User')
                .split(' ')
                .filter(Boolean)
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedUserId(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '14px',
                    border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#bcd5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '12px',
                        color: '#1e3860',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      {p.avatar_url || p.avatarUrl ? (
                        <img src={p.avatar_url || p.avatarUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        initials
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                        @{p.username || 'user'} • {p.role || 'Member'}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: isSelected ? '#2563eb' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}
                  >
                    {isSelected && '✓'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '14px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleShareSubmit}
            disabled={!selectedUserId || isSharing}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: selectedUserId ? '#2563eb' : '#94a3b8',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: selectedUserId ? 'pointer' : 'default',
              transition: 'background 0.15s ease'
            }}
          >
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
