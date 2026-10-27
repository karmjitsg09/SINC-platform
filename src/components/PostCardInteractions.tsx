import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageSquare, Share2, Bookmark } from 'lucide-react';
import {
  getPostInteractionSummary,
  likePost,
  addComment,
  getComments,
  deleteComment,
  toggleSavePost,
  subscribeToPostInteractions,
  PostInteractionSummary
} from '../lib/postInteractionService';
import InAppShareModal from './InAppShareModal';
import PostLikersModal from './PostLikersModal';
import { useToast } from '../context/ToastContext';

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

export interface PostCardInteractionsProps {
  post: any;
  initialSummary?: PostInteractionSummary | null;
  onSaveToggle?: (saved: boolean, postId: string) => void;
  disableIndividualFetch?: boolean;
}

export default function PostCardInteractions({
  post,
  initialSummary = null,
  onSaveToggle,
  disableIndividualFetch = false
}: PostCardInteractionsProps) {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [likeCount, setLikeCount] = useState<number>(initialSummary?.likeCount ?? post?.likes_count ?? 0);
  const [commentCount, setCommentCount] = useState<number>(initialSummary?.commentCount ?? post?.comments_count ?? 0);
  const [shareCount, setShareCount] = useState<number>(initialSummary?.shareCount ?? 0);
  const [saveCount, setSaveCount] = useState<number>(initialSummary?.saveCount ?? 0);
  const [isLiked, setIsLiked] = useState<boolean>(initialSummary?.likedByMe ?? false);
  const [isSaved, setIsSaved] = useState<boolean>(initialSummary?.savedByMe ?? false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage] = useState('');

  // Sync state whenever parent passes an updated batch summary
  useEffect(() => {
    if (initialSummary) {
      setLikeCount(initialSummary.likeCount);
      setCommentCount(initialSummary.commentCount);
      setShareCount(initialSummary.shareCount);
      setSaveCount(initialSummary.saveCount);
      setIsLiked(initialSummary.likedByMe);
      setIsSaved(initialSummary.savedByMe);
    }
  }, [initialSummary]);

  const fetchInteractions = useCallback(async () => {
    if (!post?.id) return;
    const summary = await getPostInteractionSummary(post.id, currentUser?.id);
    setLikeCount(summary.likeCount);
    setCommentCount(summary.commentCount);
    setShareCount(summary.shareCount);
    setSaveCount(summary.saveCount);
    setIsLiked(summary.likedByMe);
    setIsSaved(summary.savedByMe);
  }, [post?.id, currentUser?.id]);

  // Only run individual REST query and per-post WebSocket channel if NOT batched by parent
  useEffect(() => {
    if (disableIndividualFetch || initialSummary) return;
    fetchInteractions();
    const unsub = subscribeToPostInteractions(post?.id, fetchInteractions);
    return () => unsub();
  }, [post?.id, disableIndividualFetch, initialSummary, fetchInteractions]);

  // 1. LIKE / UNLIKE HANDLER (TRIGGERS ONLY ON HEART CLICK)
  const handleLike = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser?.id) {
      toast.warning('Please sign in to like posts.');
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const prevLiked = isLiked;
    const prevCount = likeCount;

    // Optimistic UI update
    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await likePost(post.id, currentUser.id, post.author_id);
      setIsLiked(res.liked);
      setLikeCount(res.count);
    } catch (err) {
      console.error('[PostCardInteractions] Like error:', err);
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
      toast.error('Unable to update like. Please try again.');
    } finally {
      setIsLiking(false);
    }
  };

  // 1B. OPEN LIKERS LIST (TRIGGERS WHEN CLICKING LIKE COUNT TEXT)
  const handleOpenLikers = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (likeCount > 0) {
      setShowLikersModal(true);
    }
  };

  // 2. TOGGLE COMMENTS
  const handleToggleComments = async () => {
    const nextState = !showComments;
    setShowComments(nextState);

    if (nextState && post?.id) {
      setLoadingComments(true);
      const list = await getComments(post.id);
      setComments(list);
      setLoadingComments(false);
    }
  };

  // 3. SUBMIT COMMENT
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) {
      toast.warning('Please sign in to comment.');
      return;
    }
    if (!commentText.trim() || isSubmittingComment) return;

    const textToSubmit = commentText.trim();
    setIsSubmittingComment(true);
    setCommentText('');

    try {
      const newComment = await addComment(post.id, currentUser.id, textToSubmit, post.author_id);
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
        setCommentCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('[PostCardInteractions] Comment error:', err);
      setCommentText(textToSubmit);
      toast.error('Unable to post comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 4. DELETE COMMENT
  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser?.id || !commentId) return;

    try {
      const ok = await deleteComment(commentId, currentUser.id);
      if (ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentCount((prev) => Math.max(0, prev - 1));
      } else {
        toast.error('Unable to delete comment.');
      }
    } catch (err) {
      console.error('[PostCardInteractions] Delete comment error:', err);
      toast.error('Unable to delete comment. Please try again.');
    }
  };

  // 5. SHARE HANDLER (OPENS IN-APP SHARE SELECTION MODAL)
  const handleOpenShare = () => {
    if (!currentUser?.id) {
      toast.warning('Please sign in to share posts.');
      return;
    }
    setShowShareModal(true);
  };

  // 6. SAVE / UNSAVE HANDLER
  const handleSave = async () => {
    if (!currentUser?.id) {
      toast.warning('Please sign in to save posts.');
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    const prevSaved = isSaved;
    const prevCount = saveCount;

    // Optimistic UI update
    setIsSaved(!prevSaved);
    setSaveCount(prevSaved ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await toggleSavePost(post.id, currentUser.id);
      setIsSaved(res.saved);
      setSaveCount(res.count);
      if (onSaveToggle) {
        onSaveToggle(res.saved, post.id);
      }
    } catch (err) {
      console.error('[PostCardInteractions] Save error:', err);
      setIsSaved(prevSaved);
      setSaveCount(prevCount);
      toast.error('Unable to update save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="post-interactions-container" style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle, #263750)', paddingTop: '10px' }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--success, #10b981)',
            backgroundColor: 'var(--success-surface, rgba(16, 185, 129, 0.15))',
            padding: '6px 12px',
            borderRadius: '8px',
            marginBottom: '8px',
            textAlign: 'center',
            fontWeight: '600',
            border: '1px solid var(--success, #10b981)'
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Interaction Buttons Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Like Group: Heart icon toggles like; Count text opens Likers Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: '16px',
            backgroundColor: isLiked ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
            padding: '2px 8px',
            border: isLiked ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <button
            type="button"
            onClick={handleLike}
            disabled={isLiking}
            title={isLiked ? 'Unlike' : 'Like'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              color: isLiked ? '#ef4444' : 'var(--text-secondary, #a7b5ca)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Heart size={16} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
          </button>

          <button
            type="button"
            onClick={handleOpenLikers}
            disabled={likeCount === 0}
            title={likeCount > 0 ? 'View who liked this post' : ''}
            style={{
              background: 'none',
              border: 'none',
              cursor: likeCount > 0 ? 'pointer' : 'default',
              padding: '4px 6px',
              color: isLiked ? '#ef4444' : 'var(--text-primary, #f3f6fc)',
              fontWeight: isLiked ? '700' : '600',
              fontSize: '13px'
            }}
          >
            <span>{likeCount}</span>
          </button>
        </div>

        {/* Comment Button */}
        <button
          type="button"
          onClick={handleToggleComments}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '16px',
            color: showComments ? 'var(--bright-blue, #438eff)' : 'var(--text-secondary, #a7b5ca)',
            backgroundColor: showComments ? 'var(--blue-surface, #142b4d)' : 'transparent',
            fontWeight: '600',
            fontSize: '13px',
            transition: 'all 0.15s ease'
          }}
        >
          <MessageSquare size={16} />
          <span>{commentCount}</span>
        </button>

        {/* In-App Share Button */}
        <button
          type="button"
          onClick={handleOpenShare}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '16px',
            color: 'var(--text-secondary, #a7b5ca)',
            fontWeight: '600',
            fontSize: '13px',
            transition: 'all 0.15s ease'
          }}
        >
          <Share2 size={16} />
          <span>{shareCount > 0 ? shareCount : 'Share'}</span>
        </button>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{
            background: isSaved ? 'var(--blue-surface, #142b4d)' : 'none',
            border: isSaved ? '1px solid rgba(40, 120, 255, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '16px',
            color: isSaved ? 'var(--bright-blue, #438eff)' : 'var(--text-secondary, #a7b5ca)',
            fontWeight: isSaved ? '700' : '600',
            fontSize: '13px',
            transition: 'all 0.15s ease'
          }}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Expandable Comments Drawer */}
      {showComments && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle, #263750)', paddingTop: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary, #f3f6fc)' }}>
            Comments ({commentCount})
          </h4>

          {/* Comments List */}
          {loadingComments ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #7e8ea7)', textAlign: 'center', padding: '10px 0' }}>
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #7e8ea7)', fontStyle: 'italic', marginBottom: '10px' }}>
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '240px', overflowY: 'auto' }}>
              {comments.map((c) => {
                const isAuthor = currentUser?.id === c.user_id;
                const initials = (c.profile?.name || 'User')
                  .split(' ')
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'var(--bg-surface, #0d1624)',
                      border: '1px solid var(--border-subtle, #1c2b40)',
                      borderRadius: '10px'
                    }}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--blue-surface, #142b4d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', color: 'var(--bright-blue, #438eff)', overflow: 'hidden', flexShrink: 0 }}>
                      {c.profile?.avatar_url ? (
                        <img src={c.profile.avatar_url} alt={c.profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        initials
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary, #f3f6fc)' }}>
                          {c.profile?.name}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted, #7e8ea7)' }}>
                          {formatTimeAgo(c.created_at)}
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary, #a7b5ca)', lineHeight: '1.4' }}>
                        {c.content}
                      </p>
                    </div>

                    {isAuthor && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        title="Delete comment"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px', padding: '2px 4px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment Form Input */}
          <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={isSubmittingComment}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '16px',
                border: '1px solid var(--border-color, #263750)',
                fontSize: '12px',
                outline: 'none',
                backgroundColor: 'var(--bg-input, #101c2d)',
                color: 'var(--text-primary, #f3f6fc)'
              }}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || isSubmittingComment}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                backgroundColor: commentText.trim() ? 'var(--primary-blue, #2878ff)' : 'var(--border-color, #263750)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '600',
                fontSize: '12px',
                cursor: commentText.trim() ? 'pointer' : 'default',
                transition: 'background 0.15s ease'
              }}
            >
              {isSubmittingComment ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      )}

      {/* In-App Share Modal */}
      {showShareModal && (
        <InAppShareModal
          postId={post?.id}
          postAuthorId={post?.author_id}
          onClose={() => setShowShareModal(false)}
          onShareSuccess={(newShareCount) => {
            if (typeof newShareCount === 'number') {
              setShareCount(newShareCount);
            }
          }}
        />
      )}

      {/* Who Liked This Post Modal */}
      {showLikersModal && (
        <PostLikersModal
          postId={post?.id}
          onClose={() => setShowLikersModal(false)}
        />
      )}
    </div>
  );
}
