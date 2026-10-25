import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfileProjects from '../components/profile/ProfileProjects';
import ProjectModal from '../components/profile/ProjectModal';
import ProfileItemPostModal from '../components/profile/ProfileItemPostModal';
import ProfileItemUpdateModal from '../components/profile/ProfileItemUpdateModal';
import {
  getUserProjects,
  createProject,
  updateProject,
  deleteProject,
  subscribeToProjectState,
  ProjectItem
} from '../lib/projectService';

export interface ProjectsPageProps {
  onBack?: () => void;
  onViewAllUpdates?: (itemType: string, itemId: string, itemTitle: string) => void;
}

export default function ProjectsPage({ onBack, onViewAllUpdates }: ProjectsPageProps) {
  const { user: currentUser } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [postModalItem, setPostModalItem] = useState<{ itemType: string; item: any } | null>(null);
  const [updateModalItem, setUpdateModalItem] = useState<{ itemType: string; item: any } | null>(null);

  const fetchProjects = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getUserProjects(currentUser.id);
      setProjects(data || []);
    } catch (err) {
      console.error('[ProjectsPage] Failed to fetch projects:', err);
      setError('Unable to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    const unsubscribe = subscribeToProjectState(() => {
      if (currentUser?.id) {
        getUserProjects(currentUser.id).then((data) => {
          setProjects(data || []);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  const handleSaveProject = async (projectData: any, projectId?: string) => {
    if (!currentUser?.id) return;
    try {
      if (projectId) {
        const updated = await updateProject(currentUser.id, projectId, projectData);
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...updated } : p)));
      } else {
        const created = await createProject(currentUser.id, projectData);
        setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      }
      setShowProjectModal(false);
      setEditingProject(null);
    } catch (err) {
      console.error('[ProjectsPage] Save project error:', err);
      alert('Failed to save project.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!currentUser?.id || !projectId) return;
    try {
      await deleteProject(currentUser.id, projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('[ProjectsPage] Delete project error:', err);
      alert('Failed to delete project.');
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
            Projects
          </h2>

          <div style={{ width: '64px' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
            Loading projects...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca', color: '#dc2626' }}>
            {error}
          </div>
        ) : (
          <ProfileProjects
            projects={projects as any}
            isOwner={true}
            onOpenAddProject={() => {
              setEditingProject(null);
              setShowProjectModal(true);
            }}
            onOpenEditProject={(proj: any) => {
              setEditingProject(proj);
              setShowProjectModal(true);
            }}
            onDeleteProject={handleDeleteProject}
            onOpenPostModal={(type: string, item: any) => setPostModalItem({ itemType: type, item })}
            onOpenUpdateModal={(type: string, item: any) => setUpdateModalItem({ itemType: type, item })}
            onViewAllUpdates={onViewAllUpdates}
          />
        )}
      </div>

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          onSave={handleSaveProject}
          onClose={() => {
            setShowProjectModal(false);
            setEditingProject(null);
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
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}
