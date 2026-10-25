import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUpdates, deleteUpdate, subscribeToUpdates, ProfileItemUpdate } from '../lib/profileItemUpdateService';
import { extractItemDetails, ITEM_TYPE_ICONS, shareUpdateToFeed } from '../lib/profileItemPostService';
import ProfileItemUpdateModal from '../components/profile/ProfileItemUpdateModal';

export interface ItemUpdatesPageProps {
  itemType: string;
  itemId: string;
  item: any;
  onBack?: () => void;
  onNavigateToPostView?: (postId: string) => void;
}

function formatUpdateDate(dateString: string) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case 'Completed':
      return { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
    case 'In Progress':
      return { backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
    case 'Planned':
      return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
    case 'Updated':
      return { backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff' };
    default:
      return { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
  }
}

export default function ItemUpdatesPage({
  itemType,
  itemId,
  item,
  onBack,
  onNavigateToPostView
}: ItemUpdatesPageProps) {
  const { user: currentUser } = useAuth();
  const [updates, setUpdates] = useState<ProfileItemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<ProfileItemUpdate | null>(null);
  const [deletingUpdate, setDeletingUpdate] = useState<ProfileItemUpdate | null>(null);
  const [sharingUpdateId, setSharingUpdateId] = useState<string | null>(null);
  const [sharedSuccessId, setSharedSuccessId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const details = extractItemDetails(itemType, item);
  const icon = ITEM_TYPE_ICONS[itemType] || '📌';

  const isOwner = currentUser?.id && item?.user_id && currentUser.id === item.user_id;

  const loadUpdates = useCallback(async () => {
    if (!itemType || !itemId) return;
    setLoading(true);
    try {
      const data = await getUpdates(itemType, itemId);
      setUpdates(data);
    } catch (err) {
      console.error('[ItemUpdatesPage] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [itemType, itemId]);

  useEffect(() => {
    loadUpdates();
    const unsub = subscribeToUpdates(() => {
      loadUpdates();
    });
    return () => {
      unsub();
    };
  }, [loadUpdates]);

  const handleDelete = async (update: ProfileItemUpdate) => {
    if (!currentUser?.id) return;
    try {
      await deleteUpdate(update.id, currentUser.id, itemType, itemId);
      setDeletingUpdate(null);
      loadUpdates();
      setFeedbackMessage('Update deleted successfully.');
      setTimeout(() => setFeedbackMessage(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete update.');
    }
  };

  const handleShareUpdate = async (update: ProfileItemUpdate) => {
    if (!isOwner || sharingUpdateId || !currentUser?.id) return;
    setSharingUpdateId(update.id);
    try {
      await shareUpdateToFeed({
        userId: currentUser.id,
        update,
        itemType,
        item,
        caption: `Progress update on my ${itemType}: ${update.title || details.title}`
      });
      setSharedSuccessId(update.id);
      setFeedbackMessage('Update shared to Feed successfully!');
      setTimeout(() => {
        setSharedSuccessId(null);
        setSharingUpdateId(null);
        setTimeout(() => setFeedbackMessage(''), 2500);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to share update.');
      setSharingUpdateId(null);
    }
  };

  return (
    <div className="main-content item-updates-page">
      <div
        className="content-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '24px',
          border: '1.5px solid var(--border-app, #b5d2fd)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#f0f7ff',
                border: '1.5px solid #bfdbfe',
                color: '#1e3860',
                cursor: 'pointer'
              }}
              title="Back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', color: '#0369a1' }}>
                {icon} {itemType.toUpperCase()} UPDATES
              </div>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
                {details.title}
              </h2>
            </div>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setEditingUpdate(null);
                setIsUpdateModalOpen(true);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
              }}
            >
              <span>➕</span>
              <span>Add Update</span>
            </button>
          )}
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            {feedbackMessage}
          </div>
        )}

        {/* Timeline Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13.5px' }}>
            Loading updates...
          </div>
        ) : updates.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '14px',
              border: '1.5px dashed #cbd5e1'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e3860', marginBottom: '4px' }}>
              No updates yet
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '360px', margin: '0 auto 14px auto' }}>
              {isOwner
                ? 'Track progress, milestones, and breakthroughs for this record by adding your first update.'
                : 'No updates have been posted for this record yet.'}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setEditingUpdate(null);
                  setIsUpdateModalOpen(true);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  color: '#2563eb',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                + Add First Update
              </button>
            )}
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Timeline vertical bar */}
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '8px',
                bottom: '8px',
                width: '2px',
                backgroundColor: '#cbd5e1'
              }}
            />

            {updates.map((update) => {
              const badgeStyle = getStatusBadgeStyle(update.status);
              const isSharing = sharingUpdateId === update.id;
              const isShared = sharedSuccessId === update.id;

              return (
                <div key={update.id} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-24px',
                      top: '12px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#2563eb',
                      border: '3px solid #ffffff',
                      boxShadow: '0 0 0 2px #bfdbfe'
                    }}
                  />

                  {/* Update Card */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    {/* Top Row: Status badge, Title, Date, and Actions */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                            ...badgeStyle
                          }}
                        >
                          {update.status || 'In Progress'}
                        </span>
                        {update.title && (
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
                            {update.title}
                          </h4>
                        )}
                      </div>

                      <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
                        {formatUpdateDate(update.created_at)}
                      </span>
                    </div>

                    {/* Content text */}
                    <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                      {update.content}
                    </div>

                    {/* Optional Image */}
                    {update.image_url && (
                      <div style={{ marginTop: '4px', borderRadius: '10px', overflow: 'hidden', maxHeight: '280px' }}>
                        <img
                          src={update.image_url}
                          alt={update.title || 'Update screenshot'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Owner Action Buttons */}
                    {isOwner && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '4px',
                          borderTop: '1px solid #e2e8f0',
                          paddingTop: '10px',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleShareUpdate(update)}
                          disabled={isSharing || isShared}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            backgroundColor: isShared ? '#dcfce7' : '#eff6ff',
                            border: '1px solid',
                            borderColor: isShared ? '#86efac' : '#bfdbfe',
                            color: isShared ? '#166534' : '#2563eb',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: isSharing || isShared ? 'default' : 'pointer'
                          }}
                          title="Share this update as a Feed post"
                        >
                          <span>📢</span>
                          <span>{isShared ? 'Shared!' : isSharing ? 'Sharing...' : 'Share Update'}</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUpdate(update);
                              setIsUpdateModalOpen(true);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingUpdate(update)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Update Modal (Add / Edit) */}
      <ProfileItemUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setEditingUpdate(null);
        }}
        itemType={itemType}
        item={item}
        userId={currentUser?.id}
        initialUpdate={editingUpdate ?? undefined}
        onSuccess={() => {
          loadUpdates();
          setFeedbackMessage(editingUpdate ? 'Update saved.' : 'Update added successfully.');
          setTimeout(() => setFeedbackMessage(''), 3000);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deletingUpdate && (
        <div
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
            zIndex: 99999,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '400px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#1e3860' }}>
              Delete Update?
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
              Are you sure you want to delete this update? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingUpdate(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingUpdate)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
