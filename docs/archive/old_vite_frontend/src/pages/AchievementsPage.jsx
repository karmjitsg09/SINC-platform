import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfileAchievements from '../components/profile/ProfileAchievements';
import AchievementModal from '../components/profile/AchievementModal';
import ProfileItemPostModal from '../components/profile/ProfileItemPostModal';
import ProfileItemUpdateModal from '../components/profile/ProfileItemUpdateModal';
import {
  getAchievementsByUserId,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  subscribeToAchievementState
} from '../lib/achievementService';

export default function AchievementsPage({ onBack, onViewAllUpdates }) {
  const { user: currentUser } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [postModalItem, setPostModalItem] = useState(null);
  const [updateModalItem, setUpdateModalItem] = useState(null);

  const fetchAchievements = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAchievementsByUserId(currentUser.id);
      setAchievements(data || []);
    } catch (err) {
      console.error('[AchievementsPage] Failed to fetch achievements:', err);
      setError('Unable to load achievements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAchievements();

    const unsubscribe = subscribeToAchievementState(() => {
      if (currentUser?.id) {
        getAchievementsByUserId(currentUser.id).then((data) => {
          setAchievements(data || []);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  const handleSaveAchievement = async (achievementData) => {
    if (!currentUser?.id) return;
    try {
      if (editingAchievement?.id) {
        const updated = await updateAchievement(currentUser.id, editingAchievement.id, achievementData);
        setAchievements((prev) => prev.map((a) => (a.id === editingAchievement.id ? { ...a, ...updated } : a)));
      } else {
        const created = await createAchievement(currentUser.id, achievementData);
        setAchievements((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      }
      setShowAchievementModal(false);
      setEditingAchievement(null);
    } catch (err) {
      console.error('[AchievementsPage] Save achievement error:', err);
      alert('Failed to save achievement.');
    }
  };

  const handleDeleteAchievement = async (achievementId) => {
    if (!currentUser?.id || !achievementId) return;
    try {
      await deleteAchievement(currentUser.id, achievementId);
      setAchievements((prev) => prev.filter((a) => a.id !== achievementId));
    } catch (err) {
      console.error('[AchievementsPage] Delete achievement error:', err);
      alert('Failed to delete achievement.');
    }
  };

  return (
    <div
      className="main-content profile-management-page"
      style={{
        width: '100%',
        minHeight: '0',
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: 'clamp(12px, 2vw, 24px) clamp(10px, 2vw, 16px)',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          width: 'min(100%, 720px)',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Top Header Row with Back Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid #b5d2fd'
          }}
        >
          <button
            type="button"
            className="profile-menu-back-btn"
            onClick={onBack}
            aria-label="Back to Profile Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>

          <h2
            style={{
              fontSize: '18px',
              fontWeight: '800',
              color: '#1e3860',
              margin: 0
            }}
          >
            Achievements
          </h2>

          <div style={{ width: '64px' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
            Loading achievements...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca', color: '#dc2626' }}>
            {error}
          </div>
        ) : (
          <ProfileAchievements
            achievements={achievements}
            isOwnProfile={true}
            onAddClick={() => {
              setEditingAchievement(null);
              setShowAchievementModal(true);
            }}
            onEditClick={(ach) => {
              setEditingAchievement(ach);
              setShowAchievementModal(true);
            }}
            onDeleteClick={handleDeleteAchievement}
            onOpenPostModal={(type, item) => setPostModalItem({ itemType: type, item })}
            onOpenUpdateModal={(type, item) => setUpdateModalItem({ itemType: type, item })}
            onViewAllUpdates={onViewAllUpdates}
          />
        )}
      </div>

      {showAchievementModal && (
        <AchievementModal
          isOpen={showAchievementModal}
          initialData={editingAchievement}
          onSave={handleSaveAchievement}
          onClose={() => {
            setShowAchievementModal(false);
            setEditingAchievement(null);
          }}
        />
      )}

      {/* Post to Feed Modal */}
      {postModalItem && (
        <ProfileItemPostModal
          isOpen={Boolean(postModalItem)}
          onClose={() => setPostModalItem(null)}
          itemType={postModalItem.itemType}
          item={postModalItem.item}
          userId={currentUser?.id}
        />
      )}

      {/* Add / Edit Update Modal */}
      {updateModalItem && (
        <ProfileItemUpdateModal
          isOpen={Boolean(updateModalItem)}
          onClose={() => setUpdateModalItem(null)}
          itemType={updateModalItem.itemType}
          item={updateModalItem.item}
          userId={currentUser?.id}
          onSuccess={() => {
            fetchAchievements();
          }}
        />
      )}
    </div>
  );
}
