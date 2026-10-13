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

/**
 * Calculate approximate duration between start and end date
 */
function calculateDuration(startDateStr, endDateStr, isCurrent) {
  if (!startDateStr) return '';
  try {
    const start = new Date(startDateStr);
    const end = isCurrent || !endDateStr ? new Date() : new Date(endDateStr);
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (monthsDiff <= 0) return '1 mo';
    const years = Math.floor(monthsDiff / 12);
    const months = monthsDiff % 12;
    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`);
    return parts.join(' ') || '1 mo';
  } catch {
    return '';
  }
}

export default function ProfileExperience({
  experiences = [],
  isOwnProfile = false,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onOpenPostModal,
  onOpenUpdateModal,
  onViewAllUpdates
}) {
  const [deleteConfirmExp, setDeleteConfirmExp] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteConfirmExp) return;
    setDeleting(true);
    try {
      deleteUpdatesByItem('experience', deleteConfirmExp.id);
      await onDeleteClick(deleteConfirmExp.id);
      setDeleteConfirmExp(null);
    } catch (err) {
      console.error('Delete experience error:', err);
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
            💼
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
              Experience
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {experiences.length} {experiences.length === 1 ? 'position' : 'positions'}
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
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Experience
          </button>
        )}
      </div>

      {/* Experience List or Empty State */}
      {experiences.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '14px',
            border: '1px dashed #cbd5e1'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>💼</div>
          <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '600', color: '#64748b' }}>
            No experience added yet.
          </p>
          {isOwnProfile && (
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Add your current and past work roles to showcase your professional background.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          {experiences.map((exp, index) => {
            const dateRange = `${formatDate(exp.start_date) || 'Started'} – ${
              exp.is_current ? 'Present' : (formatDate(exp.end_date) || 'Ended')
            }`;
            const duration = calculateDuration(exp.start_date, exp.end_date, exp.is_current);

            return (
              <div
                key={exp.id || index}
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
                {/* Header row: Job Title, Company, Status Badges & Controls */}
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
                        {exp.job_title}
                      </h3>
                      {exp.is_current && (
                        <span
                          style={{
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            letterSpacing: '0.04em',
                            border: '1px solid #bbf7d0'
                          }}
                        >
                          CURRENT
                        </span>
                      )}
                      {exp.employment_type && (
                        <span
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}
                        >
                          {exp.employment_type}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        fontSize: '13.5px'
                      }}
                    >
                      <span style={{ fontWeight: '700', color: '#0d6efd' }}>
                        {exp.company}
                      </span>
                      {exp.location && (
                        <>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ color: '#64748b' }}>
                            📍 {exp.location}
                          </span>
                        </>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '12.5px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🗓️ {dateRange}</span>
                      {duration && (
                        <>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ color: '#94a3b8' }}>{duration}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Owner Controls */}
                  {isOwnProfile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => onEditClick(exp)}
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
                        onClick={() => setDeleteConfirmExp(exp)}
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

                {/* Description */}
                {exp.description && (
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '13.5px',
                      lineHeight: '1.55',
                      color: '#475569',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {exp.description}
                  </p>
                )}

                {/* Skills Chips */}
                {Array.isArray(exp.skills) && exp.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {exp.skills.map((skill, sIdx) => (
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

                {/* Owner Actions: [📢 Post] & [➕ Add Update] */}
                {isOwnProfile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onOpenPostModal && onOpenPostModal('experience', exp)}
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
                      title="Share this experience to Feed"
                    >
                      <span>📢</span>
                      <span>Post</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenUpdateModal && onOpenUpdateModal('experience', exp)}
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
                  itemType="experience"
                  itemId={exp.id}
                  item={exp}
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
      {deleteConfirmExp && (
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
            if (e.target === e.currentTarget && !deleting) setDeleteConfirmExp(null);
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
                Delete Experience
              </h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{deleteConfirmExp.job_title}"</strong> at <strong>"{deleteConfirmExp.company}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmExp(null)}
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
                {deleting ? 'Deleting...' : 'Delete Experience'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
