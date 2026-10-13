import React, { useState, useEffect, useRef } from 'react';
import { FEED_CATEGORIES, getCategoryMatchValues } from '../data/mockData';
import { getPostsByDomain, getPostById, subscribeToPosts } from '../lib/postService';
import { useAuth } from '../context/AuthContext';
import PostCardInteractions from '../components/PostCardInteractions';
import PostInsightsModal from '../components/PostInsightsModal';
import PostMedia from '../components/PostMedia';
import ProfileItemPostEmbed from '../components/profile/ProfileItemPostEmbed';
import { parseProfileItemRef } from '../lib/profileItemPostService';
import UpdatesStories from '../components/UpdatesStories';

function formatTimeAgo(isoString) {
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

// Derive a human-readable label for any category id
function getCategoryLabel(categoryId) {
  if (!categoryId || categoryId === 'all') return 'All';
  const found = FEED_CATEGORIES.find((c) => c.id === categoryId);
  return found ? found.name : categoryId;
}

export default function Feed({
  // Feed category — set by Home rail, completely independent of domain state
  selectedFeedCategory = 'all',
  selectedUpdateCategory = 'all',
  onSelectUpdateCategory,
  onOpenStoryViewer,
  targetPostId = null,
  onClearTargetPostId,
  onNavigateToProfile
}) {
  const { user: currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [postNotFound, setPostNotFound] = useState(false);
  const [insightsPost, setInsightsPost] = useState(null);
  const postRefs = useRef({});

  const categoryLabel = getCategoryLabel(selectedFeedCategory);

  // ── Load posts whenever the selected feed category changes ─────────────────
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setPostNotFound(false);

      // 'all' → fetch every post, otherwise filter by category id
      const list = await getPostsByDomain(selectedFeedCategory);

      if (!isMounted) return;

      if (targetPostId) {
        const found = list.find((p) => p.id === targetPostId);
        if (found) {
          setPosts(list);
          setHighlightedPostId(targetPostId);
        } else {
          // Try fetching targeted post directly from Supabase
          const single = await getPostById(targetPostId);
          if (isMounted) {
            if (single) {
              setPosts([single, ...list.filter((p) => p.id !== single.id)]);
              setHighlightedPostId(targetPostId);
            } else {
              setPosts(list);
              setPostNotFound(true);
            }
          }
        }
      } else {
        setPosts(list);
      }

      setLoading(false);
    }

    load();

    // ── Realtime: only inject new posts that match the active category ───────
    const unsub = subscribeToPosts(
      (newPost) => {
        if (!isMounted) return;
        const isAll = !selectedFeedCategory || selectedFeedCategory === 'all';
        const matchValues = getCategoryMatchValues(selectedFeedCategory);
        const matchesCategory =
          isAll ||
          (newPost.domain && (matchValues.length > 0 ? matchValues.includes(newPost.domain.toLowerCase()) : newPost.domain.toLowerCase() === selectedFeedCategory.toLowerCase()));

        if (matchesCategory) {
          setPosts((prev) => {
            const exists = prev.some((p) => p.id === newPost.id);
            if (exists) return prev;
            return [newPost, ...prev];
          });
        }
      },
      (deletedPostId) => {
        if (!isMounted) return;
        setPosts((prev) => prev.filter((p) => p.id !== deletedPostId));
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [selectedFeedCategory, targetPostId]);

  // ── Scroll to highlighted post after load ──────────────────────────────────
  useEffect(() => {
    if (!loading && highlightedPostId) {
      const timer = setTimeout(() => {
        const el = postRefs.current[highlightedPostId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      const clearHighlightTimer = setTimeout(() => {
        setHighlightedPostId(null);
        if (onClearTargetPostId) onClearTargetPostId();
      }, 4000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearHighlightTimer);
      };
    }
  }, [loading, highlightedPostId, onClearTargetPostId]);

  return (
    <div className="main-content">
      <UpdatesStories
        selectedUpdateCategory={selectedUpdateCategory}
        onSelectUpdateCategory={onSelectUpdateCategory}
        onOpenStoryViewer={onOpenStoryViewer}
      />

      {/* Main Feed Scroll Container */}
      <div className="feed-scroll-container">
        {postNotFound && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1.5px solid #fecaca',
              borderRadius: '14px',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span>This post is no longer available or has been deleted.</span>
            </div>
            <button
              type="button"
              onClick={() => setPostNotFound(false)}
              style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', padding: '2px 6px' }}
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '14px' }}>
            Loading feed...
          </div>
        ) : posts.length === 0 ? (
          <div className="feed-card-inner">
            <div className="feed-media-box">
              <svg className="feed-media-svg" viewBox="0 0 500 140" preserveAspectRatio="none">
                <path
                  d="M 0 110 Q 120 70 250 90 T 460 30 Q 480 50 500 40"
                  fill="none"
                  stroke="#8cb6fc"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="feed-user-row">
              <div className="feed-user-avatar" />
              <div className="feed-user-lines">
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                  Community Admin
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Administrator
                </span>
              </div>
            </div>
            <h2 className="feed-post-title">
              No {categoryLabel} posts yet
            </h2>
            <div className="feed-post-lines">
              <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.4', marginBottom: '4px' }}>
                {selectedFeedCategory === 'all'
                  ? 'Be the first to share thoughts or insights.'
                  : `Be the first to share something in the ${categoryLabel} feed.`}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Go to your Profile to create a new post.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {posts.map((post) => {
              const initials = (post.author || 'User')
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

              const isHighlighted = highlightedPostId === post.id;

              return (
                <div
                  key={post.id}
                  ref={(el) => { if (el) postRefs.current[post.id] = el; }}
                  className="feed-card-inner"
                  style={{
                    marginBottom: 0,
                    outline: isHighlighted ? '2px solid #3b82f6' : 'none',
                    boxShadow: isHighlighted ? '0 0 0 4px rgba(59, 130, 246, 0.25), 0 10px 25px -5px rgba(59, 130, 246, 0.2)' : undefined,
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        padding: '3px 10px',
                        borderRadius: '8px'
                      }}
                    >
                      {post.domain || selectedFeedCategory}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {currentUser?.id && (post.user_id === currentUser.id || post.author_id === currentUser.id) && (
                        <button
                          type="button"
                          className="post-info-btn"
                          onClick={() => setInsightsPost(post)}
                          title="Post Insights"
                          aria-label="Post Insights"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px 4px', color: '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '50%', transition: 'color 0.15s ease, background-color 0.15s ease'
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </button>
                      )}
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {formatTimeAgo(post.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="feed-user-row" style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '38px', height: '38px', borderRadius: '50%',
                        backgroundColor: '#bcd5fa', border: '1.5px solid #b5d2fd',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '600', fontSize: '13px', color: '#1e3860',
                        overflow: 'hidden', flexShrink: 0
                      }}
                    >
                      {post.avatar_url || post.avatarUrl ? (
                        <img src={post.avatar_url || post.avatarUrl} alt={post.author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>

                    <div className="feed-user-lines" style={{ marginLeft: '10px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
                        {post.author}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
                        {post.role || 'Member'}
                      </span>
                    </div>
                  </div>

                  <h2 className="feed-post-title" style={{ fontSize: '16px', margin: '0 0 8px 0' }}>
                    {post.title}
                  </h2>

                  <div className="feed-post-lines">
                    {(() => {
                      const { caption, itemRef } = parseProfileItemRef(post.content);
                      return (
                        <>
                          {caption && (
                            <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5', margin: '0 0 8px 0', whiteSpace: 'pre-line' }}>
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
                      <div style={{ marginTop: '10px', padding: '10px 14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                        <a href={post.mediaUrl || post.media_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}>
                          🔗 {post.mediaUrl || post.media_url}
                        </a>
                      </div>
                    )}

                    {/* Attached Code Snippet */}
                    {(post.codeSnippet || post.code_snippet) && (
                      <pre style={{ marginTop: '10px', padding: '12px 14px', background: '#0f172a', color: '#38bdf8', borderRadius: '10px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto' }}>
                        <code>{post.codeSnippet || post.code_snippet}</code>
                      </pre>
                    )}
                  </div>

                  {/* Social Interaction Buttons Row (Like, Comment, Share, Save) */}
                  <PostCardInteractions post={post} />
                </div>
              );
            })}
          </div>
        )}

        {/* Dedicated Post Insights Modal (Owner-Only) */}
        {insightsPost && currentUser && (
          <PostInsightsModal
            post={insightsPost}
            postId={insightsPost.id}
            ownerId={currentUser.id}
            onClose={() => setInsightsPost(null)}
            onNavigateToProfile={onNavigateToProfile}
            onPostDeleted={(deletedId) => {
              setPosts((prev) => prev.filter((p) => p.id !== deletedId));
              setInsightsPost(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
