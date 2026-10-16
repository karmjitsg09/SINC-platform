import React, { useState } from 'react';

export default function RejectFollowRequestModal({
  isOpen,
  targetUser,
  onClose,
  onRejectOnly,
  onRejectAndBlock,
  loading = false
}) {
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!isOpen || !targetUser) return null;

  const username = targetUser.username ? `@${targetUser.username}` : (targetUser.name || 'this user');
  const displayName = targetUser.name || targetUser.username || 'User';
  const avatarUrl = targetUser.avatar_url || targetUser.avatarUrl;

  const initials = (displayName || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleClose = () => {
    if (loading || actionLoading) return;
    setShowBlockConfirm(false);
    onClose();
  };

  const handleRejectOnlyClick = async () => {
    if (loading || actionLoading) return;
    setActionLoading(true);
    try {
      await onRejectOnly();
      handleClose();
    } catch (err) {
      console.error('[RejectModal] Reject only failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRejectAndBlock = async () => {
    if (loading || actionLoading) return;
    setActionLoading(true);
    try {
      await onRejectAndBlock();
      handleClose();
    } catch (err) {
      console.error('[RejectModal] Reject and block failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: '700',
              color: '#0f172a'
            }}
          >
            {showBlockConfirm ? 'Confirm Block User' : 'Reject Follow Request?'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={actionLoading || loading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: '#94a3b8',
              cursor: actionLoading || loading ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px' }}>
          {showBlockConfirm ? (
            /* Explicit Confirmation View for Block */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div style={{ fontSize: '13.5px', color: '#991b1b', lineHeight: '1.45' }}>
                  <strong>Are you sure you want to block {username}?</strong>
                  <p style={{ margin: '6px 0 0 0', color: '#b91c1c', fontSize: '12.5px' }}>
                    {username} will be blocked from sending you follow requests, sending you messages, or finding your profile. You can unblock them later from your profile settings.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  id="confirm-reject-block-btn"
                  onClick={handleConfirmRejectAndBlock}
                  disabled={actionLoading || loading}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    cursor: actionLoading || loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                  }}
                >
                  {actionLoading ? 'Blocking...' : 'Yes, Reject & Block'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBlockConfirm(false)}
                  disabled={actionLoading || loading}
                  style={{
                    padding: '11px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: actionLoading || loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            /* Option Selection View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* User preview header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '15px',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '14.5px', color: '#0f172a' }}>{displayName}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{username}</div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
                Choose whether you want to reject this request only or also block this user.
              </p>

              {/* Action Choices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Action A: Reject Request Only */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>
                      Reject Request Only
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                      Decline this follow request. {username} can request to follow you again later.
                    </div>
                  </div>
                  <button
                    type="button"
                    id="reject-only-btn"
                    onClick={handleRejectOnlyClick}
                    disabled={actionLoading || loading}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: actionLoading || loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  >
                    {actionLoading ? 'Rejecting...' : 'Reject Request'}
                  </button>
                </div>

                {/* Action B: Reject and Block */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid #fecaca',
                    backgroundColor: '#fffafb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🚫</span> Reject and Block
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#b91c1c', marginTop: '2px' }}>
                      Decline request and block {username}. They will not be able to follow you, message you, or see your profile.
                    </div>
                  </div>
                  <button
                    type="button"
                    id="reject-and-block-btn"
                    onClick={() => setShowBlockConfirm(true)}
                    disabled={actionLoading || loading}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fca5a5',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: actionLoading || loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fecaca')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                  >
                    Reject and Block
                  </button>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                id="reject-modal-cancel-btn"
                onClick={handleClose}
                disabled={actionLoading || loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  fontWeight: '600',
                  fontSize: '13.5px',
                  cursor: actionLoading || loading ? 'not-allowed' : 'pointer',
                  marginTop: '4px'
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
