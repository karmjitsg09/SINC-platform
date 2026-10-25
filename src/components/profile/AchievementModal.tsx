import React, { useState, useEffect } from 'react';

export interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
  initialData?: any;
}

export default function AchievementModal({ isOpen, onClose, onSave, initialData = null }: AchievementModalProps) {
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [achievementDate, setAchievementDate] = useState('');
  const [description, setDescription] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setOrganization(initialData.organization || '');
      setAchievementDate(initialData.achievement_date || '');
      setDescription(initialData.description || '');
      setCredentialId(initialData.credential_id || '');
      setCredentialUrl(initialData.credential_url || '');
      setImageUrl(initialData.image_url || '');
      setSkillsInput(
        Array.isArray(initialData.skills)
          ? initialData.skills.join(', ')
          : (initialData.skills || '')
      );
    } else {
      setTitle('');
      setOrganization('');
      setAchievementDate('');
      setDescription('');
      setCredentialId('');
      setCredentialUrl('');
      setImageUrl('');
      setSkillsInput('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Achievement title is required');
      return;
    }

    let formattedUrl = credentialUrl.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let formattedImgUrl = imageUrl.trim();
    if (formattedImgUrl && !/^https?:\/\//i.test(formattedImgUrl) && !formattedImgUrl.startsWith('data:')) {
      formattedImgUrl = `https://${formattedImgUrl}`;
    }

    setSaving(true);
    setError('');

    const parsedSkills = skillsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      organization: organization.trim(),
      achievement_date: achievementDate || null,
      description: description.trim(),
      credential_id: credentialId.trim(),
      credential_url: formattedUrl,
      image_url: formattedImgUrl,
      skills: parsedSkills,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Error saving achievement:', err);
      setError(err.message || 'Failed to save achievement');
    } finally {
      setSaving(false);
    }
  };

  const previewSkills = skillsInput
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '560px',
          borderRadius: '20px',
          border: '1.5px solid #b5d2fd',
          boxShadow: '0 20px 45px -10px rgba(13, 110, 253, 0.2), 0 0 1px rgba(15, 23, 42, 0.1)',
          padding: '28px',
          position: 'relative',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInModal 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1e3860' }}>
              {initialData ? 'Edit Achievement' : 'Add Achievement'}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Highlight your awards, competition honors, and recognized milestones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'background 0.2s'
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', paddingRight: '4px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Achievement Title */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Achievement Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1st Place - Global AI Hackathon 2024"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #b5d2fd',
                fontSize: '14px',
                outline: 'none',
                color: '#1e293b',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Organization & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
                Organization / Issuer
              </label>
              <input
                type="text"
                placeholder="e.g. Google, MIT, Techstars"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #b5d2fd',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
                Achievement Date
              </label>
              <input
                type="date"
                value={achievementDate}
                onChange={(e) => setAchievementDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #b5d2fd',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Credential ID & Credential URL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
                Credential ID <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HACK-2024-WINNER"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #b5d2fd',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
                Credential URL <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. https://devpost.com/..."
                value={credentialUrl}
                onChange={(e) => setCredentialUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #b5d2fd',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Image / Certificate URL <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. https://images.unsplash.com/photo-... or certificate image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #b5d2fd',
                fontSize: '14px',
                outline: 'none',
                color: '#1e293b',
                boxSizing: 'border-box'
              }}
            />
            {imageUrl && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={imageUrl}
                  alt="Achievement Preview"
                  style={{
                    width: '60px',
                    height: '40px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '1px solid #bfdbfe'
                  }}
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <span style={{ fontSize: '12px', color: '#64748b' }}>Image preview</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Description <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Describe the recognition, competition scope, impact, or significance of the honor..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #b5d2fd',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                color: '#1e293b',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Skills / Technologies */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Associated Skills <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(comma separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Deep Learning, PyTorch, Autonomous Systems, Presentation"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #b5d2fd',
                fontSize: '14px',
                outline: 'none',
                color: '#1e293b',
                boxSizing: 'border-box'
              }}
            />
            {previewSkills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {previewSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: '#eff6ff',
                      color: '#0d6efd',
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      border: '1px solid #bfdbfe'
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 22px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#0d6efd',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(13, 110, 253, 0.25)'
              }}
            >
              {saving ? 'Saving...' : (initialData ? 'Update Achievement' : 'Add Achievement')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
