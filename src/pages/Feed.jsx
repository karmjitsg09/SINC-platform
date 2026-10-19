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
import TrendingTopicsWidget from '../components/TrendingTopicsWidget';
import WhoToFollowWidget from '../components/WhoToFollowWidget';
import QuickPostComposer from '../components/QuickPostComposer';
import {
  Link as LinkIcon,
  BarChart2,
  Share2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Copy
} from 'lucide-react';

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

function getCategoryLabel(categoryId) {
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
  showComposer = false
}) {
  const { user: currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [postNotFound, setPostNotFound] = useState(false);
  const [insightsPost, setInsightsPost] = useState(null);
  const [activeMenuPostId, setActiveMenuPostId] = useState(null);
  const [copiedPostId, setCopiedPostId] = useState(null);
  const postRefs = useRef({});
  const categoryScrollRef = useRef(null);

  const [internalCategory, setInternalCategory] = useState(selectedFeedCategory);

  useEffect(() => {
    setInternalCategory(selectedFeedCategory);
  }, [selectedFeedCategory]);

  const activeCategory = onSelectFeedCategory ? selectedFeedCategory : internalCategory;
  const categoryLabel = getCategoryLabel(activeCategory);

  // Load posts whenever active feed category changes
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setPostNotFound(false);

      const list = await getPostsByDomain(activeCategory);

      if (!isMounted) return;

      if (targetPostId) {
        const found = list.find((p) => p.id === targetPostId);
        if (found) {
          setPosts(list);
          setHighlightedPostId(targetPostId);
        } else {
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

    const unsub = subscribeToPosts(
      (newPost) => {
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
  }, [activeCategory, targetPostId]);

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

  const handleCopyPostLink = (post) => {
    const postUrl = `${window.location.origin}/#post-${post.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(postUrl);
      setCopiedPostId(post.id);
      setTimeout(() => setCopiedPostId(null), 2500);
    }
    setActiveMenuPostId(null);
  };

  const handleSelectCategory = (catId) => {
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
          onSelectUpdateCategory={onSelectUpdateCategory}
          onOpenStoryViewer={onOpenStoryViewer}
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
              const isOwner = currentUser?.id && (post.user_id === currentUser.id || post.author_id === currentUser.id);
              const isMenuOpen = activeMenuPostId === post.id;
              const isCopied = copiedPostId === post.id;

              return (
                <article
                  key={post.id}
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
                          <img src={post.avatar_url || post.avatarUrl} alt={post.author} className="avatar-img" />
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
                    <h2 className="post-card-title">{post.title}</h2>
                  )}

                  {/* Post Content */}
                  <div className="post-card-body">
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
                        <a href={post.mediaUrl || post.media_url} target="_blank" rel="noopener noreferrer">
                          {post.mediaUrl || post.media_url}
                        </a>
                      </div>
                    )}

                    {/* Attached Code Snippet */}
                    {(post.codeSnippet || post.code_snippet) && (
                      <div className="post-code-block">
                        <div className="code-block-header">
                          <span>{post.codeLanguage || post.code_language || 'code'}</span>
                        </div>
                        <pre>
                          <code>{post.codeSnippet || post.code_snippet}</code>
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Social Interactions: Likes, Comments, Share, Save */}
                  <PostCardInteractions post={post} />
                </article>
              );
            })
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
