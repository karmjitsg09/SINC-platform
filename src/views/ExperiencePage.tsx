import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ProfileExperience from '../components/profile/ProfileExperience';
import ExperienceModal from '../components/profile/ExperienceModal';
import ProfileItemPostModal from '../components/profile/ProfileItemPostModal';
import ProfileItemUpdateModal from '../components/profile/ProfileItemUpdateModal';
import {
  getExperiencesByUserId,
  createExperience,
  updateExperience,
  deleteExperience,
  subscribeToExperienceState,
  ExperienceItem
} from '../lib/experienceService';

export interface ExperiencePageProps {
  onBack?: () => void;
  onViewAllUpdates?: (itemType: string, itemId: string, itemTitle: string) => void;
}

export default function ExperiencePage({ onBack, onViewAllUpdates }: ExperiencePageProps) {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingExperience, setEditingExperience] = useState<ExperienceItem | null>(null);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [postModalItem, setPostModalItem] = useState<{ itemType: string; item: any } | null>(null);
  const [updateModalItem, setUpdateModalItem] = useState<{ itemType: string; item: any } | null>(null);

  const fetchExperiences = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getExperiencesByUserId(currentUser.id);
      setExperiences(data || []);
    } catch (err) {
      console.error('[ExperiencePage] Failed to fetch experiences:', err);
      setError('Unable to load experiences.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiences();

    const unsubscribe = subscribeToExperienceState(() => {
      if (currentUser?.id) {
        getExperiencesByUserId(currentUser.id).then((data) => {
          setExperiences(data || []);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  const handleSaveExperience = async (experienceData: any) => {
    if (!currentUser?.id) return;
    try {
      if (editingExperience?.id) {
        const updated = await updateExperience(currentUser.id, editingExperience.id, experienceData);
        setExperiences((prev) => prev.map((e) => (e.id === editingExperience.id ? { ...e, ...updated } : e)));
        toast.success('Experience updated successfully.');
      } else {
        const created = await createExperience(currentUser.id, experienceData);
        setExperiences((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);
        toast.success('Experience created successfully.');
      }
      setShowExperienceModal(false);
      setEditingExperience(null);
    } catch (err: any) {
      console.error('[ExperiencePage] Save experience error:', err);
      toast.error(err?.message || 'Failed to save experience.');
    }
  };

  const handleDeleteExperience = async (experienceId: string) => {
    if (!currentUser?.id || !experienceId) return;
    try {
      await deleteExperience(currentUser.id, experienceId);
      setExperiences((prev) => prev.filter((e) => e.id !== experienceId));
      toast.success('Experience deleted successfully.');
    } catch (err: any) {
      console.error('[ExperiencePage] Delete experience error:', err);
      toast.error(err?.message || 'Failed to delete experience.');
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
              fontWeight: 800,
              color: '#1e3860',
              margin: 0
            }}
          >
            Experience
          </h2>

          <div style={{ width: '64px' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
            Loading experience...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca', color: '#dc2626' }}>
            {error}
          </div>
        ) : (
          <ProfileExperience
            experiences={experiences as any}
            isOwnProfile={true}
            onAddClick={() => {
              setEditingExperience(null);
              setShowExperienceModal(true);
            }}
            onEditClick={(exp: any) => {
              setEditingExperience(exp);
              setShowExperienceModal(true);
            }}
            onDeleteClick={handleDeleteExperience}
            onOpenPostModal={(type: string, item: any) => setPostModalItem({ itemType: type, item })}
            onOpenUpdateModal={(type: string, item: any) => setUpdateModalItem({ itemType: type, item })}
            onViewAllUpdates={onViewAllUpdates}
          />
        )}
      </div>

      {showExperienceModal && (
        <ExperienceModal
          isOpen={showExperienceModal}
          initialData={editingExperience}
          onSave={handleSaveExperience}
          onClose={() => {
            setShowExperienceModal(false);
            setEditingExperience(null);
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
            fetchExperiences();
          }}
        />
      )}
    </div>
  );
}
