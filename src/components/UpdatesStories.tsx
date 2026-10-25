import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UPDATE_CATEGORIES, getUpdateCategoryLabel } from '../data/updatesData';
import {
  classifyUpdateError,
  createUpdate,
  getActiveUpdates,
  getViewedUpdateIds,
  removeUpdateMedia,
  subscribeToUpdates,
  uploadUpdateMedia,
  UpdateRecord
} from '../lib/updatesService';

export type UpdateProfile = UpdateRecord['profile'];
export type UpdateItem = UpdateRecord;

export interface UpdateGroup {
  user?: UpdateProfile | null;
  updates: UpdateItem[];
}

export interface UpdatesStoriesProps {
  selectedUpdateCategory?: string;
  onSelectUpdateCategory: (categoryId: string) => void;
  onOpenStoryViewer: (group: UpdateGroup, allGroups: UpdateGroup[]) => void;
}

function initials(profile?: UpdateProfile | null): string {
  return (profile?.name || profile?.username || 'User')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function groupByUser(updates: UpdateItem[]): UpdateGroup[] {
  const groups = new Map<string, UpdateGroup>();
  updates.forEach((update) => {
    const key = update.user_id;
    if (!groups.has(key)) groups.set(key, { user: update.profile, updates: [] });
    groups.get(key)!.updates.push(update);
  });
  return Array.from(groups.values());
}

export default function UpdatesStories({
  selectedUpdateCategory = 'all',
  onSelectUpdateCategory,
  onOpenStoryViewer
}: UpdatesStoriesProps) {
  const { user: currentUser, isAuthenticated } = useAuth();
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [errorType, setErrorType] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState<boolean>(false);
  const [content, setContent] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('tech');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);

  const loadUpdates = async () => {
    setLoading(true);
    setError('');
    setErrorType(null);
    const result = await getActiveUpdates();
    if (result.error) {
      const type = classifyUpdateError(result.error);
      setErrorType(type);
      setError(type === 'authentication' ? 'Sign in again to load updates.' : 'Unable to load updates right now.');
    }
    const nextUpdates = result.data || [];
    setUpdates(nextUpdates);
    const ids = await getViewedUpdateIds(nextUpdates.map((update) => update.id), currentUser?.id);
    setViewedIds(ids);
    setLoading(false);
  };

  useEffect(() => {
    loadUpdates();
    const unsubscribe = subscribeToUpdates(loadUpdates);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const nextExpiry = updates
      .map((update) => new Date(update.expires_at).getTime())
      .filter((timestamp) => timestamp > Date.now())
      .sort((first, second) => first - second)[0];
    if (!nextExpiry) return undefined;
    const timer = window.setTimeout(loadUpdates, Math.max(0, nextExpiry - Date.now() + 50));
    return () => window.clearTimeout(timer);
  }, [updates]);

  const filteredUpdates = useMemo(() => (
    selectedUpdateCategory === 'all'
      ? updates
      : updates.filter((update) => update.category_id === selectedUpdateCategory)
  ), [selectedUpdateCategory, updates]);

  const groups = useMemo(() => groupByUser(filteredUpdates), [filteredUpdates]);
  const categoryLabel = getUpdateCategoryLabel(selectedUpdateCategory);

  async function publishUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser?.id || (!content.trim() && !mediaFile)) return;
    setPublishing(true);
    setError('');
    setErrorType(null);
    let mediaUrl: string | null = null;
    let mediaType = 'none';
    let uploadedPath: string | null = null;
    const updateId = crypto.randomUUID();

    try {
      if (mediaFile) {
        mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
        const upload = await uploadUpdateMedia(mediaFile, currentUser.id, updateId);
        if (upload.error) throw upload.error;
        mediaUrl = upload.data?.publicUrl || null;
        uploadedPath = upload.data?.path || null;
      }
      const result = await createUpdate({ id: updateId, userId: currentUser.id, categoryId, content, mediaUrl, mediaType });
      if (result.error) throw result.error;
      setContent('');
      setMediaFile(null);
      setShowComposer(false);
      await loadUpdates();
    } catch (publishError: any) {
      if (uploadedPath) await removeUpdateMedia(uploadedPath, currentUser.id);
      const type = classifyUpdateError(publishError);
      setErrorType(type);
      setError(type === 'storage-bucket-missing'
        ? 'Story media storage is not configured yet. Text-only updates are still available.'
        : type === 'authentication'
          ? 'Sign in again before posting an update.'
          : 'Unable to publish this update right now.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="updates-panel" aria-labelledby="updates-title">
      <div className="updates-heading">
        <div>
          <span className="updates-kicker">Live now</span>
          <h2 id="updates-title">Updates</h2>
        </div>
        <div className="updates-actions">
          <span className="updates-count">{groups.length} {groups.length === 1 ? 'story' : 'stories'}</span>
          {isAuthenticated && (
            <button type="button" className="updates-compose-button" onClick={() => setShowComposer((open) => !open)}>
              {showComposer ? 'Close' : 'Post update'}
            </button>
          )}
        </div>
      </div>

      <div className="update-filter-pills" aria-label="Update categories">
        {UPDATE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`update-filter-pill ${category.id === selectedUpdateCategory ? 'selected' : ''}`}
            onClick={() => onSelectUpdateCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {showComposer && (
        <form className="update-composer" onSubmit={publishUpdate}>
          <label>
            Category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {UPDATE_CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            Content
            <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} placeholder="Share a moment..." />
          </label>
          <label className="update-file-input">
            Media (optional)
            <input type="file" accept="image/*,video/*" onChange={(event) => setMediaFile(event.target.files?.[0] || null)} />
          </label>
          <button type="submit" disabled={publishing || (!content.trim() && !mediaFile)}>{publishing ? 'Posting...' : 'Post update'}</button>
        </form>
      )}

      {loading && <div className="updates-empty-state">Loading updates...</div>}
      {!loading && error && (
        <div className="updates-empty-state updates-error">
          <span>{error}{errorType === 'storage-bucket-missing' ? ' Contact an administrator to apply the Updates Storage migration.' : ''}</span>
          <button type="button" onClick={loadUpdates}>Retry</button>
        </div>
      )}
      {!loading && !error && groups.length === 0 && (
        <div className="updates-empty-state">No active {selectedUpdateCategory === 'all' ? 'updates' : `${categoryLabel} updates`} yet.</div>
      )}
      {!loading && !error && groups.length > 0 && (
        <div className="story-user-strip" aria-label="Active user stories">
          {groups.map((group) => {
            const hasUnviewed = group.updates.some((update) => !viewedIds.has(update.id));
            const avatar = group.user?.avatar_url;
            return (
              <button
                type="button"
                className="story-user"
                key={group.user?.id || group.updates[0].user_id}
                onClick={() => onOpenStoryViewer(group, groups)}
              >
                <span className={`story-user-ring ${hasUnviewed ? 'unviewed' : 'viewed'}`}>
                  <span className="story-user-avatar">
                    {avatar ? <img src={avatar} alt="" /> : initials(group.user)}
                  </span>
                </span>
                <strong>{group.user?.name || group.user?.username || 'User'}</strong>
                <span>{group.updates.length} {group.updates.length === 1 ? 'story' : 'stories'}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
