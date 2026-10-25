import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSavedPosts } from '../lib/savedPostsService';
import PostMedia from '../components/PostMedia';
import PostCardInteractions from '../components/PostCardInteractions';
import PostInsightsModal from '../components/PostInsightsModal';

export interface SavedPostsProps {
  onBack?: () => void;
  onExplorePosts?: () => void;
  onNavigateToPostView?: (postId: string, options?: any) => void;
  onNavigateToProfile?: (profile: any) => void;
}

function formatTimeAgo(isoString?: string) {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function SavedPosts({
  onBack,
  onExplorePosts,
  onNavigateToPostView,
  onNavigateToProfile
}: SavedPostsProps) {
  const { user: currentUser } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsPost, setInsightsPost] = useState<any | null>(null);

  const fetchPosts = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSavedPosts(currentUser.id);
      setPosts(data || []);
    } catch (err) {
      console.error('[SavedPosts] Failed to load saved posts:', err);
      setError('Unable to load saved posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [currentUser?.id]);

  // When a post is unsaved, remove it immediately without page refresh
  const handleSaveToggle = (isSaved: boolean, postId: string) => {
    if (!isSaved) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const handlePostClick = (post: any) => {
    if (onNavigateToPostView) {
      onNavigateToPostView(post.id, {
        activeTab: 'profile',
        profileSubView: 'saved-posts',
        initialPost: post
      });
    }
  };

  return (
    <div
      className="saved-posts-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '720px',
        margin: '0 auto',
        padding: '16px 20px',
        minHeight: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid #cbd5e1'
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#2563eb',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '8px',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          ← Back
        </button>

        <h2
          style={{
            fontSize: '17px',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0
          }}
        >
          Saved Posts
        </h2>

        {/* Balance spacer */}
        <div style={{ width: '60px' }} />
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: '#64748b',
            fontSize: '14px',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '3px solid #cbd5e1',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}
          />
          <span>Loading saved posts...</span>
        </div>
      ) : error ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '50px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            textAlign: 'center',
            gap: '12px'
          }}
        >
          <span style={{ fontSize: '28px' }}>⚠️</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>
            {error}
          </span>
          <button
            type="button"
            onClick={fetchPosts}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      ) : posts.length === 0 ? (
        /* Empty State */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 24px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              marginBottom: '16px'
            }}
          >
            🔖
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', margin: '0 0 6px 0' }}>
            No Saved Posts Yet
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '280px', margin: '0 0 20px 0', lineHeight: '1.5' }}>
            Posts you save will appear here so you can easily revisit them anytime.
          </p>
          <button
            type="button"
            onClick={onExplorePosts}
            style={{
              padding: '9px 20px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '13.5px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}
          >
            Explore Posts
          </button>
        </div>
      ) : (
        /* Posts List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {posts.map((post) => {
            const isOwner = currentUser?.id && (post.user_id === currentUser.id || post.author_id === currentUser.id);
            const initials = (post.author || 'User')
              .split(' ')
              .filter(Boolean)
              .map((n: string) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase();

            return (
              <div
                key={post.id}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--fill-card, #ffffff)',
                  border: '1px solid var(--border-card, #cbd5e1)',
                  borderRadius: '14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                {/* Post Top Row: Domain Badge, Timestamp & Owner Info Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      padding: '2px 8px',
                      borderRadius: '8px'
                    }}
                  >
                    {post.domain_id || post.domain || 'Tech'}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Owner-only Info Button (strictly guarded) */}
                    {isOwner && (
                      <button
                        type="button"
                        className="post-info-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInsightsPost(post);
                        }}
                        title="Post Insights"
                        aria-label="Post Insights"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          transition: 'color 0.15s ease, background-color 0.15s ease'
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                      </button>
                    )}
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {formatTimeAgo(post.created_at)}
                    </span>
                  </div>
                </div>

                {/* Author Details (retains original post author) */}
                <div
                  style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', cursor: 'pointer' }}
                  onClick={() => {
                    if (onNavigateToProfile && (post.user_id || post.author_id)) {
                      onNavigateToProfile({
                        id: post.user_id || post.author_id,
                        name: post.author,
                        username: post.username,
                        avatar_url: post.avatar_url || post.avatarUrl
                      });
                    }
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#bcd5fa',
                      border: '1.5px solid #b5d2fd',
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
                    {post.avatar_url || post.avatarUrl ? (
                      <img src={(post.avatar_url || post.avatarUrl) ?? undefined} alt={post.author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div style={{ marginLeft: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                        {post.author}
                      </span>
                      {post.username && (
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                          @{post.username}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                      {post.role || 'Member'}
                    </span>
                  </div>
                </div>

                {/* Post Content Clickable area */}
                <div onClick={() => handlePostClick(post)} style={{ cursor: 'pointer' }}>
                  {post.title && (
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main, #1e293b)', margin: '0 0 6px 0' }}>
                      {post.title}
                    </h4>
                  )}
                  <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.45', margin: '0 0 8px 0', whiteSpace: 'pre-line' }}>
                    {post.content}
                  </p>

                  {/* Attached Media (Single Image, Video, Collage, Carousel) */}
                  <PostMedia
                    media={post.media}
                    layout={post.layout}
                    legacyImageUrl={post.mediaUrl || post.media_url || post.image_url}
                    legacyVideoUrl={post.video_url}
                    postType={post.post_type}
                    postId={post.id}
                  />
                </div>

                {/* Social Interactions Bar (Like, Comment, Share, Save) */}
                <PostCardInteractions
                  post={post}
                  onSaveToggle={(saved) => handleSaveToggle(saved, post.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Post Insights Modal (Owner-Only) */}
      {insightsPost && currentUser && (
        <PostInsightsModal
          post={insightsPost}
          postId={insightsPost.id}
          ownerId={currentUser.id}
          onClose={() => setInsightsPost(null)}
          onNavigateToProfile={onNavigateToProfile}
          onPostDeleted={(deletedId: string) => {
            setPosts((prev) => prev.filter((p) => p.id !== deletedId));
            setInsightsPost(null);
          }}
        />
      )}
    </div>
  );
}
