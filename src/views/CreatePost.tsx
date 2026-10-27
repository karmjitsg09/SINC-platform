import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createPost as createPostService } from '../lib/postService';
import { FEED_CATEGORIES } from '../data/mockData';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;  // 20 MB

export interface CreatePostProps {
  onBack?: () => void;
  onPostCreated?: (newPost: any) => void;
  initialDomain?: string;
  initialMediaType?: 'image' | 'video' | 'link' | 'code' | 'none' | string;
}

interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export default function CreatePost({
  onBack,
  onPostCreated,
  initialDomain = 'tech',
  initialMediaType = 'none'
}: CreatePostProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState('');
  const [feedDomain, setFeedDomain] = useState(initialDomain || 'tech');
  const [content, setContent] = useState('');

  const [mediaType, setMediaType] = useState<'image' | 'video' | 'link' | 'code' | 'none'>(
    (['image', 'video', 'link', 'code'].includes(initialMediaType) ? initialMediaType : 'none') as 'image' | 'video' | 'link' | 'code' | 'none'
  );

  useEffect(() => {
    if (initialMediaType === 'image') {
      setMediaType('image');
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else if (initialMediaType === 'video') {
      setMediaType('video');
      setTimeout(() => videoInputRef.current?.click(), 100);
    } else if (initialMediaType === 'code') {
      setMediaType('code');
    }
  }, [initialMediaType]);

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [layoutType, setLayoutType] = useState<'collage' | 'carousel'>('collage');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [videoSizeMb, setVideoSizeMb] = useState<string | number>(0);

  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [linkUrl, setLinkUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Upload progress & submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ active: false, percent: 0, text: '' });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const initials = (user?.name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Handle multiple image selection (1-5 images)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Rule: Video cannot be mixed with images
    if (videoFile) {
      setVideoFile(null);
      setVideoPreview('');
    }

    const currentCount = selectedImages.length;
    const incomingCount = files.length;
    if (currentCount + incomingCount > 5) {
      setErrorMessage('You can select up to 5 images.');
    }

    const remainingSlots = Math.max(0, 5 - currentCount);
    const filesToProcess = files.slice(0, remainingSlots);
    const newItems: SelectedImage[] = [];

    for (const file of filesToProcess) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Only valid image files (PNG, JPG, WebP, GIF) are allowed.');
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setErrorMessage(`Each image must be ${(MAX_IMAGE_SIZE / (1024 * 1024)).toFixed(0)} MB or smaller.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        previewUrl
      });
    }

    if (newItems.length > 0) {
      setSelectedImages((prev) => [...prev, ...newItems]);
      setMediaType('image');
      setErrorMessage('');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove individual image
  const handleRemoveImage = (idToRemove: string) => {
    setSelectedImages((prev) => {
      const filtered = prev.filter((img) => img.id !== idToRemove);
      if (filtered.length === 0) {
        setMediaType('none');
      }
      return filtered;
    });
  };

  // Handle video upload (up to 100 MB)
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_VIDEO_SIZE) {
      setErrorMessage('Video must be 100 MB or smaller.');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    // Rule: Clear any existing image attachments
    if (selectedImages.length > 0) {
      setSelectedImages([]);
    }

    setVideoFile(file);
    setVideoSizeMb((file.size / (1024 * 1024)).toFixed(1));
    const previewUrl = URL.createObjectURL(file);
    setVideoPreview(previewUrl);
    setMediaType('video');
    setErrorMessage('');

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Remove video
  const handleRemoveVideo = () => {
    setVideoFile(null);
    setVideoPreview('');
    setVideoSizeMb(0);
    setMediaType('none');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!user || !user.id) {
      setErrorMessage('You must be logged in to create a post.');
      return;
    }

    if (!feedDomain) {
      setErrorMessage('Please select a feed / domain.');
      return;
    }

    if (!description.trim() && !content.trim() && selectedImages.length === 0 && !videoFile) {
      setErrorMessage('Please enter some text or attach media.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress({ active: true, percent: 10, text: 'Preparing media...' });
    const postTitle = description.trim() || content.trim().substring(0, 50);

    try {
      let preparedMediaItems: any[] = [];

      if (mediaType === 'image' && selectedImages.length > 0) {
        preparedMediaItems = selectedImages.map((img) => ({
          file: img.file,
          type: 'image',
          previewUrl: img.previewUrl,
          url: img.previewUrl
        }));
      } else if (mediaType === 'video' && videoFile) {
        preparedMediaItems = [{
          file: videoFile,
          type: 'video',
          previewUrl: videoPreview,
          url: videoPreview
        }];
      }

      const payload = {
        authorId: user.id,
        authorObj: user,
        domain: feedDomain,
        content: content.trim() || description.trim(),
        title: postTitle,
        mediaType: mediaType === 'link' ? 'link' : mediaType === 'code' ? 'code' : mediaType,
        mediaItems: preparedMediaItems,
        layout: selectedImages.length > 1 ? layoutType : 'single',
        mediaUrl: mediaType === 'link' ? linkUrl : null,
        codeSnippet: mediaType === 'code' ? codeSnippet : null,
        codeLanguage: mediaType === 'code' ? codeLanguage : null,
        is_private: isPrivate,
        onProgress: (percent: number, text: string) => {
          setUploadProgress({ active: true, percent, text });
        }
      };

      const newPost = await createPostService(payload);
      setUploadProgress({ active: false, percent: 100, text: 'Done!' });
      setIsSubmitting(false);

      if (newPost) {
        setSuccessMessage('✓ Post published successfully!');
        setDescription('');
        setContent('');
        setSelectedImages([]);
        setVideoFile(null);
        setVideoPreview('');
        setMediaType('none');

        setTimeout(() => {
          if (onPostCreated) {
            onPostCreated(newPost);
          } else if (onBack) {
            onBack();
          }
        }, 800);
      }
    } catch (err: any) {
      console.error('[CreatePost] Form submission error:', err);
      setIsSubmitting(false);
      setUploadProgress({ active: false, percent: 0, text: '' });
      setErrorMessage(err.message || 'Failed to create post. Please try again.');
    }
  };

  return (
    <div className="main-content">
      <div className="content-card" style={{ padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Top Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexShrink: 0 }}>
          <h2 className="page-title" style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-main, #1e3860)', letterSpacing: '0.5px' }}>
            CREATE POST
          </h2>

          {onBack && (
            <button
              type="button"
              className="back-btn"
              onClick={onBack}
              disabled={isSubmitting}
              style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Status Alerts */}
        {successMessage && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '14px',
              marginBottom: '16px',
              flexShrink: 0
            }}
          >
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '14px',
              marginBottom: '16px',
              flexShrink: 0
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Upload Progress Indicator */}
        {uploadProgress.active && (
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#eff6ff',
              borderRadius: '14px',
              border: '1.5px solid #bfdbfe',
              marginBottom: '16px',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: '700', color: '#1e40af', marginBottom: '6px' }}>
              <span>{uploadProgress.text || 'Uploading media...'}</span>
              <span>{uploadProgress.percent}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#dbeafe', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${uploadProgress.percent}%`,
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  borderRadius: '4px',
                  transition: 'width 0.2s ease'
                }}
              />
            </div>
          </div>
        )}

        {/* Author Info Snippet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexShrink: 0 }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#bcd5fa',
              border: '1.5px solid #b5d2fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '14px',
              color: '#1e3860',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            {user?.avatar_url || user?.avatarUrl ? (
              <img src={(user.avatar_url || user.avatarUrl) ?? undefined} alt={user?.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main, #1e3860)' }}>
              {user?.name || 'Authenticated User'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #7b98bd)' }}>
              @{user?.username || 'user'} • {user?.role || 'Member'}
            </div>
          </div>
        </div>

        {/* Post Creation Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {/* Domain Category Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Domain / Feed Topic
            </label>
            <select
              value={feedDomain}
              onChange={(e) => setFeedDomain(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '13.5px',
                color: '#1e293b',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {FEED_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Post Visibility Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e293b' }}>
                Post Visibility: {isPrivate ? 'Private (Followers Only)' : 'Public (Everyone)'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                {isPrivate ? 'Only approved followers can see this post in their feed and profile.' : 'Visible to all members of SINC across domain feeds.'}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={isSubmitting}
                style={{ width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' }}
              />
            </label>
          </div>

          {/* Description / Summary Field */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Post Title / Summary
            </label>
            <input
              type="text"
              placeholder="Give your post a punchy title or headline..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                fontSize: '14px',
                color: '#1e293b',
                outline: 'none'
              }}
            />
          </div>

          {/* Detailed Content Field */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Content
            </label>
            <textarea
              rows={4}
              placeholder="What's on your mind? Share detailed thoughts, insights, or code..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                fontSize: '14px',
                color: '#1e293b',
                outline: 'none',
                resize: 'vertical',
                lineHeight: '1.5'
              }}
            />
          </div>

          {/* Media Attachments Toolbar */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              Attach Media (Up to 5 Photos or 1 Video up to 100 MB)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {/* Photo Upload Trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || selectedImages.length >= 5}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: mediaType === 'image' ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                  backgroundColor: mediaType === 'image' ? '#eff6ff' : '#ffffff',
                  color: mediaType === 'image' ? '#2563eb' : '#475569',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: selectedImages.length >= 5 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: selectedImages.length >= 5 ? 0.6 : 1
                }}
              >
                📷 Photos {selectedImages.length > 0 ? `(${selectedImages.length}/5)` : ''}
              </button>

              {/* Video Upload Trigger */}
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={isSubmitting}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: mediaType === 'video' ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                  backgroundColor: mediaType === 'video' ? '#eff6ff' : '#ffffff',
                  color: mediaType === 'video' ? '#2563eb' : '#475569',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🎥 Video (Max 100 MB)
              </button>

              {/* Link Trigger */}
              <button
                type="button"
                onClick={() => setMediaType(mediaType === 'link' ? 'none' : 'link')}
                disabled={isSubmitting}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: mediaType === 'link' ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                  backgroundColor: mediaType === 'link' ? '#eff6ff' : '#ffffff',
                  color: mediaType === 'link' ? '#2563eb' : '#475569',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🔗 Link
              </button>

              {/* Code Snippet Trigger */}
              <button
                type="button"
                onClick={() => setMediaType(mediaType === 'code' ? 'none' : 'code')}
                disabled={isSubmitting}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: mediaType === 'code' ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                  backgroundColor: mediaType === 'code' ? '#eff6ff' : '#ffffff',
                  color: mediaType === 'code' ? '#2563eb' : '#475569',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                💻 Code
              </button>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              <input
                type="file"
                ref={videoInputRef}
                accept="video/*"
                style={{ display: 'none' }}
                onChange={handleVideoUpload}
              />
            </div>

            {/* MULTIPLE IMAGE PREVIEWS (1-5 images) */}
            {mediaType === 'image' && selectedImages.length > 0 && (
              <div style={{ marginTop: '10px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e3860' }}>
                    Selected: {selectedImages.length} / 5
                  </span>
                  {selectedImages.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      + Add More Photos
                    </button>
                  )}
                </div>

                {/* Thumbnails Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                    gap: '10px',
                    marginBottom: selectedImages.length > 1 ? '16px' : '4px'
                  }}
                >
                  {selectedImages.map((img, idx) => (
                    <div
                      key={img.id}
                      style={{
                        position: 'relative',
                        height: '90px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#0f172a'
                      }}
                    >
                      <img
                        src={img.previewUrl}
                        alt={`Selected preview ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        title="Remove photo"
                        aria-label={`Remove photo ${idx + 1}`}
                        disabled={isSubmitting}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(15, 23, 42, 0.75)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ✕
                      </button>
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          backgroundColor: 'rgba(15, 23, 42, 0.7)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}
                      >
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>

                {/* LAYOUT CHOICE (COLLAGE vs SWIPEABLE) WHEN 2-5 IMAGES SELECTED */}
                {selectedImages.length > 1 && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e3860', marginBottom: '8px' }}>
                      How should these images be displayed?
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {/* Option 1: Collage */}
                      <button
                        type="button"
                        onClick={() => setLayoutType('collage')}
                        disabled={isSubmitting}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: layoutType === 'collage' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                          backgroundColor: layoutType === 'collage' ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13px', color: layoutType === 'collage' ? '#1d4ed8' : '#334155' }}>
                          <span>⊞</span> Collage
                          {layoutType === 'collage' && <span style={{ marginLeft: 'auto', color: '#2563eb' }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Adaptive grid showing all photos together
                        </span>
                      </button>

                      {/* Option 2: Swipeable Photos / Carousel */}
                      <button
                        type="button"
                        onClick={() => setLayoutType('carousel')}
                        disabled={isSubmitting}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: layoutType === 'carousel' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                          backgroundColor: layoutType === 'carousel' ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13px', color: layoutType === 'carousel' ? '#1d4ed8' : '#334155' }}>
                          <span>⇄</span> Swipeable Photos
                          {layoutType === 'carousel' && <span style={{ marginLeft: 'auto', color: '#2563eb' }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Single-view slider with arrow & swipe controls
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIDEO PREVIEW BOX */}
            {mediaType === 'video' && videoPreview && (
              <div style={{ position: 'relative', marginTop: '10px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #cbd5e1', backgroundColor: '#000000' }}>
                <video src={videoPreview} controls style={{ width: '100%', maxHeight: '240px', display: 'block' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '11.5px' }}>
                  <span>🎥 {videoFile?.name || 'Attached Video'} ({videoSizeMb} MB / 100 MB max)</span>
                  <button
                    type="button"
                    onClick={handleRemoveVideo}
                    disabled={isSubmitting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '11.5px'
                    }}
                  >
                    Remove Video ✕
                  </button>
                </div>
              </div>
            )}

            {/* Link Input Box */}
            {mediaType === 'link' && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            )}

            {/* Code Snippet Box */}
            {mediaType === 'code' && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '150px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML/CSS</option>
                  <option value="sql">SQL</option>
                </select>
                <textarea
                  rows={3}
                  placeholder="// Paste code snippet here..."
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #1e293b', backgroundColor: '#0f172a', color: '#38bdf8', fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>
            )}
          </div>

          {/* Bottom Right Post Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: isSubmitting ? '#94a3b8' : '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '24px',
                padding: '12px 36px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(59, 130, 246, 0.35)',
                transition: 'transform 0.15s ease, background-color 0.15s ease'
              }}
            >
              {isSubmitting ? (uploadProgress.active ? `${uploadProgress.percent}% Posting...` : 'Posting...') : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
