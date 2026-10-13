import React, { useState, useEffect } from 'react';

const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Self-employed',
  'Freelance',
  'Contract',
  'Internship',
  'Apprenticeship'
];

export default function ExperienceModal({ isOpen, onClose, onSave, initialData = null }) {
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setJobTitle(initialData.job_title || '');
      setCompany(initialData.company || '');
      setEmploymentType(initialData.employment_type || 'Full-time');
      setLocation(initialData.location || '');
      setStartDate(initialData.start_date || '');
      setEndDate(initialData.end_date || '');
      setIsCurrent(Boolean(initialData.is_current));
      setDescription(initialData.description || '');
      setSkillsInput(
        Array.isArray(initialData.skills)
          ? initialData.skills.join(', ')
          : (initialData.skills || '')
      );
    } else {
      setJobTitle('');
      setCompany('');
      setEmploymentType('Full-time');
      setLocation('');
      setStartDate('');
      setEndDate('');
      setIsCurrent(false);
      setDescription('');
      setSkillsInput('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobTitle.trim()) {
      setError('Job title is required');
      return;
    }
    if (!company.trim()) {
      setError('Company name is required');
      return;
    }

    if (!isCurrent && startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setError('End date cannot be earlier than start date');
      return;
    }

    setSaving(true);
    setError('');

    const parsedSkills = skillsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      job_title: jobTitle.trim(),
      company: company.trim(),
      employment_type: employmentType,
      location: location.trim(),
      start_date: startDate || null,
      end_date: isCurrent ? null : (endDate || null),
      is_current: isCurrent,
      description: description.trim(),
      skills: parsedSkills,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error saving experience:', err);
      setError(err.message || 'Failed to save experience');
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
              {initialData ? 'Edit Experience' : 'Add Experience'}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Highlight your work roles, employment history, and key achievements.
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', paddingRight: '4px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Job Title */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Job Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Senior Full-Stack Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
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

          {/* Company & Employment Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
                Company <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Google, Stripe"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
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
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #b5d2fd',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  boxSizing: 'border-box'
                }}
              >
                {EMPLOYMENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Location
            </label>
            <input
              type="text"
              placeholder="e.g. San Francisco, CA (Hybrid) or Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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

          {/* Current Role Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <input
              type="checkbox"
              id="is_current_role"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: '#0d6efd',
                cursor: 'pointer'
              }}
            />
            <label htmlFor="is_current_role" style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e3860', cursor: 'pointer' }}>
              I am currently working in this role
            </label>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
                End Date
              </label>
              <input
                type="date"
                disabled={isCurrent}
                value={isCurrent ? '' : endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #b5d2fd',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1e293b',
                  backgroundColor: isCurrent ? '#f1f5f9' : '#ffffff',
                  cursor: isCurrent ? 'not-allowed' : 'default',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe your responsibilities, key accomplishments, or leadership impact..."
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
              Skills & Technologies Used <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b' }}>(comma separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. React, Node.js, AWS, System Architecture, Docker"
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

          {/* Buttons */}
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
              {saving ? 'Saving...' : (initialData ? 'Update Experience' : 'Add Experience')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
