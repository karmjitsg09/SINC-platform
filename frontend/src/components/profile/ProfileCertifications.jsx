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

export default function ProfileCertifications({
  certifications = [],
  isOwnProfile = false,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onOpenPostModal,
  onOpenUpdateModal,
  onViewAllUpdates
}) {
  const [deleteConfirmCert, setDeleteConfirmCert] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteConfirmCert) return;
    setDeleting(true);
    try {
      deleteUpdatesByItem('certification', deleteConfirmCert.id);
      await onDeleteClick(deleteConfirmCert.id);
      setDeleteConfirmCert(null);
    } catch (err) {
      console.error('Delete certification error:', err);
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
            📜
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
              Certifications
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {certifications.length} {certifications.length === 1 ? 'credential' : 'credentials'}
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
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Certification
          </button>
        )}
      </div>

      {/* Certification List or Empty State */}
      {certifications.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '14px',
            border: '1px dashed #cbd5e1'
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
          <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '600', color: '#64748b' }}>
            No certifications added yet.
          </p>
          {isOwnProfile && (
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Showcase your licenses, professional certifications, and accredited skills.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          {certifications.map((cert, index) => {
            const issueDateStr = formatDate(cert.issue_date);
            const expDateStr = cert.does_not_expire
              ? 'No Expiration'
              : (formatDate(cert.expiration_date) || 'No Expiration');
            const dateRange = issueDateStr ? `${issueDateStr} – ${expDateStr}` : expDateStr;

            return (
              <div
                key={cert.id || index}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
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
                        {cert.name}
                      </h3>
                      {cert.does_not_expire && (
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
                          LIFETIME
                        </span>
                      )}
                    </div>

                    {cert.issuing_organization && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontWeight: '700',
                          color: '#0d6efd',
                          fontSize: '14px'
                        }}
                      >
                        {cert.issuing_organization}
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
                      <span>🗓️ {dateRange}</span>
                      {cert.credential_id && (
                        <>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ fontFamily: 'monospace', color: '#475569' }}>
                            ID: {cert.credential_id}
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
                        onClick={() => onEditClick(cert)}
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
                        onClick={() => setDeleteConfirmCert(cert)}
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
                {cert.description && (
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '13.5px',
                      lineHeight: '1.55',
                      color: '#475569',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {cert.description}
                  </p>
                )}

                {/* Skills Chips */}
                {Array.isArray(cert.skills) && cert.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {cert.skills.map((skill, sIdx) => (
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
                {cert.credential_url && (
                  <div style={{ marginTop: '4px' }}>
                    <a
                      href={cert.credential_url}
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
                      onClick={() => onOpenPostModal && onOpenPostModal('certification', cert)}
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
                      title="Share this certification to Feed"
                    >
                      <span>📢</span>
                      <span>Post</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenUpdateModal && onOpenUpdateModal('certification', cert)}
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
                  itemType="certification"
                  itemId={cert.id}
                  item={cert}
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
      {deleteConfirmCert && (
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
            if (e.target === e.currentTarget && !deleting) setDeleteConfirmCert(null);
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
                Delete Certification
              </h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{deleteConfirmCert.name}"</strong>
              {deleteConfirmCert.issuing_organization ? ` (${deleteConfirmCert.issuing_organization})` : ''}? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmCert(null)}
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
                {deleting ? 'Deleting...' : 'Delete Certification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
