import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FEED_CATEGORIES, getCategoryMatchValues } from '../data/mockData';
import { getPostsByDomain, getPostById, subscribeToPosts, FormattedPost } from '../lib/postService';
import { getBatchPostInteractionSummaries, subscribeToFeedInteractions } from '../lib/postInteractionService';
import { useAuth } from '../context/AuthContext';
import PostCardInteractions from '../components/PostCardInteractions';
import PostInsightsModal from '../components/PostInsightsModal';
import PostMedia from '../components/PostMedia';
import ProfileItemPostEmbed from '../components/profile/ProfileItemPostEmbed';
import { parseProfileItemRef } from '../lib/profileItemPostService';
import UpdatesStories, { UpdateGroup } from '../components/UpdatesStories';
import TrendingTopicsWidget from '../components/TrendingTopicsWidget';
import WhoToFollowWidget, { WhoToFollowUser } from '../components/WhoToFollowWidget';
import QuickPostComposer from '../components/QuickPostComposer';
import {
  Link as LinkIcon,
  BarChart2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Copy
} from 'lucide-react';

export interface FeedProps {
  selectedFeedCategory?: string;
  onSelectFeedCategory?: (categoryId: string) => void;
  selectedUpdateCategory?: string;
  onSelectUpdateCategory?: (categoryId: string) => void;
  onOpenStoryViewer?: (group: UpdateGroup, allGroups: UpdateGroup[]) => void;
  targetPostId?: string | null;
  onClearTargetPostId?: () => void;
  onNavigateToProfile?: (user: { id?: string; name?: string; [key: string]: any }) => void;
  onOpenCreatePost?: (type: string) => void;
  onNavigateToPostView?: (postId: string, options?: { activeTab?: string; initialPost?: any }) => void;
  showComposer?: boolean;
}

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

function getCategoryLabel(categoryId?: string): string {
  if (!categoryId || categoryId === 'all') return 'All';
  const found = FEED_CATEGORIES.find((c) => c.id === categoryId);
  return found ? found.name : categoryId;
}

export default function Feed({
  selectedFeedCategory = 'all',
  onSelectFeedCategory,
  selectedUpdateCategory = 'all',
  onSelectUpdateCategory,
  onOpenStoryViewer,
  targetPostId = null,
  onClearTargetPostId,
  onNavigateToProfile,
  onOpenCreatePost,
  onNavigateToPostView,
  showComposer = false
}: FeedProps) {
  const { user: currentUser } = useAuth();
  const [posts, setPosts] = useState<FormattedPost[]>([]);
  const [interactionMap, setInteractionMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [postNotFound, setPostNotFound] = useState<boolean>(false);
  const [insightsPost, setInsightsPost] = useState<FormattedPost | null>(null);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const postRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [internalCategory, setInternalCategory] = useState<string>(selectedFeedCategory);

  useEffect(() => {
    setInternalCategory(selectedFeedCategory);
  }, [selectedFeedCategory]);

  const activeCategory = onSelectFeedCategory ? selectedFeedCategory : internalCategory;
  const categoryLabel = getCategoryLabel(activeCategory);

  // Helper to fetch batch interactions for given posts
  const fetchInteractionsForPosts = useCallback(async (postsList: FormattedPost[]) => {
    if (!postsList || postsList.length === 0) return;
    const postIds = postsList.map((p) => p.id).filter(Boolean);
    if (postIds.length === 0) return;
    try {
      const summaries = await getBatchPostInteractionSummaries(postIds, currentUser?.id);
      setInteractionMap((prev) => ({ ...prev, ...summaries }));
    } catch (err) {
      console.warn('[Feed] Error fetching batch interactions:', err);
    }
  }, [currentUser?.id]);

  // Initial load when activeCategory or targetPostId changes
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setPostNotFound(false);
      setPage(0);
      setHasMore(true);

      const list = await getPostsByDomain(activeCategory, 0, 15);

      if (!isMounted) return;

      let finalPosts = list;
      if (list.length < 15) {
        setHasMore(false);
      }

      if (targetPostId) {
        const found = list.find((p) => p.id === targetPostId);
        if (found) {
          finalPosts = list;
          setHighlightedPostId(targetPostId);
        } else {
          const single = await getPostById(targetPostId);
          if (isMounted) {
            if (single) {
              finalPosts = [single, ...list.filter((p) => p.id !== single.id)];
              setHighlightedPostId(targetPostId);
            } else {
              finalPosts = list;
              setPostNotFound(true);
            }
          }
        }
      }

      setPosts(finalPosts);
      setLoading(false);

      // Fetch batch interaction summaries in parallel
      fetchInteractionsForPosts(finalPosts);
    }

    load();

    const unsub = subscribeToPosts(
      (newPost: FormattedPost) => {
        if (!isMounted) return;
        const isAll = !activeCategory || activeCategory === 'all';
        const matchValues = getCategoryMatchValues(activeCategory);
        const matchesCategory =
          isAll ||
          (newPost.domain &&
            (matchValues.length > 0
              ? matchValues.includes(newPost.domain.toLowerCase())
              : newPost.domain.toLowerCase() === activeCategory.toLowerCase()));

        if (matchesCategory) {
          setPosts((prev) => {
            const exists = prev.some((p) => p.id === newPost.id);
            if (exists) return prev;
            return [newPost, ...prev];
          });
          fetchInteractionsForPosts([newPost]);
        }
      },
      (deletedPostId: string) => {
        if (!isMounted) return;
        setPosts((prev) => prev.filter((p) => p.id !== deletedPostId));
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [activeCategory, targetPostId, fetchInteractionsForPosts]);

  // Central subscription for all loaded feed posts' interactions
  useEffect(() => {
    const postIds = posts.map((p) => p.id).filter(Boolean);
    if (postIds.length === 0) return;

    const unsub = subscribeToFeedInteractions(postIds, (updatedSummary: any) => {
      if (!updatedSummary || !updatedSummary.postId) return;
      setInteractionMap((prev) => ({
        ...prev,
        [updatedSummary.postId]: {
          ...(prev[updatedSummary.postId] || {}),
          ...updatedSummary
        }
      }));
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [posts]);

  // Load next page of posts
  const loadMorePosts = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);

    const nextPage = page + 1;
    try {
      const nextList = await getPostsByDomain(activeCategory, nextPage, 15);
      if (!nextList || nextList.length < 15) {
        setHasMore(false);
      }

      if (nextList && nextList.length > 0) {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = nextList.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
        fetchInteractionsForPosts(nextList);
      }
    } catch (err) {
      console.error('[Feed] loadMorePosts error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, page, activeCategory, fetchInteractionsForPosts]);

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    if (loading || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          loadMorePosts();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, loadMorePosts]);

  // Scroll to targeted post
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

  const handleCopyPostLink = (post: FormattedPost) => {
    const postUrl = `${window.location.origin}/#post-${post.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(postUrl);
      setCopiedPostId(post.id);
      setTimeout(() => setCopiedPostId(null), 2500);
    }
    setActiveMenuPostId(null);
  };

  const handleSelectCategory = (catId: string) => {
    if (onSelectFeedCategory) {
      onSelectFeedCategory(catId);
    }
    setInternalCategory(catId);
  };

  const currentUserInitials = (currentUser?.name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="home-feed-layout">
      {/* Center Feed Column */}
      <main className="feed-primary-column">
        {/* 1. Stories Strip */}
        <UpdatesStories
          selectedUpdateCategory={selectedUpdateCategory}
          onSelectUpdateCategory={onSelectUpdateCategory || (() => {})}
          onOpenStoryViewer={onOpenStoryViewer || (() => {})}
        />

        {/* 2. Category Filter Pills Bar */}
        <section className="feed-category-bar-wrapper" aria-label="Category Filters">
          <div className="feed-category-bar" ref={categoryScrollRef}>
            {FEED_CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`feed-category-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectCategory(cat.id)}
                  aria-pressed={isSelected}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Quick Post Creation Prompt Box (Conditionally rendered when showComposer is true) */}
        {showComposer && (
          <QuickPostComposer
            currentUser={currentUser}
            currentUserInitials={currentUserInitials}
            onOpenCreatePost={onOpenCreatePost}
          />
        )}

        {/* 4. Post Not Found Notice */}
        {postNotFound && (
          <div className="post-not-found-banner" role="alert">
            <div className="banner-content">
              <AlertCircle size={18} className="text-red" />
              <span>This post is no longer available or was removed.</span>
            </div>
            <button
              type="button"
              onClick={() => setPostNotFound(false)}
              className="banner-close-btn"
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* 5. Posts Feed Stream */}
        <div className="feed-posts-stream">
          {loading ? (
            <div className="feed-loading-skeleton">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          ) : posts.length === 0 ? (
            <div className="feed-empty-state-card" role="region" aria-label="No posts found">
              <div className="empty-state-icon-wrapper" aria-hidden="true">
                <Sparkles size={32} className="empty-state-icon" />
              </div>
              <h3 className="empty-state-title">
                {activeCategory === 'all'
                  ? 'No posts in the network yet'
                  : `No posts in ${categoryLabel} yet`}
              </h3>
              <p className="empty-state-description">
                Be the first to share an update, start a discussion, or publish a project in this community.
              </p>
              <button
                type="button"
                className="empty-create-post-btn"
                onClick={() => onOpenCreatePost?.('none')}
                aria-label="Create the first post"
              >
                <span className="btn-plus-icon">+</span>
                <span>Create the First Post</span>
              </button>
            </div>
          ) : (
            posts.map((post) => {
              const initials = (post.author || 'User')
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

              const isHighlighted = highlightedPostId === post.id;
              const isOwner = !!(currentUser?.id && (post.user_id === currentUser.id || post.author_id === currentUser.id));
              const isMenuOpen = activeMenuPostId === post.id;
              const isCopied = copiedPostId === post.id;

              return (
                <article
                  key={post.id}
                  data-post-id={post.id}
                  ref={(el) => { if (el) postRefs.current[post.id] = el; }}
                  className={`feed-post-card ${isHighlighted ? 'highlighted-post' : ''}`}
                >
                  {/* Post Header */}
                  <div className="post-card-header">
                    <div
                      className="post-author-block"
                      onClick={() => onNavigateToProfile && onNavigateToProfile({ id: post.user_id || post.author_id, name: post.author })}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="post-author-avatar">
                        {post.avatar_url || post.avatarUrl ? (
                          <img src={(post.avatar_url || post.avatarUrl) ?? undefined} alt={post.author} className="avatar-img" />
                        ) : (
                          <span className="avatar-initials">{initials}</span>
                        )}
                      </div>

                      <div className="post-author-details">
                        <div className="author-name-row">
                          <span className="author-display-name">{post.author}</span>
                          {post.username && (
                            <span className="author-username">@{post.username}</span>
                          )}
                        </div>
                        <div className="post-submeta-row">
                          <span className="author-role">{post.role || 'Member'}</span>
                          <span className="meta-bullet">•</span>
                          <span className="post-timestamp" title={new Date(post.created_at).toLocaleString()}>
                            {formatTimeAgo(post.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="post-header-actions">
                      <span className="post-domain-badge">
                        {post.domain || 'Tech'}
                      </span>

                      {/* Post Options Dropdown Menu */}
                      <div className="post-overflow-menu-wrapper">
                        <button
                          type="button"
                          className="post-overflow-btn"
                          onClick={() => setActiveMenuPostId(isMenuOpen ? null : post.id)}
                          aria-label="Post options"
                          title="More options"
                        >
                          <MoreHorizontal size={17} />
                        </button>

                        {isMenuOpen && (
                          <div className="post-dropdown-menu">
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => handleCopyPostLink(post)}
                            >
                              {isCopied ? <CheckCircle2 size={14} className="text-green" /> : <Copy size={14} />}
                              <span>{isCopied ? 'Link Copied!' : 'Copy Link'}</span>
                            </button>

                            {isOwner && (
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  setActiveMenuPostId(null);
                                  setInsightsPost(post);
                                }}
                              >
                                <BarChart2 size={14} />
                                <span>Post Insights</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Post Title */}
                  {post.title && post.title !== 'Post' && (
                    <h2
                      className="post-card-title"
                      onClick={() => onNavigateToPostView && onNavigateToPostView(post.id, { activeTab: 'home', initialPost: post })}
                      style={{ cursor: onNavigateToPostView ? 'pointer' : 'default' }}
                    >
                      {post.title}
                    </h2>
                  )}

                  {/* Post Content */}
                  <div
                    className="post-card-body"
                    onClick={(e: React.MouseEvent) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('a') || target.closest('button') || target.closest('pre') || target.closest('input')) return;
                      if (onNavigateToPostView) onNavigateToPostView(post.id, { activeTab: 'home', initialPost: post });
                    }}
                    style={{ cursor: onNavigateToPostView ? 'pointer' : 'default' }}
                  >
                    {(() => {
                      const { caption, itemRef } = parseProfileItemRef(post.content);
                      return (
                        <>
                          {caption && (
                            <p className="post-caption-text">{caption}</p>
                          )}
                          {itemRef && <ProfileItemPostEmbed itemRef={itemRef} />}
                        </>
                      );
                    })()}

                    {/* Media Attachments: Single, Collage, Carousel, Video */}
                    <PostMedia
                      media={post.media}
                      layout={post.layout}
                      legacyImageUrl={post.mediaUrl || post.media_url || post.image_url}
                      legacyVideoUrl={post.video_url}
                      postType={post.post_type}
                    />

                    {/* Attached Link */}
                    {(post.mediaUrl || post.media_url) && (post.mediaType === 'link' || post.media_type === 'link') && (
                      <div className="post-attached-link-box">
                        <LinkIcon size={14} className="text-blue" />
                        <a href={(post.mediaUrl || post.media_url) ?? undefined} target="_blank" rel="noopener noreferrer">
                          {post.mediaUrl || post.media_url}
                        </a>
                      </div>
                    )}

                    {/* Attached Code Snippet */}
                    {(post.codeSnippet || (post as any).code_snippet) && (
                      <div className="post-code-block">
                        <div className="code-block-header">
                          <span>{(post as any).codeLanguage || (post as any).code_language || 'code'}</span>
                        </div>
                        <pre>
                          <code>{post.codeSnippet || (post as any).code_snippet}</code>
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Social Interactions: Likes, Comments, Share, Save (Batched initial data) */}
                  <PostCardInteractions
                    post={post}
                    initialSummary={interactionMap[post.id]}
                    disableIndividualFetch={true}
                  />
                </article>
              );
            })
          )}

          {/* Sentinel for infinite scroll pagination */}
          {posts.length > 0 && (
            <div
              ref={sentinelRef}
              className="feed-infinite-scroll-sentinel"
              style={{
                padding: '16px 0',
                textAlign: 'center',
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '13px'
              }}
            >
              {loadingMore ? (
                <div className="feed-loading-more-indicator">Loading more posts...</div>
              ) : !hasMore ? (
                <div className="feed-caught-up-text">You've reached the end of the feed</div>
              ) : null}
            </div>
          )}
        </div>

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
      </main>

      {/* Right Column: Trending Topics & Who To Follow */}
      <aside className="feed-contextual-column" aria-label="Contextual Widgets">
        <div className="contextual-sticky-wrapper">
          <TrendingTopicsWidget
            selectedCategory={selectedFeedCategory}
            onSelectCategory={handleSelectCategory}
          />

          <WhoToFollowWidget
            onNavigateToProfile={onNavigateToProfile}
          />
        </div>
      </aside>
    </div>
  );
}
