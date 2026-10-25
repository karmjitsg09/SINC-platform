import React, { useState, useEffect } from 'react';
import { getPostById, FormattedPost } from '../lib/postService';
import { useAuth } from '../context/AuthContext';
import PostCardInteractions from '../components/PostCardInteractions';
import PostInsightsModal from '../components/PostInsightsModal';
import PostMedia from '../components/PostMedia';
import ProfileItemPostEmbed from '../components/profile/ProfileItemPostEmbed';
import { parseProfileItemRef } from '../lib/profileItemPostService';

function formatTimeAgo(isoString?: string | null): string {
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

export interface PostViewProps {
  postId?: string | null;
  initialPost?: FormattedPost | null;
  onBack?: () => void;
  onNavigateToProfile?: (user: any) => void;
}

export default function PostView({ postId, initialPost = null, onBack, onNavigateToProfile }: PostViewProps) {
  const { user: currentUser } = useAuth();
  const [post, setPost] = useState<FormattedPost | null>(initialPost);
  const [loading, setLoading] = useState<boolean>(!initialPost);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [showInsights, setShowInsights] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPost() {
      if (!postId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Only show full blocking loader if we have no initial post data
      if (!initialPost && !post) {
        setLoading(true);
      }
      setNotFound(false);

      try {
        const data = await getPostById(postId);
        if (isMounted) {
          if (data) {
            setPost(data);
            setNotFound(false);
          } else if (!initialPost && !post) {
            setPost(null);
            setNotFound(true);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('[PostView] Error loading post:', err);
        if (isMounted) {
          if (!initialPost && !post) {
            setPost(null);
            setNotFound(true);
          }
          setLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const initials = (post?.author || 'User')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="main-content post-view-page">
      <div className="content-card post-view-container">
        {/* Navigation Top Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', flexShrink: 0 }}>
          <button
            type="button"
            className="back-btn"
            onClick={onBack}
            aria-label="Back"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-main, #1e3860)',
              fontWeight: 600,
              fontSize: '14px',
              padding: '4px 8px',
              borderRadius: '8px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main, #1e3860)' }}>
            Post
          </span>
          <div style={{ width: '40px' }} /> {/* Spacer for balance */}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: '14px' }}>
            Loading post...
          </div>
        )}

        {/* Not Found State */}
        {!loading && (notFound || !post) && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #1e3860)', margin: '0 0 8px 0' }}>
              This post is no longer available.
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              The post may have been deleted or the link is invalid.
            </p>
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 20px',
                borderRadius: '12px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Go Back
            </button>
          </div>
        )}

        {/* Loaded Post Display */}
        {!loading && post && (
          <div className="feed-card-inner post-view-card">
            {/* Domain Badge & Timestamp */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  padding: '4px 12px',
                  borderRadius: '10px'
                }}
              >
                {post.domain || 'tech'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {currentUser?.id && (post.user_id === currentUser.id || post.author_id === currentUser.id) && (
                  <button
                    type="button"
                    className="post-info-btn"
                    onClick={() => setShowInsights(true)}
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
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {formatTimeAgo(post.created_at)}
                </span>
              </div>
            </div>

            {/* Author Row */}
            <div className="feed-user-row" style={{ marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#bcd5fa',
                  border: '1.5px solid #b5d2fd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
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

              <div className="feed-user-lines" style={{ marginLeft: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #1e3860)' }}>
                    {post.author}
                  </span>
                  {post.username && (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      @{post.username}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                  {post.role || 'Member'}
                </span>
              </div>
            </div>

            {/* Post Content */}
            <div className="feed-post-lines" style={{ marginBottom: '16px' }}>
              {(() => {
                const { caption, itemRef } = parseProfileItemRef(post.content);
                return (
                  <>
                    {caption && (
                      <p style={{ fontSize: '14px', color: 'var(--text-main, #1e3860)', lineHeight: 1.6, margin: '0 0 12px 0', whiteSpace: 'pre-line', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {caption}
                      </p>
                    )}
                    {itemRef && <ProfileItemPostEmbed itemRef={itemRef} />}
                  </>
                );
              })()}

              {/* Media: Single Image, Video, Collage, or Carousel */}
              <PostMedia
                media={post.media}
                layout={post.layout}
                legacyImageUrl={post.mediaUrl || post.media_url || post.image_url}
                legacyVideoUrl={post.video_url}
                postType={post.post_type}
              />

              {/* Attached Link */}
              {(post.mediaUrl || post.media_url) && (post.mediaType === 'link' || post.media_type === 'link') && (
                <div style={{ marginTop: '12px', padding: '12px 16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <a href={(post.mediaUrl || post.media_url) ?? undefined} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}>
                    🔗 {post.mediaUrl || post.media_url}
                  </a>
                </div>
              )}

              {/* Attached Code Snippet */}
              {(post.codeSnippet || (post as any).code_snippet) && (
                <pre style={{ marginTop: '12px', padding: '14px 16px', background: '#0f172a', color: '#38bdf8', borderRadius: '12px', fontSize: '12.5px', fontFamily: 'monospace', overflowX: 'auto' }}>
                  <code>{post.codeSnippet || (post as any).code_snippet}</code>
                </pre>
              )}
            </div>

            {/* Social Interaction Buttons (Like, Comment, Share, Save) */}
            <PostCardInteractions post={post} />
          </div>
        )}

        {/* Dedicated Post Insights Modal (Owner-Only) */}
        {showInsights && currentUser && post && (
          <PostInsightsModal
            post={post}
            postId={post.id}
            ownerId={currentUser.id}
            onClose={() => setShowInsights(false)}
            onNavigateToProfile={onNavigateToProfile}
            onPostDeleted={() => {
              setShowInsights(false);
              if (onBack) {
                onBack();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
