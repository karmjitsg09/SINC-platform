import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfileEducation from '../components/profile/ProfileEducation';
import EducationModal from '../components/profile/EducationModal';
import ProfileItemPostModal from '../components/profile/ProfileItemPostModal';
import ProfileItemUpdateModal from '../components/profile/ProfileItemUpdateModal';
import {
  getEducationByUserId,
  createEducation,
  updateEducation,
  deleteEducation,
  subscribeToEducationState,
  EducationItem
} from '../lib/educationService';

export interface EducationPageProps {
  onBack?: () => void;
  onViewAllUpdates?: (itemType: string, itemId: string, itemTitle: string) => void;
}

export default function EducationPage({ onBack, onViewAllUpdates }: EducationPageProps) {
  const { user: currentUser } = useAuth();
  const [educationList, setEducationList] = useState<EducationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEducation, setEditingEducation] = useState<EducationItem | null>(null);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [postModalItem, setPostModalItem] = useState<{ itemType: string; item: any } | null>(null);
  const [updateModalItem, setUpdateModalItem] = useState<{ itemType: string; item: any } | null>(null);

  const fetchEducation = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getEducationByUserId(currentUser.id);
      setEducationList(data || []);
    } catch (err) {
      console.error('[EducationPage] Failed to fetch education:', err);
      setError('Unable to load education.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducation();

    const unsubscribe = subscribeToEducationState(() => {
      if (currentUser?.id) {
        getEducationByUserId(currentUser.id).then((data) => {
          setEducationList(data || []);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  const handleSaveEducation = async (educationData: any) => {
    if (!currentUser?.id) return;
    try {
      if (editingEducation?.id) {
        const updated = await updateEducation(currentUser.id, editingEducation.id, educationData);
        setEducationList((prev) => prev.map((e) => (e.id === editingEducation.id ? { ...e, ...updated } : e)));
      } else {
        const created = await createEducation(currentUser.id, educationData);
        setEducationList((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);
      }
      setShowEducationModal(false);
      setEditingEducation(null);
    } catch (err) {
      console.error('[EducationPage] Save education error:', err);
      alert('Failed to save education.');
    }
  };

  const handleDeleteEducation = async (educationId: string) => {
    if (!currentUser?.id || !educationId) return;
    try {
      await deleteEducation(currentUser.id, educationId);
      setEducationList((prev) => prev.filter((e) => e.id !== educationId));
    } catch (err) {
      console.error('[EducationPage] Delete education error:', err);
      alert('Failed to delete education.');
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
            Education
          </h2>

          <div style={{ width: '64px' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
            Loading education...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca', color: '#dc2626' }}>
            {error}
          </div>
        ) : (
          <ProfileEducation
            educationList={educationList}
            isOwnProfile={true}
            onAddClick={() => {
              setEditingEducation(null);
              setShowEducationModal(true);
            }}
            onEditClick={(edu: any) => {
              setEditingEducation(edu);
              setShowEducationModal(true);
            }}
            onDeleteClick={handleDeleteEducation}
            onOpenPostModal={(type: string, item: any) => setPostModalItem({ itemType: type, item })}
            onOpenUpdateModal={(type: string, item: any) => setUpdateModalItem({ itemType: type, item })}
            onViewAllUpdates={onViewAllUpdates}
          />
        )}
      </div>

      {showEducationModal && (
        <EducationModal
          isOpen={showEducationModal}
          initialData={editingEducation}
          onSave={handleSaveEducation}
          onClose={() => {
            setShowEducationModal(false);
            setEditingEducation(null);
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
            fetchEducation();
          }}
        />
      )}
    </div>
  );
}
