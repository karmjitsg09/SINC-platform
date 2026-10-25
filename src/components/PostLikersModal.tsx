import React, { useState, useEffect } from 'react';
import { getPostLikers } from '../lib/postInteractionService';

export interface PostLikersModalProps {
  postId: string;
  onClose: () => void;
}

export default function PostLikersModal({ postId, onClose }: PostLikersModalProps) {
  const [likers, setLikers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadLikers() {
      if (!postId) return;
      setLoading(true);
      setErrorMessage('');
      try {
        const list = await getPostLikers(postId);
        if (isMounted) {
          setLikers(list);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[PostLikersModal] Load likers error:', err);
        if (isMounted) {
          setErrorMessage(err?.message || 'Failed to load likers.');
          setLoading(false);
        }
      }
    }

    loadLikers();

    return () => {
      isMounted = false;
    };
  }, [postId]);

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
          maxWidth: '420px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
          border: '1.5px solid var(--border-app, #b5d2fd)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
            Liked by
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '12px', fontSize: '13px', fontWeight: '600', marginBottom: '14px', flexShrink: 0 }}>
            {errorMessage}
          </div>
        )}

        {/* Likers List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
              Loading likers...
            </div>
          ) : likers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
              No likes found.
            </div>
          ) : (
            likers.map((user) => {
              const initials = (user.name || 'User')
                .split(' ')
                .filter(Boolean)
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

              return (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#bcd5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '13px',
                      color: '#1e3860',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    {user.avatar_url || user.avatarUrl ? (
                      <img src={user.avatar_url || user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                      @{user.username || 'user'} • {user.role || 'Member'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
