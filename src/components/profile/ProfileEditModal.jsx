import React, { useState, useRef, useMemo } from 'react';
import LocationSelector from './LocationSelector';
import SkillMultiSelect from './SkillMultiSelect';
import { validateLocationFields } from '../../lib/locationService';
import { checkUsernameAvailability, calculateAge, uploadProfilePhoto } from '../../lib/profileService';
import { SKILL_OPTIONS } from '../../data/skillsData';

const POPULAR_LANGUAGES = [
  'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam',
  'Spanish', 'French', 'German', 'Mandarin', 'Japanese'
];

const AVAILABLE_DOMAINS = [
  { id: 'tech', name: 'Technology' },
  { id: 'ai', name: 'Artificial Intelligence' },
  { id: 'ml', name: 'Machine Learning' },
  { id: 'cybersecurity', name: 'Cybersecurity' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'finance', name: 'Finance' },
  { id: 'design', name: 'Design & UI/UX' },
  { id: 'business', name: 'Business & Entrepreneurship' },
  { id: 'education', name: 'Education' },
  { id: 'research', name: 'Research & Science' },
  { id: 'social_media', name: 'Social Media' },
  { id: 'food', name: 'Food & Culinary' }
];

function TagInput({ label, helper, tags = [], onTagsChange, placeholder }) {
  const [val, setVal] = useState('');

  const add = (t) => {
    const clean = t.trim();
    if (clean && !tags.includes(clean)) {
      onTagsChange([...tags, clean]);
    }
    setVal('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e3860' }}>{label}</label>
        {helper && <span style={{ fontSize: '11.5px', color: '#64748b' }}>{helper}</span>}
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tags.map((tag, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e40af',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              {tag}
              <button
                type="button"
                onClick={() => onTagsChange(tags.filter((_, i) => i !== idx))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(val);
          }
        }}
        placeholder={placeholder || 'Type and press Enter...'}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
}

export default function ProfileEditModal({
  profileUser,
  onSave,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('basic');
  const fileInputRef = useRef(null);
  const professionalPhotoInputRef = useRef(null);

  // 1. Basic Info
  const [firstName, setFirstName] = useState(() => {
    if (profileUser?.first_name) return profileUser.first_name;
    if (profileUser?.name) return profileUser.name.split(' ')[0] || '';
    return '';
  });
  const [lastName, setLastName] = useState(() => {
    if (profileUser?.last_name) return profileUser.last_name;
    if (profileUser?.name) {
      const parts = profileUser.name.split(' ');
      return parts.slice(1).join(' ') || '';
    }
    return '';
  });
  const [username, setUsername] = useState(profileUser?.username || '');
  const [bio, setBio] = useState(profileUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profileUser?.avatarUrl || profileUser?.avatar_url || '');
  const [dateOfBirth, setDateOfBirth] = useState(profileUser?.date_of_birth || '');
  const [gender, setGender] = useState(profileUser?.gender || 'prefer_not_to_say');
  const [customGender, setCustomGender] = useState(profileUser?.gender_custom || '');
  const [languages, setLanguages] = useState(profileUser?.languages || ['English']);
  const [professionalPhotoUrl, setProfessionalPhotoUrl] = useState(
    profileUser?.professional_photo_url || ''
  );

  const derivedAge = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth]);

  // 2. Location
  const [locationData, setLocationData] = useState(() => ({
    placeName: profileUser?.location_place_name || '',
    address: profileUser?.location_address || '',
    area: profileUser?.location_area || '',
    landmark: profileUser?.location_landmark || '',
    city: profileUser?.location_city || '',
    state: profileUser?.location_state || '',
    country: profileUser?.location_country || 'India',
    pincode: profileUser?.location_pincode || '',
    latitude: profileUser?.location_latitude ?? null,
    longitude: profileUser?.location_longitude ?? null,
    displayLocation: profileUser?.location || ''
  }));

  // 3. Profession
  const [professionType, setProfessionType] = useState(profileUser?.profession_type || profileUser?.profile_type || 'student');
  const [roleTitle, setRoleTitle] = useState(profileUser?.role || profileUser?.profession_details?.jobTitle || '');
  const [companyOrSchool, setCompanyOrSchool] = useState(
    profileUser?.profession_details?.company || profileUser?.profession_details?.institution || profileUser?.company || profileUser?.college || ''
  );
  const [courseOrDept, setCourseOrDept] = useState(
    profileUser?.profession_details?.course || profileUser?.profession_details?.department || profileUser?.degree || ''
  );
  const [professionSummary, setProfessionSummary] = useState(profileUser?.profession_details?.summary || profileUser?.about_you || '');

  // 4. Skills
  const [technicalSkills, setTechnicalSkills] = useState(profileUser?.skills_technical || profileUser?.skills || []);
  const [softSkills, setSoftSkills] = useState(profileUser?.skills_soft || []);
  const [progLanguages, setProgLanguages] = useState(profileUser?.skills_languages || []);
  const [tools, setTools] = useState(profileUser?.skills_tools || []);
  const [technologies, setTechnologies] = useState(profileUser?.skills_technologies || []);
  const [expertise, setExpertise] = useState(profileUser?.skills_expertise || []);

  // 5. Portfolio & Links
  const [portfolioUrl, setPortfolioUrl] = useState(profileUser?.portfolio_url || '');
  const [githubUrl, setGithubUrl] = useState(profileUser?.github_url || '');
  const [linkedinUrl, setLinkedinUrl] = useState(profileUser?.linkedin_url || '');
  const [otherLinks, setOtherLinks] = useState(profileUser?.other_links || []);

  // 6. Preferences
  const [preferredWorkLocation, setPreferredWorkLocation] = useState(profileUser?.preferred_work_location || ['Remote']);

  // 7. Privacy
  const [privacySettings, setPrivacySettings] = useState(() => ({
    dob_visibility: profileUser?.privacy_settings?.dob_visibility || 'followers',
    gender_visibility: profileUser?.privacy_settings?.gender_visibility || 'only_me',
    location_visibility: profileUser?.privacy_settings?.location_visibility || 'followers',
    profile_visibility: profileUser?.privacy_settings?.profile_visibility || 'everyone'
  }));

  // 8. Domains
  const [selectedDomains, setSelectedDomains] = useState(profileUser?.domains || ['tech']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [locationErrors, setLocationErrors] = useState({});

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setAvatarUrl(reader.result);
      reader.readAsDataURL(file);

      try {
        const uploaded = await uploadProfilePhoto(file, initialData?.id, 'avatar');
        if (uploaded) setAvatarUrl(uploaded);
      } catch (err) {
        console.warn('[ProfileEditModal] Avatar upload error:', err);
      }
    }
  };

  const handleProfessionalPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Professional photo must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setProfessionalPhotoUrl(reader.result);
      reader.readAsDataURL(file);

      try {
        const uploaded = await uploadProfilePhoto(file, initialData?.id, 'professional');
        if (uploaded) setProfessionalPhotoUrl(uploaded);
      } catch (err) {
        console.warn('[ProfileEditModal] Professional photo upload error:', err);
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required.');
      setActiveTab('basic');
      return;
    }

    const locValidation = validateLocationFields(locationData);
    if (!locValidation.isValid) {
      setLocationErrors(locValidation.errors);
      setError('Please complete required location fields.');
      setActiveTab('location');
      return;
    }
    setLocationErrors({});

    setIsSubmitting(true);
    setError(null);

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      const combinedSkills = Array.from(new Set([
        ...technicalSkills,
        ...progLanguages,
        ...tools,
        ...technologies,
        ...softSkills,
        ...expertise
      ]));

      let derivedRole = roleTitle.trim();
      if (!derivedRole) {
        if (professionType === 'student') derivedRole = `Student at ${companyOrSchool.trim() || 'University'}`;
        else if (professionType === 'employee') derivedRole = `${roleTitle.trim() || 'Employee'} at ${companyOrSchool.trim() || 'Company'}`;
        else derivedRole = 'Member';
      }

      await onSave({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: fullName,
        username: cleanUsername || undefined,
        role: derivedRole,
        bio: bio.trim(),
        avatarUrl: avatarUrl || null,
        avatar_url: avatarUrl || null,
        date_of_birth: dateOfBirth || null,
        gender: gender,
        gender_custom: gender === 'other' ? customGender.trim() : null,
        languages: languages,
        professional_photo_url: professionalPhotoUrl || null,

        // Location
        location: (locationData?.displayLocation || '').trim(),
        location_place_name: locationData?.placeName || '',
        location_address: locationData?.address || '',
        location_area: locationData?.area || '',
        location_landmark: locationData?.landmark || '',
        location_city: locationData?.city || '',
        location_state: locationData?.state || '',
        location_country: locationData?.country || 'India',
        location_pincode: locationData?.pincode || '',
        location_latitude: locationData?.latitude ?? null,
        location_longitude: locationData?.longitude ?? null,
        locationData: locationData,

        // Profession
        profession_type: professionType,
        profession_details: {
          jobTitle: roleTitle.trim(),
          company: companyOrSchool.trim(),
          institution: companyOrSchool.trim(),
          course: courseOrDept.trim(),
          summary: professionSummary.trim()
        },

        // Skills
        skills: combinedSkills,
        skills_technical: technicalSkills,
        skills_soft: softSkills,
        skills_languages: progLanguages,
        skills_tools: tools,
        skills_technologies: technologies,
        skills_expertise: expertise,

        // Portfolio
        portfolio_url: portfolioUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        other_links: otherLinks,

        // Preferences & Privacy
        preferred_work_location: preferredWorkLocation,
        privacy_settings: privacySettings,

        // Domains
        domains: selectedDomains
      });

      onClose();
    } catch (err) {
      console.error('[ProfileEditModal] Save error:', err);
      setError(err.message || 'Failed to save changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'location', label: 'Location' },
    { id: 'profession', label: 'Profession' },
    { id: 'skills', label: 'Skills' },
    { id: 'portfolio', label: 'Links' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'domains', label: 'Domains' }
  ];

  const fieldLabel = { display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e3860', marginBottom: '4px' };
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box' };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          border: '1.5px solid var(--border-app, #b5d2fd)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1e3860' }}>
              Edit Profile
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Manage all your question-based profile details
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Tab Strip */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '0 12px' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 14px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === t.id ? '2.5px solid #2563eb' : '2.5px solid transparent',
                color: activeTab === t.id ? '#2563eb' : '#64748b',
                fontWeight: activeTab === t.id ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>
                {error}
              </div>
            )}

            {/* TAB 1: BASIC */}
            {activeTab === 'basic' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabel}>What’s your first name? *</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Do you have a last name?</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={fieldLabel}>What username would you like people to find you by? *</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={inputStyle} />
                </div>

                <div>
                  <label style={fieldLabel}>Would you like to change your profile photo?</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                      {avatarUrl ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'U'}
                    </div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}>
                      Upload New
                    </button>
                    {avatarUrl && (
                      <button type="button" onClick={() => setAvatarUrl('')} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12.5px', cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" style={{ display: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabel}>When were you born? (Date of Birth)</label>
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Derived Age</label>
                    <div style={{ ...inputStyle, backgroundColor: '#f8fafc', fontWeight: '700', color: '#1e3860' }}>
                      {derivedAge !== null ? `${derivedAge} yrs` : 'Calculated automatically'}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={fieldLabel}>How do you identify? (Gender)</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} style={inputStyle}>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                  {gender === 'other' && (
                    <input type="text" placeholder="Custom gender" value={customGender} onChange={(e) => setCustomGender(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} />
                  )}
                </div>

                <div>
                  <label style={fieldLabel}>How would you describe yourself? (Bio)</label>
                  <textarea rows="3" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 250))} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <SkillMultiSelect
                  label="What languages do you speak?"
                  helper="Select or add languages you speak"
                  options={POPULAR_LANGUAGES}
                  selected={languages}
                  onChange={setLanguages}
                  placeholder="Select or search languages (e.g. English, Hindi, Kannada)..."
                  id="edit-languages"
                />

                {/* Professional Photo */}
                <div>
                  <label style={fieldLabel}>Would you like to change your professional photo?</label>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: '#64748b' }}>
                    This is separate from your profile avatar — a formal photo for your professional profile.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #94a3b8', fontSize: '11px', color: '#64748b', fontWeight: '700', textAlign: 'center' }}>
                      {professionalPhotoUrl ? <img src={professionalPhotoUrl} alt="Professional" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} /> : <span>📸</span>}
                    </div>
                    <button type="button" onClick={() => professionalPhotoInputRef.current?.click()} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', color: '#0369a1', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}>
                      Upload Professional
                    </button>
                    {professionalPhotoUrl && (
                      <button type="button" onClick={() => setProfessionalPhotoUrl('')} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12.5px', cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                    <input type="file" ref={professionalPhotoInputRef} onChange={handleProfessionalPhotoUpload} accept="image/*" style={{ display: 'none' }} />
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: LOCATION */}
            {activeTab === 'location' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={fieldLabel}>Where are you located?</label>
                <LocationSelector value={locationData} onChange={setLocationData} errors={locationErrors} />
              </div>
            )}

            {/* TAB 3: PROFESSION */}
            {activeTab === 'profession' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={fieldLabel}>What are you?</label>
                  <select value={professionType} onChange={(e) => setProfessionType(e.target.value)} style={inputStyle}>
                    <option value="student">🎓 Student</option>
                    <option value="employee">💼 Employee</option>
                    <option value="freelancer">💻 Freelancer</option>
                    <option value="self_employed">🏢 Self-employed</option>
                    <option value="other">➕ Other</option>
                  </select>
                </div>

                <div>
                  <label style={fieldLabel}>Role / Job Title</label>
                  <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Student, Software Engineer, Designer" style={inputStyle} />
                </div>

                <div>
                  <label style={fieldLabel}>Company / Institution</label>
                  <input type="text" value={companyOrSchool} onChange={(e) => setCompanyOrSchool(e.target.value)} placeholder="e.g. Yenepoya University, Google" style={inputStyle} />
                </div>

                <div>
                  <label style={fieldLabel}>Course / Department</label>
                  <input type="text" value={courseOrDept} onChange={(e) => setCourseOrDept(e.target.value)} placeholder="e.g. Computer Science, Product" style={inputStyle} />
                </div>

                <div>
                  <label style={fieldLabel}>Professional Summary</label>
                  <textarea rows="3" value={professionSummary} onChange={(e) => setProfessionSummary(e.target.value)} placeholder="Brief summary of what you do..." style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            )}

            {/* TAB 4: SKILLS */}
            {activeTab === 'skills' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <SkillMultiSelect
                  label="Technical Skills"
                  options={SKILL_OPTIONS.technical_skills}
                  selected={technicalSkills}
                  onChange={setTechnicalSkills}
                  placeholder="Select technical skills"
                  id="edit-technical-skills"
                />
                <SkillMultiSelect
                  label="Soft Skills"
                  options={SKILL_OPTIONS.soft_skills}
                  selected={softSkills}
                  onChange={setSoftSkills}
                  placeholder="Select soft skills"
                  id="edit-soft-skills"
                />
                <SkillMultiSelect
                  label="Programming Languages"
                  options={SKILL_OPTIONS.programming_languages}
                  selected={progLanguages}
                  onChange={setProgLanguages}
                  placeholder="Select programming languages"
                  id="edit-programming-languages"
                />
                <SkillMultiSelect
                  label="Tools"
                  options={SKILL_OPTIONS.tools}
                  selected={tools}
                  onChange={setTools}
                  placeholder="Select tools"
                  id="edit-tools"
                />
                <SkillMultiSelect
                  label="Technologies"
                  options={SKILL_OPTIONS.technologies}
                  selected={technologies}
                  onChange={setTechnologies}
                  placeholder="Select technologies"
                  id="edit-technologies"
                />
                <SkillMultiSelect
                  label="Areas of Expertise"
                  options={SKILL_OPTIONS.areas_of_expertise}
                  selected={expertise}
                  onChange={setExpertise}
                  placeholder="Select areas of expertise"
                  id="edit-areas-of-expertise"
                />
              </div>
            )}

            {/* TAB 5: PORTFOLIO */}
            {activeTab === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={fieldLabel}>Portfolio Website</label>
                  <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>GitHub Profile</label>
                  <input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>LinkedIn Profile</label>
                  <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." style={inputStyle} />
                </div>
              </div>
            )}

            {/* TAB 6: PREFERENCES */}
            {activeTab === 'preferences' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={fieldLabel}>Preferred Work Location</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Remote', 'Hybrid', 'On-site', 'No preference'].map((loc) => {
                    const sel = preferredWorkLocation.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          if (sel) setPreferredWorkLocation(preferredWorkLocation.filter((l) => l !== loc));
                          else setPreferredWorkLocation([...preferredWorkLocation, loc]);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1.5px solid',
                          borderColor: sel ? '#2563eb' : '#cbd5e1',
                          backgroundColor: sel ? '#eff6ff' : '#ffffff',
                          color: sel ? '#1e40af' : '#334155',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        {sel ? `✓ ${loc}` : loc}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 7: PRIVACY */}
            {activeTab === 'privacy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={fieldLabel}>Who can view your profile?</label>
                  <select
                    value={privacySettings.profile_visibility}
                    onChange={(e) => setPrivacySettings((p) => ({ ...p, profile_visibility: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="verified_profile">Verified Profile</option>
                    <option value="followers_only">Followers only</option>
                  </select>
                </div>

                <div>
                  <label style={fieldLabel}>Date of Birth / Derived Age Visibility</label>
                  <select
                    value={privacySettings.dob_visibility}
                    onChange={(e) => setPrivacySettings((p) => ({ ...p, dob_visibility: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>

                <div>
                  <label style={fieldLabel}>Gender Visibility</label>
                  <select
                    value={privacySettings.gender_visibility}
                    onChange={(e) => setPrivacySettings((p) => ({ ...p, gender_visibility: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 8: DOMAINS */}
            {activeTab === 'domains' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={fieldLabel}>Which domains are you part of?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                  {AVAILABLE_DOMAINS.map((d) => {
                    const isSel = selectedDomains.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          if (isSel) setSelectedDomains(selectedDomains.filter((id) => id !== d.id));
                          else setSelectedDomains([...selectedDomains, d.id]);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid',
                          borderColor: isSel ? '#2563eb' : '#e2e8f0',
                          backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                          color: isSel ? '#1e40af' : '#334155',
                          fontWeight: '700',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{d.name}</span>
                        <span>{isSel ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f8fafc' }}>
            <button type="button" onClick={onClose} disabled={isSubmitting} style={{ padding: '10px 18px', borderRadius: '10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '10px 22px', borderRadius: '10px', backgroundColor: '#2563eb', border: 'none', color: '#ffffff', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
