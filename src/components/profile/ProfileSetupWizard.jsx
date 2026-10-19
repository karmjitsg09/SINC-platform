import React, { useState, useEffect, useRef, useMemo } from 'react';
import LocationSelector from './LocationSelector';
import SkillMultiSelect from './SkillMultiSelect';
import { validateLocationFields } from '../../lib/locationService';
import { checkUsernameAvailability, calculateAge, saveStepProfile, uploadProfilePhoto, isValidUrl } from '../../lib/profileService';
import { domains as platformDomains } from '../../data/mockData';
import { SKILL_OPTIONS } from '../../data/skillsData';

// Reusable Skill Tag Input Component
function SkillTagInput({ label, helper, tags = [], onTagsChange, placeholder, suggestions = [] }) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAddTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      onTagsChange([...tags, clean]);
    }
    setInputValue('');
  };

  const handleRemoveTag = (indexToRemove) => {
    onTagsChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (s) => !tags.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e3860' }}>
          {label}
        </label>
        {helper && (
          <span style={{ fontSize: '12px', color: '#64748b' }}>{helper}</span>
        )}
      </div>

      {/* Selected tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
          {tags.map((t, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e40af',
                fontSize: '12.5px',
                fontWeight: '600'
              }}
            >
              {t}
              <button
                type="button"
                onClick={() => handleRemoveTag(idx)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#3b82f6',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label={`Remove ${t}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type and press Enter...'}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1.5px solid #cbd5e1',
            fontSize: '13.5px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        {/* Suggestion list */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 30,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              marginTop: '4px',
              maxHeight: '140px',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {filteredSuggestions.map((sug, i) => (
              <div
                key={i}
                onClick={() => {
                  handleAddTag(sug);
                  setShowSuggestions(false);
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderBottom: i < filteredSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                  color: '#334155'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
              >
                + {sug}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Predefined suggestion sets
const POPULAR_LANGUAGES = [
  'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam',
  'Spanish', 'French', 'German', 'Mandarin', 'Japanese', 'Arabic',
  'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Urdu'
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

export default function ProfileSetupWizard({
  profileUser,
  initialStep = 1,
  onSave,
  onCancel
}) {
  // Wizard current step: 1 to 9
  // 1: Basic Info, 2: Location, 3: Profession, 4: Skills, 5: Portfolio, 6: Preferences, 7: Privacy, 8: Domains, 9: Review
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Per-step independent saving states
  const [completedSteps, setCompletedSteps] = useState(() => {
    if (Array.isArray(profileUser?.profile_setup_completed_steps)) {
      return profileUser.profile_setup_completed_steps;
    }
    return [];
  });
  const [isStepSaving, setIsStepSaving] = useState(false);
  const [savingAction, setSavingAction] = useState(null); // 'save' | 'continue' | null
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);
  const stepBodyRef = useRef(null);

  useEffect(() => {
    if (stepBodyRef.current) {
      stepBodyRef.current.scrollTop = 0;
    }
  }, [currentStep]);

  // ----------------------------------------------------
  // STEP 1: BASIC INFORMATION
  // ----------------------------------------------------
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
  const [usernameStatus, setUsernameStatus] = useState({ state: 'idle', message: '' });
  const [avatarUrl, setAvatarUrl] = useState(profileUser?.avatarUrl || profileUser?.avatar_url || '');
  const [dateOfBirth, setDateOfBirth] = useState(profileUser?.date_of_birth || '');
  const [gender, setGender] = useState(profileUser?.gender || 'prefer_not_to_say');
  const [customGender, setCustomGender] = useState(profileUser?.gender_custom || '');
  const [bio, setBio] = useState(profileUser?.bio || '');
  const [languages, setLanguages] = useState(profileUser?.languages || ['English']);

  // Derived age
  const derivedAge = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth]);

  // Username validation & availability checker with debounce
  const usernameCheckTimerRef = useRef(null);
  useEffect(() => {
    if (!username || !username.trim()) {
      setUsernameStatus({ state: 'idle', message: '' });
      return;
    }
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    if (clean === (profileUser?.username || '').toLowerCase()) {
      setUsernameStatus({ state: 'available', message: '✓ Current username' });
      return;
    }
    if (clean.length < 3) {
      setUsernameStatus({ state: 'error', message: 'Username must be at least 3 characters' });
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(clean)) {
      setUsernameStatus({ state: 'error', message: 'Only letters, numbers, _, -, and . allowed' });
      return;
    }

    setUsernameStatus({ state: 'checking', message: 'Checking availability...' });
    if (usernameCheckTimerRef.current) clearTimeout(usernameCheckTimerRef.current);

    usernameCheckTimerRef.current = setTimeout(async () => {
      const res = await checkUsernameAvailability(clean, profileUser?.id);
      if (res.available) {
        setUsernameStatus({ state: 'available', message: '✓ Username available' });
      } else {
        setUsernameStatus({ state: 'taken', message: res.error || 'Username already taken' });
      }
    }, 450);

    return () => {
      if (usernameCheckTimerRef.current) clearTimeout(usernameCheckTimerRef.current);
    };
  }, [username, profileUser?.id, profileUser?.username]);

  // Photo upload handler
  const fileInputRef = useRef(null);
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, photo: 'Photo size should be under 5MB' }));
        return;
      }
      // Instant local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result);
        setErrors((prev) => ({ ...prev, photo: null }));
      };
      reader.readAsDataURL(file);

      // Persistent Supabase Storage upload
      try {
        const uploadedUrl = await uploadProfilePhoto(file, profileUser?.id, 'avatar');
        if (uploadedUrl) {
          setAvatarUrl(uploadedUrl);
        }
      } catch (err) {
        console.warn('[ProfileSetupWizard] Avatar storage upload warning:', err);
      }
    }
  };

  // Professional Photo (separate from avatar)
  const [professionalPhotoUrl, setProfessionalPhotoUrl] = useState(
    profileUser?.professional_photo_url || ''
  );
  const professionalPhotoInputRef = useRef(null);
  const handleProfessionalPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, professionalPhoto: 'Photo size should be under 5MB' }));
        return;
      }
      // Instant local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfessionalPhotoUrl(reader.result);
        setErrors((prev) => ({ ...prev, professionalPhoto: null }));
      };
      reader.readAsDataURL(file);

      // Persistent Supabase Storage upload
      try {
        const uploadedUrl = await uploadProfilePhoto(file, profileUser?.id, 'professional');
        if (uploadedUrl) {
          setProfessionalPhotoUrl(uploadedUrl);
        }
      } catch (err) {
        console.warn('[ProfileSetupWizard] Professional photo storage upload warning:', err);
      }
    }
  };

  // ----------------------------------------------------
  // STEP 2: LOCATION
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // STEP 3: PROFESSION & BRANCHING
  // ----------------------------------------------------
  const [professionType, setProfessionType] = useState(profileUser?.profession_type || profileUser?.profile_type || 'student');
  
  // Student Branch
  const [studentInstitution, setStudentInstitution] = useState(
    profileUser?.profession_details?.institution || profileUser?.college || ''
  );
  const [studentCourse, setStudentCourse] = useState(
    profileUser?.profession_details?.course || profileUser?.degree || ''
  );
  const [studentGradYear, setStudentGradYear] = useState(
    profileUser?.profession_details?.gradYear || profileUser?.year_of_study || '2026'
  );
  const [studentInterests, setStudentInterests] = useState(
    profileUser?.profession_details?.interests || []
  );

  // Employee Branch
  const [employeeJobTitle, setEmployeeJobTitle] = useState(
    profileUser?.profession_details?.jobTitle || profileUser?.role || ''
  );
  const [employeeCompany, setEmployeeCompany] = useState(
    profileUser?.profession_details?.company || profileUser?.company || ''
  );
  const [employeeIndustry, setEmployeeIndustry] = useState(
    profileUser?.profession_details?.industry || ''
  );
  const [employeeDepartment, setEmployeeDepartment] = useState(
    profileUser?.profession_details?.department || ''
  );
  const [employeeEmploymentType, setEmployeeEmploymentType] = useState(
    profileUser?.profession_details?.employmentType || 'Full-time'
  );
  const [employeeStartYear, setEmployeeStartYear] = useState(
    profileUser?.profession_details?.startYear || '2023'
  );
  const [employeeIsCurrent, setEmployeeIsCurrent] = useState(
    profileUser?.profession_details?.isCurrent !== undefined ? profileUser.profession_details.isCurrent : true
  );
  const [employeeEndYear, setEmployeeEndYear] = useState(
    profileUser?.profession_details?.endYear || ''
  );
  const [employeeWorkLocation, setEmployeeWorkLocation] = useState(
    profileUser?.profession_details?.workLocation || 'Hybrid'
  );
  const [employeeSummary, setEmployeeSummary] = useState(
    profileUser?.profession_details?.summary || ''
  );

  // Freelancer Branch
  const [freelancerServices, setFreelancerServices] = useState(
    profileUser?.profession_details?.services || []
  );
  const [freelancerTitle, setFreelancerTitle] = useState(
    profileUser?.profession_details?.title || 'Freelance Specialist'
  );
  const [freelancerIndustries, setFreelancerIndustries] = useState(
    profileUser?.profession_details?.industries || []
  );
  const [freelancerWorkLocation, setFreelancerWorkLocation] = useState(
    profileUser?.profession_details?.workLocation || 'Remote'
  );
  const [freelancerSummary, setFreelancerSummary] = useState(
    profileUser?.profession_details?.summary || ''
  );

  // Self-Employed Branch
  const [selfProfession, setSelfProfession] = useState(
    profileUser?.profession_details?.businessType || 'Founder'
  );
  const [selfBusinessName, setSelfBusinessName] = useState(
    profileUser?.profession_details?.businessName || ''
  );
  const [selfIndustry, setSelfIndustry] = useState(
    profileUser?.profession_details?.industry || ''
  );
  const [selfRole, setSelfRole] = useState(
    profileUser?.profession_details?.role || ''
  );
  const [selfSummary, setSelfSummary] = useState(
    profileUser?.profession_details?.summary || ''
  );

  // Other Branch
  const [customProfession, setCustomProfession] = useState(
    profileUser?.profession_details?.customProfession || profileUser?.custom_role || ''
  );
  const [otherAbout, setOtherAbout] = useState(
    profileUser?.profession_details?.about || profileUser?.about_you || ''
  );

  // ----------------------------------------------------
  // STEP 4: SKILLS & EXPERTISE
  // ----------------------------------------------------
  const [technicalSkills, setTechnicalSkills] = useState(profileUser?.skills_technical || []);
  const [softSkills, setSoftSkills] = useState(profileUser?.skills_soft || []);
  const [programmingLanguages, setProgrammingLanguages] = useState(profileUser?.skills_languages || []);
  const [tools, setTools] = useState(profileUser?.skills_tools || []);
  const [technologies, setTechnologies] = useState(profileUser?.skills_technologies || []);
  const [areasOfExpertise, setAreasOfExpertise] = useState(profileUser?.skills_expertise || []);

  // ----------------------------------------------------
  // STEP 5: PORTFOLIO & LINKS
  // ----------------------------------------------------
  const [portfolioUrl, setPortfolioUrl] = useState(profileUser?.portfolio_url || '');
  const [githubUrl, setGithubUrl] = useState(profileUser?.github_url || '');
  const [linkedinUrl, setLinkedinUrl] = useState(profileUser?.linkedin_url || '');
  const [otherLinks, setOtherLinks] = useState(profileUser?.other_links || []);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // ----------------------------------------------------
  // STEP 6: PREFERENCES
  // ----------------------------------------------------
  const [preferredWorkLocation, setPreferredWorkLocation] = useState(
    profileUser?.preferred_work_location || ['Remote', 'Hybrid']
  );
  const [preferredRoleTypes, setPreferredRoleTypes] = useState(
    profileUser?.preferences?.roleTypes || ['Full-time']
  );
  const [preferredIndustries, setPreferredIndustries] = useState(
    profileUser?.preferences?.industries || []
  );

  // ----------------------------------------------------
  // STEP 7: PRIVACY SETTINGS
  // ----------------------------------------------------
  const [privacySettings, setPrivacySettings] = useState(() => ({
    dob_visibility: profileUser?.privacy_settings?.dob_visibility || 'followers',
    gender_visibility: profileUser?.privacy_settings?.gender_visibility || 'only_me',
    location_visibility: profileUser?.privacy_settings?.location_visibility || 'followers',
    profile_visibility: profileUser?.privacy_settings?.profile_visibility || 'everyone'
  }));

  // ----------------------------------------------------
  // STEP 8: DOMAIN SELECTION
  // ----------------------------------------------------
  const [selectedDomains, setSelectedDomains] = useState(() => {
    if (Array.isArray(profileUser?.domains) && profileUser.domains.length > 0) {
      return profileUser.domains;
    }
    return ['tech'];
  });
  const [domainSearch, setDomainSearch] = useState('');

  // ----------------------------------------------------
  // STEP VALIDATIONS
  // ----------------------------------------------------
  const validateStep = (stepNumber) => {
    const errs = {};
    if (stepNumber === 1) {
      if (!firstName.trim()) errs.firstName = 'First name is required.';
      if (!username.trim()) {
        errs.username = 'Please choose a username.';
      } else if (usernameStatus.state === 'taken') {
        errs.username = 'Username is already taken.';
      } else if (usernameStatus.state === 'error') {
        errs.username = usernameStatus.message;
      }
    } else if (stepNumber === 2) {
      const locRes = validateLocationFields(locationData);
      if (!locRes.isValid) {
        errs.location = 'Please complete all required location fields.';
        errs.locationFields = locRes.errors;
      }
    } else if (stepNumber === 3) {
      if (professionType === 'student') {
        if (!studentInstitution.trim()) errs.studentInstitution = 'Institution is required.';
        if (!studentCourse.trim()) errs.studentCourse = 'Course or program is required.';
        if (!studentGradYear) errs.studentGradYear = 'Graduation year is required.';
      } else if (professionType === 'employee') {
        if (!employeeJobTitle.trim()) errs.employeeJobTitle = 'Job title is required.';
        if (!employeeCompany.trim()) errs.employeeCompany = 'Company is required.';
      } else if (professionType === 'other') {
        if (!customProfession.trim()) errs.customProfession = 'Please enter what you do.';
      }
    } else if (stepNumber === 5) {
      if (portfolioUrl.trim() && !isValidUrl(portfolioUrl.trim())) {
        errs.portfolioUrl = 'Please enter a valid portfolio URL (e.g. https://myportfolio.com).';
      }
      if (githubUrl.trim() && !isValidUrl(githubUrl.trim())) {
        errs.githubUrl = 'Please enter a valid GitHub profile URL.';
      }
      if (linkedinUrl.trim() && !isValidUrl(linkedinUrl.trim())) {
        errs.linkedinUrl = 'Please enter a valid LinkedIn profile URL.';
      }
    } else if (stepNumber === 8) {
      if (selectedDomains.length === 0) {
        errs.domains = 'Please select at least one domain to continue.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ----------------------------------------------------
  // INDEPENDENT STEP DATA GATHERER & PER-STEP SAVER
  // ----------------------------------------------------
  const getStepData = (stepNumber) => {
    switch (stepNumber) {
      case 1: {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
        return {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name: fullName || profileUser?.name,
          username: cleanUsername,
          avatar_url: avatarUrl,
          avatarUrl: avatarUrl,
          date_of_birth: dateOfBirth || null,
          gender,
          gender_custom: gender === 'custom' ? customGender.trim() : null,
          bio: bio.trim(),
          languages,
          professional_photo_url: professionalPhotoUrl || null
        };
      }
      case 2: {
        const dispLoc = locationData.displayLocation ||
          [locationData.city, locationData.state, locationData.country].filter(Boolean).join(', ');
        return {
          location: dispLoc,
          location_place_name: locationData.placeName,
          location_address: locationData.address,
          location_area: locationData.area,
          location_landmark: locationData.landmark,
          location_city: locationData.city,
          location_state: locationData.state,
          location_country: locationData.country,
          location_pincode: locationData.pincode,
          location_latitude: locationData.latitude,
          location_longitude: locationData.longitude,
          locationData
        };
      }
      case 3: {
        let derivedRole = 'Member';
        if (professionType === 'student') {
          derivedRole = `Student at ${studentInstitution.trim()}`;
        } else if (professionType === 'employee') {
          derivedRole = `${employeeJobTitle.trim()} at ${employeeCompany.trim()}`;
        } else if (professionType === 'freelancer') {
          derivedRole = freelancerTitle.trim() || 'Freelancer';
        } else if (professionType === 'self_employed') {
          derivedRole = selfRole.trim() ? `${selfRole.trim()} (${selfBusinessName.trim()})` : 'Self-employed';
        } else if (professionType === 'other') {
          derivedRole = customProfession.trim() || 'Member';
        }
        const professionDetails = {
          institution: studentInstitution.trim(),
          course: studentCourse.trim(),
          gradYear: studentGradYear,
          interests: studentInterests,
          jobTitle: employeeJobTitle.trim(),
          company: employeeCompany.trim(),
          industry: employeeIndustry.trim() || selfIndustry.trim(),
          department: employeeDepartment.trim(),
          employmentType: employeeEmploymentType,
          startYear: employeeStartYear,
          isCurrent: employeeIsCurrent,
          endYear: employeeIsCurrent ? null : employeeEndYear,
          workLocation: employeeWorkLocation || freelancerWorkLocation,
          summary: employeeSummary.trim() || freelancerSummary.trim() || selfSummary.trim() || otherAbout.trim(),
          services: freelancerServices,
          title: freelancerTitle.trim(),
          industries: freelancerIndustries,
          businessType: selfProfession,
          businessName: selfBusinessName.trim(),
          role: selfRole.trim(),
          customProfession: customProfession.trim(),
          about: otherAbout.trim()
        };
        return {
          profession_type: professionType,
          profession_details: professionDetails,
          role: derivedRole
        };
      }
      case 4: {
        const allSkillsCombined = Array.from(new Set([
          ...technicalSkills,
          ...programmingLanguages,
          ...tools,
          ...technologies,
          ...softSkills,
          ...areasOfExpertise
        ]));
        return {
          skills: allSkillsCombined,
          skills_technical: technicalSkills,
          skills_soft: softSkills,
          skills_languages: programmingLanguages,
          skills_tools: tools,
          skills_technologies: technologies,
          skills_expertise: areasOfExpertise
        };
      }
      case 5: {
        return {
          portfolio_url: portfolioUrl.trim(),
          github_url: githubUrl.trim(),
          linkedin_url: linkedinUrl.trim(),
          other_links: otherLinks
        };
      }
      case 6: {
        return {
          preferred_work_location: preferredWorkLocation,
          preferences: {
            roleTypes: preferredRoleTypes,
            industries: preferredIndustries
          }
        };
      }
      case 7: {
        return {
          privacy_settings: privacySettings
        };
      }
      case 8: {
        return {
          domains: selectedDomains
        };
      }
      default:
        return {};
    }
  };

  const handleSaveStep = async (andContinue = false) => {
    if (!validateStep(currentStep)) return;
    setErrors({});
    setIsStepSaving(true);
    setSavingAction(andContinue ? 'continue' : 'save');
    setSaveSuccessMessage(null);

    const stepData = getStepData(currentStep);
    try {
      const res = await saveStepProfile(profileUser?.id, currentStep, stepData);
      if (res.success) {
        setCompletedSteps((prev) => Array.from(new Set([...prev, currentStep])));
        if (res.serverSaved) {
          setSaveSuccessMessage('✓ Saved to server');
        } else {
          setSaveSuccessMessage('⚠️ Saved locally (server migration pending)');
        }
        setTimeout(() => setSaveSuccessMessage(null), 4000);

        if (andContinue) {
          if (currentStep < 9) {
            setCurrentStep((prev) => Math.min(9, prev + 1));
            stepBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      } else {
        setErrors((prev) => ({ ...prev, stepSave: res.error || 'Failed to save step to server' }));
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, stepSave: err.message || 'Error saving step.' }));
    } finally {
      setIsStepSaving(false);
      setSavingAction(null);
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      setCurrentStep((prev) => Math.min(9, prev + 1));
      stepBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setErrors({});
    if (currentStep === 1) {
      onCancel?.();
    } else {
      setCurrentStep((prev) => Math.max(1, prev - 1));
      stepBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Jump to specific step from Step 9 Review
  const handleEditSection = (targetStep) => {
    setErrors({});
    setCurrentStep(targetStep);
    stepBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // FINAL SUBMISSION (STEP 9 COMPLETE PROFILE)
  // ----------------------------------------------------
  const handleCompleteProfile = async () => {
    // Validate minimum required fields across all steps
    if (!firstName.trim()) {
      setCurrentStep(1);
      setErrors({ firstName: 'First name is required.' });
      return;
    }
    if (!username.trim()) {
      setCurrentStep(1);
      setErrors({ username: 'Username is required.' });
      return;
    }
    const locRes = validateLocationFields(locationData);
    if (!locRes.isValid) {
      setCurrentStep(2);
      setErrors({ location: 'Please complete your location details.', locationFields: locRes.errors });
      return;
    }
    if (professionType === 'student' && (!studentInstitution.trim() || !studentCourse.trim())) {
      setCurrentStep(3);
      setErrors({ studentInstitution: 'Please complete required student information.' });
      return;
    }
    if (professionType === 'employee' && (!employeeJobTitle.trim() || !employeeCompany.trim())) {
      setCurrentStep(3);
      setErrors({ employeeJobTitle: 'Please complete required job information.' });
      return;
    }
    if (professionType === 'other' && !customProfession.trim()) {
      setCurrentStep(3);
      setErrors({ customProfession: 'Please specify what you do.' });
      return;
    }
    if (selectedDomains.length === 0) {
      setCurrentStep(8);
      setErrors({ domains: 'Please select at least one domain.' });
      return;
    }

    setIsSaving(true);

    // Assemble unified role / title
    let derivedRole = 'Member';
    if (professionType === 'student') {
      derivedRole = `Student at ${studentInstitution.trim()}`;
    } else if (professionType === 'employee') {
      derivedRole = `${employeeJobTitle.trim()} at ${employeeCompany.trim()}`;
    } else if (professionType === 'freelancer') {
      derivedRole = freelancerTitle.trim() || 'Freelancer';
    } else if (professionType === 'self_employed') {
      derivedRole = selfRole.trim() ? `${selfRole.trim()} (${selfBusinessName.trim()})` : 'Self-employed';
    } else if (professionType === 'other') {
      derivedRole = customProfession.trim() || 'Member';
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

    const professionDetails = {
      institution: studentInstitution.trim(),
      course: studentCourse.trim(),
      gradYear: studentGradYear,
      interests: studentInterests,
      jobTitle: employeeJobTitle.trim(),
      company: employeeCompany.trim(),
      industry: employeeIndustry.trim() || selfIndustry.trim(),
      department: employeeDepartment.trim(),
      employmentType: employeeEmploymentType,
      startYear: employeeStartYear,
      isCurrent: employeeIsCurrent,
      endYear: employeeEndYear,
      workLocation: employeeWorkLocation || freelancerWorkLocation,
      summary: employeeSummary.trim() || freelancerSummary.trim() || selfSummary.trim(),
      services: freelancerServices,
      title: freelancerTitle.trim(),
      industries: freelancerIndustries,
      businessType: selfProfession.trim(),
      businessName: selfBusinessName.trim(),
      role: selfRole.trim(),
      customProfession: customProfession.trim(),
      about: otherAbout.trim()
    };

    const combinedSkills = Array.from(new Set([
      ...technicalSkills,
      ...programmingLanguages,
      ...tools,
      ...technologies,
      ...softSkills,
      ...areasOfExpertise
    ]));

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      name: fullName,
      username: cleanUsername,
      role: derivedRole,
      avatar_url: avatarUrl || null,
      avatarUrl: avatarUrl || null,
      date_of_birth: dateOfBirth || null,
      gender: gender,
      gender_custom: gender === 'other' ? customGender.trim() : null,
      bio: bio.trim(),
      languages: languages,

      // Location
      location: (locationData.displayLocation || '').trim(),
      location_place_name: locationData.placeName,
      location_address: locationData.address,
      location_area: locationData.area,
      location_landmark: locationData.landmark,
      location_city: locationData.city,
      location_state: locationData.state,
      location_country: locationData.country,
      location_pincode: locationData.pincode,
      location_latitude: locationData.latitude,
      location_longitude: locationData.longitude,
      locationData: locationData,

      // Profession
      profession_type: professionType,
      profession_details: professionDetails,

      // Skills
      skills: combinedSkills,
      skills_technical: technicalSkills,
      skills_soft: softSkills,
      skills_languages: programmingLanguages,
      skills_tools: tools,
      skills_technologies: technologies,
      skills_expertise: areasOfExpertise,

      // Portfolio & links
      portfolio_url: portfolioUrl.trim() || null,
      github_url: githubUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      other_links: otherLinks,

      // Preferences
      preferred_work_location: preferredWorkLocation,
      preferences: {
        roleTypes: preferredRoleTypes,
        industries: preferredIndustries
      },

      // Privacy
      privacy_settings: privacySettings,

      // Domains
      domains: selectedDomains,

      // Professional Photo
      professional_photo_url: professionalPhotoUrl || null,

      onboarding_completed: true,
      profile_setup_completed_steps: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    };

    try {
      await onSave?.(payload);
    } catch (err) {
      console.error('[ProfileSetupWizard] Save failed:', err);
      setErrors({ submit: 'Failed to save profile. Please check your network and try again.' });
      setIsSaving(false);
    }
  };

  // Helper styles
  const cardStyle = {
    maxWidth: '720px',
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '24px 24px 20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    border: '1.5px solid var(--border-app, #b5d2fd)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden'
  };

  const questionHeadingStyle = {
    fontSize: '22px',
    fontWeight: '800',
    color: '#1e3860',
    margin: '0 0 6px 0',
    letterSpacing: '-0.3px',
    lineHeight: '1.3'
  };

  const helperTextStyle = {
    fontSize: '13.5px',
    color: '#64748b',
    margin: '0 0 16px 0',
    lineHeight: '1.45'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease'
  };

  const fieldLabelStyle = {
    display: 'block',
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#1e3860',
    marginBottom: '6px'
  };

  const errorTextStyle = {
    color: '#dc2626',
    fontSize: '12.5px',
    fontWeight: '600',
    marginTop: '4px'
  };

  return (
    <div
      className="profile-setup-wizard-container"
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <div className="profile-setup-wizard-card" style={cardStyle}>
        {/* PROGRESS HEADER */}
        <div
          className="wizard-progress-header"
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingBottom: '16px',
            borderBottom: '1.5px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563eb', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              STEP {currentStep} OF 9
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
              {currentStep === 1 && 'Basic Information'}
              {currentStep === 2 && 'Location Details'}
              {currentStep === 3 && 'Profession & Role'}
              {currentStep === 4 && 'Skills & Expertise'}
              {currentStep === 5 && 'Portfolio & Links'}
              {currentStep === 6 && 'Preferences'}
              {currentStep === 7 && 'Privacy Settings'}
              {currentStep === 8 && 'Domains & Communities'}
              {currentStep === 9 && 'Review & Complete'}
            </span>
          </div>

          {/* Progress bar with saved state indicators */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
              const isCompleted = completedSteps.includes(s);
              const isCurrent = s === currentStep;
              return (
                <div
                  key={s}
                  onClick={() => {
                    if (isCompleted || s <= currentStep || currentStep === 9) {
                      setErrors({});
                      setCurrentStep(s);
                      stepBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  title={`Step ${s}: ${isCompleted ? 'Saved ✓' : isCurrent ? 'Current' : 'Not saved'}`}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '4px',
                    backgroundColor: isCompleted ? '#16a34a' : isCurrent ? '#2563eb' : '#e2e8f0',
                    cursor: (isCompleted || s <= currentStep || currentStep === 9) ? 'pointer' : 'default',
                    transition: 'all 0.25s ease'
                  }}
                />
              );
            })}
          </div>

          {/* Saved Steps Summary Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>
              Progress:{' '}
              <strong style={{ color: completedSteps.length > 0 ? '#16a34a' : '#2563eb' }}>
                {completedSteps.length} of 8 steps saved
              </strong>
            </span>
            {saveSuccessMessage && (
              <span
                style={{
                  color: saveSuccessMessage.includes('⚠️') ? '#b45309' : '#16a34a',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {saveSuccessMessage}
              </span>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* SCROLLABLE STEP FORM BODY                                    */}
        {/* ============================================================ */}
        <div
          ref={stepBodyRef}
          className="wizard-step-body"
          tabIndex={0}
          role="region"
          aria-label={`Profile setup step ${currentStep} of 9`}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '8px',
            paddingTop: '16px',
            paddingBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
        {/* ============================================================ */}
        {/* STEP 1: BASIC INFORMATION                                    */}
        {/* ============================================================ */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={questionHeadingStyle}>Let’s start with the basics</h2>
              <p style={helperTextStyle}>Tell us how people should recognize and address you on SINC Platform.</p>
            </div>

            {/* Q1: First Name */}
            <div>
              <label style={fieldLabelStyle}>What’s your first name? *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: null }));
                }}
                placeholder="Enter your first name"
                style={{
                  ...inputStyle,
                  borderColor: errors.firstName ? '#dc2626' : '#cbd5e1'
                }}
              />
              {errors.firstName && <div style={errorTextStyle}>{errors.firstName}</div>}
            </div>

            {/* Q2: Last Name */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={fieldLabelStyle}>Do you have a last name?</label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Optional</span>
              </div>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                style={inputStyle}
              />
            </div>

            {/* Q3: Username */}
            <div>
              <label style={fieldLabelStyle}>What username would you like people to find you by? *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''));
                    if (errors.username) setErrors((prev) => ({ ...prev, username: null }));
                  }}
                  placeholder="choose_a_username"
                  style={{
                    ...inputStyle,
                    paddingLeft: '32px',
                    borderColor: errors.username ? '#dc2626' : usernameStatus.state === 'available' ? '#16a34a' : '#cbd5e1'
                  }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8', fontWeight: '700' }}>
                  @
                </span>
              </div>

              {/* Username status banner */}
              {usernameStatus.message && (
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color:
                      usernameStatus.state === 'available'
                        ? '#16a34a'
                        : usernameStatus.state === 'taken' || usernameStatus.state === 'error'
                        ? '#dc2626'
                        : '#64748b'
                  }}
                >
                  {usernameStatus.message}
                </div>
              )}
              {errors.username && <div style={errorTextStyle}>{errors.username}</div>}
            </div>

            {/* Q4: Profile Photo */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={fieldLabelStyle}>Would you like to add a profile photo?</label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Optional</span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b' }}>
                Optional — you can always upload or change one later.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '2px solid #b5d2fd',
                    color: '#1e3860',
                    fontWeight: '800',
                    fontSize: '22px'
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{firstName ? firstName[0].toUpperCase() : 'U'}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1e40af',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Upload Photo
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              {errors.photo && <div style={errorTextStyle}>{errors.photo}</div>}
            </div>

            {/* Q4b: Professional Photo (SEPARATE from profile photo) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={fieldLabelStyle}>Would you like to add a professional photo?</label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Optional</span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b' }}>
                This is a separate, formal photo for your professional profile — not the same as your avatar.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '14px',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '2px dashed #94a3b8',
                    color: '#64748b',
                    fontWeight: '700',
                    fontSize: '12px',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}
                >
                  {professionalPhotoUrl ? (
                    <img
                      src={professionalPhotoUrl}
                      alt="Professional"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                    />
                  ) : (
                    <span style={{ padding: '6px' }}>📸<br/>Pro</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => professionalPhotoInputRef.current?.click()}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      color: '#0369a1',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Upload Professional Photo
                  </button>
                  {professionalPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setProfessionalPhotoUrl('')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  )}
                  <input
                    type="file"
                    ref={professionalPhotoInputRef}
                    onChange={handleProfessionalPhotoUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              {errors.professionalPhoto && <div style={errorTextStyle}>{errors.professionalPhoto}</div>}
            </div>

            {/* Q5: Date of Birth & Derived Age */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={fieldLabelStyle}>When were you born?</label>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Optional</span>
                </div>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  style={inputStyle}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  This helps us calculate your age.
                </span>
              </div>

              <div>
                <label style={fieldLabelStyle}>Derived Age</label>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: derivedAge !== null ? '#1e3860' : '#94a3b8'
                  }}
                >
                  {derivedAge !== null ? `${derivedAge} years old` : 'Calculated automatically'}
                </div>
                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Age is derived automatically and protected by privacy settings.
                </span>
              </div>
            </div>

            {/* Q6: Gender */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={fieldLabelStyle}>How do you identify?</label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Optional</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {[
                  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
                  { id: 'woman', label: 'Woman' },
                  { id: 'man', label: 'Man' },
                  { id: 'non_binary', label: 'Non-binary' },
                  { id: 'other', label: 'Other' }
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGender(g.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid',
                      borderColor: gender === g.id ? '#2563eb' : '#cbd5e1',
                      backgroundColor: gender === g.id ? '#eff6ff' : '#ffffff',
                      color: gender === g.id ? '#1e40af' : '#475569',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {gender === 'other' && (
                <div style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    value={customGender}
                    onChange={(e) => setCustomGender(e.target.value)}
                    placeholder="Enter your gender identity"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            {/* Q7: Bio */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={fieldLabelStyle}>How would you describe yourself?</label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{bio.length}/250</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 250))}
                rows="3"
                placeholder="Tell people a little about yourself..."
                style={{
                  ...inputStyle,
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Q8: Languages */}
            <SkillMultiSelect
              label="What languages do you speak?"
              helper="Select or search languages you are comfortable with, or add a custom language"
              options={POPULAR_LANGUAGES}
              selected={languages}
              onChange={setLanguages}
              placeholder="Select or search languages (e.g. English, Hindi, Kannada)..."
              id="wizard-languages"
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: LOCATION                                             */}
        {/* ============================================================ */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={questionHeadingStyle}>Where are you located?</h2>
              <p style={helperTextStyle}>
                Help us connect you with nearby opportunities and local communities. Your exact street address and coordinates remain private.
              </p>
            </div>

            <LocationSelector
              value={locationData}
              onChange={(updatedLoc) => {
                setLocationData(updatedLoc);
                if (errors.location) setErrors((prev) => ({ ...prev, location: null, locationFields: null }));
              }}
              errors={errors.locationFields || {}}
            />

            {errors.location && <div style={errorTextStyle}>{errors.location}</div>}

            {/* Privacy note */}
            <div
              style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '12.5px',
                color: '#0369a1',
                lineHeight: '1.4'
              }}
            >
              🔒 <strong>Privacy guarantee:</strong> Your public profile will only show your city and state (e.g.{' '}
              <em>📍 {locationData.city || 'Mangaluru'}, {locationData.state || 'Karnataka'}</em>). Specific flat, street, and coordinates are never publicly exposed.
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: PROFESSION & DYNAMIC BRANCHING                       */}
        {/* ============================================================ */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <h2 style={questionHeadingStyle}>What are you?</h2>
              <p style={helperTextStyle}>Select your current occupational path. This helps tailor questions to your background.</p>
            </div>

            {/* Branching selector cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
              {[
                { id: 'student', label: 'Student', icon: '🎓' },
                { id: 'employee', label: 'Employee', icon: '💼' },
                { id: 'freelancer', label: 'Freelancer', icon: '💻' },
                { id: 'self_employed', label: 'Self-employed', icon: '🏢' },
                { id: 'other', label: 'Other', icon: '➕' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProfessionType(p.id);
                    setErrors({});
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '14px 8px',
                    borderRadius: '14px',
                    border: '2px solid',
                    borderColor: professionType === p.id ? '#2563eb' : '#e2e8f0',
                    backgroundColor: professionType === p.id ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{p.icon}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: professionType === p.id ? '#1e40af' : '#334155'
                    }}
                  >
                    {p.label}
                  </span>
                </button>
              ))}
            </div>

            {/* ---------------- STUDENT BRANCH ---------------- */}
            {professionType === 'student' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3860', margin: 0 }}>
                  🎓 Student Profile
                </h3>

                <div>
                  <label style={fieldLabelStyle}>Where do you study? *</label>
                  <input
                    type="text"
                    value={studentInstitution}
                    onChange={(e) => setStudentInstitution(e.target.value)}
                    placeholder="Enter institution, college, or university"
                    style={{
                      ...inputStyle,
                      borderColor: errors.studentInstitution ? '#dc2626' : '#cbd5e1'
                    }}
                  />
                  {errors.studentInstitution && <div style={errorTextStyle}>{errors.studentInstitution}</div>}
                </div>

                <div>
                  <label style={fieldLabelStyle}>What are you studying? *</label>
                  <input
                    type="text"
                    value={studentCourse}
                    onChange={(e) => setStudentCourse(e.target.value)}
                    placeholder="Enter course or program (e.g. B.Tech Computer Science)"
                    style={{
                      ...inputStyle,
                      borderColor: errors.studentCourse ? '#dc2626' : '#cbd5e1'
                    }}
                  />
                  {errors.studentCourse && <div style={errorTextStyle}>{errors.studentCourse}</div>}
                </div>

                <div>
                  <label style={fieldLabelStyle}>When do you expect to graduate? *</label>
                  <select
                    value={studentGradYear}
                    onChange={(e) => setStudentGradYear(e.target.value)}
                    style={inputStyle}
                  >
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <SkillTagInput
                  label="What are your main skills or academic interests?"
                  helper="Optional"
                  tags={studentInterests}
                  onTagsChange={setStudentInterests}
                  placeholder="Type an interest (e.g. Robotics, Web Development)..."
                  suggestions={['Web Development', 'Machine Learning', 'Data Structures', 'Robotics', 'UI/UX Design']}
                />
              </div>
            )}

            {/* ---------------- EMPLOYEE BRANCH ---------------- */}
            {professionType === 'employee' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3860', margin: 0 }}>
                  💼 Professional Profile
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>What is your job title? *</label>
                    <input
                      type="text"
                      value={employeeJobTitle}
                      onChange={(e) => setEmployeeJobTitle(e.target.value)}
                      placeholder="e.g. Software Engineer"
                      style={{
                        ...inputStyle,
                        borderColor: errors.employeeJobTitle ? '#dc2626' : '#cbd5e1'
                      }}
                    />
                    {errors.employeeJobTitle && <div style={errorTextStyle}>{errors.employeeJobTitle}</div>}
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Where do you work? *</label>
                    <input
                      type="text"
                      value={employeeCompany}
                      onChange={(e) => setEmployeeCompany(e.target.value)}
                      placeholder="e.g. Google, Microsoft, Startup"
                      style={{
                        ...inputStyle,
                        borderColor: errors.employeeCompany ? '#dc2626' : '#cbd5e1'
                      }}
                    />
                    {errors.employeeCompany && <div style={errorTextStyle}>{errors.employeeCompany}</div>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>What industry do you work in?</label>
                    <input
                      type="text"
                      value={employeeIndustry}
                      onChange={(e) => setEmployeeIndustry(e.target.value)}
                      placeholder="e.g. FinTech, Healthcare, SaaS"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Which department are you part of?</label>
                    <input
                      type="text"
                      value={employeeDepartment}
                      onChange={(e) => setEmployeeDepartment(e.target.value)}
                      placeholder="e.g. Engineering, Product, Marketing"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>What type of employment is this?</label>
                    <select
                      value={employeeEmploymentType}
                      onChange={(e) => setEmployeeEmploymentType(e.target.value)}
                      style={inputStyle}
                    >
                      {['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Other'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Where do you work from?</label>
                    <select
                      value={employeeWorkLocation}
                      onChange={(e) => setEmployeeWorkLocation(e.target.value)}
                      style={inputStyle}
                    >
                      {['On-site', 'Hybrid', 'Remote'].map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>When did you start this role?</label>
                    <select
                      value={employeeStartYear}
                      onChange={(e) => setEmployeeStartYear(e.target.value)}
                      style={inputStyle}
                    >
                      {[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].reverse().map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Are you still working there?</label>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="isCurrent"
                          checked={employeeIsCurrent}
                          onChange={() => setEmployeeIsCurrent(true)}
                        />
                        Yes (Current)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="isCurrent"
                          checked={!employeeIsCurrent}
                          onChange={() => setEmployeeIsCurrent(false)}
                        />
                        No
                      </label>
                    </div>
                    {!employeeIsCurrent && (
                      <input
                        type="text"
                        value={employeeEndYear}
                        onChange={(e) => setEmployeeEndYear(e.target.value)}
                        placeholder="End Year (e.g. 2024)"
                        style={{ ...inputStyle, marginTop: '8px' }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label style={fieldLabelStyle}>How would you describe your professional experience?</label>
                  <textarea
                    rows="3"
                    value={employeeSummary}
                    onChange={(e) => setEmployeeSummary(e.target.value)}
                    placeholder="Briefly summarize your core responsibilities and impact..."
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ---------------- FREELANCER BRANCH ---------------- */}
            {professionType === 'freelancer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3860', margin: 0 }}>
                  💻 Freelancer Profile
                </h3>

                <div>
                  <label style={fieldLabelStyle}>What is your professional title?</label>
                  <input
                    type="text"
                    value={freelancerTitle}
                    onChange={(e) => setFreelancerTitle(e.target.value)}
                    placeholder="e.g. Independent UI/UX Designer & Consultant"
                    style={inputStyle}
                  />
                </div>

                <SkillTagInput
                  label="What services do you provide?"
                  helper="Multiple services"
                  tags={freelancerServices}
                  onTagsChange={setFreelancerServices}
                  placeholder="e.g. Web Design, Mobile App Dev, Brand Strategy..."
                  suggestions={['Web Development', 'Mobile Apps', 'UI/UX Design', 'Content Writing', 'SEO Audit']}
                />

                <SkillTagInput
                  label="What industries do you work with?"
                  helper="Optional"
                  tags={freelancerIndustries}
                  onTagsChange={setFreelancerIndustries}
                  placeholder="e.g. E-commerce, EdTech, Real Estate..."
                  suggestions={['E-commerce', 'FinTech', 'HealthTech', 'Education', 'Media']}
                />

                <div>
                  <label style={fieldLabelStyle}>Where do you usually work from?</label>
                  <select
                    value={freelancerWorkLocation}
                    onChange={(e) => setFreelancerWorkLocation(e.target.value)}
                    style={inputStyle}
                  >
                    {['Remote', 'On-site', 'Hybrid'].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={fieldLabelStyle}>Tell us about your freelance work.</label>
                  <textarea
                    rows="3"
                    value={freelancerSummary}
                    onChange={(e) => setFreelancerSummary(e.target.value)}
                    placeholder="Describe your typical projects, workflow, or client results..."
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ---------------- SELF-EMPLOYED BRANCH ---------------- */}
            {professionType === 'self_employed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3860', margin: 0 }}>
                  🏢 Self-Employed Profile
                </h3>

                <div>
                  <label style={fieldLabelStyle}>What do you do? (Profession / Business Type)</label>
                  <input
                    type="text"
                    value={selfProfession}
                    onChange={(e) => setSelfProfession(e.target.value)}
                    placeholder="e.g. Founder & Managing Director, Agency Owner"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={fieldLabelStyle}>What is your business or organization called?</label>
                  <input
                    type="text"
                    value={selfBusinessName}
                    onChange={(e) => setSelfBusinessName(e.target.value)}
                    placeholder="e.g. Apex Digital Ventures"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>What industry are you in?</label>
                    <input
                      type="text"
                      value={selfIndustry}
                      onChange={(e) => setSelfIndustry(e.target.value)}
                      placeholder="e.g. Information Technology"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>What is your role?</label>
                    <input
                      type="text"
                      value={selfRole}
                      onChange={(e) => setSelfRole(e.target.value)}
                      placeholder="e.g. Lead Consultant, CEO"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={fieldLabelStyle}>Tell us about your work.</label>
                  <textarea
                    rows="3"
                    value={selfSummary}
                    onChange={(e) => setSelfSummary(e.target.value)}
                    placeholder="Share what your business accomplishes and who you serve..."
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ---------------- OTHER BRANCH ---------------- */}
            {professionType === 'other' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e3860', margin: 0 }}>
                  ➕ Custom Profession
                </h3>

                <div>
                  <label style={fieldLabelStyle}>What do you do? *</label>
                  <input
                    type="text"
                    value={customProfession}
                    onChange={(e) => setCustomProfession(e.target.value)}
                    placeholder="e.g. Creative Artist, Researcher, Community Organizer"
                    style={{
                      ...inputStyle,
                      borderColor: errors.customProfession ? '#dc2626' : '#cbd5e1'
                    }}
                  />
                  {errors.customProfession && <div style={errorTextStyle}>{errors.customProfession}</div>}
                </div>

                <div>
                  <label style={fieldLabelStyle}>Tell us a little about what you do.</label>
                  <textarea
                    rows="3"
                    value={otherAbout}
                    onChange={(e) => setOtherAbout(e.target.value)}
                    placeholder="Share details about your day-to-day focus..."
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: SKILLS & EXPERTISE                                    */}
        {/* ============================================================ */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <h2 style={questionHeadingStyle}>What are you good at?</h2>
              <p style={helperTextStyle}>
                Add your skills across core areas. Search or select from the list, or add your own.
              </p>
            </div>

            {/* 1. Technical Skills */}
            <SkillMultiSelect
              label="What technical skills do you have?"
              helper="Multi-select"
              options={SKILL_OPTIONS.technical_skills}
              selected={technicalSkills}
              onChange={setTechnicalSkills}
              placeholder="Select technical skills"
              id="wizard-technical-skills"
            />

            {/* 2. Soft Skills */}
            <SkillMultiSelect
              label="What are your strongest soft skills?"
              helper="Multi-select"
              options={SKILL_OPTIONS.soft_skills}
              selected={softSkills}
              onChange={setSoftSkills}
              placeholder="Select soft skills"
              id="wizard-soft-skills"
            />

            {/* 3. Programming Languages */}
            <SkillMultiSelect
              label="Which programming languages do you know?"
              helper="Multi-select"
              options={SKILL_OPTIONS.programming_languages}
              selected={programmingLanguages}
              onChange={setProgrammingLanguages}
              placeholder="Select programming languages"
              id="wizard-programming-languages"
            />

            {/* 4. Tools */}
            <SkillMultiSelect
              label="Which tools do you use?"
              helper="Multi-select"
              options={SKILL_OPTIONS.tools}
              selected={tools}
              onChange={setTools}
              placeholder="Select tools"
              id="wizard-tools"
            />

            {/* 5. Technologies */}
            <SkillMultiSelect
              label="Which technologies are you familiar with?"
              helper="Multi-select"
              options={SKILL_OPTIONS.technologies}
              selected={technologies}
              onChange={setTechnologies}
              placeholder="Select technologies"
              id="wizard-technologies"
            />

            {/* 6. Areas of Expertise */}
            <SkillMultiSelect
              label="What areas are you most interested or experienced in?"
              helper="Multi-select"
              options={SKILL_OPTIONS.areas_of_expertise}
              selected={areasOfExpertise}
              onChange={setAreasOfExpertise}
              placeholder="Select areas of expertise"
              id="wizard-areas-of-expertise"
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: PORTFOLIO & LINKS                                     */}
        {/* ============================================================ */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={questionHeadingStyle}>Where can people learn more about your work?</h2>
              <p style={helperTextStyle}>All links are optional. Only valid URLs will be displayed on your profile.</p>
            </div>

            {/* Portfolio */}
            <div>
              <label style={fieldLabelStyle}>Portfolio Website</label>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => {
                  setPortfolioUrl(e.target.value);
                  if (errors.portfolioUrl) setErrors((prev) => ({ ...prev, portfolioUrl: null }));
                }}
                placeholder="https://yourportfolio.com"
                style={{
                  ...inputStyle,
                  borderColor: errors.portfolioUrl ? '#ef4444' : '#cbd5e1'
                }}
              />
              {errors.portfolioUrl && (
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontWeight: '600' }}>
                  {errors.portfolioUrl}
                </div>
              )}
            </div>

            {/* GitHub */}
            <div>
              <label style={fieldLabelStyle}>GitHub Profile</label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => {
                  setGithubUrl(e.target.value);
                  if (errors.githubUrl) setErrors((prev) => ({ ...prev, githubUrl: null }));
                }}
                placeholder="https://github.com/username"
                style={{
                  ...inputStyle,
                  borderColor: errors.githubUrl ? '#ef4444' : '#cbd5e1'
                }}
              />
              {errors.githubUrl && (
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontWeight: '600' }}>
                  {errors.githubUrl}
                </div>
              )}
            </div>

            {/* LinkedIn */}
            <div>
              <label style={fieldLabelStyle}>LinkedIn Profile</label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => {
                  setLinkedinUrl(e.target.value);
                  if (errors.linkedinUrl) setErrors((prev) => ({ ...prev, linkedinUrl: null }));
                }}
                placeholder="https://linkedin.com/in/username"
                style={{
                  ...inputStyle,
                  borderColor: errors.linkedinUrl ? '#ef4444' : '#cbd5e1'
                }}
              />
              {errors.linkedinUrl && (
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontWeight: '600' }}>
                  {errors.linkedinUrl}
                </div>
              )}
            </div>

            {/* Other Links */}
            <div>
              <label style={fieldLabelStyle}>Other Links (e.g. Behance, Medium, Dribbble)</label>
              {otherLinks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  {otherLinks.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px'
                      }}
                    >
                      <div>
                        <strong>{item.title}: </strong>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                          {item.url}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOtherLinks(otherLinks.filter((_, i) => i !== index))}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Platform / Label (e.g. Behance)"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: '130px' }}
                />
                <input
                  type="url"
                  placeholder="https://behance.net/..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  style={{ ...inputStyle, flex: 2, minWidth: '180px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newLinkTitle.trim() && newLinkUrl.trim()) {
                      let formatted = newLinkUrl.trim();
                      if (!/^https?:\/\//i.test(formatted)) formatted = `https://${formatted}`;
                      setOtherLinks([...otherLinks, { title: newLinkTitle.trim(), url: formatted }]);
                      setNewLinkTitle('');
                      setNewLinkUrl('');
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    color: '#1e40af',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  + Add Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 6: PREFERENCES                                          */}
        {/* ============================================================ */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <h2 style={questionHeadingStyle}>What kind of work environment do you prefer?</h2>
              <p style={helperTextStyle}>These preferences help match you with relevant teams and collaborators.</p>
            </div>

            {/* Preferred Work Location */}
            <div>
              <label style={fieldLabelStyle}>Preferred Work Location</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {['Remote', 'Hybrid', 'On-site', 'No preference'].map((loc) => {
                  const isSelected = preferredWorkLocation.includes(loc);
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        if (loc === 'No preference') {
                          setPreferredWorkLocation(['No preference']);
                        } else {
                          const cleaned = preferredWorkLocation.filter((l) => l !== 'No preference');
                          if (isSelected) {
                            setPreferredWorkLocation(cleaned.filter((l) => l !== loc));
                          } else {
                            setPreferredWorkLocation([...cleaned, loc]);
                          }
                        }
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: isSelected ? '#2563eb' : '#cbd5e1',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        color: isSelected ? '#1e40af' : '#334155',
                        fontWeight: '700',
                        fontSize: '13.5px',
                        cursor: 'pointer'
                      }}
                    >
                      {isSelected ? `✓ ${loc}` : loc}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferred Role Types */}
            <div>
              <label style={fieldLabelStyle}>Preferred Role Types (Optional)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'].map((role) => {
                  const isSelected = preferredRoleTypes.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setPreferredRoleTypes(preferredRoleTypes.filter((r) => r !== role));
                        } else {
                          setPreferredRoleTypes([...preferredRoleTypes, role]);
                        }
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid',
                        borderColor: isSelected ? '#2563eb' : '#cbd5e1',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        color: isSelected ? '#1e40af' : '#475569',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {isSelected ? `✓ ${role}` : role}
                    </button>
                  );
                })}
              </div>
            </div>

            <SkillTagInput
              label="Preferred Industries (Optional)"
              helper="Industries you are interested in exploring"
              tags={preferredIndustries}
              onTagsChange={setPreferredIndustries}
              placeholder="e.g. Artificial Intelligence, ClimateTech, Fintech..."
              suggestions={['FinTech', 'Artificial Intelligence', 'HealthTech', 'Education', 'Gaming', 'E-Commerce']}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 7: PRIVACY SETTINGS                                     */}
        {/* ============================================================ */}
        {currentStep === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <h2 style={questionHeadingStyle}>What would you like other people to see?</h2>
              <p style={helperTextStyle}>You are in complete control of your privacy and visibility on SINC Platform.</p>
            </div>

            {/* 1. Profile Visibility */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <label style={fieldLabelStyle}>Who can view your profile?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {[
                  { id: 'everyone', title: 'Everyone', desc: 'Anyone on the web and platform can view your public profile' },
                  { id: 'verified_profile', title: 'Verified Profile', desc: 'Only profiles verified by SINC Platform' },
                  { id: 'followers_only', title: 'Followers Only', desc: 'Only users you have accepted as followers' }
                ].map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: privacySettings.profile_visibility === opt.id ? '#eff6ff' : '#ffffff',
                      border: '1.5px solid',
                      borderColor: privacySettings.profile_visibility === opt.id ? '#2563eb' : '#e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="profile_visibility"
                      checked={privacySettings.profile_visibility === opt.id}
                      onChange={() => setPrivacySettings((p) => ({ ...p, profile_visibility: opt.id }))}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e3860' }}>{opt.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Granular Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1e3860', margin: 0 }}>
                Field Visibility Controls
              </h3>

              {[
                {
                  key: 'dob_visibility',
                  label: 'Date of Birth / Derived Age',
                  helper: 'Show your derived age to others'
                },
                {
                  key: 'gender_visibility',
                  label: 'Gender Identity',
                  helper: 'Show your gender identity on profile'
                },
                {
                  key: 'location_visibility',
                  label: 'City & State Location',
                  helper: 'Exact GPS and street address are always private'
                }
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e3860' }}>{item.label}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>{item.helper}</div>
                  </div>

                  <select
                    value={privacySettings[item.key]}
                    onChange={(e) =>
                      setPrivacySettings((prev) => ({ ...prev, [item.key]: e.target.value }))
                    }
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      backgroundColor: '#f8fafc',
                      color: '#1e3860',
                      fontWeight: '600'
                    }}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 8: DOMAIN SELECTION                                     */}
        {/* ============================================================ */}
        {currentStep === 8 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={questionHeadingStyle}>Which domains are you part of?</h2>
              <p style={helperTextStyle}>
                Select the communities you want in your Domains Menu and group conversations. Only domains you join will be active.
              </p>
            </div>

            {/* Domain Search */}
            <input
              type="text"
              placeholder="🔍 Search domains (e.g. Technology, AI, Design)..."
              value={domainSearch}
              onChange={(e) => setDomainSearch(e.target.value)}
              style={inputStyle}
            />

            {/* Domains Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
              {AVAILABLE_DOMAINS.filter((d) =>
                d.name.toLowerCase().includes(domainSearch.toLowerCase())
              ).map((d) => {
                const isSelected = selectedDomains.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedDomains(selectedDomains.filter((id) => id !== d.id));
                      } else {
                        setSelectedDomains([...selectedDomains, d.id]);
                      }
                      if (errors.domains) setErrors((prev) => ({ ...prev, domains: null }));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '2px solid',
                      borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      color: isSelected ? '#1e40af' : '#334155',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{d.name}</span>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#2563eb' : '#e2e8f0',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}
                    >
                      {isSelected ? '✓' : '+'}
                    </span>
                  </button>
                );
              })}
            </div>

            {errors.domains && <div style={errorTextStyle}>{errors.domains}</div>}

            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              Selected ({selectedDomains.length}):{' '}
              {selectedDomains
                .map((id) => AVAILABLE_DOMAINS.find((d) => d.id === id)?.name || id)
                .join(', ') || 'None'}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 9: REVIEW PROFILE                                       */}
        {/* ============================================================ */}
        {currentStep === 9 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <h2 style={questionHeadingStyle}>Review your profile</h2>
              <p style={helperTextStyle}>
                Take a look at your information before completing. Click <strong>Edit</strong> on any section to adjust details.
              </p>
            </div>

            {/* Review Section 1: Basic Info */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    1. Basic Information
                  </span>
                  {completedSteps.includes(1) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(1)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div
                    title="Profile Avatar"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      fontWeight: '800',
                      fontSize: '18px',
                      color: '#1e3860',
                      border: '2px solid #b5d2fd'
                    }}
                  >
                    {avatarUrl ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (firstName[0] || 'U')}
                  </div>
                  <div
                    title={professionalPhotoUrl ? "Professional Photo" : (avatarUrl ? "Professional Photo (Falling back to Profile Photo)" : "Professional Photo (Default)")}
                    style={{
                      width: '42px',
                      height: '52px',
                      borderRadius: '10px',
                      backgroundColor: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      fontWeight: '800',
                      fontSize: '14px',
                      color: '#1e3860',
                      border: '2px solid #b5d2fd'
                    }}
                  >
                    {(professionalPhotoUrl || avatarUrl) ? (
                      <img src={professionalPhotoUrl || avatarUrl} alt="Professional" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span>{(firstName[0] || 'U')}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e3860' }}>
                    {firstName} {lastName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>@{username}</div>
                  {derivedAge !== null && (
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      Age: {derivedAge} • Gender: {gender}
                    </div>
                  )}
                  {bio && <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#334155' }}>"{bio}"</p>}
                  {languages.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Languages: {languages.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Review Section 2: Location */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    2. Location
                  </span>
                  {completedSteps.includes(2) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(2)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              <div style={{ fontSize: '14px', color: '#1e3860', fontWeight: '600' }}>
                📍 {locationData.city || 'City'}, {locationData.state || 'State'} ({locationData.country || 'India'})
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                PIN: {locationData.pincode || 'N/A'} • Area: {locationData.area || 'N/A'}
              </div>
            </div>

            {/* Review Section 3: Profession */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    3. Profession ({professionType.toUpperCase()})
                  </span>
                  {completedSteps.includes(3) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(3)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              {professionType === 'student' && (
                <div style={{ fontSize: '13.5px', color: '#334155' }}>
                  <strong>{studentCourse}</strong> at <strong>{studentInstitution}</strong> (Graduating {studentGradYear})
                </div>
              )}
              {professionType === 'employee' && (
                <div style={{ fontSize: '13.5px', color: '#334155' }}>
                  <strong>{employeeJobTitle}</strong> at <strong>{employeeCompany}</strong> ({employeeEmploymentType}, {employeeWorkLocation})
                </div>
              )}
              {professionType === 'freelancer' && (
                <div style={{ fontSize: '13.5px', color: '#334155' }}>
                  <strong>{freelancerTitle}</strong> ({freelancerWorkLocation})
                  {freelancerServices.length > 0 && <div>Services: {freelancerServices.join(', ')}</div>}
                </div>
              )}
              {professionType === 'self_employed' && (
                <div style={{ fontSize: '13.5px', color: '#334155' }}>
                  <strong>{selfRole || selfProfession}</strong> at <strong>{selfBusinessName || 'Independent'}</strong>
                </div>
              )}
              {professionType === 'other' && (
                <div style={{ fontSize: '13.5px', color: '#334155' }}>
                  <strong>{customProfession}</strong>
                </div>
              )}
            </div>

            {/* Review Section 4: Skills */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    4. Skills & Expertise
                  </span>
                  {completedSteps.includes(4) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(4)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[...technicalSkills, ...programmingLanguages, ...tools, ...technologies, ...softSkills, ...areasOfExpertise].slice(0, 10).map((s, i) => (
                  <span key={i} style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: '600' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Review Section 5: Portfolio & Links */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    5. Portfolio & Links
                  </span>
                  {completedSteps.includes(5) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(5)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {portfolioUrl && <div>🌐 Portfolio: {portfolioUrl}</div>}
                {githubUrl && <div>🐙 GitHub: {githubUrl}</div>}
                {linkedinUrl && <div>💼 LinkedIn: {linkedinUrl}</div>}
                {!portfolioUrl && !githubUrl && !linkedinUrl && otherLinks.length === 0 && (
                  <span style={{ color: '#94a3b8' }}>None provided (Optional)</span>
                )}
              </div>
            </div>

            {/* Review Section 6: Preferences */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    6. Work Preferences
                  </span>
                  {completedSteps.includes(6) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(6)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#334155' }}>
                Location: <strong>{preferredWorkLocation.join(', ') || 'Any'}</strong> • Roles: <strong>{preferredRoleTypes.join(', ') || 'Any'}</strong>
              </div>
            </div>

            {/* Review Section 7: Privacy */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    7. Privacy & Visibility
                  </span>
                  {completedSteps.includes(7) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(7)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              <div style={{ fontSize: '12.5px', color: '#475569' }}>
                Profile visibility: <strong>{privacySettings.profile_visibility}</strong> • DOB visibility: <strong>{privacySettings.dob_visibility}</strong>
              </div>
            </div>

            {/* Review Section 8: Domains */}
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                    8. Domains & Communities
                  </span>
                  {completedSteps.includes(8) ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                      Saved ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      Not completed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditSection(8)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedDomains.map((id) => (
                  <span key={id} style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '12px', fontWeight: '700' }}>
                    {AVAILABLE_DOMAINS.find((d) => d.id === id)?.name || id}
                  </span>
                ))}
              </div>
            </div>

            {errors.submit && <div style={errorTextStyle}>{errors.submit}</div>}
          </div>
        )}

        </div>

        {/* ============================================================ */}
        {/* ACTION BUTTONS (BACK, SAVE, SAVE & CONTINUE, COMPLETE)        */}
        {/* ============================================================ */}
        <div
          className="wizard-action-footer"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1.5px solid #e2e8f0',
            paddingTop: '16px',
            marginTop: 'auto',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            disabled={isSaving || isStepSaving}
            style={{
              padding: '11px 22px',
              borderRadius: '12px',
              backgroundColor: '#f1f5f9',
              border: '1.5px solid #cbd5e1',
              color: '#334155',
              fontWeight: '700',
              fontSize: '14px',
              cursor: (isSaving || isStepSaving) ? 'not-allowed' : 'pointer'
            }}
          >
            ← {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < 9 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {saveSuccessMessage && (
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: saveSuccessMessage.includes('⚠️') ? '#b45309' : '#16a34a',
                    backgroundColor: saveSuccessMessage.includes('⚠️') ? '#fef3c7' : '#dcfce7',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${saveSuccessMessage.includes('⚠️') ? '#fde68a' : '#bbf7d0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {saveSuccessMessage}
                </span>
              )}
              {errors.stepSave && (
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#dc2626' }}>
                  {errors.stepSave}
                </span>
              )}

              {/* Skip button for optional steps */}
              {currentStep > 1 && currentStep < 9 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isStepSaving || isSaving}
                  style={{
                    padding: '11px 18px',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    color: '#64748b',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: (isStepSaving || isSaving) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Skip →
                </button>
              )}

              {/* Independent Save Button (saves current step, stays on current step) */}
              <button
                type="button"
                onClick={() => handleSaveStep(false)}
                disabled={isStepSaving || isSaving}
                style={{
                  padding: '11px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #2563eb',
                  color: '#2563eb',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: (isStepSaving || isSaving) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {isStepSaving && savingAction === 'save' ? 'Saving...' : 'Save'}
              </button>

              {/* Save & Continue Button (saves current step, then advances to next) */}
              <button
                type="button"
                onClick={() => handleSaveStep(true)}
                disabled={isStepSaving || isSaving}
                style={{
                  padding: '11px 24px',
                  borderRadius: '12px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: (isStepSaving || isSaving) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isStepSaving && savingAction === 'continue' ? 'Saving...' : 'Save & Continue →'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCompleteProfile}
              disabled={isSaving}
              style={{
                padding: '12px 30px',
                borderRadius: '12px',
                backgroundColor: '#16a34a',
                border: 'none',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '14.5px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSaving ? 'Completing Profile...' : 'Complete Profile ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
