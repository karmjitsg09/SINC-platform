import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfileCertifications from '../components/profile/ProfileCertifications';
import CertificationModal from '../components/profile/CertificationModal';
import ProfileItemPostModal from '../components/profile/ProfileItemPostModal';
import ProfileItemUpdateModal from '../components/profile/ProfileItemUpdateModal';
import {
  getCertificationsByUserId,
  createCertification,
  updateCertification,
  deleteCertification,
  subscribeToCertificationState,
  CertificationItem
} from '../lib/certificationService';

export interface CertificationsPageProps {
  onBack?: () => void;
  onViewAllUpdates?: (itemType: string, itemId: string, itemTitle: string) => void;
}

export default function CertificationsPage({ onBack, onViewAllUpdates }: CertificationsPageProps) {
  const { user: currentUser } = useAuth();
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCertification, setEditingCertification] = useState<CertificationItem | null>(null);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [postModalItem, setPostModalItem] = useState<{ itemType: string; item: any } | null>(null);
  const [updateModalItem, setUpdateModalItem] = useState<{ itemType: string; item: any } | null>(null);

  const fetchCertifications = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getCertificationsByUserId(currentUser.id);
      setCertifications(data || []);
    } catch (err) {
      console.error('[CertificationsPage] Failed to fetch certifications:', err);
      setError('Unable to load certifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertifications();

    const unsubscribe = subscribeToCertificationState(() => {
      if (currentUser?.id) {
        getCertificationsByUserId(currentUser.id).then((data) => {
          setCertifications(data || []);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  const handleSaveCertification = async (certificationData: any) => {
    if (!currentUser?.id) return;
    try {
      if (editingCertification?.id) {
        const updated = await updateCertification(currentUser.id, editingCertification.id, certificationData);
        setCertifications((prev) => prev.map((c) => (c.id === editingCertification.id ? { ...c, ...updated } : c)));
      } else {
        const created = await createCertification(currentUser.id, certificationData);
        setCertifications((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      }
      setShowCertificationModal(false);
      setEditingCertification(null);
    } catch (err) {
      console.error('[CertificationsPage] Save certification error:', err);
      alert('Failed to save certification.');
    }
  };

  const handleDeleteCertification = async (certificationId: string) => {
    if (!currentUser?.id || !certificationId) return;
    try {
      await deleteCertification(currentUser.id, certificationId);
      setCertifications((prev) => prev.filter((c) => c.id !== certificationId));
    } catch (err) {
      console.error('[CertificationsPage] Delete certification error:', err);
      alert('Failed to delete certification.');
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
            Certifications
          </h2>

          <div style={{ width: '64px' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
            Loading certifications...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca', color: '#dc2626' }}>
            {error}
          </div>
        ) : (
          <ProfileCertifications
            certifications={certifications}
            isOwnProfile={true}
            onAddClick={() => {
              setEditingCertification(null);
              setShowCertificationModal(true);
            }}
            onEditClick={(cert: any) => {
              setEditingCertification(cert);
              setShowCertificationModal(true);
            }}
            onDeleteClick={handleDeleteCertification}
            onOpenPostModal={(type: string, item: any) => setPostModalItem({ itemType: type, item })}
            onOpenUpdateModal={(type: string, item: any) => setUpdateModalItem({ itemType: type, item })}
            onViewAllUpdates={onViewAllUpdates}
          />
        )}
      </div>

      {showCertificationModal && (
        <CertificationModal
          isOpen={showCertificationModal}
          initialData={editingCertification}
          onSave={handleSaveCertification}
          onClose={() => {
            setShowCertificationModal(false);
            setEditingCertification(null);
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
            fetchCertifications();
          }}
        />
      )}
    </div>
  );
}
