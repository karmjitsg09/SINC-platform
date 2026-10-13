import React, { useState, useEffect } from 'react';
import { extractItemDetails, ITEM_TYPE_ICONS } from '../../lib/profileItemPostService';
import { createUpdate, updateUpdate } from '../../lib/profileItemUpdateService';

export default function ProfileItemUpdateModal({
  isOpen,
  onClose,
  itemType,
  item,
  userId,
  initialUpdate = null,
  onSuccess
}) {
  if (!isOpen || !item) return null;

  const isEditing = Boolean(initialUpdate?.id);
  const details = extractItemDetails(itemType, item);
  const icon = ITEM_TYPE_ICONS[itemType] || '📌';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('In Progress');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (initialUpdate) {
      setTitle(initialUpdate.title || '');
      setContent(initialUpdate.content || '');
      setStatus(initialUpdate.status || 'In Progress');
      setImageUrl(initialUpdate.image_url || '');
    } else {
      setTitle('');
      setContent('');
      setStatus('In Progress');
      setImageUrl('');
    }
    setErrorMessage('');
  }, [initialUpdate, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setErrorMessage('Please provide what changed / content for this update.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      if (isEditing) {
        const updated = await updateUpdate(
          initialUpdate.id,
          {
            itemType,
            itemId: item.id,
            title,
            content,
            status,
            imageUrl
          },
          userId
        );
        if (onSuccess) onSuccess(updated);
      } else {
        const created = await createUpdate({
          userId,
          itemType,
          itemId: item.id,
          title,
          content,
          status,
          imageUrl
        });
        if (onSuccess) onSuccess(created);
      }

      setSubmitting(false);
      onClose();
    } catch (err) {
      console.error('[ProfileItemUpdateModal] Error saving update:', err);
      setErrorMessage(err.message || 'Failed to save update.');
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
          maxWidth: '500px',
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
            <span style={{ fontSize: '20px' }}>{isEditing ? '✏️' : '➕'}</span>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
              {isEditing ? 'Edit Update' : 'Add Update'}
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

        {/* Item Context Banner */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#0369a1' }}>
              {itemType}
            </span>
            <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e3860' }}>
              {details.title}
            </span>
          </div>
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

          {/* Update Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              Update Title <span style={{ fontWeight: '400', color: '#94a3b8' }}>(e.g. Added Supabase integration)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Started project, Completed MVP, Passed exam..."
              disabled={submitting}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* What changed / Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              What changed? / Details <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the progress, accomplishments, milestones reached..."
              disabled={submitting}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
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

          {/* Status Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={submitting}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                backgroundColor: '#ffffff',
                color: '#1e3860',
                fontWeight: '600',
                outline: 'none'
              }}
            >
              <option value="Planned">Planned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Updated">Updated</option>
            </select>
          </div>

          {/* Optional Image URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              Optional Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/update-screenshot.png"
              disabled={submitting}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* Footer */}
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
              disabled={submitting}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {submitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Update')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
