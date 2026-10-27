import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { deleteUpdate, recordUpdateView } from '../lib/updatesService';

function initials(profile) {
  return (profile?.name || profile?.username || 'User')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(iso) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function UpdateStoryViewer({ initialGroup, groups, onClose }) {
  const { user: currentUser } = useAuth();
  const availableGroups = Array.isArray(groups) ? groups : [];
  const selectedGroup = initialGroup || availableGroups[0];
  const [userIndex, setUserIndex] = useState(() => Math.max(0, availableGroups.findIndex((group) => group.user?.id === selectedGroup?.user?.id)));
  const [storyIndex, setStoryIndex] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef(null);
  const group = availableGroups[userIndex] || selectedGroup;
  const story = group?.updates?.[storyIndex];
  const isOwnStory = story?.user_id === currentUser?.id;
  const storyCount = group?.updates?.length || 0;
  const storyExpiresAt = story?.expires_at ? new Date(story.expires_at).getTime() : 0;

  const currentGroupName = useMemo(() => group?.user?.name || group?.user?.username || 'User', [group]);

  useEffect(() => {
    setMediaError(false);
    if (story?.id && storyExpiresAt > Date.now()) recordUpdateView(story.id, currentUser?.id);
  }, [story?.id, storyExpiresAt, currentUser?.id]);

  function playActiveVideo() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }

  useEffect(() => {
    const video = videoRef.current;
    if (story?.media_type !== 'video' || !video) return undefined;

    video.currentTime = 0;
    video.muted = true;
    playActiveVideo();

    return () => {
      video.pause();
      video.currentTime = 0;
    };
  }, [story?.id, story?.media_type, story?.media_url]);

  useEffect(() => {
    if (!story || !storyExpiresAt) return undefined;
    const remaining = storyExpiresAt - Date.now();
    const timer = window.setTimeout(nextStory, Math.max(0, remaining + 50));
    return () => window.clearTimeout(timer);
  }, [story?.id, storyExpiresAt, userIndex, storyIndex]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') previousStory();
      if (event.key === 'ArrowRight') nextStory();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function previousStory() {
    if (storyIndex > 0) {
      setStoryIndex((index) => index - 1);
    } else if (userIndex > 0) {
      const nextUserIndex = userIndex - 1;
      setUserIndex(nextUserIndex);
      setStoryIndex(availableGroups[nextUserIndex].updates.length - 1);
    }
  }

  function nextStory() {
    if (storyIndex < storyCount - 1) {
      setStoryIndex((index) => index + 1);
    } else if (userIndex < availableGroups.length - 1) {
      setUserIndex((index) => index + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }

  function handleNavigationPointer(event, navigate) {
    event.preventDefault();
    event.stopPropagation();
    navigate();
  }

  function handleViewerPointer(event) {
    if (event.target.closest('button')) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    if (relativeY < 0.08 || relativeY > 0.92 || relativeX < 0.35 || relativeX > 0.65) return;

    const video = videoRef.current;
    if (story?.media_type !== 'video' || !video) return;
    event.preventDefault();
    if (video.paused) {
      playActiveVideo();
    } else {
      video.pause();
    }
  }

  async function handleDelete() {
    if (!story || !isOwnStory || !window.confirm('Delete this update?')) return;
    setDeleting(true);
    const result = await deleteUpdate(story.id, currentUser.id);
    setDeleting(false);
    if (!result.error) {
      if (storyCount > 1) {
        setStoryIndex((index) => Math.min(index, storyCount - 2));
      } else {
        onClose();
      }
    }
  }

  if (!story) {
    return (
      <main className="story-view-page">
        <button type="button" className="story-back-button" onClick={onClose}>Back to Home</button>
        <div className="story-view-error">This update is no longer available.</div>
      </main>
    );
  }

  const avatar = group.user?.avatar_url;
  return (
    <main className="story-view-page">
      <div className="story-view-shell" onPointerUp={handleViewerPointer}>
        <div className="story-progress-row" aria-label={`Story ${storyIndex + 1} of ${storyCount}`}>
          {group.updates.map((item, index) => <span key={item.id} className={index <= storyIndex ? 'complete' : ''} />)}
        </div>
        <button
          type="button"
          className="story-navigation-zone story-navigation-zone-left"
          aria-label="Previous story"
          tabIndex={-1}
          onPointerUp={(event) => handleNavigationPointer(event, previousStory)}
        />
        <button
          type="button"
          className="story-navigation-zone story-navigation-zone-right"
          aria-label="Next story"
          tabIndex={-1}
          onPointerUp={(event) => handleNavigationPointer(event, nextStory)}
        />
        <header className="story-view-header">
          <button type="button" className="story-back-button" onClick={onClose}>Back</button>
          <div className="story-view-author">
            <span className="story-view-avatar">{avatar ? <img src={avatar} alt="" /> : initials(group.user)}</span>
            <span><strong>{currentGroupName}</strong><small>{story.category_id} · {formatTime(story.created_at)}</small></span>
            {group.user?.is_verified && <b className="story-verified">✓</b>}
          </div>
          {isOwnStory ? <button type="button" className="story-delete-button" disabled={deleting} onClick={handleDelete}>{deleting ? 'Deleting...' : 'Delete'}</button> : <span />}
        </header>

        <article className="story-view-content">
          {story.media_url && !mediaError && story.media_type === 'image' && <img src={story.media_url} alt="Update" onError={() => setMediaError(true)} />}
          {story.media_url && !mediaError && story.media_type === 'video' && (
            <video
              key={story.id}
              ref={videoRef}
              src={story.media_url}
              autoPlay
              muted
              playsInline
              controls={false}
              onCanPlay={playActiveVideo}
              onError={() => setMediaError(true)}
            />
          )}
          {story.media_url && mediaError && <div className="story-media-fallback">Media unavailable</div>}
          {story.content && <p>{story.content}</p>}
        </article>

        <div className="story-view-controls" aria-label={`User story group ${userIndex + 1} of ${availableGroups.length}`}>
          <span>{userIndex + 1} / {availableGroups.length}</span>
        </div>
      </div>
    </main>
  );
}
