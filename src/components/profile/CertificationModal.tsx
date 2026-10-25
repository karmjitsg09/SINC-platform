import React, { useState, useEffect } from 'react';

export interface CertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
  initialData?: any;
}

export default function CertificationModal({ isOpen, onClose, onSave, initialData = null }: CertificationModalProps) {
  const [name, setName] = useState('');
  const [issuingOrg, setIssuingOrg] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [doesNotExpire, setDoesNotExpire] = useState(false);
  const [credentialId, setCredentialId] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setIssuingOrg(initialData.issuing_organization || '');
      setIssueDate(initialData.issue_date || '');
      setExpirationDate(initialData.expiration_date || '');
      setDoesNotExpire(Boolean(initialData.does_not_expire));
      setCredentialId(initialData.credential_id || '');
      setCredentialUrl(initialData.credential_url || '');
      setDescription(initialData.description || '');
      setSkillsInput(
        Array.isArray(initialData.skills)
          ? initialData.skills.join(', ')
          : (initialData.skills || '')
      );
    } else {
      setName('');
      setIssuingOrg('');
      setIssueDate('');
      setExpirationDate('');
      setDoesNotExpire(false);
      setCredentialId('');
      setCredentialUrl('');
      setDescription('');
      setSkillsInput('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Certification name is required');
      return;
    }

    if (!doesNotExpire && issueDate && expirationDate && new Date(issueDate) > new Date(expirationDate)) {
      setError('Expiration date cannot be earlier than issue date');
      return;
    }

    let formattedUrl = credentialUrl.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setSaving(true);
    setError('');

    const parsedSkills = skillsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      issuing_organization: issuingOrg.trim(),
      issue_date: issueDate || null,
      expiration_date: doesNotExpire ? null : (expirationDate || null),
      does_not_expire: doesNotExpire,
      credential_id: credentialId.trim(),
      credential_url: formattedUrl,
      description: description.trim(),
      skills: parsedSkills,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Error saving certification:', err);
      setError(err.message || 'Failed to save certification');
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
              {initialData ? 'Edit Certification' : 'Add Certification'}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Add your professional licenses, certificates, and credentials.
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
          {/* Certification Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Certification Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AWS Certified Solutions Architect - Associate"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          {/* Issuing Organization */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Issuing Organization
            </label>
            <input
              type="text"
              placeholder="e.g. Amazon Web Services, Google Cloud, Meta"
              value={issuingOrg}
              onChange={(e) => setIssuingOrg(e.target.value)}
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

          {/* Expiration Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
            <input
              type="checkbox"
              id="does_not_expire"
              checked={doesNotExpire}
              onChange={(e) => setDoesNotExpire(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: '#0d6efd',
                cursor: 'pointer'
              }}
            />
            <label htmlFor="does_not_expire" style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e3860', cursor: 'pointer' }}>
              This certification does not expire
            </label>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
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
                Expiration Date
              </label>
              <input
                type="date"
                disabled={doesNotExpire}
                value={doesNotExpire ? '' : expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #b5d2fd',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                  backgroundColor: doesNotExpire ? '#f1f5f9' : '#ffffff',
                  cursor: doesNotExpire ? 'not-allowed' : 'default',
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
                placeholder="e.g. AWS-10293847"
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
                placeholder="e.g. https://credly.com/..."
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

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Description <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Describe the skills verified, certification score, or topics mastered..."
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
              Skills & Technologies <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(comma separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Cloud Security, AWS Lambda, IAM, VPC, S3"
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
              {saving ? 'Saving...' : (initialData ? 'Update Certification' : 'Add Certification')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
