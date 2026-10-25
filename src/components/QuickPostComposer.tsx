import React from 'react';
import { Image, Video, Code } from 'lucide-react';

export interface QuickPostComposerProps {
  currentUser?: {
    id?: string;
    name?: string;
    avatarUrl?: string | null;
    [key: string]: any;
  } | null;
  currentUserInitials?: string;
  onOpenCreatePost?: (type: 'none' | 'image' | 'video' | 'code' | string) => void;
}

export default function QuickPostComposer({
  currentUser,
  currentUserInitials = 'U',
  onOpenCreatePost
}: QuickPostComposerProps) {
  return (
    <section className="quick-create-card" aria-label="Create a post">
      <div className="quick-create-row">
        <div className="quick-user-avatar">
          {currentUser?.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt={currentUser.name} className="avatar-img" />
          ) : (
            <span className="avatar-initials">{currentUserInitials}</span>
          )}
        </div>

        <button
          type="button"
          className="quick-create-input-btn"
          onClick={() => onOpenCreatePost?.('none')}
          aria-label="Create a new post"
        >
          <span>Share thoughts, tech updates, or project milestones...</span>
        </button>
      </div>

      <div className="quick-create-actions-row">
        <div className="quick-create-media-actions">
          <button
            type="button"
            className="quick-action-pill"
            onClick={() => onOpenCreatePost?.('image')}
            title="Add Image Attachment"
            aria-label="Attach Photo"
          >
            <Image size={17} className="quick-icon text-blue" />
            <span>Photo</span>
          </button>

          <button
            type="button"
            className="quick-action-pill"
            onClick={() => onOpenCreatePost?.('video')}
            title="Add Video Attachment"
            aria-label="Attach Video"
          >
            <Video size={17} className="quick-icon text-purple" />
            <span>Video</span>
          </button>

          <button
            type="button"
            className="quick-action-pill"
            onClick={() => onOpenCreatePost?.('code')}
            title="Share Code Snippet"
            aria-label="Attach Code Snippet"
          >
            <Code size={17} className="quick-icon text-cyan" />
            <span>Code</span>
          </button>
        </div>

        <button
          type="button"
          className="quick-publish-btn"
          onClick={() => onOpenCreatePost?.('none')}
          aria-label="Open post publisher"
        >
          <span>Post</span>
        </button>
      </div>
    </section>
  );
}
