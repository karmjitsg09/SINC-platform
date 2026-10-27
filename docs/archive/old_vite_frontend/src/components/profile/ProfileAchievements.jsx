import React, { useState } from 'react';
import ProfileItemUpdatesSnippet from './ProfileItemUpdatesSnippet';
import { deleteUpdatesByItem } from '../../lib/profileItemUpdateService';

/**
 * Format a date string (YYYY-MM-DD or ISO) into readable Month Year
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (months[monthIndex]) {
        return `${months[monthIndex]} ${year}`;
      }
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default function ProfileAchievements({
  achievements = [],
  isOwnProfile = false,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onOpenPostModal,
  onOpenUpdateModal,
  onViewAllUpdates
}) {
  const [deleteConfirmAch, setDeleteConfirmAch] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteConfirmAch) return;
    setDeleting(true);
    try {
      deleteUpdatesByItem('achievement', deleteConfirmAch.id);
      await onDeleteClick(deleteConfirmAch.id);
      setDeleteConfirmAch(null);
    } catch (err) {
      console.error('Delete achievement error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        border: '1.5px solid #b5d2fd',
        padding: '24px',
        boxShadow: '0 4px 20px -2px rgba(13, 110, 253, 0.05)',
        boxSizing: 'border-box',
        width: '100%',
        marginBottom: '24px'
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}
          >
            🏆
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '800',
                color: '#1e3860',
                letterSpacing: '-0.01em'
              }}
            >
              Achievements
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {achievements.length} {achievements.length === 1 ? 'honor' : 'honors'}
            </span>
          </div>
        </div>

        {/* Owner-Only Add Button */}
        {isOwnProfile && (
          <button
            type="button"
            onClick={onAddClick}
            style={{
              backgroundColor: '#0d6efd',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 10px rgba(13, 110, 253, 0.25)',
              transition: 'transform 0.15s, background-color 0.15s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0b5ed7')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0d6efd')}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Achievement
          </button>
        )}
      </div>

      {/* Achievement List or Empty State */}
      {achievements.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '14px',
            border: '1px dashed #cbd5e1'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
          <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '600', color: '#64748b' }}>
            No achievements added yet.
          </p>
          {isOwnProfile && (
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Add hackathon awards, honors, speaker engagements, or distinguished recognitions.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          {achievements.map((ach, index) => {
            const formattedDate = formatDate(ach.achievement_date);

            return (
              <div
                key={ach.id || index}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#93c5fd';
                  e.currentTarget.style.boxShadow = '0 6px 18px -4px rgba(13, 110, 253, 0.08)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: '800',
                          color: '#1e3860'
                        }}
                      >
                        {ach.title}
                      </h3>
                    </div>

                    {ach.organization && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontWeight: '700',
                          color: '#0d6efd',
                          fontSize: '14px'
                        }}
                      >
                        {ach.organization}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '12.5px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}
                    >
                      {formattedDate && <span>🗓️ {formattedDate}</span>}
                      {ach.credential_id && (
                        <>
                          {formattedDate && <span style={{ color: '#cbd5e1' }}>•</span>}
                          <span style={{ fontFamily: 'monospace', color: '#475569' }}>
                            ID: {ach.credential_id}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Owner Controls */}
                  {isOwnProfile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => onEditClick(ach)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#334155',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmAch(ach)}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#dc2626',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Optional Image */}
                {ach.image_url && (
                  <div style={{ marginTop: '2px', maxWidth: '320px', width: '100%' }}>
                    <img
                      src={ach.image_url}
                      alt={ach.title}
                      style={{
                        width: '100%',
                        maxHeight: '180px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        border: '1.5px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* Description */}
                {ach.description && (
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '13.5px',
                      lineHeight: '1.55',
                      color: '#475569',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {ach.description}
                  </p>
                )}

                {/* Skills Chips */}
                {Array.isArray(ach.skills) && ach.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                    {ach.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#0d6efd',
                          border: '1px solid #bfdbfe',
                          borderRadius: '10px',
                          padding: '3px 10px',
                          fontSize: '11.5px',
                          fontWeight: '600'
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Credential URL Button */}
                {ach.credential_url && (
                  <div style={{ marginTop: '2px' }}>
                    <a
                      href={ach.credential_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#0d6efd',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: '700',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        transition: 'background-color 0.15s',
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                        boxSizing: 'border-box'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                    >
                      <span>Show credential</span>
                      <span style={{ fontSize: '14px' }}>↗</span>
                    </a>
                  </div>
                )}

                {/* Owner Actions: [📢 Post] & [➕ Add Update] */}
                {isOwnProfile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onOpenPostModal && onOpenPostModal('achievement', ach)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                        border: '1.5px solid #bfdbfe',
                        color: '#1d4ed8',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Share this achievement to Feed"
                    >
                      <span>📢</span>
                      <span>Post</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenUpdateModal && onOpenUpdateModal('achievement', ach)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        color: '#1e3860',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Add a progress or milestone update"
                    >
                      <span>➕</span>
                      <span>Add Update</span>
                    </button>
                  </div>
                )}

                {/* Recent Updates Preview Snippet */}
                <ProfileItemUpdatesSnippet
                  itemType="achievement"
                  itemId={ach.id}
                  item={ach}
                  isOwner={isOwnProfile}
                  onViewAllUpdates={onViewAllUpdates}
                  onAddUpdate={onOpenUpdateModal}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation In-App Modal */}
      {deleteConfirmAch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteConfirmAch(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '18px',
              border: '1.5px solid #fecaca',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px -10px rgba(220, 38, 38, 0.2)',
              animation: 'fadeInModal 0.15s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>🗑️</span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#991b1b' }}>
                Delete Achievement
              </h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{deleteConfirmAch.title}"</strong>
              {deleteConfirmAch.organization ? ` from ${deleteConfirmAch.organization}` : ''}? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmAch(null)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '9px',
                  border: 'none',
                  background: '#dc2626',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Achievement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
