import React, { useState, useEffect, useCallback } from 'react';
import { getPostInsights, subscribeToPostInteractions } from '../lib/postInteractionService';
import { useAuth } from '../context/AuthContext';
import { deletePost } from '../lib/postService';

function formatTimeAgo(isoString?: string | null): string {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export interface PostInsightsModalProps {
  post?: any;
  postId?: string;
  ownerId?: string;
  onClose?: () => void;
  onNavigateToProfile?: (user: any) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function PostInsightsModal({
  post,
  postId,
  ownerId,
  onClose,
  onNavigateToProfile,
  onPostDeleted
}: PostInsightsModalProps) {
  const { user: currentUser } = useAuth();
  const effectivePostId = postId || post?.id;
  const postOwnerId = post?.user_id || post?.author_id || ownerId;
  const isOwner = Boolean(
    currentUser?.id &&
    postOwnerId &&
    currentUser.id === postOwnerId
  );

  const [insights, setInsights] = useState<{
    likes: any[];
    comments: any[];
    shares: any[];
    saves: any[];
    counts: { likes: number; comments: number; shares: number; saves: number };
  }>({
    likes: [],
    comments: [],
    shares: [],
    saves: [],
    counts: { likes: 0, comments: 0, shares: 0, saves: 0 }
  });
  const [activeTab, setActiveTab] = useState<'likes' | 'comments' | 'shares' | 'saves'>('likes');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Delete states
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async (isMountedRef: { current: boolean }) => {
    if (!effectivePostId || !ownerId) return;
    try {
      const data = await getPostInsights(effectivePostId, ownerId);
      if (isMountedRef?.current !== false) {
        setInsights(data);
        setErrorMessage('');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[PostInsightsModal] loadData error:', err);
      if (isMountedRef?.current !== false) {
        setErrorMessage(err?.message || 'Failed to load post insights.');
        setLoading(false);
      }
    }
  }, [effectivePostId, ownerId]);

  useEffect(() => {
    const isMountedRef = { current: true };
    setLoading(true);
    loadData(isMountedRef);

    // Subscribe to realtime engagement changes for this post
    const unsubscribe = subscribeToPostInteractions(effectivePostId, () => {
      loadData(isMountedRef);
    });

    return () => {
      isMountedRef.current = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [effectivePostId, loadData]);

  const handleUserClick = (userObj: any) => {
    if (!userObj || !userObj.id) return;
    if (onNavigateToProfile) {
      onNavigateToProfile(userObj);
      if (onClose) onClose();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!effectivePostId || !currentUser?.id || isDeleting) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      await deletePost(effectivePostId, currentUser.id);
      setShowConfirmDelete(false);
      if (onPostDeleted) {
        onPostDeleted(effectivePostId);
      }
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      console.error('[PostInsightsModal] Failed to delete post:', err);
      setDeleteError('Unable to delete post. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderUserAvatar = (user: any) => {
    if (!user) return null;
    const avatarUrl = user.avatarUrl || user.avatar_url;
    const initials = getInitials(user.name);

    return (
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: '#bcd5fa',
          border: '1.5px solid #b5d2fd',
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
        {avatarUrl ? (
          <img src={avatarUrl} alt={user.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
    );
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
        zIndex: 2500,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          padding: '24px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
          border: '1.5px solid var(--border-app, #b5d2fd)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>ⓘ</span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
              Post Insights
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px 8px',
              borderRadius: '8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Top Engagement Metrics Summary Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginBottom: '16px',
            flexShrink: 0
          }}
        >
          {/* Likes Summary */}
          <button
            type="button"
            onClick={() => setActiveTab('likes')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px',
              backgroundColor: activeTab === 'likes' ? '#eff6ff' : 'var(--fill-card, #f8fafc)',
              border: activeTab === 'likes' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>❤️ Likes</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #1e3860)', marginTop: '2px' }}>
              {insights.counts.likes}
            </span>
          </button>

          {/* Comments Summary */}
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px',
              backgroundColor: activeTab === 'comments' ? '#eff6ff' : 'var(--fill-card, #f8fafc)',
              border: activeTab === 'comments' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>💬 Comments</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #1e3860)', marginTop: '2px' }}>
              {insights.counts.comments}
            </span>
          </button>

          {/* Shares Summary */}
          <button
            type="button"
            onClick={() => setActiveTab('shares')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px',
              backgroundColor: activeTab === 'shares' ? '#eff6ff' : 'var(--fill-card, #f8fafc)',
              border: activeTab === 'shares' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>↗ Shares</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #1e3860)', marginTop: '2px' }}>
              {insights.counts.shares}
            </span>
          </button>

          {/* Saves Summary */}
          <button
            type="button"
            onClick={() => setActiveTab('saves')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px',
              backgroundColor: activeTab === 'saves' ? '#eff6ff' : 'var(--fill-card, #f8fafc)',
              border: activeTab === 'saves' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>🔖 Saves</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #1e3860)', marginTop: '2px' }}>
              {insights.counts.saves}
            </span>
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1.5px solid #e2e8f0',
            marginBottom: '14px',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('likes')}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'likes' ? '2.5px solid #3b82f6' : '2.5px solid transparent',
              fontWeight: activeTab === 'likes' ? '700' : '500',
              color: activeTab === 'likes' ? '#2563eb' : '#64748b',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Likes ({insights.counts.likes})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'comments' ? '2.5px solid #3b82f6' : '2.5px solid transparent',
              fontWeight: activeTab === 'comments' ? '700' : '500',
              color: activeTab === 'comments' ? '#2563eb' : '#64748b',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Comments ({insights.counts.comments})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shares')}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'shares' ? '2.5px solid #3b82f6' : '2.5px solid transparent',
              fontWeight: activeTab === 'shares' ? '700' : '500',
              color: activeTab === 'shares' ? '#2563eb' : '#64748b',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Shares ({insights.counts.shares})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saves')}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'saves' ? '2.5px solid #3b82f6' : '2.5px solid transparent',
              fontWeight: activeTab === 'saves' ? '700' : '500',
              color: activeTab === 'saves' ? '#2563eb' : '#64748b',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Saves ({insights.counts.saves})
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '14px',
              flexShrink: 0
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Tab Detail Contents (Scrollable List) */}
        <div
          style={{
            flex: 1,
            minHeight: '160px',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            paddingRight: '4px',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13.5px' }}>
              Loading insights...
            </div>
          ) : (
            <>
              {/* TAB 1: LIKES */}
              {activeTab === 'likes' && (
                <>
                  {insights.likes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '13px' }}>
                      No one has liked this post yet.
                    </div>
                  ) : (
                    insights.likes.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleUserClick(user)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {renderUserAvatar(user)}
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                              {user.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                              @{user.username || 'user'}
                            </div>
                          </div>
                        </div>
                        {user.created_at && (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {formatTimeAgo(user.created_at)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 2: COMMENTS */}
              {activeTab === 'comments' && (
                <>
                  {insights.comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '13px' }}>
                      No comments yet.
                    </div>
                  ) : (
                    insights.comments.map((comment) => (
                      <div
                        key={comment.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div
                            onClick={() => handleUserClick(comment.profile)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer'
                            }}
                          >
                            {renderUserAvatar(comment.profile)}
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                                {comment.profile?.name || 'User'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                                @{comment.profile?.username || 'user'}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {formatTimeAgo(comment.created_at)}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '13.5px',
                            color: 'var(--text-main, #1e3860)',
                            lineHeight: '1.45',
                            paddingLeft: '48px',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {comment.content}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 3: SHARES */}
              {activeTab === 'shares' && (
                <>
                  {insights.shares.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '13px' }}>
                      No one has shared this post yet.
                    </div>
                  ) : (
                    insights.shares.map((share) => (
                      <div
                        key={share.id}
                        onClick={() => handleUserClick(share.user)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {renderUserAvatar(share.user)}
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                              {share.user?.name || 'User'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                              @{share.user?.username || 'user'}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {formatTimeAgo(share.created_at)}
                        </span>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 4: SAVES */}
              {activeTab === 'saves' && (
                <>
                  {insights.saves.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '13px' }}>
                      No one has saved this post yet.
                    </div>
                  ) : (
                    insights.saves.map((save) => (
                      <div
                        key={save.id}
                        onClick={() => handleUserClick(save.user)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {renderUserAvatar(save.user)}
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                              {save.user?.name || 'User'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                              @{save.user?.username || 'user'}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Saved {formatTimeAgo(save.created_at)}
                        </span>
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Owner-Only Actions Footer */}
        {isOwner && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0
            }}
          >
            {deleteError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {deleteError}
              </div>
            )}

            <button
              type="button"
              id="delete-post-btn"
              onClick={() => {
                setDeleteError('');
                setShowConfirmDelete(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                backgroundColor: '#fff1f2',
                border: '1.5px solid #fecdd3',
                color: '#e11d48',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ffe4e6';
                e.currentTarget.style.borderColor = '#fda4af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff1f2';
                e.currentTarget.style.borderColor = '#fecdd3';
              }}
            >
              <span style={{ fontSize: '15px' }}>🗑</span>
              <span>Delete Post</span>
            </button>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL OVERLAY */}
      {showConfirmDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '16px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeleting) setShowConfirmDelete(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '380px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #e2e8f0',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                marginBottom: '14px'
              }}
            >
              🗑
            </div>

            <h3
              style={{
                margin: '0 0 8px 0',
                fontSize: '18px',
                fontWeight: '700',
                color: '#0f172a'
              }}
            >
              Delete Post?
            </h3>

            <p
              style={{
                margin: '0 0 20px 0',
                fontSize: '13.5px',
                color: '#64748b',
                lineHeight: '1.5'
              }}
            >
              Are you sure you want to delete this post?
              <br />
              <span style={{ fontWeight: '600', color: '#ef4444' }}>
                This action cannot be undone.
              </span>
            </p>

            {deleteError && (
              <div
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '16px',
                  textAlign: 'left'
                }}
              >
                {deleteError}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '10px',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <button
                type="button"
                id="cancel-delete-btn"
                disabled={isDeleting}
                onClick={() => setShowConfirmDelete(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                id="confirm-delete-btn"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: isDeleting ? '#f87171' : '#dc2626',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
