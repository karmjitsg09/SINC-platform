import React, { useState } from 'react';
import ProfileItemUpdatesSnippet from './ProfileItemUpdatesSnippet';
import { deleteUpdatesByItem } from '../../lib/profileItemUpdateService';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

export default function ProfileProjects({
  projects = [],
  isOwner = false,
  onOpenAddProject,
  onOpenEditProject,
  onDeleteProject,
  onOpenPostModal,
  onOpenUpdateModal,
  onViewAllUpdates
}) {
  const [deletingProject, setDeletingProject] = useState(null);
  return (
    <div
      className="profile-projects-section"
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '20px',
        border: '1.5px solid var(--border-app, #b5d2fd)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
      }}
    >
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0369a1'
          }}
        >
          Projects
        </h3>

        {/* Add Project Button (Owner Only) */}
        {isOwner && (
          <button
            type="button"
            id="add-project-btn"
            onClick={onOpenAddProject}
            style={{
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#2563eb',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            <span>+</span>
            <span>Add Project</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {(!projects || projects.length === 0) ? (
        <div
          style={{
            fontSize: '13px',
            color: '#64748b',
            textAlign: 'center',
            padding: '28px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>No projects added yet.</span>
          {isOwner && (
            <button
              type="button"
              onClick={onOpenAddProject}
              style={{
                fontSize: '12.5px',
                fontWeight: '700',
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '6px 14px',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              + Add your first project
            </button>
          )}
        </div>
      ) : (
        /* Projects List / Grid */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {projects.map((project) => {
            const hasTech = Array.isArray(project.technologies) && project.technologies.length > 0;
            const startFormatted = formatDate(project.start_date || project.startDate);
            const endFormatted = project.is_current || project.isCurrent
              ? 'Present'
              : formatDate(project.end_date || project.endDate);
            const hasDate = Boolean(startFormatted || endFormatted);

            const imageUrl = project.image_url || project.imageUrl;
            const projectUrl = project.project_url || project.projectUrl;

            return (
              <div
                key={project.id}
                className="project-card-item"
                style={{
                  padding: '16px 18px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Top Row: Title, Status Badge, and Owner Controls */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #1e3860)' }}>
                      {project.title}
                    </h4>
                    {(project.is_current || project.isCurrent) && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '700',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          textTransform: 'uppercase'
                        }}
                      >
                        In Progress
                      </span>
                    )}
                  </div>

                  {/* Owner-Only Edit / Delete Controls */}
                  {isOwner && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => onOpenEditProject(project)}
                        aria-label={`Edit ${project.title}`}
                        title="Edit Project"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingProject(project)}
                        aria-label={`Delete ${project.title}`}
                        title="Delete Project"
                        style={{
                          padding: '4px 8px',
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
                  )}
                </div>

                {/* Optional Project Thumbnail */}
                {imageUrl && (
                  <div style={{ width: '100%', height: '140px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#e2e8f0' }}>
                    <img
                      src={imageUrl}
                      alt={project.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}

                {/* Dates */}
                {hasDate && (
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                    {startFormatted ? `${startFormatted} — ${endFormatted || 'Present'}` : endFormatted}
                  </div>
                )}

                {/* Description */}
                {project.description && (
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                    {project.description}
                  </p>
                )}

                {/* Technologies Chips */}
                {hasTech && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                    {project.technologies.map((tech, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '11.5px',
                          fontWeight: '600',
                          backgroundColor: '#eff6ff',
                          color: '#1e3860',
                          border: '1px solid #bfdbfe',
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {/* Project URL Link */}
                {projectUrl && (
                  <div style={{ marginTop: '2px' }}>
                    <a
                      href={projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: '#2563eb',
                        textDecoration: 'none'
                      }}
                    >
                      <span>View Project</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  </div>
                )}

                {/* Owner Actions: [📢 Post] & [➕ Add Update] */}
                {isOwner && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onOpenPostModal && onOpenPostModal('project', project)}
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
                      title="Share this project to Feed"
                    >
                      <span>📢</span>
                      <span>Post</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenUpdateModal && onOpenUpdateModal('project', project)}
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
                  itemType="project"
                  itemId={project.id}
                  item={project}
                  isOwner={isOwner}
                  onViewAllUpdates={onViewAllUpdates}
                  onAddUpdate={onOpenUpdateModal}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deletingProject && (
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
            zIndex: 10000,
            padding: '16px'
          }}
          onClick={() => setDeletingProject(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              border: '1.5px solid var(--border-app, #b5d2fd)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: '800', color: '#dc2626' }}>
              Delete Project
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong>"{deletingProject.title}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-project-btn"
                onClick={() => {
                  const id = deletingProject.id;
                  deleteUpdatesByItem('project', id);
                  setDeletingProject(null);
                  onDeleteProject(id);
                }}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(220, 38, 38, 0.25)'
                }}
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
