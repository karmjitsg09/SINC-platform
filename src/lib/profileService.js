import { supabase, isSupabaseConfigured } from './supabase';

const profileListeners = new Set();
export const notifyProfileListeners = () => {
  profileListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Profile listener error:', e);
    }
  });
};

export const subscribeToProfileState = (fn) => {
  profileListeners.add(fn);
  return () => profileListeners.delete(fn);
};

// Local storage key helper
const getStorageKey = (userId) => `sync_profile_ext_${userId}`;

// ============================================================
// 1. GET DATABASE-BACKED PROFILE STATS (FOLLOWERS, FOLLOWING, POSTS)
// ============================================================
export const getProfileStats = async (userId) => {
  if (!userId) {
    return { followersCount: 0, followingCount: 0, postsCount: 0 };
  }

  let followersCount = 0;
  let followingCount = 0;
  let postsCount = 0;

  if (isSupabaseConfigured) {
    try {
      // Followers count (people who follow this profile)
      const { count: fCount, error: fErr } = await supabase
        .from('follow_requests')
        .select('id', { count: 'exact', head: true })
        .eq('following_user_id', userId)
        .eq('status', 'accepted');

      if (!fErr && typeof fCount === 'number') {
        followersCount = fCount;
      }

      // Following count (people this profile follows)
      const { count: fgCount, error: fgErr } = await supabase
        .from('follow_requests')
        .select('id', { count: 'exact', head: true })
        .eq('follower_user_id', userId)
        .eq('status', 'accepted');

      if (!fgErr && typeof fgCount === 'number') {
        followingCount = fgCount;
      }

      // Posts count
      const { count: pCount, error: pErr } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!pErr && typeof pCount === 'number') {
        postsCount = pCount;
      }
    } catch (err) {
      console.error('[ProfileService] getProfileStats error:', err);
    }
  }

  return { followersCount, followingCount, postsCount };
};

// ============================================================
// 2. GET FOLLOWERS LIST (REAL DATABASE PROFILES)
// ============================================================
export const getProfileFollowers = async (userId) => {
  if (!userId || !isSupabaseConfigured) return [];

  try {
    const { data: requests, error } = await supabase
      .from('follow_requests')
      .select('follower_user_id')
      .eq('following_user_id', userId)
      .eq('status', 'accepted');

    if (error || !requests || requests.length === 0) return [];

    const followerIds = requests.map((r) => r.follower_user_id).filter(Boolean);
    if (followerIds.length === 0) return [];

    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, username, role, avatar_url, bio')
      .in('id', followerIds);

    if (!pErr && profiles) {
      return profiles.map((p) => ({
        id: p.id,
        name: p.name || 'User',
        username: p.username || 'user',
        role: p.role || 'Member',
        avatarUrl: p.avatar_url || null,
        avatar_url: p.avatar_url || null,
        bio: p.bio || ''
      }));
    }
  } catch (err) {
    console.error('[ProfileService] getProfileFollowers error:', err);
  }

  return [];
};

// ============================================================
// 3. GET FOLLOWING LIST (REAL DATABASE PROFILES)
// ============================================================
export const getProfileFollowing = async (userId) => {
  if (!userId || !isSupabaseConfigured) return [];

  try {
    const { data: requests, error } = await supabase
      .from('follow_requests')
      .select('following_user_id')
      .eq('follower_user_id', userId)
      .eq('status', 'accepted');

    if (error || !requests || requests.length === 0) return [];

    const followingIds = requests.map((r) => r.following_user_id).filter(Boolean);
    if (followingIds.length === 0) return [];

    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, username, role, avatar_url, bio')
      .in('id', followingIds);

    if (!pErr && profiles) {
      return profiles.map((p) => ({
        id: p.id,
        name: p.name || 'User',
        username: p.username || 'user',
        role: p.role || 'Member',
        avatarUrl: p.avatar_url || null,
        avatar_url: p.avatar_url || null,
        bio: p.bio || ''
      }));
    }
  } catch (err) {
    console.error('[ProfileService] getProfileFollowing error:', err);
  }

  return [];
};

// ============================================================
// 4. GET PROFESSIONAL PROFILE SECTIONS (PROJECTS, EXPERIENCE, ETC.)
// ============================================================
export const getProfileSections = async (userId) => {
  const defaultSections = {
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    achievements: []
  };

  if (!userId) return defaultSections;

  let loadedData = { ...defaultSections };

  // A) Attempt to read from Supabase dedicated tables
  if (isSupabaseConfigured) {
    try {
      const [projRes, expRes, eduRes, certRes, achRes] = await Promise.all([
        supabase.from('profile_projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_experience').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_education').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_certifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_achievements').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);

      if (!projRes.error && Array.isArray(projRes.data) && projRes.data.length > 0) {
        loadedData.projects = projRes.data;
      }
      if (!expRes.error && Array.isArray(expRes.data) && expRes.data.length > 0) {
        loadedData.experience = expRes.data;
      }
      if (!eduRes.error && Array.isArray(eduRes.data) && eduRes.data.length > 0) {
        loadedData.education = eduRes.data;
      }
      if (!certRes.error && Array.isArray(certRes.data) && certRes.data.length > 0) {
        loadedData.certifications = certRes.data;
      }
      if (!achRes.error && Array.isArray(achRes.data) && achRes.data.length > 0) {
        loadedData.achievements = achRes.data;
      }
    } catch (e) {
      // Tables may not be migrated yet; fallback seamlessly
    }
  }

  // B) Fallback and merge with persistent local storage cache
  try {
    const rawLocal = localStorage.getItem(getStorageKey(userId));
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed.projects) && loadedData.projects.length === 0) {
        loadedData.projects = parsed.projects;
      }
      if (Array.isArray(parsed.experience) && loadedData.experience.length === 0) {
        loadedData.experience = parsed.experience;
      }
      if (Array.isArray(parsed.education) && loadedData.education.length === 0) {
        loadedData.education = parsed.education;
      }
      if (Array.isArray(parsed.certifications) && loadedData.certifications.length === 0) {
        loadedData.certifications = parsed.certifications;
      }
      if (Array.isArray(parsed.achievements) && loadedData.achievements.length === 0) {
        loadedData.achievements = parsed.achievements;
      }
    }
  } catch (e) {
    console.warn('[ProfileService] Local storage fallback read notice:', e);
  }

  return loadedData;
};

// ============================================================
// 5. SAVE PROFESSIONAL PROFILE SECTIONS (DUAL PERSISTENCE)
// ============================================================
export const saveProfileSections = async (userId, sectionsData) => {
  if (!userId) return false;

  const payload = {
    projects: sectionsData.projects || [],
    experience: sectionsData.experience || [],
    education: sectionsData.education || [],
    certifications: sectionsData.certifications || [],
    achievements: sectionsData.achievements || []
  };

  // 1. Immediately update persistent localStorage cache
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(payload));
  } catch (e) {
    console.warn('[ProfileService] Local storage save error:', e);
  }

  // 2. Persist to Supabase dedicated tables if available
  if (isSupabaseConfigured) {
    try {
      // Clear and re-insert projects
      if (payload.projects) {
        await supabase.from('profile_projects').delete().eq('user_id', userId);
        if (payload.projects.length > 0) {
          const insertData = payload.projects.map((p) => ({
            user_id: userId,
            title: p.title || p.name || 'Untitled Project',
            description: p.description || '',
            technologies: Array.isArray(p.technologies) ? p.technologies : (p.technologies ? p.technologies.split(',').map((t) => t.trim()).filter(Boolean) : []),
            project_url: p.project_url || p.projectUrl || null,
            github_url: p.github_url || p.githubUrl || null,
            start_date: p.start_date || p.startDate || null,
            end_date: p.end_date || p.endDate || null,
            is_current: Boolean(p.is_current ?? p.isCurrent ?? false)
          }));
          await supabase.from('profile_projects').insert(insertData);
        }
      }

      // Clear and re-insert experience
      if (payload.experience) {
        await supabase.from('profile_experience').delete().eq('user_id', userId);
        if (payload.experience.length > 0) {
          const insertData = payload.experience.map((e) => ({
            user_id: userId,
            organization: e.organization || e.company || '',
            role: e.role || '',
            description: e.description || '',
            start_date: e.start_date || e.startDate || null,
            end_date: e.end_date || e.endDate || null,
            is_current: Boolean(e.is_current ?? e.isCurrent ?? false)
          }));
          await supabase.from('profile_experience').insert(insertData);
        }
      }

      // Clear and re-insert education
      if (payload.education) {
        await supabase.from('profile_education').delete().eq('user_id', userId);
        if (payload.education.length > 0) {
          const insertData = payload.education.map((e) => ({
            user_id: userId,
            institution: e.institution || e.school || '',
            degree: e.degree || '',
            field_of_study: e.field_of_study || e.fieldOfStudy || null,
            start_date: e.start_date || e.startDate || null,
            end_date: e.end_date || e.endDate || null,
            is_current: Boolean(e.is_current ?? e.isCurrent ?? false)
          }));
          await supabase.from('profile_education').insert(insertData);
        }
      }

      // Clear and re-insert certifications
      if (payload.certifications) {
        await supabase.from('profile_certifications').delete().eq('user_id', userId);
        if (payload.certifications.length > 0) {
          const insertData = payload.certifications.map((c) => ({
            user_id: userId,
            name: c.name || c.title || '',
            issuer: c.issuer || c.organization || '',
            issue_date: c.issue_date || c.issueDate || null,
            credential_id: c.credential_id || c.credentialId || null,
            credential_url: c.credential_url || c.credentialUrl || null
          }));
          await supabase.from('profile_certifications').insert(insertData);
        }
      }

      // Clear and re-insert achievements
      if (payload.achievements) {
        await supabase.from('profile_achievements').delete().eq('user_id', userId);
        if (payload.achievements.length > 0) {
          const insertData = payload.achievements.map((a) => ({
            user_id: userId,
            title: a.title || '',
            organization: a.organization || null,
            date: a.date || null,
            description: a.description || '',
            proof_url: a.proof_url || a.proofUrl || null
          }));
          await supabase.from('profile_achievements').insert(insertData);
        }
      }
    } catch (dbErr) {
      console.warn('[ProfileService] Database table persistence note:', dbErr);
    }
  }

  notifyProfileListeners();
  return true;
};

// ============================================================
// ============================================================
// 6. HELPER: DERIVED AGE CALCULATION
// ============================================================
export const calculateAge = (dobString) => {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

// ============================================================
// 7. CHECK USERNAME AVAILABILITY (REAL SUPABASE QUERY)
// ============================================================
export const checkUsernameAvailability = async (username, currentUserId = null) => {
  if (!username) return { available: false, error: 'Username is required' };
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  
  if (clean.length < 3) {
    return { available: false, error: 'Username must be at least 3 characters' };
  }
  if (!/^[a-z0-9_.-]+$/.test(clean)) {
    return { available: false, error: 'Username can only contain letters, numbers, underscores, dashes, and dots' };
  }

  if (!isSupabaseConfigured) {
    return { available: true };
  }

  try {
    let query = supabase
      .from('profiles')
      .select('id, username')
      .eq('username', clean);

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[ProfileService] Username check error:', error);
      return { available: true };
    }

    if (data && data.length > 0) {
      return { available: false, error: 'Username already taken' };
    }

    return { available: true };
  } catch (err) {
    console.error('[ProfileService] checkUsernameAvailability error:', err);
    return { available: true };
  }
};

// ============================================================
// 8. USER DOMAIN MEMBERSHIPS (user_domains table)
// ============================================================
export const getUserDomainMemberships = async (userId) => {
  if (!userId) return [];
  
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('user_domains')
        .select('domain_id')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        return data.map((d) => d.domain_id);
      }
    } catch (err) {
      console.warn('[ProfileService] user_domains fetch error:', err);
    }
  }

  // Fallback to localStorage or profile.domains
  try {
    const raw = localStorage.getItem(`sync_user_domains_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return [];
};

export const setUserDomainMemberships = async (userId, domainIds = []) => {
  if (!userId) return false;
  const uniqueDomainIds = Array.from(new Set((domainIds || []).filter(Boolean)));

  try {
    localStorage.setItem(`sync_user_domains_${userId}`, JSON.stringify(uniqueDomainIds));
  } catch (e) {}

  if (isSupabaseConfigured) {
    try {
      // 1. Update profiles.domains array directly (authoritative source)
      await supabase
        .from('profiles')
        .update({ domains: uniqueDomainIds, updated_at: new Date().toISOString() })
        .eq('id', userId);

      // 2. Safely sync to user_domains table if it exists
      try {
        await supabase.from('user_domains').delete().eq('user_id', userId);
        if (uniqueDomainIds.length > 0) {
          const rows = uniqueDomainIds.map((domain_id) => ({
            user_id: userId,
            domain_id: domain_id
          }));
          await supabase.from('user_domains').insert(rows);
        }
      } catch (tableErr) {
        // user_domains table is optional
      }
    } catch (err) {
      console.warn('[ProfileService] setUserDomainMemberships note:', err);
    }
  }

  notifyProfileListeners();
  return true;
};

// ============================================================
// 9. UPDATE PROFILE (WITH QUESTION-BASED ONBOARDING FIELDS)
// ============================================================
export const updateBasicProfile = async (userId, profileData) => {
  if (!userId) return null;

  // Persist structured wizard cache locally
  try {
    localStorage.setItem(`sync_profile_wizard_${userId}`, JSON.stringify(profileData));
  } catch (e) {}

  // Persist location cache locally
  if (profileData.locationData || profileData.location) {
    try {
      const locPayload = profileData.locationData || {
        displayLocation: profileData.location,
        placeName: profileData.location_place_name,
        address: profileData.location_address,
        area: profileData.location_area,
        landmark: profileData.location_landmark,
        city: profileData.location_city,
        state: profileData.location_state,
        country: profileData.location_country,
        pincode: profileData.location_pincode,
        latitude: profileData.location_latitude,
        longitude: profileData.location_longitude
      };
      localStorage.setItem(`sync_profile_location_${userId}`, JSON.stringify(locPayload));
    } catch (e) {}
  }

  // Update domain memberships if provided
  if (profileData.domains && Array.isArray(profileData.domains)) {
    await setUserDomainMemberships(userId, profileData.domains);
  }

  if (isSupabaseConfigured) {
    try {
      const baseUpdates = {};
      if (profileData.name !== undefined) baseUpdates.name = profileData.name;
      if (profileData.username !== undefined) baseUpdates.username = profileData.username;
      if (profileData.role !== undefined) baseUpdates.role = profileData.role;
      if (profileData.bio !== undefined) baseUpdates.bio = profileData.bio;
      if (profileData.avatarUrl !== undefined) baseUpdates.avatar_url = profileData.avatarUrl;
      if (profileData.avatar_url !== undefined) baseUpdates.avatar_url = profileData.avatar_url;
      if (profileData.skills !== undefined) baseUpdates.skills = profileData.skills;
      if (profileData.domains !== undefined) baseUpdates.domains = profileData.domains;
      baseUpdates.updated_at = new Date().toISOString();

      const fullUpdates = { ...baseUpdates };
      // Location fields
      if (profileData.location !== undefined) fullUpdates.location = profileData.location;
      if (profileData.location_place_name !== undefined) fullUpdates.location_place_name = profileData.location_place_name;
      if (profileData.location_address !== undefined) fullUpdates.location_address = profileData.location_address;
      if (profileData.location_area !== undefined) fullUpdates.location_area = profileData.location_area;
      if (profileData.location_landmark !== undefined) fullUpdates.location_landmark = profileData.location_landmark;
      if (profileData.location_city !== undefined) fullUpdates.location_city = profileData.location_city;
      if (profileData.location_state !== undefined) fullUpdates.location_state = profileData.location_state;
      if (profileData.location_country !== undefined) fullUpdates.location_country = profileData.location_country;
      if (profileData.location_pincode !== undefined) fullUpdates.location_pincode = profileData.location_pincode;
      if (profileData.location_latitude !== undefined) fullUpdates.location_latitude = profileData.location_latitude;
      if (profileData.location_longitude !== undefined) fullUpdates.location_longitude = profileData.location_longitude;

      // Onboarding fields
      if (profileData.first_name !== undefined) fullUpdates.first_name = profileData.first_name;
      if (profileData.last_name !== undefined) fullUpdates.last_name = profileData.last_name;
      if (profileData.date_of_birth !== undefined) fullUpdates.date_of_birth = profileData.date_of_birth;
      if (profileData.gender !== undefined) fullUpdates.gender = profileData.gender;
      if (profileData.gender_custom !== undefined) fullUpdates.gender_custom = profileData.gender_custom;
      if (profileData.languages !== undefined) fullUpdates.languages = profileData.languages;
      if (profileData.profession_type !== undefined) fullUpdates.profession_type = profileData.profession_type;
      if (profileData.profession_details !== undefined) fullUpdates.profession_details = profileData.profession_details;
      if (profileData.skills_technical !== undefined) fullUpdates.skills_technical = profileData.skills_technical;
      if (profileData.skills_soft !== undefined) fullUpdates.skills_soft = profileData.skills_soft;
      if (profileData.skills_languages !== undefined) fullUpdates.skills_languages = profileData.skills_languages;
      if (profileData.skills_tools !== undefined) fullUpdates.skills_tools = profileData.skills_tools;
      if (profileData.skills_technologies !== undefined) fullUpdates.skills_technologies = profileData.skills_technologies;
      if (profileData.skills_expertise !== undefined) fullUpdates.skills_expertise = profileData.skills_expertise;
      if (profileData.portfolio_url !== undefined) fullUpdates.portfolio_url = profileData.portfolio_url;
      if (profileData.github_url !== undefined) fullUpdates.github_url = profileData.github_url;
      if (profileData.linkedin_url !== undefined) fullUpdates.linkedin_url = profileData.linkedin_url;
      if (profileData.other_links !== undefined) fullUpdates.other_links = profileData.other_links;
      if (profileData.preferred_work_location !== undefined) fullUpdates.preferred_work_location = profileData.preferred_work_location;
      if (profileData.preferences !== undefined) fullUpdates.preferences = profileData.preferences;
      if (profileData.privacy_settings !== undefined) fullUpdates.privacy_settings = profileData.privacy_settings;
      if (profileData.onboarding_completed !== undefined) fullUpdates.onboarding_completed = profileData.onboarding_completed;
      if (profileData.professional_photo_url !== undefined) fullUpdates.professional_photo_url = profileData.professional_photo_url;

      let { data, error } = await supabase
        .from('profiles')
        .update(fullUpdates)
        .eq('id', userId)
        .select()
        .single();

      // If missing column error occurs before migration is run, fallback to base updates
      if (
        error &&
        (error.code === '42703' ||
          error.code === 'PGRST204' ||
          error.message?.includes('column') ||
          error.message?.includes('schema cache'))
      ) {
        console.warn('[ProfileService] Some columns not in schema yet, saving base fields:', error.message);
        const fallbackRes = await supabase
          .from('profiles')
          .update(baseUpdates)
          .eq('id', userId)
          .select()
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (!error && data) {
        notifyProfileListeners();
        return data;
      }
    } catch (err) {
      console.error('[ProfileService] updateBasicProfile error:', err);
    }
  }

  notifyProfileListeners();
  return profileData;
};

// ============================================================
// 10. SAVE INDIVIDUAL WIZARD STEP
// ============================================================
export const saveStepProfile = async (userId, stepNumber, stepData) => {
  if (!userId || !stepData) return { success: false, error: 'Missing user ID or data' };

  // Cache to localStorage
  try {
    const existing = JSON.parse(localStorage.getItem(`sync_profile_wizard_${userId}`) || '{}');
    const merged = { ...existing, ...stepData };
    localStorage.setItem(`sync_profile_wizard_${userId}`, JSON.stringify(merged));
  } catch (e) {}

  // Handle domain memberships separately (Step 8)
  if (stepData.domains && Array.isArray(stepData.domains)) {
    await setUserDomainMemberships(userId, stepData.domains);
  }

  // Handle location cache (Step 2)
  if (stepData.locationData || stepData.location) {
    try {
      const locPayload = stepData.locationData || {
        displayLocation: stepData.location,
        placeName: stepData.location_place_name,
        address: stepData.location_address,
        area: stepData.location_area,
        landmark: stepData.location_landmark,
        city: stepData.location_city,
        state: stepData.location_state,
        country: stepData.location_country,
        pincode: stepData.location_pincode,
        latitude: stepData.location_latitude,
        longitude: stepData.location_longitude
      };
      localStorage.setItem(`sync_profile_location_${userId}`, JSON.stringify(locPayload));
    } catch (e) {}
  }

  if (!isSupabaseConfigured) {
    notifyProfileListeners();
    return { success: true, data: stepData };
  }

  try {
    // Build the update object from ONLY the fields in stepData
    const updates = {};
    const fieldMap = {
      first_name: 'first_name', last_name: 'last_name', name: 'name',
      username: 'username', role: 'role', bio: 'bio',
      avatar_url: 'avatar_url', avatarUrl: 'avatar_url',
      date_of_birth: 'date_of_birth', gender: 'gender', gender_custom: 'gender_custom',
      languages: 'languages', professional_photo_url: 'professional_photo_url',
      location: 'location', location_place_name: 'location_place_name',
      location_address: 'location_address', location_area: 'location_area',
      location_landmark: 'location_landmark', location_city: 'location_city',
      location_state: 'location_state', location_country: 'location_country',
      location_pincode: 'location_pincode', location_latitude: 'location_latitude',
      location_longitude: 'location_longitude',
      profession_type: 'profession_type', profession_details: 'profession_details',
      skills: 'skills', skills_technical: 'skills_technical', skills_soft: 'skills_soft',
      skills_languages: 'skills_languages', skills_tools: 'skills_tools',
      skills_technologies: 'skills_technologies', skills_expertise: 'skills_expertise',
      portfolio_url: 'portfolio_url', github_url: 'github_url',
      linkedin_url: 'linkedin_url', other_links: 'other_links',
      preferred_work_location: 'preferred_work_location', preferences: 'preferences',
      privacy_settings: 'privacy_settings', domains: 'domains',
      onboarding_completed: 'onboarding_completed'
    };

    for (const [srcKey, dbKey] of Object.entries(fieldMap)) {
      if (stepData[srcKey] !== undefined) {
        updates[dbKey] = stepData[srcKey];
      }
    }

    updates.updated_at = new Date().toISOString();

    // Fetch current completed steps safely
    let existingSteps = [];
    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      existingSteps = currentProfile?.profile_setup_completed_steps || [];
    } catch (e) {}

    const newSteps = Array.from(new Set([...existingSteps, stepNumber])).sort((a, b) => a - b);
    updates.profile_setup_completed_steps = newSteps;

    // Execute update with progressive omission of unmigrated schema columns
    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    let retries = 0;
    while (
      error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message?.includes('column') ||
        error.message?.includes('schema cache')) &&
      retries < 10
    ) {
      retries++;
      const match =
        error.message.match(/'([^']+)' column/i) ||
        error.message.match(/column "?([^"\s]+)"?/i);

      if (match && match[1] && updates[match[1]] !== undefined) {
        console.warn(`[ProfileService] Omitting missing column '${match[1]}' from Supabase update.`);
        delete updates[match[1]];
      } else {
        // Fallback: keep only existing base columns
        const baseAllowed = ['name', 'username', 'role', 'bio', 'avatar_url', 'skills', 'domains', 'updated_at'];
        for (const k of Object.keys(updates)) {
          if (!baseAllowed.includes(k)) {
            delete updates[k];
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        // All fields were new schema columns; successfully cached in localStorage
        notifyProfileListeners();
        return { success: true, data: stepData };
      }

      const retryRes = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error && Object.keys(updates).length > 0) {
      console.warn('[ProfileService] Supabase update warning, falling back to local cache:', error.message);
    }

    notifyProfileListeners();
    return { success: true, data: data || stepData };
  } catch (err) {
    console.error('[ProfileService] saveStepProfile exception:', err);
    // Even if remote DB throws network exception, local cache is saved
    notifyProfileListeners();
    return { success: true, data: stepData };
  }
};

// ============================================================
// 11. URL VALIDATION HELPER
// ============================================================
export const isValidUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') return true;
  const trimmed = urlString.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
};

// ============================================================
// 12. SUPABASE STORAGE UPLOAD FOR PROFILE & PROFESSIONAL PHOTOS
// ============================================================
export const uploadProfilePhoto = async (file, userId, photoType = 'avatar') => {
  if (!file || !userId) return null;

  const rawExt = file.name ? file.name.split('.').pop().toLowerCase() : 'jpg';
  const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
  const uniqueTag = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const folderName = photoType === 'professional' ? 'professional_photos' : 'avatars';
  const filePath = `${folderName}/${userId}/${uniqueTag}.${ext}`;

  if (isSupabaseConfigured) {
    const bucketsToTry = ['profile-photos', 'avatars', 'post-media'];
    const clientToUse = supabase;

    for (const bucket of bucketsToTry) {
      try {
        const { data, error } = await clientToUse.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (!error && data) {
          const { data: publicUrlData } = clientToUse.storage
            .from(bucket)
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            console.log(`[ProfileService] Photo uploaded successfully to bucket '${bucket}':`, publicUrlData.publicUrl);
            return publicUrlData.publicUrl;
          }
        }
      } catch (err) {
        console.warn(`[ProfileService] Bucket '${bucket}' upload attempt notice:`, err);
      }
    }
  }

  // Resilient fallback to persistent Data URL if storage bucket is not created or in mock mode
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};



