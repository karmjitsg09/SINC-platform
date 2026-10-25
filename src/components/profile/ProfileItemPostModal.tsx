import React, { useState } from 'react';
import { extractItemDetails, ITEM_TYPE_LABELS, ITEM_TYPE_ICONS, createProfileItemPost } from '../../lib/profileItemPostService';
import { FEED_CATEGORIES } from '../../data/mockData';

export interface ProfileItemPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: string;
  item: any;
  userId?: string;
  initialDomain?: string;
  onPostSuccess?: (newPost: any) => void;
}

export default function ProfileItemPostModal({
  isOpen,
  onClose,
  itemType,
  item,
  userId,
  initialDomain = 'tech',
  onPostSuccess
}: ProfileItemPostModalProps) {
  if (!isOpen || !item) return null;

  const [caption, setCaption] = useState('');
  const [domain, setDomain] = useState(initialDomain || 'tech');
  const [submitting, setSubmitting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const details = extractItemDetails(itemType, item);
  const icon = ITEM_TYPE_ICONS[itemType] || '📌';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || postSuccess) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const newPost = await createProfileItemPost({
        userId: userId || '',
        itemType,
        item,
        caption,
        domain
      });

      setPostSuccess(true);
      if (onPostSuccess) onPostSuccess(newPost);

      setTimeout(() => {
        setPostSuccess(false);
        setSubmitting(false);
        setCaption('');
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[ProfileItemPostModal] Error creating post:', err);
      setErrorMessage(err.message || 'Failed to create feed post.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
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
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          border: '1.5px solid #bfdbfe',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📢</span>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
              Create Post
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#94a3b8',
              cursor: submitting ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px'
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Item Reference Preview Card */}
          <div
            style={{
              backgroundColor: '#f0f7ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: '#0369a1',
                  letterSpacing: '0.5px'
                }}
              >
                {icon} {itemType.toUpperCase()}
              </span>
              {details.date && (
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
                  {details.date}
                </span>
              )}
            </div>

            <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e3860', lineHeight: 1.3 }}>
              {details.title}
            </div>

            {details.subtitle && (
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                {details.subtitle}
              </div>
            )}

            {details.description && (
              <div
                style={{
                  fontSize: '12.5px',
                  color: '#64748b',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {details.description}
              </div>
            )}

            {Array.isArray(details.tags) && details.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {details.tags.slice(0, 5).map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}
                  >
                    {tag}
                  </span>
                ))}
                {details.tags.length > 5 && (
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    +{details.tags.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Caption Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              Add a Caption <span style={{ fontWeight: '400', color: '#94a3b8' }}>(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What would you like to say about this milestone?"
              disabled={submitting || postSuccess}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* Domain Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: '600', color: '#64748b' }}>
              Publish to Channel:
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={submitting || postSuccess}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                backgroundColor: '#ffffff',
                color: '#1e3860',
                fontWeight: '600'
              }}
            >
              {FEED_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: 'none',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || postSuccess}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                backgroundColor: postSuccess ? '#16a34a' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: submitting || postSuccess ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {postSuccess ? (
                <>
                  <span>✓</span>
                  <span>Posted!</span>
                </>
              ) : submitting ? (
                <span>Posting...</span>
              ) : (
                <>
                  <span>📢</span>
                  <span>Post to Feed</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
